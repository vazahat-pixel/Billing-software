/**
 * Plan limit enforcement — refuses a document once the month's quota is spent.
 *
 * Sits on invoice-creating routes only. The count is incremented after the
 * handler reports success, so a validation failure or a duplicate-invoice
 * rejection does not burn quota the customer never used.
 *
 * Rollout mirrors the module gate: shadow (log-only) until PLAN_LIMIT_ENFORCE
 * is set, so a mis-set plan shows up in logs rather than blocking real billing.
 */
const usageService = require('../services/usageService');
const AppError = require('../utils/AppError');
const ErrorCodes = require('../constants/errorCodes');
const logger = require('../utils/logger');

const isEnforcing = () =>
  String(process.env.PLAN_LIMIT_ENFORCE || '').toLowerCase() === 'true';

/**
 * Guard a create route against the monthly invoice cap, then count the
 * document once it is actually created.
 */
const enforceInvoiceLimit = async (req, res, next) => {
  try {
    // Platform operator working inside a tenant is not billable usage.
    if (req.user?.role === 'super_admin') return next();

    const companyId = req.companyId || req.user?.companyId;
    if (!companyId) return next();

    const check = await usageService.checkLimit(companyId, 'invoicesPerMonth');

    // Uncapped plan — nothing to meter.
    if (check.limit === null) return next();

    if (!check.allowed) {
      const detail = {
        requestId: req.requestId,
        companyId: String(companyId),
        used: check.used,
        limit: check.limit,
        path: req.originalUrl,
      };

      if (!isEnforcing()) {
        logger.warn('plan.limit.shadow (would block)', detail);
        res.set('X-Plan-Limit', 'shadow:invoices');
      } else {
        logger.warn('plan.limit.blocked', detail);
        return next(
          new AppError(
            `You have used all ${check.limit} invoices included in your plan this month. Upgrade your plan to continue.`,
            { statusCode: 402, errorCode: ErrorCodes.FEATURE_LOCKED }
          )
        );
      }
    }

    // Surface the meter so the UI can warn before the wall is hit.
    res.set('X-Plan-Invoices-Used', String(check.used));
    res.set('X-Plan-Invoices-Limit', String(check.limit));
    if (check.warn) res.set('X-Plan-Limit-Warning', 'invoices');

    // Count only a genuinely created document.
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        usageService.recordInvoice(companyId).catch(() => {});
      }
    });

    return next();
  } catch (err) {
    logger.error('plan.limit.error', { error: err.message, requestId: req.requestId });
    return next();
  }
};

module.exports = { enforceInvoiceLimit, isEnforcing };
