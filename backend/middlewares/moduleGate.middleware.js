/**
 * Module gate — refuses API access to a module the company has not been given.
 *
 * The frontend already hides menu entries a company cannot use, but hiding is
 * not enforcement: the endpoints stayed reachable. This closes that, using the
 * same entitlement resolver the UI reads, so the two can never disagree.
 *
 * Rollout: shadow mode is the default. The gate logs what it *would* have
 * blocked without blocking anything, so a mapping mistake shows up in the logs
 * instead of in a customer's face. Set MODULE_GATE_ENFORCE=true to enforce.
 */
const entitlementService = require('../services/entitlementService');
const AppError = require('../utils/AppError');
const ErrorCodes = require('../constants/errorCodes');
const logger = require('../utils/logger');

const isEnforcing = () => String(process.env.MODULE_GATE_ENFORCE || '').toLowerCase() === 'true';

/** Human-facing module names for the "not in your plan" message. */
const MODULE_LABELS = {
  sales: 'Sales',
  purchase: 'Purchase',
  jobWork: 'Job Work',
  inventory: 'Inventory',
  accounting: 'Accounting',
  gst: 'GST',
  reports: 'Reports',
  masters: 'Masters',
  utilities: 'Utilities',
};

const label = (key) => MODULE_LABELS[key] || key;

/**
 * Gate a router on one module.
 *
 *   router.use('/gst', requireModule('gst'), gstRoutes);
 *
 * Super-admin always passes — they operate the platform, not a tenant seat.
 */
const requireModule = (moduleKey) => {
  return async (req, res, next) => {
    try {
      // Platform operator — never gated by a tenant's plan.
      if (req.user?.role === 'super_admin') return next();

      const companyId = req.companyId || req.user?.companyId;
      if (!companyId) return next(); // companyIsolation already rules on this

      const ent = await entitlementService.resolve(companyId);

      // A degraded resolve must not lock anyone out; subscription middleware
      // is still the real gate on account status.
      if (ent.degraded) return next();

      if (ent.modules[moduleKey] !== false) return next();

      // ---- Blocked ----
      const soldButOff = ent.entitledModules?.[moduleKey] === true;
      const reason = soldButOff
        ? `${label(moduleKey)} is switched off for your company. Contact your administrator.`
        : `${label(moduleKey)} is not included in your plan.`;

      const detail = {
        requestId: req.requestId,
        companyId: String(companyId),
        module: moduleKey,
        method: req.method,
        path: req.originalUrl,
        entitled: ent.entitledModules?.[moduleKey],
        enabled: ent.enabledModules?.[moduleKey],
        plan: ent.plan?.name || null,
      };

      if (!isEnforcing()) {
        // Shadow mode — record and let the request through.
        logger.warn('module.gate.shadow (would block)', detail);
        res.set('X-Module-Gate', `shadow:${moduleKey}`);
        return next();
      }

      logger.warn('module.gate.blocked', detail);
      return next(
        new AppError(reason, {
          statusCode: 403,
          errorCode: ErrorCodes.FEATURE_LOCKED,
          errors: [{ field: 'module', message: moduleKey }],
        })
      );
    } catch (err) {
      // Never let a gate failure take down a working endpoint.
      logger.error('module.gate.error', {
        module: moduleKey,
        error: err.message,
        requestId: req.requestId,
      });
      return next();
    }
  };
};

/**
 * Blocks writes while the account is in its post-expiry grace period,
 * leaving reads working so the customer can still see and export their data.
 * Read-only enforcement follows the same MODULE_GATE_ENFORCE switch.
 */
const blockWritesWhenReadOnly = async (req, res, next) => {
  try {
    if (req.user?.role === 'super_admin') return next();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

    const companyId = req.companyId || req.user?.companyId;
    if (!companyId) return next();

    const ent = await entitlementService.resolve(companyId);
    if (ent.degraded || !ent.isReadOnly) return next();

    const detail = {
      requestId: req.requestId,
      companyId: String(companyId),
      method: req.method,
      path: req.originalUrl,
      daysLeft: ent.daysLeft,
    };

    if (!isEnforcing()) {
      logger.warn('module.gate.readonly.shadow (would block write)', detail);
      res.set('X-Module-Gate', 'shadow:readonly');
      return next();
    }

    logger.warn('module.gate.readonly.blocked', detail);
    return next(
      new AppError(
        `Your subscription has expired. You have ${ent.daysLeft} day(s) of read-only access left — renew to continue saving entries.`,
        { statusCode: 402, errorCode: ErrorCodes.SUBSCRIPTION_INACTIVE }
      )
    );
  } catch (err) {
    logger.error('module.gate.readonly.error', { error: err.message, requestId: req.requestId });
    return next();
  }
};

module.exports = { requireModule, blockWritesWhenReadOnly, MODULE_LABELS, isEnforcing };
