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
const BILL_NUMBER_MODULES = [
  { module: 'sales', label: 'Sales Invoice' },
  { module: 'purchase', label: 'Purchase Bill' },
  { module: 'salesReturn', label: 'Sales Return' },
  { module: 'purchaseReturn', label: 'Purchase Return' },
  { module: 'receipt', label: 'Bank Receipt' },
  { module: 'payment', label: 'Bank Payment' },
  { module: 'job', label: 'Job / Mill Challan' },
  { module: 'note', label: 'Debit / Credit Note' },
];

function assertBillModule(module) {
  if (!BILL_NUMBER_MODULES.some((m) => m.module === module)) {
    const err = new Error('Unknown bill number series');
    err.statusCode = 400;
    throw err;
  }
}

function plainCounterId(companyId, module) {
  return `BILLNO-${module}-${companyId}`;
}

async function peekNext(companyId, module) {
  assertBillModule(module);
  const row = await Counter.findById(plainCounterId(companyId, module)).lean();
  return (Number(row?.seq) || 0) + 1;
}

async function setNext(companyId, module, next) {
  assertBillModule(module);
  const n = Math.max(1, parseInt(next, 10) || 1);
  await Counter.findOneAndUpdate(
    { _id: plainCounterId(companyId, module) },
    { $set: { seq: n - 1 } },
    { upsert: true }
  );
  return n;
}

async function listBillNumbers(companyId) {
  const rows = [];
  for (const m of BILL_NUMBER_MODULES) {
    const row = await Counter.findById(plainCounterId(companyId, m.module)).lean();
    rows.push({ module: m.module, label: m.label, next: (Number(row?.seq) || 0) + 1 });
  }
  return rows;
}

async function resetAll(companyId, next = 1) {
  for (const m of BILL_NUMBER_MODULES) {
    await setNext(companyId, m.module, next);
  }
  return listBillNumbers(companyId);
}

/**
 * Use the typed number, or take the next 1, 2, 3… when the field is blank / AUTO.
 * A typed integer moves the series forward so the following bill does not repeat it.
 */
async function reserveNumber(companyId, module, requested, session = null) {
  assertBillModule(module);
  const raw = String(requested ?? '').trim();
  if (!raw || raw.toUpperCase() === 'AUTO') {
    const allocated = await allocateNext(companyId, module, { session });
    return allocated.number;
  }
  const n = Number(raw);
  if (Number.isInteger(n) && n > 0 && String(n) === raw) {
    const opts = { upsert: true };
    if (session) opts.session = session;
    await Counter.findOneAndUpdate(
      { _id: plainCounterId(companyId, module) },
      { $max: { seq: n } },
      opts
    );
    return String(n);
  }
  return raw;
}

async function allocateNext(companyId, module, { session = null } = {}) {
  if (BILL_NUMBER_MODULES.some((m) => m.module === module)) {
    const seq = await Counter.nextSeq(plainCounterId(companyId, module), session);
    return {
      number: String(seq),
      prefix: '',
      seq,
      seriesId: null,
      financialYearCode: '',
    };
  }

  const series = await VoucherSeries.findOne({
    companyId,
    module,
    isDefault: true,
    status: 'Active',
  }).session(session);
  const fyCode = series?.financialYearCode || (await getActiveFyCode(companyId));
  const prefix = (series?.prefix || String(module).slice(0, 3).toUpperCase()).toUpperCase();
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
  BILL_NUMBER_MODULES,
  peekNext,
  setNext,
  listBillNumbers,
  resetAll,
  reserveNumber,
};
