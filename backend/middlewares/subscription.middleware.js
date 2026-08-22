const Company = require('../models/Company');
const Subscription = require('../models/Subscription');
const License = require('../models/License');
const AppError = require('../utils/AppError');
const ErrorCodes = require('../constants/errorCodes');
const logger = require('../utils/logger');

const subscriptionMiddleware = async (req, res, next) => {
  // Super admin: skip commercial gates
  if (req.user && req.user.role === 'super_admin') {
    if (req.user.companyId) {
      try {
        const company = await Company.findById(req.user.companyId);
        if (company) req.planId = company.planId;
      } catch (e) {
        /* ignore */
      }
    }
    return next();
  }

  // Development bypass. Requires BOTH a dev NODE_ENV and an explicit opt-in, so
  // an unset NODE_ENV on a packaged desktop build cannot silently disable every
  // commercial gate. Set ALLOW_SUBSCRIPTION_BYPASS=true locally to use it.
  const devBypassAllowed =
    process.env.NODE_ENV === 'development' &&
    String(process.env.ALLOW_SUBSCRIPTION_BYPASS || '').toLowerCase() === 'true' &&
    process.env.ENFORCE_SUBSCRIPTION !== 'true';

  if (devBypassAllowed) {
    logger.warn('Subscription/license middleware BYPASSED (dev bypass opt-in). Never enable this on a customer build.');
    if (req.user?.companyId) {
      try {
        const company = await Company.findById(req.user.companyId);
        if (company) req.planId = company.planId;
      } catch (e) {
        /* ignore */
      }
    }
    return next();
  }

  try {
    if (!req.user.companyId) {
      return next(AppError.forbidden('User is not associated with any company', ErrorCodes.COMPANY_REQUIRED));
    }

    const company = await Company.findById(req.user.companyId);
    if (!company || !company.isActive || company.status === 'suspended') {
      return next(AppError.forbidden('Account locked or inactive. Please contact support.'));
    }

    const subscription = await Subscription.findOne({ companyId: req.user.companyId });
    const license = await License.findOne({ companyId: req.user.companyId, isActive: true });

    // Grace period: for graceDays after expiry the account stays readable so the
    // customer can still see, print and export their own data while they renew.
    // Writes are refused by blockWritesWhenReadOnly in the module gate.
    const entitlementService = require('../services/entitlementService');
    const ent = await entitlementService.resolve(req.user.companyId);
    const isRead = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if (!ent.degraded && ent.status === 'grace' && isRead) {
      req.planId = company.planId;
      req.readOnlyGrace = true;
      return next();
    }

    if (!subscription || subscription.status !== 'active' || new Date() > subscription.endDate) {
      return next(AppError.paymentRequired('Subscription expired or inactive'));
    }

    if (!license || new Date() > license.expiresAt) {
      return next(AppError.forbidden('License key invalid or expired', ErrorCodes.LICENSE_INVALID));
    }

    req.planId = company.planId;
    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = subscriptionMiddleware;
