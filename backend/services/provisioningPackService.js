'use strict';

/**
 * Secure desktop provisioning packs — Web Super Admin is the sole company source.
 * Pack contains identity/config only (no operational transactions, no plaintext passwords).
 */
const crypto = require('crypto');
const mongoose = require('mongoose');
const Company = require('../models/Company');
const User = require('../models/User');
const Plan = require('../models/Plan');
const License = require('../models/License');
const Subscription = require('../models/Subscription');
const CompanyModuleConfig = require('../models/CompanyModuleConfig');
const CompanySettings = require('../models/CompanySettings');
const PermissionMatrix = require('../models/PermissionMatrix');
const GstConfig = require('../models/GstConfig');
const AppError = require('../utils/AppError');
const { validateLicenseKey } = require('../utils/license');
const licensing = require('./licensingActivationService');

const PACK_VERSION = 1;

function hmacSecret() {
  const s = process.env.PROVISIONING_PACK_SECRET || process.env.JWT_SECRET || '';
  if (!s || s.length < 16) {
    throw new Error('PROVISIONING_PACK_SECRET or JWT_SECRET (>=16 chars) required to sign packs');
  }
  return s;
}

function canonicalPayload(payload) {
  // Stable stringify: sort top-level keys only (payload is controlled)
  const ordered = {};
  Object.keys(payload)
    .sort()
    .forEach((k) => {
      ordered[k] = payload[k];
    });
  return JSON.stringify(ordered);
}

function signPayload(payload) {
  return crypto.createHmac('sha256', hmacSecret()).update(canonicalPayload(payload)).digest('hex');
}

function verifySignature(pack) {
  if (!pack || !pack.payload || !pack.signature) {
    throw AppError.badRequest('Invalid pack: missing payload/signature');
  }
  const expected = signPayload(pack.payload);
  const a = Buffer.from(String(pack.signature), 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw AppError.forbidden('Pack signature invalid — tampered or wrong signing secret');
  }
  return true;
}

function packFingerprint(pack) {
  return crypto
    .createHash('sha256')
    .update(String(pack.signature || '') + '|' + String(pack.payload?.company?.id || ''))
    .digest('hex');
}

function stripUser(u) {
  if (!u) return null;
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    role: u.role,
    companyRole: u.companyRole,
    isActive: u.isActive !== false,
  };
}

/**
 * Build a signed provisioning pack for desktop activation (admin / cloud).
 */
async function buildProvisioningPack(companyId, { issuedBy } = {}) {
  if (!mongoose.Types.ObjectId.isValid(String(companyId))) {
    throw AppError.badRequest('Invalid company id');
  }

  const company = await Company.findById(companyId).lean();
  if (!company) throw AppError.notFound('Company not found');
  if (company.status === 'suspended' || company.isActive === false) {
    throw AppError.badRequest('Company is locked or inactive — unlock before generating a provisioning pack');
  }

  const [plan, subscription, license, owner, users, moduleConfig, settings, permissions, gstConfig] =
    await Promise.all([
      company.planId ? Plan.findById(company.planId).lean() : null,
      Subscription.findOne({ companyId }).sort({ createdAt: -1 }).lean(),
      License.findOne({ companyId, isActive: true }).sort({ createdAt: -1 }),
      company.ownerId ? User.findById(company.ownerId).select('name email role companyRole isActive').lean() : null,
      User.find({ companyId, role: 'user' }).select('name email role companyRole isActive').lean(),
      CompanyModuleConfig.findOne({ companyId }).lean(),
      CompanySettings.findOne({ companyId }).lean(),
      PermissionMatrix.findOne({ companyId }).lean(),
      GstConfig.findOne({ companyId }).lean(),
    ]);

  if (!license) {
    throw AppError.badRequest('No active license — generate a license before creating a provisioning pack');
  }
  if (new Date(license.expiresAt) < new Date()) {
    throw AppError.badRequest('License expired — renew the license before generating a provisioning pack');
  }

  // Ensure offline code exists (reuse existing licensing formula)
  let offlineCode = license.offlineCode;
  if (!offlineCode) {
    const generated = await licensing.generateOfflineCode(companyId, license.licenseKey);
    offlineCode = generated.offlineCode;
  }

  const ownerDoc = owner || users.find((u) => u.companyRole === 'owner') || users[0];
  if (!ownerDoc) {
    throw AppError.badRequest('Company has no owner/user to provision');
  }

  const payload = {
    packVersion: PACK_VERSION,
    issuedAt: new Date().toISOString(),
    issuedBy: issuedBy ? String(issuedBy) : null,
    company: {
      id: String(company._id),
      name: company.name,
      status: company.status || 'active',
      isActive: company.isActive !== false,
      planId: company.planId ? String(company.planId) : null,
      licenseKey: company.licenseKey || license.licenseKey,
      commercialPolicy: company.commercialPolicy || 'saas_enforced',
      ownerId: company.ownerId ? String(company.ownerId) : String(ownerDoc._id),
      meta: company.meta || {},
      settings: company.settings || {},
    },
    plan: plan
      ? {
          id: String(plan._id),
          name: plan.name,
          slug: plan.slug,
          priceMonthly: plan.priceMonthly,
          priceYearly: plan.priceYearly,
          trialDays: plan.trialDays,
          features: plan.features,
          limits: plan.limits,
        }
      : null,
    subscription: subscription
      ? {
          status: subscription.status,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          billingCycle: subscription.billingCycle,
          offlineModeEnabled: subscription.offlineModeEnabled !== false,
          planId: subscription.planId ? String(subscription.planId) : null,
        }
      : null,
    license: {
      licenseKey: license.licenseKey,
      expiresAt: license.expiresAt,
      checksum: license.checksum,
      isActive: license.isActive,
      planTier: license.planTier,
      maxDevices: license.maxDevices || 1,
      graceDays: license.graceDays || 7,
      activationMode: 'offline',
      offlineCode,
      antiTamperHash: license.antiTamperHash || '',
    },
    owner: stripUser(ownerDoc),
    users: users.map(stripUser).filter(Boolean),
    moduleConfig: moduleConfig
      ? {
          modules: moduleConfig.modules,
          subMenus: moduleConfig.subMenus,
          fields: moduleConfig.fields,
          version: moduleConfig.version,
        }
      : null,
    permissionMatrix: permissions
      ? { roles: permissions.roles, sections: permissions.sections }
      : null,
    settings: settings
      ? {
          legalName: settings.legalName,
          shortName: settings.shortName,
          gstin: settings.gstin,
          offlineModeEnabled: true,
          address: settings.address,
          city: settings.city,
          state: settings.state,
          stateCode: settings.stateCode,
          phone: settings.phone,
          email: settings.email,
          bankName: settings.bankName,
          bankAccount: settings.bankAccount,
          bankIfsc: settings.bankIfsc,
        }
      : { legalName: company.name, offlineModeEnabled: true },
    gstConfig: gstConfig
      ? {
          gstin: gstConfig.gstin,
          legalName: gstConfig.legalName,
          tradeName: gstConfig.tradeName,
          stateCode: gstConfig.stateCode,
          stateName: gstConfig.stateName,
          registrationType: gstConfig.registrationType,
          filingFrequency: gstConfig.filingFrequency,
        }
      : null,
  };

  const signature = signPayload(payload);
  const fingerprint = crypto
    .createHash('sha256')
    .update(signature + '|' + payload.company.id)
    .digest('hex');

  return {
    packVersion: PACK_VERSION,
    fingerprint,
    signature,
    payload,
  };
}

/**
 * Validate pack integrity + license identity (no DB writes).
 * Trust only signed payload — never client-supplied companyId/role outside pack.
 */
function validateProvisioningPack(pack) {
  verifySignature(pack);
  const p = pack.payload;
  if (!p || p.packVersion !== PACK_VERSION) {
    throw AppError.badRequest('Unsupported or missing pack version');
  }
  if (!p.company?.id || !p.company?.name) {
    throw AppError.badRequest('Pack missing company identity');
  }
  if (!p.owner?.email || !p.owner?.id) {
    throw AppError.badRequest('Pack missing owner identity');
  }
  if (!p.license?.licenseKey || !p.license?.offlineCode || !p.license?.expiresAt) {
    throw AppError.badRequest('Pack missing license / offline identity');
  }
  if (new Date(p.license.expiresAt) < new Date()) {
    throw AppError.forbidden('License in pack is expired');
  }
  if (p.license.isActive === false) {
    throw AppError.forbidden('License in pack is inactive');
  }

  // When the same JWT_SECRET as the issuer is available, enforce license/offline formulae.
  // Desktop builds primarily trust PROVISIONING_PACK_SECRET HMAC (already verified).
  const isDesktop = String(process.env.DESKTOP_LOCAL || '').toLowerCase() === 'true';
  if (!isDesktop || process.env.JWT_SECRET) {
    if (!validateLicenseKey(p.license.licenseKey, p.company.id)) {
      if (!isDesktop) {
        throw AppError.forbidden('License key does not match company identity');
      }
    } else {
      const expectedOffline = crypto
        .createHash('sha256')
        .update(`${p.license.licenseKey}:${p.company.id}:${process.env.JWT_SECRET || ''}`)
        .digest('hex')
        .substring(0, 12)
        .toUpperCase();
      if (String(p.license.offlineCode).toUpperCase() !== expectedOffline) {
        if (!isDesktop) {
          throw AppError.forbidden('Offline activation code invalid for this pack');
        }
      }
    }
  }

  return {
    ok: true,
    fingerprint: packFingerprint(pack),
    companyName: p.company.name,
    companyId: p.company.id,
    planName: p.plan?.name || null,
    licenseKey: p.license.licenseKey,
    expiresAt: p.license.expiresAt,
    ownerEmail: p.owner.email,
  };
}

async function upsertById(Model, id, doc) {
  const { _id, __v, createdAt, updatedAt, ...rest } = doc;
  await Model.updateOne({ _id: id }, { $set: { ...rest, _id: id } }, { upsert: true, setDefaultsOnInsert: true });
}

/**
 * Apply validated pack into local Mongo (desktop). Idempotent upserts.
 * Sets owner password via User model hashing (pre-save).
 */
async function applyProvisioningPack(pack, { password, deviceId, deviceName = '' }) {
  const summary = validateProvisioningPack(pack);
  const p = pack.payload;
  const companyId = new mongoose.Types.ObjectId(p.company.id);
  const ownerId = new mongoose.Types.ObjectId(p.owner.id);

  if (!password || String(password).length < 8) {
    throw AppError.badRequest('Owner password must be at least 8 characters');
  }
  if (!deviceId) {
    throw AppError.badRequest('deviceId required for activation binding');
  }

  // Replay / duplicate activation guards (local)
  const Activation = getActivationModel();
  const existingFp = await Activation.findOne({ fingerprint: summary.fingerprint });
  if (existingFp) {
    throw AppError.forbidden('This provisioning pack was already activated on this installation');
  }
  const existingCompany = await Company.findById(companyId);
  if (existingCompany) {
    const prior = await Activation.findOne({ companyId });
    if (prior && prior.fingerprint !== summary.fingerprint) {
      throw AppError.forbidden('This PC already has a different company activated');
    }
  }

  // Plan snapshot
  if (p.plan?.id) {
    await upsertById(Plan, p.plan.id, {
      name: p.plan.name,
      slug: p.plan.slug || `plan-${p.plan.id}`,
      priceMonthly: p.plan.priceMonthly || 0,
      priceYearly: p.plan.priceYearly || 0,
      trialDays: p.plan.trialDays || 0,
      features: p.plan.features || {},
      limits: p.plan.limits || {},
    });
  }

  // Company
  await Company.findOneAndUpdate(
    { _id: companyId },
    {
      $set: {
        name: p.company.name,
        ownerId,
        planId: p.plan?.id || p.company.planId || null,
        licenseKey: p.license.licenseKey,
        status: p.company.status || 'active',
        isActive: true,
        commercialPolicy: p.company.commercialPolicy || 'saas_enforced',
        meta: p.company.meta || {},
        settings: p.company.settings || {},
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Owner user — set password (hashed by pre-save)
  let owner = await User.findById(ownerId).select('+password');
  if (!owner) {
    owner = new User({
      _id: ownerId,
      name: p.owner.name,
      email: p.owner.email,
      password,
      role: 'user',
      companyRole: p.owner.companyRole || 'owner',
      companyId,
      isActive: true,
      mustChangePassword: false,
    });
    await owner.save();
  } else {
    owner.name = p.owner.name;
    owner.email = p.owner.email;
    owner.companyId = companyId;
    owner.companyRole = p.owner.companyRole || 'owner';
    owner.role = 'user';
    owner.isActive = true;
    owner.password = password;
    owner.mustChangePassword = false;
    await owner.save();
  }

  // Additional users (random temp password — they must be reset locally later)
  for (const u of p.users || []) {
    if (String(u.id) === String(ownerId)) continue;
    const uid = new mongoose.Types.ObjectId(u.id);
    const exists = await User.findById(uid);
    if (exists) {
      await User.updateOne(
        { _id: uid },
        {
          $set: {
            name: u.name,
            email: u.email,
            companyId,
            companyRole: u.companyRole || 'viewer',
            role: 'user',
            isActive: u.isActive !== false,
          },
        }
      );
    } else {
      const temp = crypto.randomBytes(24).toString('hex') + 'Aa1!';
      const nu = new User({
        _id: uid,
        name: u.name,
        email: u.email,
        password: temp,
        role: 'user',
        companyRole: u.companyRole || 'viewer',
        companyId,
        isActive: u.isActive !== false,
        mustChangePassword: true,
      });
      await nu.save();
    }
  }

  // Subscription
  if (p.subscription) {
    await Subscription.findOneAndUpdate(
      { companyId },
      {
        $set: {
          companyId,
          planId: p.subscription.planId || p.plan?.id || null,
          status: p.subscription.status || 'active',
          startDate: p.subscription.startDate || new Date(),
          endDate: p.subscription.endDate || p.license.expiresAt,
          billingCycle: p.subscription.billingCycle || 'monthly',
          autoRenew: false,
          offlineModeEnabled: true,
        },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }

  // License + device bind
  const devices = [
    {
      deviceId,
      deviceName: deviceName || 'Desktop',
      fingerprint: summary.fingerprint,
      activatedAt: new Date(),
      lastSeenAt: new Date(),
      active: true,
    },
  ];
  await License.findOneAndUpdate(
    { companyId, licenseKey: p.license.licenseKey },
    {
      $set: {
        companyId,
        licenseKey: p.license.licenseKey,
        expiresAt: p.license.expiresAt,
        checksum: p.license.checksum,
        isActive: true,
        planTier: p.license.planTier || 'pro',
        maxDevices: p.license.maxDevices || 1,
        graceDays: p.license.graceDays || 7,
        activationMode: 'offline',
        offlineCode: p.license.offlineCode,
        antiTamperHash: p.license.antiTamperHash || '',
        devices,
        lastValidatedAt: new Date(),
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  if (p.moduleConfig) {
    await CompanyModuleConfig.findOneAndUpdate(
      { companyId },
      {
        $set: {
          companyId,
          modules: p.moduleConfig.modules || {},
          subMenus: p.moduleConfig.subMenus || {},
          fields: p.moduleConfig.fields || {},
          version: p.moduleConfig.version || 1,
        },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }

  if (p.permissionMatrix) {
    await PermissionMatrix.findOneAndUpdate(
      { companyId },
      {
        $set: {
          companyId,
          roles: p.permissionMatrix.roles || {},
          sections: p.permissionMatrix.sections || {},
        },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }

  await CompanySettings.findOneAndUpdate(
    { companyId },
    {
      $set: {
        companyId,
        ...(p.settings || {}),
        legalName: (p.settings && p.settings.legalName) || p.company.name,
        offlineModeEnabled: true,
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  if (p.gstConfig) {
    await GstConfig.findOneAndUpdate(
      { companyId },
      { $set: { companyId, ...p.gstConfig, isActive: true } },
      { upsert: true, setDefaultsOnInsert: true }
    );
  } else {
    const gstConfigService = require('./gstConfigService');
    await gstConfigService.getOrCreate(companyId);
  }

  // System ledgers (idempotent seed)
  try {
    const accountingService = require('./accountingService');
    await accountingService.seedSystemLedgers(companyId);
  } catch (err) {
    /* non-fatal if already seeded */
  }

  await Activation.create({
    companyId,
    fingerprint: summary.fingerprint,
    licenseKey: p.license.licenseKey,
    deviceId,
    activatedAt: new Date(),
    ownerEmail: p.owner.email,
  });

  return {
    companyId: String(companyId),
    companyName: p.company.name,
    ownerEmail: p.owner.email,
    fingerprint: summary.fingerprint,
    planName: p.plan?.name || null,
  };
}

function getActivationModel() {
  if (mongoose.models.DesktopActivation) return mongoose.models.DesktopActivation;
  const schema = new mongoose.Schema(
    {
      companyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
      fingerprint: { type: String, required: true, unique: true },
      licenseKey: { type: String, required: true },
      deviceId: { type: String, required: true },
      ownerEmail: { type: String, default: '' },
      activatedAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
  );
  return mongoose.model('DesktopActivation', schema);
}

async function getLocalActivationStatus() {
  const Activation = getActivationModel();
  const row = await Activation.findOne().sort({ activatedAt: -1 }).lean();
  if (!row) return { activated: false };
  const company = await Company.findById(row.companyId).select('name licenseKey status').lean();
  return {
    activated: true,
    companyId: String(row.companyId),
    companyName: company?.name || null,
    fingerprint: row.fingerprint,
    activatedAt: row.activatedAt,
    ownerEmail: row.ownerEmail,
  };
}

module.exports = {
  PACK_VERSION,
  buildProvisioningPack,
  validateProvisioningPack,
  applyProvisioningPack,
  getLocalActivationStatus,
  packFingerprint,
  signPayload,
  verifySignature,
};
