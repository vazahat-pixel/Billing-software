/**
 * Plan usage metering — counts what a plan caps.
 *
 * The Usage model has existed since the first SaaS pass but nothing ever wrote
 * to it, so plan limits were sold and never enforced. This is the writer.
 *
 * Counting rule: usage is recorded per calendar month (period "YYYY-MM"), which
 * matches how Plan.limits.invoicesPerMonth is sold. A month rolls over on its
 * own because the period key changes — there is no reset job to forget to run.
 *
 * Deliberately NOT counted: drafts, and anything created by a super-admin
 * operating a tenant. The customer pays for documents they issue, not for a
 * support session.
 */
const Usage = require('../models/Usage');
const entitlementService = require('./entitlementService');
const AppError = require('../utils/AppError');
const ErrorCodes = require('../constants/errorCodes');
const logger = require('../utils/logger');

/** Warn the user once they cross this fraction of a limit. */
const SOFT_LIMIT_RATIO = 0.8;

/** Current billing period key, e.g. "2026-08". */
const currentPeriod = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

/** Read (never create) the counter for a company/period. */
async function getUsage(companyId, period = currentPeriod()) {
  const doc = await Usage.findOne({ companyId, period }).lean();
  return {
    period,
    invoicesCount: doc?.invoicesCount || 0,
    usersCount: doc?.usersCount || 0,
    storageUsedMb: doc?.storageUsedMb || 0,
  };
}

/**
 * Increment a counter. Upsert + $inc so concurrent invoice saves cannot lose
 * a count to a read-modify-write race.
 */
async function increment(companyId, field, by = 1, period = currentPeriod()) {
  if (!companyId) return null;
  try {
    return await Usage.findOneAndUpdate(
      { companyId, period },
      { $inc: { [field]: by }, $setOnInsert: { companyId, period } },
      { upsert: true, new: true }
    );
  } catch (err) {
    // Metering must never break a save the customer is entitled to make.
    logger.warn('usage.increment.failed', {
      companyId: String(companyId), field, error: err.message,
    });
    return null;
  }
}

const recordInvoice = (companyId) => increment(companyId, 'invoicesCount', 1);

/**
 * Check a limit without consuming it.
 *
 * Returns { allowed, limit, used, remaining, ratio, warn, reason }.
 * A null limit means "uncapped" — an unset plan value must not read as zero.
 */
async function checkLimit(companyId, key = 'invoicesPerMonth') {
  const ent = await entitlementService.resolve(companyId);
  const limit = ent.limits?.[key];

  // Uncapped, or entitlements could not be resolved — do not invent a cap.
  if (ent.degraded || limit === null || limit === undefined) {
    return { allowed: true, limit: null, used: 0, remaining: null, ratio: 0, warn: false };
  }

  const field = key === 'invoicesPerMonth' ? 'invoicesCount'
    : key === 'storageMb' ? 'storageUsedMb'
    : 'usersCount';

  const usage = await getUsage(companyId);
  const used = usage[field] || 0;
  const remaining = Math.max(0, limit - used);
  const ratio = limit > 0 ? used / limit : 0;

  return {
    allowed: used < limit,
    limit,
    used,
    remaining,
    ratio,
    warn: ratio >= SOFT_LIMIT_RATIO,
    reason: used >= limit ? 'limit_reached' : '',
  };
}

/** Everything the UI needs to show a usage meter. */
async function summary(companyId) {
  const ent = await entitlementService.resolve(companyId);
  const usage = await getUsage(companyId);
  const invoices = await checkLimit(companyId, 'invoicesPerMonth');

  return {
    period: usage.period,
    plan: ent.plan?.name || null,
    invoices: {
      used: invoices.used,
      limit: invoices.limit,
      remaining: invoices.remaining,
      warn: invoices.warn,
      exceeded: !invoices.allowed,
    },
    storage: {
      usedMb: usage.storageUsedMb,
      limitMb: ent.limits?.storageMb ?? null,
    },
    // 1 company = 1 user in this product; kept for the admin view.
    users: { used: usage.usersCount, limit: ent.limits?.users ?? 1 },
  };
}

module.exports = {
  currentPeriod,
  getUsage,
  increment,
  recordInvoice,
  checkLimit,
  summary,
  SOFT_LIMIT_RATIO,
};
