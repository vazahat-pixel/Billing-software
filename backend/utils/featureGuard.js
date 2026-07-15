const Plan = require('../models/Plan');
const AppError = require('./AppError');
const ErrorCodes = require('../constants/errorCodes');
const { fail } = require('./apiResponse');

/**
 * Server-side feature guard (plan modules)
 */
exports.checkFeature = async (req, module, field = null) => {
  if (req.user && req.user.role === 'super_admin') return true;

  if (!req.planId) {
    throw AppError.forbidden('No plan associated with this request', ErrorCodes.FEATURE_LOCKED);
  }

  const plan = await Plan.findById(req.planId);
  if (!plan) throw AppError.forbidden('Plan not found', ErrorCodes.FEATURE_LOCKED);

  if (!plan.features.modules[module]) {
    throw AppError.forbidden(`Module '${module}' not allowed in your current plan`, ErrorCodes.FEATURE_LOCKED);
  }

  if (field && !plan.features.fields[module]?.[field]) {
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
