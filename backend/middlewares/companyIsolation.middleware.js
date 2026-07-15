const AppError = require('../utils/AppError');
const ErrorCodes = require('../constants/errorCodes');

/**
 * Never trust companyId from client body/query for tenant users.
 * JWT → req.companyId is the source of truth.
 * Super-admin may use X-Company-Id header to select a tenant (not query/body spoofing).
 */
const companyIsolationMiddleware = (req, res, next) => {
  // Strip spoofable companyId from mutations / filters for normal tenants
  if (req.user?.role !== 'super_admin') {
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'companyId')) {
      delete req.body.companyId;
    }
    if (req.query && Object.prototype.hasOwnProperty.call(req.query, 'companyId')) {
      delete req.query.companyId;
    }
  }

  if (req.user?.role === 'super_admin') {
    const headerCompany = req.headers['x-company-id'];
    if (headerCompany) {
      req.companyId = headerCompany;
      req.superAdminTenant = true;
    }
  }

  if (!req.companyId && req.user?.role !== 'super_admin') {
    return next(AppError.forbidden('No company context on this account', ErrorCodes.COMPANY_REQUIRED));
  }

  // Bind companyId onto body for create operations after strip
  if (req.companyId && req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    req.body.companyId = req.companyId;
  }

  next();
};

module.exports = companyIsolationMiddleware;
