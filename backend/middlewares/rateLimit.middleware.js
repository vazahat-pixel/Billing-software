const rateLimit = require('express-rate-limit');
const ErrorCodes = require('../constants/errorCodes');

/**
 * Global API rate limit — auth routes get a stricter bucket.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX || 1000),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later',
    errorCode: ErrorCodes.RATE_LIMITED,
    errors: [],
    data: null,
    meta: {},
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 40),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts',
    errorCode: ErrorCodes.RATE_LIMITED,
    errors: [],
    data: null,
    meta: {},
  },
});

module.exports = { apiLimiter, authLimiter };
