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

  // Development bypass — logged loudly; NEVER rely on this in production deploys
  if (process.env.NODE_ENV === 'development' && process.env.ENFORCE_SUBSCRIPTION !== 'true') {
    logger.warn('Subscription/license middleware BYPASSED (NODE_ENV=development). Set ENFORCE_SUBSCRIPTION=true to test gates.');
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
    if (!subscription || subscription.status !== 'active' || new Date() > subscription.endDate) {
      return next(AppError.paymentRequired('Subscription expired or inactive'));
    }

    const license = await License.findOne({ companyId: req.user.companyId, isActive: true });
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
