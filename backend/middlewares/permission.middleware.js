const PermissionMatrix = require('../models/PermissionMatrix');
const AppError = require('../utils/AppError');
const ErrorCodes = require('../constants/errorCodes');
const logger = require('../utils/logger');

/**
 * Soft RBAC middleware — reads PermissionMatrix when present.
 * Sprint 1.2: blocks only when matrix explicitly denies the action.
 * Super_admin / owner / admin always pass. Missing matrix → allow (compat).
 *
 * Usage: requirePermission('sales', 'create')
 */
const requirePermission = (moduleKey, action = 'read') => {
  return async (req, res, next) => {
    try {
      if (!req.user) return next(AppError.unauthorized());
      if (req.user.role === 'super_admin') return next();

      const companyRole = req.user.companyRole || 'owner';
      if (['owner', 'admin'].includes(companyRole)) return next();

      if (!req.companyId) return next();

      const matrix = await PermissionMatrix.findOne({ companyId: req.companyId }).lean();
      if (!matrix || !matrix.roles) return next(); // no matrix configured → backward compatible

      const rolePerms = matrix.roles[companyRole] || matrix.roles[companyRole.toLowerCase()];
      if (!rolePerms) return next();

      const modulePerms = rolePerms[moduleKey] || rolePerms.modules?.[moduleKey];
      if (modulePerms === false) {
        return next(AppError.forbidden(`Permission denied for ${moduleKey}`, ErrorCodes.FORBIDDEN));
      }
      if (modulePerms && typeof modulePerms === 'object' && modulePerms[action] === false) {
        return next(AppError.forbidden(`Permission denied: ${moduleKey}.${action}`, ErrorCodes.FORBIDDEN));
      }

      return next();
    } catch (err) {
      logger.warn('requirePermission failed open', { error: err.message });
      return next();
    }
  };
};

module.exports = { requirePermission };
