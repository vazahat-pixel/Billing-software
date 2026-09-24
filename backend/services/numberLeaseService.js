const crypto = require('crypto');
const NumberRangeLease = require('../models/NumberRangeLease');
const SyncState = require('../models/SyncState');
const Counter = require('../models/Counter');
const voucherSeriesService = require('./voucherSeriesService');
const AppError = require('../utils/AppError');

const DEFAULT_LEASE_SIZE = Number(process.env.SYNC_INVOICE_LEASE_SIZE || 50);
const DEFAULT_TTL_HOURS = Number(process.env.SYNC_INVOICE_LEASE_TTL_HOURS || 168);

// Module -> prefix mapping for non-sales leases
const MODULE_PREFIX_MAP = {
  sales: null,    // resolved from VoucherSeries / falls through to default
  purchase: 'PUR',
  job: 'JC',
  payment: 'PMT',
  receipt: 'RCT',
};

function formatNumber(prefix, fyCode, seq, padLength) {
  return `${prefix}-${fyCode}-${String(seq).padStart(padLength || 4, '0')}`;
}

/**
 * Central: allocate a contiguous number range for a device for any module.
 * For module='sales', delegates to VoucherSeries for prefix/FY code (backward compat).
 * For other modules, uses the MODULE_PREFIX_MAP prefix with the company FY code.
 */
async function allocateInvoiceLease(companyId, deviceId, { size = DEFAULT_LEASE_SIZE, module: mod = 'sales' } = {}) {
  if (!deviceId) throw AppError.badRequest('deviceId is required for invoice lease');
  const n = Math.max(1, Math.min(500, Number(size) || DEFAULT_LEASE_SIZE));

  let prefix;
  let fyCode;
  let padLength;
  let counterId;

  if (mod === 'sales') {
    await voucherSeriesService.ensureDefaultSeries(companyId);
    const series =
      (await require('../models/VoucherSeries').findOne({
        companyId,
        module: 'sales',
        isDefault: true,
        status: 'Active',
      })) ||
      (await require('../models/VoucherSeries').findOne({
        companyId,
        module: 'sales',
        status: 'Active',
      }));

    fyCode = series?.financialYearCode || (await voucherSeriesService.getActiveFyCode(companyId));
    prefix = (series?.prefix || 'INV').toUpperCase();
    padLength = series?.padLength || 4;
    counterId = `${prefix}-${fyCode}-${companyId}`;
  } else {
    fyCode = await voucherSeriesService.getActiveFyCode(companyId);
    prefix = MODULE_PREFIX_MAP[mod] || mod.toUpperCase().slice(0, 6);
    padLength = 4;
    counterId = `${prefix}-${fyCode}-${companyId}`;
  }

  // Advance central counter by N atomically
  const counter = await Counter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: n } },
    { new: true, upsert: true }
  );
  const endSeq = counter.seq;
  const startSeq = endSeq - n + 1;
  const leaseId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + DEFAULT_TTL_HOURS * 3600 * 1000);

  const lease = await NumberRangeLease.create({
    companyId,
    deviceId: String(deviceId),
    module: mod,
    leaseId,
    prefix,
    financialYearCode: fyCode,
    padLength,
    startSeq,
    endSeq,
    nextSeq: startSeq,
    consumedThrough: startSeq - 1,
    expiresAt,
    status: 'active',
  });

  return {
    leaseId: lease.leaseId,
    module: mod,
    prefix,
    financialYearCode: fyCode,
    padLength,
    startSeq,
    endSeq,
    nextSeq: startSeq,
    expiresAt,
    numbersPreview: [
      formatNumber(prefix, fyCode, startSeq, padLength),
      formatNumber(prefix, fyCode, endSeq, padLength),
    ],
  };
}

/**
 * Persist lease on local SyncState after downloading from central.
 * Works for any module — key is 'lease:{module}:{companyId}'.
 */
async function cacheLeaseLocally(companyId, lease) {
  const mod = lease.module || 'sales';
  const key = `lease:${mod}:${companyId}`;
  await SyncState.findOneAndUpdate(
    { key },
    {
      $set: {
        companyId,
        value: {
          ...lease,
          module: mod,
          nextSeq: lease.nextSeq || lease.startSeq,
        },
      },
    },
    { upsert: true }
  );
  return lease;
}

/**
 * Desktop-hybrid: consume next invoice number from cached lease.
 * Throws if exhausted / missing — does not invent alternate numbering.
 */
async function consumeLocalLease(companyId, module = 'sales', { session = null } = {}) {
  const key = `lease:${module}:${companyId}`;
  const q = SyncState.findOne({ key });
  if (session) q.session(session);
  const doc = await q;
  if (!doc?.value) {
    throw AppError.badRequest(
      'No invoice number lease available. Connect online to renew invoice numbers.'
    );
  }
  const lease = doc.value;
  if (lease.expiresAt && new Date(lease.expiresAt) < new Date()) {
    throw AppError.badRequest(
      'Invoice number lease expired. Connect online to renew invoice numbers.'
    );
  }
  const next = Number(lease.nextSeq);
  const end = Number(lease.endSeq);
  if (!Number.isFinite(next) || next > end) {
    throw AppError.badRequest(
      'Invoice number lease exhausted. Connect online to renew invoice numbers.'
    );
  }
  const number = formatNumber(lease.prefix, lease.financialYearCode, next, lease.padLength);
  lease.nextSeq = next + 1;
  if (lease.nextSeq > end) lease.status = 'exhausted';
  doc.value = lease;
  doc.markModified('value');
  await doc.save(session ? { session } : undefined);
  return {
    number,
    seq: next,
    leaseId: lease.leaseId,
    prefix: lease.prefix,
    financialYearCode: lease.financialYearCode,
  };
}

/**
 * Central: verify a number belongs to an active lease for this device and mark consumed.
 * module defaults to 'sales' for backward compatibility.
 */
async function assertAndConsumeLeaseNumber(companyId, deviceId, invoiceNo, module = 'sales') {
  const leases = await NumberRangeLease.find({
    companyId,
    deviceId: String(deviceId),
    module,
    status: 'active',
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  for (const lease of leases) {
    for (let seq = lease.startSeq; seq <= lease.endSeq; seq += 1) {
      const candidate = formatNumber(lease.prefix, lease.financialYearCode, seq, lease.padLength);
      if (candidate === invoiceNo) {
        if (seq <= lease.consumedThrough) {
          // Already marked — allow idempotent retry
          return { lease, seq, alreadyConsumed: true };
        }
        lease.consumedThrough = Math.max(lease.consumedThrough, seq);
        lease.nextSeq = Math.max(lease.nextSeq, seq + 1);
        if (lease.consumedThrough >= lease.endSeq) lease.status = 'exhausted';
        await lease.save();
        return { lease, seq, alreadyConsumed: false };
      }
    }
  }
  throw AppError.conflict(
    `Number ${invoiceNo} is not within an active ${module} lease for this device`
  );
}

async function getLocalLeaseStatus(companyId, module = 'sales') {
  const doc = await SyncState.findOne({ key: `lease:${module}:${companyId}` }).lean();
  if (!doc?.value) return { available: 0, lease: null };
  const lease = doc.value;
  const remaining = Math.max(0, Number(lease.endSeq) - Number(lease.nextSeq) + 1);
  return { available: remaining, lease };
}

module.exports = {
  allocateInvoiceLease,
  cacheLeaseLocally,
  consumeLocalLease,
  assertAndConsumeLeaseNumber,
  getLocalLeaseStatus,
  formatNumber,
  DEFAULT_LEASE_SIZE,
  MODULE_PREFIX_MAP,
};
