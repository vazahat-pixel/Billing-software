const PlatformLog = require('../models/PlatformLog');
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

/**
 * Stage 7.6 — Centralized logging platform (extends console logger + AuditLog).
 */
class PlatformLogService {
  async write({
    category = 'application',
    level = 'info',
    message,
    companyId = null,
    branchId = null,
    userId = null,
    module = '',
    action = '',
    requestId = '',
    correlationId = '',
    ip = '',
    device = '',
    durationMs = null,
    status = '',
    meta = {},
  }) {
    if (!message) return null;
    // Mirror to console logger
    const fn = logger[level] || logger.info;
    fn.call(logger, message, {
      category,
      companyId: companyId ? String(companyId) : undefined,
      requestId,
      module,
      action,
    });

    try {
      return await PlatformLog.create({
        category,
        level,
        message,
        companyId,
        branchId,
        userId,
        module,
        action,
        requestId,
        correlationId: correlationId || requestId,
        ip,
        device,
        durationMs,
        status,
        meta,
      });
    } catch (err) {
      logger.debug('platform.log.persist.failed', { error: err.message });
      return null;
    }
  }

  async query(companyId, { category, level, limit = 50, requestId } = {}) {
    const filter = {};
    if (companyId) filter.companyId = companyId;
    if (category) filter.category = category;
    if (level) filter.level = level;
    if (requestId) filter.requestId = requestId;
    return PlatformLog.find(filter).sort({ createdAt: -1 }).limit(Math.min(limit, 200));
  }

  async categories(companyId) {
    const match = companyId ? { companyId } : {};
    return PlatformLog.aggregate([
      { $match: match },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
  }

  async auditTail(companyId, { limit = 50 } = {}) {
    const filter = companyId ? { companyId } : {};
    return AuditLog.find(filter).sort({ createdAt: -1 }).limit(Math.min(limit, 200));
  }

  middleware() {
    const self = this;
    return (req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const durationMs = Date.now() - start;
        if (req.path?.startsWith('/health') || req.path === '/') return;
        self
          .write({
            category: 'api',
            level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
            message: `${req.method} ${req.originalUrl || req.url}`,
            companyId: req.companyId || null,
            userId: req.user?._id || null,
            module: 'api',
            action: req.method,
            requestId: req.requestId || '',
            correlationId: req.headers['x-correlation-id'] || req.requestId || '',
            ip: req.ip || '',
            device: req.headers['user-agent'] || '',
            durationMs,
            status: String(res.statusCode),
            meta: { path: req.path },
          })
          .catch(() => {});
      });
      next();
    };
  }
}

module.exports = new PlatformLogService();
