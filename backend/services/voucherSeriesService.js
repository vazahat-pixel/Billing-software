const Counter = require('../models/Counter');
const VoucherSeries = require('../models/VoucherSeries');
const FinancialYear = require('../models/FinancialYear');

const DEFAULT_SERIES = [
  { module: 'sales', name: 'Sales Invoice', prefix: 'INV', padLength: 4, isDefault: true },
  { module: 'purchase', name: 'Purchase Bill', prefix: 'PUR', padLength: 4, isDefault: true },
  { module: 'payment', name: 'Payment', prefix: 'PMT', padLength: 4, isDefault: true },
  { module: 'receipt', name: 'Receipt', prefix: 'RCT', padLength: 4, isDefault: true },
  { module: 'journal', name: 'Journal', prefix: 'JNL', padLength: 4, isDefault: true },
  { module: 'job', name: 'Job Card', prefix: 'JC', padLength: 4, isDefault: true },
  { module: 'return', name: 'Return', prefix: 'RET', padLength: 4, isDefault: true },
  { module: 'note', name: 'Credit/Debit Note', prefix: 'CDN', padLength: 4, isDefault: true },
  { module: 'grn', name: 'GRN', prefix: 'GRN', padLength: 4, isDefault: true },
  { module: 'challan', name: 'Delivery Challan', prefix: 'DC', padLength: 4, isDefault: true },
];

async function ensureDefaultSeries(companyId) {
  for (const s of DEFAULT_SERIES) {
    const exists = await VoucherSeries.findOne({ companyId, module: s.module, prefix: s.prefix });
    if (!exists) {
      await VoucherSeries.create({ companyId, ...s, financialYearCode: '', status: 'Active' });
    }
  }
}

async function getActiveFyCode(companyId) {
  const fy = await FinancialYear.findOne({ companyId, isActive: true }).lean();
  return fy?.code || `${new Date().getFullYear().toString().slice(2)}`;
}

/**
 * Allocate next document number from VoucherSeries + Counter.
 * Falls back to prefix defaults if no series configured.
 */
async function allocateNext(companyId, module, { session = null, seriesId = null } = {}) {
  let series = null;
  if (seriesId) {
    series = await VoucherSeries.findOne({ _id: seriesId, companyId, status: 'Active' }).session(session);
  }
  if (!series) {
    series = await VoucherSeries.findOne({
      companyId,
      module,
      isDefault: true,
      status: 'Active',
    }).session(session);
  }
  if (!series) {
    series = await VoucherSeries.findOne({ companyId, module, status: 'Active' }).session(session);
  }

  const fyCode = series?.financialYearCode || (await getActiveFyCode(companyId));
  const prefix = (series?.prefix || module.slice(0, 3).toUpperCase()).toUpperCase();
  const pad = series?.padLength || 4;
  const counterId = `${prefix}-${fyCode}-${companyId}`;
  const seq = await Counter.nextSeq(counterId, session);
  const number = `${prefix}-${fyCode}-${String(seq).padStart(pad, '0')}`;

  return {
    number,
    prefix,
    seq,
    seriesId: series?._id || null,
    financialYearCode: fyCode,
  };
}

async function listSeries(companyId, module) {
  const filter = { companyId };
  if (module) filter.module = module;
  let rows = await VoucherSeries.find(filter).sort({ module: 1, isDefault: -1 });
  if (!rows.length) {
    await ensureDefaultSeries(companyId);
    rows = await VoucherSeries.find(filter).sort({ module: 1, isDefault: -1 });
  }
  return rows;
}

module.exports = {
  allocateNext,
  ensureDefaultSeries,
  listSeries,
  getActiveFyCode,
  DEFAULT_SERIES,
};
