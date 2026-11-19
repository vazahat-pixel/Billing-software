'use strict';

/**
 * JSM: Reports › Tds Reports › Head Wise Report / Tds Register (Rpt_TdsReports) and
 *      Reports › Tcs Reports › Tcs Sales Register / Tcs Purchase Register (Rpt_TcsReports).
 *
 * JSM reads JSM_VW_TDS_BOOK (T_TDS_BOOK) and JSM_VW_TCS_BOOK / JSM_VW_TCS_BOOK_PURCHASE, filters on
 * the date and the ticked Party / TdsHead / TdsPer, then either lists the entries (detail) or groups
 * them (Summary Reports), with Month as YEAR_NO, MONTH_NO order, as the Report-type combo says.
 *
 * Here the TDS book is the deduction register (TaxDeduction) plus the TDS recorded on purchase bills
 * and debit/credit notes that the register does not already hold; the TCS book is the TCS saved on
 * sales bills (less sales returns) and purchase bills. Amounts are read as saved, never recomputed.
 */
const { orderRows, inList, inDateRange, groupBy, round, MONTHS } = require('../jcEngine');

// Report-type combo -> grouping fields (display), summary GROUP BY and detail ORDER BY (JSM's own lists).
const TDS_MODES = {
  TdsHead: { show: ['TDSHEAD'], sumBy: ['TDSHEAD'], order: ['TDSHEAD'] },
  'TdsHead+Month': { show: ['TDSHEAD', 'MONTH'], sumBy: ['TDSHEAD', 'MONTH'], order: ['TDSHEAD', 'YEAR_NO', 'MONTH_NO'] },
  'TdsHead+Month+Party': { show: ['TDSHEAD', 'MONTH', 'PARTY'], sumBy: ['TDSHEAD', 'MONTH', 'PARTY'], order: ['TDSHEAD', 'YEAR_NO', 'MONTH_NO', 'PARTY'] },
  'Month+TdsHead': { show: ['MONTH', 'TDSHEAD'], sumBy: ['MONTH', 'TDSHEAD'], order: ['YEAR_NO', 'MONTH_NO', 'TDSHEAD'] },
  'Month+Party': { show: ['MONTH', 'PARTY'], sumBy: ['MONTH', 'PARTY'], order: ['YEAR_NO', 'MONTH_NO', 'PARTY'] },
  'Month+TdsHead+Party': { show: ['MONTH', 'TDSHEAD', 'PARTY'], sumBy: ['MONTH', 'TDSHEAD', 'PARTY', 'TDS_PER'], order: ['YEAR_NO', 'MONTH_NO', 'TDSHEAD', 'PARTY'] },
  'Month+TdsHead+CompNon+Party': { show: ['MONTH', 'TDSHEAD', 'COMP_NON', 'PARTY'], sumBy: ['MONTH', 'TDSHEAD', 'PARTY', 'TDS_PER', 'COMP_NON'], order: ['YEAR_NO', 'MONTH_NO', 'TDSHEAD', 'COMP_NON', 'TDS_PER', 'PARTY'] },
  'TdsHead+Party': { show: ['TDSHEAD', 'PARTY'], sumBy: ['MONTH', 'TDSHEAD', 'PARTY', 'TDS_PER'], order: ['YEAR_NO', 'MONTH_NO', 'TDSHEAD', 'PARTY'] },
  'Month+TdsHead+TdsPer': { show: ['MONTH', 'TDSHEAD', 'TDS_P_COMP_NON'], sumBy: ['MONTH', 'TDSHEAD', 'PARTY', 'TDS_PER', 'COMP_NON'], order: ['YEAR_NO', 'MONTH_NO', 'TDSHEAD', 'TDS_P_COMP_NON', 'TDS_PER', 'PARTY'] },
};

const bad = (message) => Object.assign(new Error(message), { status: 400 });
const monthParts = (d) => {
  const t = new Date(d);
  return { YEAR_NO: t.getFullYear(), MONTH_NO: t.getMonth() + 1, MONTH: MONTHS[t.getMonth()] };
};
const compNon = (pan) => (String(pan || '').charAt(3).toUpperCase() === 'C' ? 'COMP' : 'NON-COMP');
const num = (v) => Number(v) || 0;

async function companyName(companyId) {
  const Company = require('../../../models/Company');
  const co = await Company.findById(companyId).select('name').lean();
  return co?.name || '';
}

function tdsRow(base, r) {
  const comp = compNon(r.PANNO);
  return {
    ...base,
    ...monthParts(r.ENT_DATE),
    SRAL_NO: 0,
    TDS_P: r.TDS_PER,
    TDS_A: r.TDS_AMT,
    SUR_P: 0, SUR_A: 0, EDU_P: 0, EDU_A: 0,
    CHQ_DDNO: '', PAY_DATE: null, BSR_CODE: '', TRNS_VOU: '', CHALLAN_CP: '',
    COMP_NON: comp,
    TDS_P_COMP_NON: `${Number(r.TDS_PER || 0).toFixed(2)} / ${comp}`,
    ...r,
  };
}

async function loadTdsBook(companyId) {
  const TaxDeduction = require('../../../models/TaxDeduction');
  const Purchase = require('../../../models/Purchase');
  const DebitCreditNote = require('../../../models/DebitCreditNote');
  require('../../../models/Party');
  const Job = require('../../../models/Job');
  const [company, deductions, purchases, notes, receipts] = await Promise.all([
    companyName(companyId),
    TaxDeduction.find({ companyId, deductionType: 'TDS', status: { $ne: 'Reversed' }, isDeleted: { $ne: true } }).lean(),
    Purchase.find({ companyId, tdsAmount: { $gt: 0 }, status: { $ne: 'cancelled' } })
      .populate('supplierId', 'name pan tdsSection tdsPer').lean(),
    DebitCreditNote.find({ companyId, tdsAmount: { $gt: 0 }, status: { $ne: 'Cancelled' } })
      .populate('partyId', 'name pan tdsSection tdsPer').lean(),
    // Mill / Job receipts: the TDS deducted on the receipt's bill (kept on its first line).
    Job.find({ companyId, receiveTdsAmount: { $gt: 0 }, isDeleted: { $ne: true } })
      .populate('workerId', 'name pan tdsSection tdsPer').lean(),
  ]);
  const base = { COMPANY: company, DOB_DATE: null };
  const out = [];
  const covered = new Set();
  for (const d of deductions) {
    if (d.refId) covered.add(String(d.refId));
    out.push(tdsRow(base, {
      ENT_NO: 0, ENT_DATE: d.transactionDate, TDSHEAD: d.section || 'TDS ACCOUNT', PARTY: d.partyName || '',
      PANNO: d.pan || '', AMOUNT: round(d.taxableAmount), TDS_PER: num(d.rate), TDS_AMT: round(d.deductedAmount),
      NCBILL_NO: d.refNo || '', SP_TYPE: d.refType || '',
    }));
  }
  for (const b of purchases) {
    if (covered.has(String(b._id))) continue;
    const taxable = num(b.taxableAmount);
    out.push(tdsRow(base, {
      ENT_NO: 0, ENT_DATE: b.date, TDSHEAD: b.supplierId?.tdsSection || 'TDS ACCOUNT', PARTY: b.supplierId?.name || '',
      PANNO: b.supplierId?.pan || '', AMOUNT: round(taxable),
      TDS_PER: num(b.supplierId?.tdsPer) || (taxable ? round((num(b.tdsAmount) / taxable) * 100, 4) : 0),
      TDS_AMT: round(b.tdsAmount), NCBILL_NO: b.supplierInvoiceNo || b.invoiceNo || '', SP_TYPE: 'Purchase',
    }));
  }
  for (const n of notes) {
    if (covered.has(String(n._id))) continue;
    out.push(tdsRow(base, {
      ENT_NO: 0, ENT_DATE: n.date, TDSHEAD: n.partyId?.tdsSection || 'TDS ACCOUNT', PARTY: n.partyId?.name || '',
      PANNO: n.partyId?.pan || '', AMOUNT: round(n.taxableAmount), TDS_PER: num(n.tdsPercent), TDS_AMT: round(n.tdsAmount),
      NCBILL_NO: n.noteNo || '', SP_TYPE: `${n.noteType || ''} Note`,
    }));
  }
  for (const j of receipts) {
    if (covered.has(String(j._id))) continue;
    const w = j.workerId && typeof j.workerId === 'object' ? j.workerId : {};
    const taxable = num(j.receiveTdsBase);
    out.push(tdsRow(base, {
      ENT_NO: 0, ENT_DATE: j.receiveDate || j.updatedAt, TDSHEAD: w.tdsSection || 'TDS ACCOUNT', PARTY: w.name || '',
      PANNO: w.pan || '', AMOUNT: round(taxable),
      TDS_PER: num(j.receiveTdsPercent) || (taxable ? round((num(j.receiveTdsAmount) / taxable) * 100, 4) : 0),
      TDS_AMT: round(j.receiveTdsAmount), NCBILL_NO: j.billGpNo || '', SP_TYPE: j.workKind === 'Job' ? 'Job Receipt' : 'Mill Receipt',
    }));
  }
  for (const j of receipts) covered.add(String(j._id));
  out.push(...await ledgerTdsRows(companyId, base, covered));
  return out.map((r, i) => ({ ...r, ENT_NO: i + 1, SRAL_NO: i + 1 }));
}

/**
 * TDS deducted as the books record it: a voucher that credits a TDS ledger ("TDS ACCOUNT", "TDS ON
 * JOBWORK", ...) against a party's debit — how JSM's mill / job bills and journals carry it, and how an
 * imported company holds all of its TDS (the JSM TDS book itself is not imported). The TDS head is the
 * TDS ledger's name, the amount paid is the bill's own charge (its expense lines). A TDS ledger on the
 * debit side is a payment of TDS to the government, not a deduction, and is left out. Read-only.
 */
async function ledgerTdsRows(companyId, base, covered) {
  const LedgerMaster = require('../../../models/LedgerMaster');
  const AccountingEntry = require('../../../models/AccountingEntry');
  const Party = require('../../../models/Party');
  const Job = require('../../../models/Job');
  const ledgers = await LedgerMaster.find({ companyId }).select('name group linkedPartyId').lean();
  const byId = new Map(ledgers.map((l) => [String(l._id), l]));
  const tdsIds = ledgers.filter((l) => /\btds\b/i.test(l.name || '')).map((l) => l._id);
  if (!tdsIds.length) return [];
  const tdsSet = new Set(tdsIds.map(String));
  const entries = await AccountingEntry.find({
    companyId, isReversed: { $ne: true }, status: { $ne: 'Reversed' },
    lines: { $elemMatch: { ledgerId: { $in: tdsIds }, type: 'Cr' } },
  }).lean();
  const partyIds = new Set(ledgers.filter((l) => l.linkedPartyId).map((l) => String(l.linkedPartyId)));
  const parties = new Map((await Party.find({ _id: { $in: [...partyIds] } }).select('name pan').lean()).map((p) => [String(p._id), p]));
  const jobIds = entries.filter((e) => e.refType === 'JobWorkCharges' && e.refId).map((e) => e.refId);
  const jobs = new Map((await Job.find({ _id: { $in: jobIds } }).select('processBillNo billGpNo challanNo').lean()).map((j) => [String(j._id), j]));

  const out = [];
  for (const e of entries) {
    if (e.refId && covered.has(String(e.refId))) continue;
    const lines = e.lines || [];
    const expense = round(lines.reduce((s, ln) => {
      const l = byId.get(String(ln.ledgerId));
      if (!l || l.group !== 'Expenses') return s;
      return s + (ln.type === 'Dr' ? 1 : -1) * Number(ln.amount || 0);
    }, 0));
    for (const t of lines.filter((ln) => ln.type === 'Cr' && tdsSet.has(String(ln.ledgerId)))) {
      const amt = round(t.amount);
      if (amt <= 0) continue;
      // the party the TDS was cut from: a party ledger debited with the same amount, else any party ledger
      const partyLine = lines.find((ln) => ln.type === 'Dr' && byId.get(String(ln.ledgerId))?.linkedPartyId && Math.abs(Number(ln.amount) - amt) < 0.01)
        || lines.find((ln) => byId.get(String(ln.ledgerId))?.linkedPartyId)
        // no party account on the voucher (a journal against a loan / other account): name that account
        || lines.filter((ln) => ln.type === 'Dr' && !tdsSet.has(String(ln.ledgerId)) && byId.get(String(ln.ledgerId))?.group !== 'Expenses')
          .sort((a, b) => Math.abs(Number(a.amount) - amt) - Math.abs(Number(b.amount) - amt))[0];
      // only TDS heads on the voucher: a transfer between TDS heads, not a deduction
      if (!partyLine) continue;
      const partyLedger = byId.get(String(partyLine.ledgerId));
      const party = partyLedger ? parties.get(String(partyLedger.linkedPartyId)) : null;
      const job = e.refId ? jobs.get(String(e.refId)) : null;
      out.push(tdsRow(base, {
        ENT_NO: 0, ENT_DATE: e.entryDate, TDSHEAD: byId.get(String(t.ledgerId))?.name || 'TDS ACCOUNT',
        PARTY: party?.name || partyLedger?.name || '', PANNO: party?.pan || '',
        AMOUNT: expense > 0 ? expense : 0, TDS_PER: expense > 0 ? round((amt / expense) * 100) : 0, TDS_AMT: amt,
        NCBILL_NO: job?.processBillNo || job?.billGpNo || e.entryNo || '',
        SP_TYPE: e.refType === 'JobWorkCharges' ? 'Mill / Job Bill' : (e.refType || 'Journal'),
      }));
    }
  }
  return out;
}

// JSM's Account / Acc Head tick-lists hold every account, not only the ones that already have TDS
// entries — an empty book must still show the party list (and the TDS sections set on the masters).
async function masterTdsLists(companyId) {
  try {
    const Party = require('../../../models/Party');
    const masterId = await require('../../companyGroupService').masterId(companyId);
    const parties = await Party.find({ companyId: masterId, isDeleted: { $ne: true } }).select('name tdsSection').lean();
    return { parties: parties.map((x) => x.name), heads: parties.map((x) => x.tdsSection) };
  } catch (_) {
    return { parties: [], heads: [] };
  }
}
const uniqSorted = (vals) => [...new Set(vals.filter((v) => String(v ?? '').trim() !== ''))]
  .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));

const period = (p) => `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`;

function tdsReport() {
  async function run(companyId, p = {}, deps = {}) {
    const mode = String(p.group || 'Month+TdsHead+Party');
    const spec = TDS_MODES[mode];
    if (!spec) throw bad(`Unknown Report Type: ${mode}`);

    let rows = deps.rows || await loadTdsBook(companyId);
    rows = inDateRange(rows, 'ENT_DATE', p.from, p.to);
    rows = inList(rows, 'PARTY', p.parties);
    rows = inList(rows, 'TDSHEAD', p.heads);
    if (Array.isArray(p.pers) && p.pers.length) {
      const want = new Set(p.pers.map((v) => Number(v)));
      rows = rows.filter((r) => want.has(Number(r.TDS_PER)));
    }

    const orderKeys = spec.order.map((f) => (f === 'YEAR_NO' || f === 'MONTH_NO' ? { field: f, numeric: true } : f));
    const grid = {
      // JSM keeps one column format per Report Type: the combo's position, counted from 1.
      variant: Object.keys(TDS_MODES).indexOf(mode) + 1,
      groupColumns: spec.show,
      groupDisplays: spec.show,
      captions: {},
      period: period(p),
      pageWise: String(p.printout || '').startsWith('2'),
    };

    if (p.summary) {
      const grouped = groupBy(rows, spec.sumBy, { sum: ['AMOUNT', 'TDS_AMT'], max: ['PANNO', 'TDS_PER', 'YEAR_NO', 'MONTH_NO', 'MONTH', 'COMPANY', 'DOB_DATE', 'COMP_NON', 'TDS_P_COMP_NON'] })
        .map((r) => ({ ...r, AMOUNT: round(r.AMOUNT), TDS_AMT: round(r.TDS_AMT) }));
      return {
        rows: orderRows(grouped, orderKeys),
        grid: { ...grid, layout: 'JSM_VW_TDS_BOOK_SUMMARYREPORT', title: `${spec.show[0]} Wise TdsReport` },
      };
    }
    return {
      rows: orderRows(rows, [...orderKeys, 'ENT_DATE', { field: 'SRAL_NO', numeric: true }]),
      grid: { ...grid, layout: 'JSM_VW_TDS_BOOK_DETAILREPORT', primaryDetailColumn: 'ENT_NO', title: `${spec.show[0]} Wise TdsReport` },
    };
  }

  async function options(companyId, deps = {}) {
    const rows = deps.rows || await loadTdsBook(companyId);
    const master = deps.rows ? { parties: [], heads: [] } : await masterTdsLists(companyId);
    const u = (f) => uniqSorted(rows.map((r) => r[f]));
    return {
      parties: uniqSorted([...u('PARTY'), ...master.parties]),
      heads: uniqSorted([...u('TDSHEAD'), ...master.heads]),
      pers: u('TDS_PER').map(String),
    };
  }
  return { run, options };
}

async function loadTcsBook(companyId, kind) {
  require('../../../models/Party');
  const company = await companyName(companyId);
  const sales = kind === 'sales';
  const Doc = require(sales ? '../../../models/Sales' : '../../../models/Purchase');
  const docs = await Doc.find({ companyId, status: { $ne: 'cancelled' } })
    .populate(sales ? 'customerId' : 'supplierId', 'name pan').lean();
  let returns = [];
  if (sales) {
    const ReturnInvoice = require('../../../models/ReturnInvoice');
    returns = await ReturnInvoice.find({ companyId, returnType: 'Sales' }).populate('partyId', 'name pan').lean();
  }
  const mk = (d, party, sign, tcsAmt, tcsPer) => ({
    COMPANY: company,
    TCSHEAD: 'TCS',
    PARTY: party?.name || '',
    PANNO: party?.pan || '',
    ...monthParts(d.date),
    TCS_PER: sign * num(tcsPer),
    TCS_AMT: sign * round(tcsAmt),
    TAXABLE_AMT: sign * round(d.taxableAmount),
    NET_TOT: sign * round(d.netAmount),
    BILL_DATE: d.date,
    NCBILL_NO: sales ? d.invoiceNo : (d.supplierInvoiceNo || d.invoiceNo),
    ENT_NO: parseInt(String(d.invoiceNo || '').replace(/\D/g, ''), 10) || 0,
    T_TDS_PER: 0,
    T_TDS_AMT: 0,
  });
  const out = docs.map((d) => (sales
    ? mk(d, d.customerId, 1, d.tcsAmount || d.tcs, d.tcsPer)
    : mk(d, d.supplierId, 1, d.tcsAmt, d.tcsRate)));
  for (const r of returns) {
    const amt = num(r.tcs);
    if (amt) out.push(mk(r, r.partyId, -1, amt, 0));
  }
  return out.filter((r) => r.TCS_AMT !== 0 || r.T_TDS_AMT !== 0);
}

function tcsReport(kind) {
  async function run(companyId, p = {}, deps = {}) {
    let rows = deps.rows || await loadTcsBook(companyId, kind);
    rows = inDateRange(rows, 'BILL_DATE', p.from, p.to);
    rows = inList(rows, 'PARTY', p.parties);
    const noun = kind === 'sales' ? 'Sales' : 'Purchase';
    const grid = {
      variant: 1,
      groupColumns: ['MONTH', 'TCSHEAD'],
      groupDisplays: ['MONTH', 'TCSHEAD'],
      captions: {},
      period: period(p),
      pageWise: String(p.printout || '').startsWith('2'),
      title: `Month Wise TCS ${noun} Report`,
    };
    const order = [{ field: 'YEAR_NO', numeric: true }, { field: 'MONTH_NO', numeric: true }, 'TCSHEAD'];
    if (p.summary) {
      const grouped = groupBy(rows, ['MONTH', 'TCSHEAD', 'PARTY', 'TCS_PER'], {
        sum: ['TAXABLE_AMT', 'NET_TOT', 'TCS_AMT', 'T_TDS_AMT'],
        max: ['PANNO', 'YEAR_NO', 'MONTH_NO', 'COMPANY', 'ENT_NO', 'T_TDS_PER'],
      }).map((r) => ({ ...r, TAXABLE_AMT: round(r.TAXABLE_AMT), NET_TOT: round(r.NET_TOT), TCS_AMT: round(r.TCS_AMT), T_TDS_AMT: round(r.T_TDS_AMT) }));
      return { rows: orderRows(grouped, [...order, 'PARTY']), grid: { ...grid, layout: 'TCS_SUMMARYREPORT' } };
    }
    return {
      rows: orderRows(rows, [...order, 'BILL_DATE', { field: 'ENT_NO', numeric: true }]),
      grid: { ...grid, layout: 'TCS_DETAILREPORT', primaryDetailColumn: 'ENT_NO' },
    };
  }
  async function options(companyId, deps = {}) {
    const rows = deps.rows || await loadTcsBook(companyId, kind);
    return { parties: [...new Set(rows.map((r) => r.PARTY).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b))) };
  }
  return { run, options };
}

/**
 * Reports › Tds Reports › Party Wise Report / Party Wise Monthly Report (Rpt_Tds2_Prty_Mnth_Wise):
 * JSM prints these from Crystal templates; the data is its TMP_VW_TDS view (entries in the date range,
 * for the ticked accounts or TDS heads). Party Wise groups by party, Monthly by month; Detail lists the
 * entries, Summary one line per group; "With Chq Detail" adds the payment columns.
 */
function tdsPartyMonthReport() {
  async function run(companyId, p = {}, deps = {}) {
    const monthly = String(p.mode || 'P').toUpperCase() === 'M';
    let rows = deps.rows || await loadTdsBook(companyId);
    rows = inDateRange(rows, 'ENT_DATE', p.from, p.to);
    rows = inList(rows, p.byHead ? 'TDSHEAD' : 'PARTY', p.accounts);
    const key = monthly ? 'MONTH' : 'PARTY';
    const order = monthly ? [{ field: 'YEAR_NO', numeric: true }, { field: 'MONTH_NO', numeric: true }, 'PARTY'] : ['PARTY'];
    const grid = {
      layout: 'RPT_TDS_PARTY_MONTH',
      variant: p.withChq ? 2 : 1,
      groupColumns: p.summary ? [] : [key],
      groupDisplays: p.summary ? [] : [monthly ? 'MONTH' : 'PARTY'],
      captions: {},
      title: `${monthly ? 'Month' : 'Party'} Wise TDS Report`,
      period: period(p),
      pageWise: false,
    };
    if (p.summary) {
      const g = groupBy(rows, monthly ? ['MONTH'] : ['PARTY'], { sum: ['AMOUNT', 'TDS_AMT'], max: ['PANNO', 'YEAR_NO', 'MONTH_NO', 'TDSHEAD'] })
        .map((r) => ({ ...r, AMOUNT: round(r.AMOUNT), TDS_AMT: round(r.TDS_AMT) }));
      return { rows: orderRows(g, order), grid };
    }
    return { rows: orderRows(rows, [...order, 'ENT_DATE', { field: 'SRAL_NO', numeric: true }]), grid };
  }
  async function options(companyId, deps = {}) {
    const rows = deps.rows || await loadTdsBook(companyId);
    const master = deps.rows ? { parties: [], heads: [] } : await masterTdsLists(companyId);
    const u = (f) => uniqSorted(rows.map((r) => r[f]));
    return { parties: uniqSorted([...u('PARTY'), ...master.parties]), heads: uniqSorted([...u('TDSHEAD'), ...master.heads]) };
  }
  return { run, options };
}

module.exports = {
  tds: tdsReport(),
  tdsPartyMonth: tdsPartyMonthReport(),
  tcsSales: tcsReport('sales'),
  tcsPurchase: tcsReport('purchase'),
  TDS_MODES,
  loadTdsBook,
  masterTdsLists,
  uniqSorted,
};
