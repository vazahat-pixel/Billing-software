const Plan = require('../models/Plan');
const AppError = require('./AppError');
const ErrorCodes = require('../constants/errorCodes');
const { fail } = require('./apiResponse');

/**
 * Server-side feature guard (plan modules)
 */
exports.checkFeature = async (req, module, field = null) => {
  if (req.user && (req.user.role === 'super_admin' || ['owner', 'admin'].includes(req.user.companyRole || 'owner'))) return true;
  if (process.env.ENFORCE_SUBSCRIPTION !== 'true') return true;

  if (!req.planId) {
    return true; // No plan enforced in default setup
  }

  const plan = await Plan.findById(req.planId);
  if (!plan) return true;

  if (plan.features?.modules && plan.features.modules[module] === false) {
    throw AppError.forbidden(`Module '${module}' not allowed in your current plan`, ErrorCodes.FEATURE_LOCKED);
  }

  if (field && plan.features?.fields?.[module]?.[field] === false) {
    throw AppError.forbidden(`Field '${field}' not allowed in your current plan`, ErrorCodes.FEATURE_LOCKED);
  }

  return true;
};

exports.guard = (module, field = null) => {
  return async (req, res, next) => {
    try {
      await exports.checkFeature(req, module, field);
      next();
    } catch (err) {
      if (err.name === 'AppError') return next(err);
      return fail(res, 403, err.message, { errorCode: ErrorCodes.FEATURE_LOCKED });
    }
  };
};
