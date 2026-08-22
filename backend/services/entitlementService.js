/**
 * Entitlement Resolver — single source of truth for "what can this company use?"
 *
 * Model: 1 company = 1 user = 1 computer.
 *
 *   Effective Access = Entitlement (Plan — what was sold)
 *                  AND Configuration (CompanyModuleConfig — what is switched on)
 *
 * The Plan is the ceiling: a company can never switch on a module it did not buy.
 * There is no RBAC layer here — the single company user is always the owner.
 */
const Company = require('../models/Company');
const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');
const License = require('../models/License');
const CompanyModuleConfig = require('../models/CompanyModuleConfig');
const defaults = require('../config/defaultConfigs');
const logger = require('../utils/logger');

/** Modules the Plan schema can sell. Anything outside this set is not plan-gated. */
const PLAN_GATED_MODULES = [
  'sales', 'purchase', 'jobWork', 'inventory', 'accounting', 'gst', 'reports',
];

/**
 * Modules that exist in CompanyModuleConfig but have no Plan.features.modules key.
 * These ship with every plan — they are the shell of the product, not a paid add-on.
 * Without this list they would resolve to false for every company.
 */
const ALWAYS_ENTITLED_MODULES = ['masters', 'utilities'];

const ALL_MODULES = Object.keys(defaults.DEFAULT_MODULES);

const mapToObject = (mapVal) => {
  if (!mapVal) return {};
  if (mapVal instanceof Map) return Object.fromEntries(mapVal);
  if (typeof mapVal === 'object') return mapVal;
  return {};
};

const DAY_MS = 24 * 60 * 60 * 1000;
const daysBetween = (from, to) => Math.ceil((new Date(to) - new Date(from)) / DAY_MS);

/** null = uncapped. 0 and negatives are how an admin says "no limit". */
const uncappedOrNumber = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
};

/* ------------------------------------------------------------------ *
 * Cache — keyed by companyId, invalidated on config/plan/licence write.
 * ------------------------------------------------------------------ */
const CACHE_TTL_MS = 30 * 1000;
const cache = new Map();

const cacheGet = (companyId) => {
  const hit = cache.get(String(companyId));
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(String(companyId));
    return null;
  }
  return hit.value;
};

const cacheSet = (companyId, value) => {
  cache.set(String(companyId), { value, expiresAt: Date.now() + CACHE_TTL_MS });
};

/** Call after any Plan / Subscription / License / ModuleConfig write. */
const invalidate = (companyId) => {
  if (companyId) cache.delete(String(companyId));
  else cache.clear();
};

/* ------------------------------------------------------------------ *
 * Lifecycle status
 * ------------------------------------------------------------------ */

/**
 * Collapse company + subscription + licence into one lifecycle state.
 *
 *   suspended - admin locked the account            -> no access
 *   expired   - past subscription end + grace days  -> no access
 *   grace     - past end, still inside graceDays    -> read-only, warn hard
 *   trial     - running on the trial subscription   -> full access
 *   active    - paid and current                    -> full access
 */
function resolveStatus({ company, subscription, license }) {
  if (!company || company.isActive === false || company.status === 'suspended') {
    return { status: 'suspended', daysLeft: 0, reason: 'Account suspended by administrator' };
  }

  const now = new Date();
  const graceDays = license?.graceDays ?? 7;

  // Licence is the desktop-side gate; treat a missing/dead licence as expired.
  if (!license || license.isActive === false) {
    return { status: 'expired', daysLeft: 0, reason: 'No active licence for this company' };
  }

  const licenceEnd = license.expiresAt ? new Date(license.expiresAt) : null;
  const subEnd = subscription?.endDate ? new Date(subscription.endDate) : null;

  // The earlier of the two deadlines wins.
  const deadline = [licenceEnd, subEnd].filter(Boolean).sort((a, b) => a - b)[0];
  if (!deadline) {
    return { status: 'expired', daysLeft: 0, reason: 'No subscription or licence period set' };
  }

  if (now <= deadline) {
    const daysLeft = Math.max(0, daysBetween(now, deadline));
    const status = subscription?.status === 'trial' ? 'trial' : 'active';
    return { status, daysLeft, reason: '' };
  }

  const graceEnd = new Date(deadline.getTime() + graceDays * DAY_MS);
  if (now <= graceEnd) {
    return {
      status: 'grace',
      daysLeft: Math.max(0, daysBetween(now, graceEnd)),
      reason: 'Subscription expired — renew to avoid losing access',
    };
  }

  return { status: 'expired', daysLeft: 0, reason: 'Subscription and grace period have ended' };
}

/* ------------------------------------------------------------------ *
 * Module resolution
 * ------------------------------------------------------------------ */

/**
 * modules = plan AND config, per module key.
 *
 * A missing Plan is treated as "sells everything" rather than "sells nothing":
 * failing closed here would lock out every existing company the moment this
 * resolver goes live. Company status is what actually gates access.
 */
function resolveModules({ plan, moduleConfig }) {
  const planModules = plan?.features?.modules || null;
  const configModules = mapToObject(moduleConfig?.modules);

  const entitled = {};
  const enabled = {};
  const effective = {};

  for (const key of ALL_MODULES) {
    let isEntitled;
    if (ALWAYS_ENTITLED_MODULES.includes(key)) {
      isEntitled = true;
    } else if (!planModules) {
      isEntitled = true; // no plan attached -> do not lock the product
    } else if (!PLAN_GATED_MODULES.includes(key)) {
      isEntitled = true; // key the Plan schema cannot express
    } else {
      isEntitled = planModules[key] === true;
    }

    // Config default is ON: only an explicit false switches a module off.
    const isEnabled = configModules[key] !== false;

    entitled[key] = isEntitled;
    enabled[key] = isEnabled;
    effective[key] = isEntitled && isEnabled;
  }

  return { entitled, enabled, effective };
}

/** Sub-menus and field flags inherit their parent module entitlement. */
function resolveSubMenus({ moduleConfig, effectiveModules }) {
  const configSubMenus = mapToObject(moduleConfig?.subMenus);
  const out = {};

  for (const [moduleKey, items] of Object.entries(configSubMenus)) {
    const parentOn = effectiveModules[moduleKey] !== false;
    const resolved = {};
    for (const [label, on] of Object.entries(mapToObject(items))) {
      resolved[label] = parentOn && on !== false;
    }
    out[moduleKey] = resolved;
  }

  return out;
}

function resolveFields({ plan, moduleConfig, effectiveModules }) {
  const planFields = plan?.features?.fields || {};
  const configFields = mapToObject(moduleConfig?.fields);
  const out = {};

  for (const [moduleKey, fields] of Object.entries(configFields)) {
    const parentOn = effectiveModules[moduleKey] !== false;
    const planModuleFields = planFields[moduleKey] || null;
    const resolved = {};

    for (const [fieldKey, on] of Object.entries(mapToObject(fields))) {
      // A field is plan-gated only when the Plan actually declares it.
      const planAllows = !planModuleFields || !(fieldKey in planModuleFields)
        ? true
        : planModuleFields[fieldKey] === true;
      resolved[fieldKey] = parentOn && planAllows && on !== false;
    }

    out[moduleKey] = resolved;
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/**
 * Permissive shape used when resolution cannot complete.
 * A resolver outage must not lock every customer out of the product;
 * the existing company-status and subscription middleware still apply.
 */
function fallbackEntitlements(reason) {
  const allOn = Object.fromEntries(ALL_MODULES.map((k) => [k, true]));
  return {
    companyId: null,
    company: null,
    status: 'unknown',
    daysLeft: null,
    statusReason: reason,
    isUsable: true,
    isReadOnly: false,
    modules: allOn,
    entitledModules: allOn,
    enabledModules: allOn,
    subMenus: {},
    fields: {},
    plan: null,
    limits: { users: 1, invoicesPerMonth: null, storageMb: null },
    license: null,
    subscription: null,
    degraded: true,
    resolvedAt: new Date().toISOString(),
  };
}

/**
 * Resolve everything a company is allowed to do, right now.
 * Never throws for a normal miss — returns a safe, permissive shape and logs.
 */
async function resolve(companyId, { fresh = false } = {}) {
  if (!companyId) return fallbackEntitlements('No company context');

  if (!fresh) {
    const cached = cacheGet(companyId);
    if (cached) return cached;
  }

  try {
    const company = await Company.findById(companyId)
      .select('name status isActive planId licenseKey')
      .lean();

    if (!company) return fallbackEntitlements('Company not found');

    const [plan, subscription, license, moduleConfig] = await Promise.all([
      company.planId ? Plan.findById(company.planId).lean() : null,
      Subscription.findOne({ companyId }).sort({ createdAt: -1 }).lean(),
      License.findOne({ companyId, isActive: true }).sort({ createdAt: -1 }).lean(),
      CompanyModuleConfig.findOne({ companyId, isActive: true, deletedAt: null }).lean(),
    ]);

    const lifecycle = resolveStatus({ company, subscription, license });
    const { entitled, enabled, effective } = resolveModules({ plan, moduleConfig });
    const subMenus = resolveSubMenus({ moduleConfig, effectiveModules: effective });
    const fields = resolveFields({ plan, moduleConfig, effectiveModules: effective });

    const result = {
      companyId: String(companyId),
      company: { name: company.name, status: company.status },

      status: lifecycle.status,
      daysLeft: lifecycle.daysLeft,
      statusReason: lifecycle.reason,
      isUsable: ['active', 'trial', 'grace'].includes(lifecycle.status),
      isReadOnly: lifecycle.status === 'grace',

      modules: effective,
      entitledModules: entitled,   // what the plan sells  (upsell UI reads this)
      enabledModules: enabled,     // what config switches on
      subMenus,
      fields,

      plan: plan
        ? { id: String(plan._id), name: plan.name, limits: plan.limits || {} }
        : null,

      limits: {
        // 1 company = 1 user. Not plan-driven in this model.
        users: 1,
        // 0 (or unset) means unlimited. The Plan schema defaults these to
        // numbers, so an admin who leaves the field blank still gets a cap —
        // 0 is the only way to express "no cap" without a schema migration.
        invoicesPerMonth: uncappedOrNumber(plan?.limits?.invoicesPerMonth),
        storageMb: uncappedOrNumber(plan?.limits?.storageMb),
      },

      license: license
        ? {
            key: license.licenseKey,
            planTier: license.planTier,
            expiresAt: license.expiresAt,
            maxDevices: license.maxDevices ?? 1,
            graceDays: license.graceDays ?? 7,
            activeDevices: (license.devices || []).filter((d) => d.active).length,
          }
        : null,

      subscription: subscription
        ? {
            status: subscription.status,
            endDate: subscription.endDate,
            billingCycle: subscription.billingCycle,
          }
        : null,

      resolvedAt: new Date().toISOString(),
    };

    cacheSet(companyId, result);
    return result;
  } catch (err) {
    logger.error('Entitlement resolution failed', {
      companyId: String(companyId),
      error: err.message,
    });
    return fallbackEntitlements(`Resolution error: ${err.message}`);
  }
}

/** Single-module check used by the route gate. */
async function hasModule(companyId, moduleKey) {
  const ent = await resolve(companyId);
  return ent.modules[moduleKey] !== false;
}

module.exports = {
  resolve,
  hasModule,
  invalidate,
  ALL_MODULES,
  PLAN_GATED_MODULES,
  ALWAYS_ENTITLED_MODULES,
};
