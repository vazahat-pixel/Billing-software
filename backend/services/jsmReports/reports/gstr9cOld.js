'use strict';

/**
 * JSM: Reports › Gst Reports › Gstr-9 › Gstr-9C Old (xOld_Rpt_Jsm_GSTR9_All_Excel_Report, GSTR_9C.xlsx).
 *
 * Produces the 9 sheets of GSTR_9C.xlsx backed by sales/purchase/return/note registers:
 *   OUTWARD SUPPLY - B2B, OUTWARD SUPPLY - B2C, DEBIT NOTE, CREDIT NOTE,
 *   OUTWARD SUPPLY - HSN, INWARD SUPPLY - HSN, EXEMP.ALL, SL.TAXRATE, PU.TAXRATE.
 * Refuses the 6 sheets requiring JSM tables/heads not present in MERN:
 *   REVERCE CHARGE (RCM all-register + JV summary), ITC - INPUT / ITC - SERVICE /
 *   ITC - CAP.GOODS (T_JV_GST GST_TYPE heads), TAX PAID (GST challan JVs), INWARD SUPPLY (EXP_HEAD).
 */
const { orderRows, inDateRange, groupBy, round, MONTHS } = require('../jcEngine');
const src = require('../sources/billRegister');

const SHEETS = [
  'OUTWARD SUPPLY - B2B', 'OUTWARD SUPPLY - B2C', 'DEBIT NOTE', 'CREDIT NOTE',
  'OUTWARD SUPPLY - HSN', 'INWARD SUPPLY - HSN', 'EXEMP.ALL', 'SL.TAXRATE', 'PU.TAXRATE',
];
const UNAVAILABLE = [
  'REVERCE CHARGE', 'ITC - INPUT', 'ITC - SERVICE', 'ITC - CAP.GOODS', 'TAX PAID', 'INWARD SUPPLY',
];

const hasTax = (b) => Math.abs(Number(b.SGST_AMT || 0)) + Math.abs(Number(b.CGST_AMT || 0)) + Math.abs(Number(b.IGST_AMT || 0)) > 0.004;
const registered = (b) => String(b.GSTIN_NO || '').trim() !== '';

const monthOf = (b) => {
  const d = b.BILL_DATE ? new Date(b.BILL_DATE) : null;
  return d && !Number.isNaN(d.getTime())
    ? { MONTH_NAME: MONTHS[d.getUTCMonth()], MONTH_NO: d.getUTCMonth() + 1, YEAR_NO: d.getUTCFullYear() }
    : { MONTH_NAME: '', MONTH_NO: 0, YEAR_NO: 0 };
};

const signed = (b, sign) => ({
  ...b,
  ...monthOf(b),
  NET_TOT: sign * Number(b.NET_TOT || 0),
  TAXABLE_AMT: sign * Number(b.TAXABLE_AMT || 0),
  IGST_AMT: sign * Number(b.IGST_AMT || 0),
  CGST_AMT: sign * Number(b.CGST_AMT || 0),
  SGST_AMT: sign * Number(b.SGST_AMT || 0),
  _sign: sign,
});

const SUM = ['NET_TOT', 'TAXABLE_AMT', 'IGST_AMT', 'CGST_AMT', 'SGST_AMT'];

function monthlyBook(bills) {
  const g = groupBy(bills, ['YEAR_NO', 'MONTH_NO', 'BOOK'], { sum: SUM });
  return orderRows(g.map((r) => ({
    MONTH_NAME: MONTHS[r.MONTH_NO - 1] || '', BOOK: r.BOOK,
    TAXABLE_AMT: round(r.TAXABLE_AMT), IGST_AMT: round(r.IGST_AMT),
    CGST_AMT: round(r.CGST_AMT), SGST_AMT: round(r.SGST_AMT), NET_TOT: round(r.NET_TOT),
    YEAR_NO: r.YEAR_NO, MONTH_NO: r.MONTH_NO,
  })), [{ field: 'YEAR_NO', dir: 'asc', numeric: true }, { field: 'MONTH_NO', dir: 'asc', numeric: true }, 'BOOK']);
}

function monthlyFlat(bills, label) {
  const g = groupBy(bills, ['YEAR_NO', 'MONTH_NO'], { sum: SUM });
  return orderRows(g.map((r) => ({
    MONTH_NAME: MONTHS[r.MONTH_NO - 1] || '', BOOK: label || '',
    TAXABLE_AMT: round(r.TAXABLE_AMT), IGST_AMT: round(r.IGST_AMT),
    CGST_AMT: round(r.CGST_AMT), SGST_AMT: round(r.SGST_AMT), NET_TOT: round(r.NET_TOT),
    YEAR_NO: r.YEAR_NO, MONTH_NO: r.MONTH_NO,
  })), [{ field: 'YEAR_NO', dir: 'asc', numeric: true }, { field: 'MONTH_NO', dir: 'asc', numeric: true }]);
}

function lineRows(bills) {
  const out = [];
  for (const b of bills) {
    for (const l of b._lines || []) {
      out.push({
        TYPE: b.BOOK || '', HSN_CODE: l.HSN_CODE || '', UNIT_NAME: l.UNIT_NAME || '',
        TAX_RATE: round(l.IT_GST_PER),
        IT_QTY: b._sign * Number(l.IT_QTY || 0),
        TAXABLE_AMT: b._sign * Number(l.IT_TAXABLE || 0),
        IGST_AMT: b._sign * Number(l.IT_IGST_A || 0),
        CGST_AMT: b._sign * Number(l.IT_CGST_A || 0),
        SGST_AMT: b._sign * Number(l.IT_SGST_A || 0),
        NET_TOT: b._sign * (Number(l.IT_TAXABLE || 0) + Number(l.IT_GST_AMT || 0)),
        HAS_TAX: Number(l.IT_GST_AMT || 0) > 0.004,
      });
    }
  }
  return out;
}

const hsnWise = (lines) => orderRows(groupBy(lines, ['TYPE', 'HSN_CODE', 'TAX_RATE'],
  { sum: ['IT_QTY', 'TAXABLE_AMT', 'NET_TOT', 'IGST_AMT', 'CGST_AMT', 'SGST_AMT'] }, (f) => ({ UNIT_NAME: f.UNIT_NAME }))
  .map((r) => ({
    TYPE: r.TYPE, HSN_CODE: r.HSN_CODE, QUC: r.UNIT_NAME, NET_QTY: round(r.IT_QTY),
    TAXABLE_AMT: round(r.TAXABLE_AMT), NET_AMOUNT: round(r.NET_TOT), IGST_AMT: round(r.IGST_AMT),
    CGST_AMT: round(r.CGST_AMT), SGST_AMT: round(r.SGST_AMT), A_TAX_RATE: '', TAX_RATE: r.TAX_RATE,
  })), ['TYPE', 'HSN_CODE']);

const rateWise = (lines) => orderRows(groupBy(lines, ['TAX_RATE'], { sum: ['TAXABLE_AMT', 'IGST_AMT', 'CGST_AMT', 'SGST_AMT'] })
  .map((r) => ({
    TAX_RATE: r.TAX_RATE, TAXABLE_AMT: round(r.TAXABLE_AMT), IGST_AMT: round(r.IGST_AMT),
    CGST_AMT: round(r.CGST_AMT), SGST_AMT: round(r.SGST_AMT), CESS: 0,
  })), [{ field: 'TAX_RATE', dir: 'asc', numeric: true }]);

async function loadNotes(companyId, noteType, from, to) {
  const DebitCreditNote = require('../../../models/DebitCreditNote');
  const notes = await DebitCreditNote.find({ companyId, noteType }).lean();
  return inDateRange(notes.map((n) => ({ ...n, BILL_DATE: n.date })), 'BILL_DATE', from, to)
    .map((n) => ({
      ...monthOf(n), BOOK: n.accountHeadName || noteType.toUpperCase(),
      TAXABLE_AMT: Number(n.taxableAmount || 0), IGST_AMT: Number(n.igst || 0),
      CGST_AMT: Number(n.cgst || 0), SGST_AMT: Number(n.sgst || 0),
      NET_TOT: Number(n.netAmount ?? n.totalAmount ?? n.amount ?? 0),
    }));
}

function exemptRows(sl, pu) {
  const slEx = orderRows(groupBy(sl.filter((b) => !hasTax(b)), ['YEAR_NO', 'MONTH_NO'], { sum: SUM }).map((r) => ({
    TYPE: 'SL', MONTH_NAME: MONTHS[r.MONTH_NO - 1] || '',
    TAXABLE_AMT: round(r.TAXABLE_AMT), SGST_AMT: 0, CGST_AMT: 0, IGST_AMT: 0, NET_VALUE: round(r.NET_TOT), NET_TOT: round(r.NET_TOT),
  })), ['MONTH_NAME']);
  const puEx = orderRows(groupBy(pu.filter((b) => !hasTax(b)), ['YEAR_NO', 'MONTH_NO', 'BOOK'], { sum: SUM }).map((r) => ({
    TYPE: r.BOOK || 'PU', MONTH_NAME: MONTHS[r.MONTH_NO - 1] || '',
    TAXABLE_AMT: round(r.TAXABLE_AMT), SGST_AMT: 0, CGST_AMT: 0, IGST_AMT: 0, NET_VALUE: round(r.NET_TOT), NET_TOT: round(r.NET_TOT),
  })), ['TYPE', 'MONTH_NAME']);
  return [...slEx, ...puEx];
}

async function run(companyId, p = {}, deps = {}) {
  const wanted = (p.sheets && p.sheets.length ? p.sheets : SHEETS);
  const unknown = wanted.filter((s) => ![...SHEETS, ...UNAVAILABLE].includes(s));
  if (unknown.length) {
    const err = new Error(`Unknown sheet: ${unknown.join(', ')}`);
    err.status = 400;
    throw err;
  }
  const missing = wanted.filter((s) => UNAVAILABLE.includes(s));
  if (missing.length) {
    const err = new Error(`${missing.join(', ')}: this software does not record JSM's JV GST category heads (Inputs / Input services / Capital goods), RCM all-register or GST challan tax-paid JVs, so these sheets are not produced`);
    err.status = 400;
    throw err;
  }

  const [sales, purchases, salesRtn, purchaseRtn] = await Promise.all([
    deps.sales || src.loadSalesRegisterRows(companyId),
    deps.purchases || src.loadPurchaseRegisterRows(companyId),
    deps.salesRtn || src.loadReturnRegisterRows(companyId, 'Sales'),
    deps.purchaseRtn || src.loadReturnRegisterRows(companyId, 'Purchase'),
  ]);
  const within = (rows) => inDateRange(rows, 'BILL_DATE', p.from, p.to);
  const sl = [...within(sales).map((b) => signed(b, 1)), ...within(salesRtn).map((b) => signed(b, -1))];
  const pu = [...within(purchases).map((b) => signed(b, 1)), ...within(purchaseRtn).map((b) => signed(b, -1))];
  const slLines = lineRows(sl);
  const puLines = lineRows(pu);

  const builders = {
    'OUTWARD SUPPLY - B2B': () => monthlyBook(sl.filter(registered).filter(hasTax)),
    'OUTWARD SUPPLY - B2C': () => monthlyBook(sl.filter((b) => !registered(b)).filter(hasTax)),
    'DEBIT NOTE': async () => monthlyFlat(deps.notes?.['DEBIT NOTE'] || await loadNotes(companyId, 'Debit', p.from, p.to), 'DN'),
    'CREDIT NOTE': async () => monthlyFlat(deps.notes?.['CREDIT NOTE'] || await loadNotes(companyId, 'Credit', p.from, p.to), 'CN'),
    'OUTWARD SUPPLY - HSN': () => hsnWise(slLines.filter((r) => r.HAS_TAX)),
    'INWARD SUPPLY - HSN': () => hsnWise(puLines.filter((r) => r.HAS_TAX)),
    'EXEMP.ALL': () => exemptRows(sl, pu),
    'SL.TAXRATE': () => rateWise(slLines.filter((r) => r.HAS_TAX)),
    'PU.TAXRATE': () => rateWise(puLines.filter((r) => r.HAS_TAX)),
  };

  const rows = [];
  for (const name of wanted) {
    const sheetRows = await builders[name]();
    for (const r of sheetRows) rows.push({ SHEET: name, ...r });
  }

  return {
    rows,
    grid: {
      layout: 'JSM_VW_GSTR9C_OLD',
      variant: 1,
      groupColumns: ['SHEET'],
      groupDisplays: ['SHEET'],
      captions: {},
      title: 'Gstr-9C Working Sheets',
      period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
      pageWise: false,
      notice: `Skipped (not in MERN): ${UNAVAILABLE.join(', ')}`,
    },
  };
}

async function options() { return { sheets: SHEETS, unavailable: UNAVAILABLE }; }

module.exports = { run, options, SHEETS, UNAVAILABLE };

