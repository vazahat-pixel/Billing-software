const logger = require('../utils/logger');

/**
 * Request access log — method, path, status, duration, tenant.
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level](`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`, {
      requestId: req.requestId,
      companyId: req.companyId?.toString?.() || null,
      userId: req.user?._id?.toString?.() || null,
    });
  });
  next();
};

module.exports = requestLogger;
