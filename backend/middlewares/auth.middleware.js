const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const ErrorCodes = require('../constants/errorCodes');
const logger = require('../utils/logger');

const authMiddleware = async (req, res, next) => {
  try {
    // Safety: public auth endpoints must never require a bearer token
    // (unmatched /auth/* methods used to fall through into this middleware).
    const path = (req.path || '').replace(/\/+$/, '') || '/';
    const publicAuth = [
      '/auth/login',
      '/auth/register',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/auth/refresh',
    ];
    if (publicAuth.includes(path) || publicAuth.some((p) => path.endsWith(p))) {
      return next();
    }

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return next(AppError.unauthorized('No token, authorization denied'));
    }

    if (!process.env.JWT_SECRET) {
      logger.error('JWT_SECRET is not configured');
      return next(AppError.unauthorized('Auth misconfigured'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return next(AppError.unauthorized('User not found'));
    }

    if (!user.isActive) {
      return next(AppError.forbidden('Account deactivated. Contact your administrator.'));
    }

    // Stage 7.2 — revoke check for session-bound tokens (legacy tokens without sid still work)
    if (decoded.sid) {
      const sessionService = require('../services/sessionService');
      const valid = await sessionService.isSessionValid(decoded.sid);
      if (!valid) {
        return next(AppError.unauthorized('Session revoked or expired'));
      }
      req.sessionId = decoded.sid;
      user.sessionId = decoded.sid;
      sessionService.touch(decoded.sid).catch(() => {});
    }

    req.user = user;
    req.companyId = user.companyId;
    req.branchId = req.headers['x-branch-id'] || null;

    // Super admin without company: prefer X-Company-Id (set later by companyIsolation),
    // otherwise fall back to oldest company (logged — avoid silent cross-tenant ops).
    if (!req.companyId && user.role === 'super_admin') {
      const headerCompany = req.headers['x-company-id'];
      if (headerCompany) {
        req.companyId = headerCompany;
        req.superAdminTenant = true;
      } else {
        const Company = require('../models/Company');
        const fallback = await Company.findOne().sort({ createdAt: 1 });
        if (fallback) {
          req.companyId = fallback._id;
          req.superAdminTenant = true;
          logger.warn('Super-admin using fallback oldest company — send X-Company-Id header', {
            companyId: fallback._id.toString(),
            requestId: req.requestId,
          });
        }
      }
    }

    if (req.companyId) {
      const Company = require('../models/Company');
      const company = await Company.findById(req.companyId);
      if (company) {
        req.planId = company.planId;
        req.companyStatus = company.status;
        if (company.status === 'suspended') {
          return next(AppError.forbidden('Your company account is suspended. Please contact support.'));
        }
      }
    }

    return next();
  } catch (err) {
    if (err.name === 'AppError') return next(err);
    return next(new AppError('Token is not valid', { statusCode: 401, errorCode: ErrorCodes.AUTH_INVALID }));
  }
};

module.exports = authMiddleware;
