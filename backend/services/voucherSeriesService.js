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
  let next = (Number(row?.seq) || 0) + 1;
  // Guard against 10-digit FY composite numbers (e.g. 2026270058) poisoning the counter
  if (next >= 2000000000 && next <= 2099999999) {
    next = (next % 10000) || 1;
    try {
      await Counter.findByIdAndUpdate(
        plainCounterId(companyId, module),
        { $set: { seq: next - 1 } }
      );
    } catch {
      /* ignore */
    }
  }
  if (module === 'job') {
    try {
      const Job = require('../models/Job');
      const jobs = await Job.find({ companyId }).select('jobCardNo challanNo').lean();
      let max = 0;
      for (const j of jobs) {
        const v1 = parseInt(String(j.jobCardNo || '').trim(), 10);
        if (!isNaN(v1) && String(v1) === String(j.jobCardNo || '').trim()) {
          if (v1 > max) max = v1;
        }
        const v2 = parseInt(String(j.challanNo || '').trim(), 10);
        if (!isNaN(v2) && String(v2) === String(j.challanNo || '').trim()) {
          if (v2 > max) max = v2;
        }
      }
      if (max >= next) {
        next = max + 1;
        await Counter.findByIdAndUpdate(
          plainCounterId(companyId, module),
          { $max: { seq: max } },
          { upsert: true }
        );
      }
    } catch {
      /* ignore */
    }
  }
  if (module === 'purchase') {
    try {
      const Purchase = require('../models/Purchase');
      const purchases = await Purchase.find({ companyId }).select('invoiceNo vNo').lean();
      let max = 0;
      for (const p of purchases) {
        const raw = String(p.vNo || p.invoiceNo || '').replace(/-OFF.*$/i, '').trim();
        let val = parseInt(raw.replace(/\D/g, ''), 10);
        if (!isNaN(val)) {
          if (val >= 2000000000 && val <= 2099999999) {
            val = val % 10000;
          }
          if (val < 100000 && val > max) {
            max = val;
          }
        }
      }
      if (max >= next) {
        next = max + 1;
        await Counter.findByIdAndUpdate(
          plainCounterId(companyId, module),
          { $max: { seq: max } },
          { upsert: true }
        );
      }
    } catch {
      /* ignore */
    }
  }
  return next;
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
  let raw = String(requested ?? '').trim();
  if (raw.includes('-OFF')) {
    raw = raw.replace(/-OFF.*$/i, '').trim();
  }
  if (!raw || raw.toUpperCase() === 'AUTO') {
    const allocated = await allocateNext(companyId, module, { session });
    return allocated.number;
  }
  let n = Number(raw);
  if (Number.isInteger(n) && n > 0 && String(n) === raw) {
    if (n >= 2000000000 && n <= 2099999999) {
      n = (n % 10000) || 1;
    }
    if (n < 100000) {
      const opts = { upsert: true };
      if (session) opts.session = session;
      await Counter.findOneAndUpdate(
        { _id: plainCounterId(companyId, module) },
        { $max: { seq: n } },
        opts
      );
    }
    return String(n);
  }
  return raw;
}

async function allocateNext(companyId, module, { session = null } = {}) {
  if (BILL_NUMBER_MODULES.some((m) => m.module === module)) {
    if (module === 'job') {
      try {
        const Job = require('../models/Job');
        const query = Job.find({ companyId }).select('jobCardNo challanNo');
        if (session) query.session(session);
        const jobs = await query.lean();
        let max = 0;
        for (const j of jobs) {
          const v1 = parseInt(String(j.jobCardNo || '').trim(), 10);
          if (!isNaN(v1) && String(v1) === String(j.jobCardNo || '').trim()) {
            if (v1 > max) max = v1;
          }
          const v2 = parseInt(String(j.challanNo || '').trim(), 10);
          if (!isNaN(v2) && String(v2) === String(j.challanNo || '').trim()) {
            if (v2 > max) max = v2;
          }
        }
        if (max > 0) {
          const opts = { upsert: true };
          if (session) opts.session = session;
          await Counter.findOneAndUpdate(
            { _id: plainCounterId(companyId, module) },
            { $max: { seq: max } },
            opts
          );
        }
      } catch {
        /* ignore */
      }
    }
    if (module === 'purchase') {
      try {
        const Purchase = require('../models/Purchase');
        const query = Purchase.find({ companyId }).select('invoiceNo vNo');
        if (session) query.session(session);
        const purchases = await query.lean();
        let max = 0;
        for (const p of purchases) {
          const raw = String(p.vNo || p.invoiceNo || '').replace(/-OFF.*$/i, '').trim();
          let val = parseInt(raw.replace(/\D/g, ''), 10);
          if (!isNaN(val)) {
            if (val >= 2000000000 && val <= 2099999999) {
              val = val % 10000;
            }
            if (val < 100000 && val > max) {
              max = val;
            }
          }
        }
        if (max > 0) {
          const opts = { upsert: true };
          if (session) opts.session = session;
          await Counter.findOneAndUpdate(
            { _id: plainCounterId(companyId, module) },
            { $max: { seq: max } },
            opts
          );
        }
      } catch {
        /* ignore */
      }
    }
    let seq = await Counter.nextSeq(plainCounterId(companyId, module), session);
    if (seq >= 2000000000 && seq <= 2099999999) {
      seq = (seq % 10000) || 1;
    }
    if (seq >= 100000 && seq < 2000000000) {
      seq = 1;
    }
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
