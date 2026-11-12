'use strict';

/**
 * JSM: Reports › Gst Reports › Gstr-9 › Gstr-9 Old (Rpt_Jsm_GSTR9_Excel, GSTR_9.xlsx).
 *
 * The annual-return working sheets JSM fills into its own GSTR_9.xlsx. Each sheet is a grouping of
 * the same registers, and its own LoadData builds them (TEMP_B2B_FOR_GSTR9 and friends):
 *
 *   SALES - BOOK WISE      SUM(NET_TOT, TAXABLE, IGST, CGST, SGST) by BOOK and month over sales whose
 *                          GSTIN is set and whose tax is not zero, with sales returns taken as
 *                          negatives (UNION ALL … -SUM(…) FROM the sales-return summary)
 *   SL.NONGST / PU.NONGST  the same for the bills carrying no tax
 *   SALES / PURCHASE TAX RATE WISE   by GST rate
 *   SALES / PURCHASE HSN WISE        by HSN, with the unit and quantity
 *   B2C(UNREG)             the unregistered sales, a line per bill and rate
 *   CDNR / DBNR REG/UNREG  credit and debit notes by month, split on whether the party has a GSTIN
 *
 * The sheets whose source JSM reads from tables this software has no counterpart for — RCM month
 * wise (its reverse-charge register) and ITC ALL (its input / input-service / capital-goods
 * journal heads) — are not produced; they are listed as unavailable rather than filled with
 * guesses. Everything here is read from the registers' own stored tax; nothing is recomputed.
 */
const { orderRows, inDateRange, groupBy, round, MONTHS } = require('../jcEngine');
const src = require('../sources/billRegister');

const SHEETS = [
  'SALES - BOOK WISE', 'PURCHASE - BOOK WISE', 'B2C(UNREG)', 'B2C - HSN WISE(UNREG)',
  'CDNR - REG', 'CDNR - UNREG', 'DBNR - REG', 'DBNR - UNREG',
  'SALES - HSN WISE', 'SALES TAX RATE WISE', 'PURCHASE - TAXRATE WISE', 'PURCHASE - HSN WISE',
  'SL.NONGST', 'PU.NONGST', 'B2CREG.NONGST', 'B2CHSN.NONGST', 'DBCDNR.NONGST',
  'SL.HSN.NONGST', 'PU.HSN.NONGST', 'SL.TAX.NONGST', 'PU.TAX.NONGST',
];
const UNAVAILABLE = ['RCM MONTH WISE', 'ITC ALL', 'RCM.NONGST', 'ITC.NONGST'];

const hasTax = (b) => Math.abs(Number(b.SGST_AMT || 0)) + Math.abs(Number(b.CGST_AMT || 0)) + Math.abs(Number(b.IGST_AMT || 0)) > 0.004;
const registered = (b) => String(b.GSTIN_NO || '').trim() !== '';

const monthOf = (b) => {
  const d = b.BILL_DATE ? new Date(b.BILL_DATE) : null;
  return d ? { MONTH_NAME: MONTHS[d.getUTCMonth()], MONTH_NO: d.getUTCMonth() + 1, YEAR_NO: d.getUTCFullYear() } : { MONTH_NAME: '', MONTH_NO: 0, YEAR_NO: 0 };
};

/** A bill, with a sign: returns come off the totals, as JSM's `-SUM(…)` does. */
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

function bookWise(bills) {
  const g = groupBy(bills, ['YEAR_NO', 'MONTH_NO', 'BOOK'], { sum: SUM });
  return orderRows(g.map((r) => ({
    BOOK: r.BOOK, MONTH_NAME: MONTHS[r.MONTH_NO - 1] || '',
    NET_TOT: round(r.NET_TOT), TAXABLE_AMT: round(r.TAXABLE_AMT), IGST_AMT: round(r.IGST_AMT),
    CGST_AMT: round(r.CGST_AMT), SGST_AMT: round(r.SGST_AMT), CESS_AMT: 0,
    BILL_AMOUNT: round(r.IGST_AMT + r.CGST_AMT + r.SGST_AMT),
    YEAR_NO: r.YEAR_NO, MONTH_NO: r.MONTH_NO,
  })), [{ field: 'YEAR_NO', dir: 'asc', numeric: true }, { field: 'MONTH_NO', dir: 'asc', numeric: true }, 'BOOK']);
}

/** One row per bill line, with the bill's identity — what the rate and HSN sheets group. */
function lineRows(bills) {
  const out = [];
  for (const b of bills) {
    for (const l of b._lines || []) {
      out.push({
        TYPE: b.BOOK || '', BOOK: b.BOOK || '', PARTY: b.PARTY || '', NCBILL_NO: b.NCBILL_NO || '',
        BILL_DATE: b.BILL_DATE, ...monthOf(b), STATE_NAME: b.STATE || '', HSN_CODE: l.HSN_CODE || '',
        UNIT_NAME: l.UNIT_NAME || '', A_TAX_RATE: '', TAX_RATE: round(l.IT_GST_PER),
        IT_QTY: b._sign * Number(l.IT_QTY || 0),
        TAXABLE_AMT: b._sign * Number(l.IT_TAXABLE || 0),
        IGST_AMT: b._sign * Number(l.IT_IGST_A || 0),
        CGST_AMT: b._sign * Number(l.IT_CGST_A || 0),
        SGST_AMT: b._sign * Number(l.IT_SGST_A || 0),
        NET_TOT: b._sign * (Number(l.IT_TAXABLE || 0) + Number(l.IT_GST_AMT || 0)),
        HAS_TAX: Number(l.IT_GST_AMT || 0) > 0.004,
        GSTIN_NO: b.GSTIN_NO || '',
      });
    }
  }
  return out;
}

const rateWise = (lines) => orderRows(groupBy(lines, ['TAX_RATE'], { sum: ['TAXABLE_AMT', 'IGST_AMT', 'CGST_AMT', 'SGST_AMT'] })
  .map((r) => ({
    TAX_RATE: r.TAX_RATE, TAXABLE_AMT: round(r.TAXABLE_AMT), IGST_AMT: round(r.IGST_AMT),
    CGST_AMT: round(r.CGST_AMT), SGST_AMT: round(r.SGST_AMT), CESS: 0,
  })), [{ field: 'TAX_RATE', dir: 'asc', numeric: true }]);

const hsnWise = (lines) => orderRows(groupBy(lines, ['TYPE', 'HSN_CODE', 'TAX_RATE'],
  { sum: ['IT_QTY', 'TAXABLE_AMT', 'NET_TOT', 'IGST_AMT', 'CGST_AMT', 'SGST_AMT'] }, (f) => ({ UNIT_NAME: f.UNIT_NAME }))
  .map((r) => ({
    TYPE: r.TYPE, HSN_CODE: r.HSN_CODE, QUC: r.UNIT_NAME, NET_QTY: round(r.IT_QTY),
    TAXABLE_AMT: round(r.TAXABLE_AMT), NET_AMOUNT: round(r.NET_TOT), IGST_AMT: round(r.IGST_AMT),
    CGST_AMT: round(r.CGST_AMT), SGST_AMT: round(r.SGST_AMT), A_TAX_RATE: '', TAX_RATE: r.TAX_RATE,
  })), ['TYPE', 'HSN_CODE']);

async function noteRows(companyId, noteType, isRegistered) {
  const DebitCreditNote = require('../../../models/DebitCreditNote');
  require('../../../models/Party');
  const notes = await DebitCreditNote.find({ companyId, noteType }).populate('partyId', 'gstin').lean();
  return notes
    .filter((n) => Boolean(String(n.partyId?.gstin || '').trim()) === isRegistered)
    .map((n) => ({ ...monthOf({ BILL_DATE: n.date }), BILL_DATE: n.date,
      BILL_AMT: Number(n.totalAmount ?? n.amount ?? 0), TAXABLE_AMT: Number(n.taxableAmount || 0),
      IGST_AMT: Number(n.igst || 0), CGST_AMT: Number(n.cgst || 0), SGST_AMT: Number(n.sgst || 0) }));
}

const noteSheet = (notes, label) => orderRows(groupBy(notes, ['YEAR_NO', 'MONTH_NO'],
  { sum: ['BILL_AMT', 'TAXABLE_AMT', 'IGST_AMT', 'CGST_AMT', 'SGST_AMT'] }).map((r) => ({
  TYPE: label, MONTH_NAME: MONTHS[r.MONTH_NO - 1] || '', MONTH_NO: r.MONTH_NO,
  BILL_AMT: round(r.BILL_AMT), TAXABLE_AMT: round(r.TAXABLE_AMT), IGST_AMT: round(r.IGST_AMT),
  CGST_AMT: round(r.CGST_AMT), SGST_AMT: round(r.SGST_AMT), YEAR_NO: r.YEAR_NO,
})), [{ field: 'YEAR_NO', dir: 'asc', numeric: true }, { field: 'MONTH_NO', dir: 'asc', numeric: true }]);

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
    const err = new Error(`${missing.join(', ')}: this software does not record the reverse-charge register or the ITC journal heads JSM builds these from, so they are not produced`);
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

  const slReg = sl.filter(registered);
  const slUnreg = sl.filter((b) => !registered(b));
  const slLines = lineRows(sl);
  const puLines = lineRows(pu);

  const sheetRows = {
    'SALES - BOOK WISE': () => bookWise(slReg.filter(hasTax)),
    'SL.NONGST': () => bookWise(slReg.filter((b) => !hasTax(b))),
    'PURCHASE - BOOK WISE': () => bookWise(pu.filter(registered).filter(hasTax)),
    'PU.NONGST': () => bookWise(pu.filter(registered).filter((b) => !hasTax(b))),
    'B2C(UNREG)': () => lineRows(slUnreg).filter((r) => r.HAS_TAX).map((r) => ({
      TYPE: r.TYPE, PARTY: r.PARTY, NCBILL_NO: r.NCBILL_NO, BILL_DATE: r.BILL_DATE, NET_TOT: round(r.NET_TOT),
      HSN_CODE: r.HSN_CODE, A_TAX_RATE: '', SGST_AMT: round(r.SGST_AMT), CGST_AMT: round(r.CGST_AMT),
      IGST_AMT: round(r.IGST_AMT), TAX_RATE: r.TAX_RATE, TAXABLE_AMT: round(r.TAXABLE_AMT), CESS_AMOUNT: 0,
      ECOMM: '', MONTH_NAME: r.MONTH_NAME,
    })),
    'B2CREG.NONGST': () => lineRows(slUnreg).filter((r) => !r.HAS_TAX).map((r) => ({
      TYPE: r.TYPE, PARTY: r.PARTY, NCBILL_NO: r.NCBILL_NO, BILL_DATE: r.BILL_DATE, NET_TOT: round(r.NET_TOT),
      STATE_NAME: r.STATE_NAME, A_TAX_RATE: '', TAX_RATE: r.TAX_RATE, TAXABLE_AMT: round(r.TAXABLE_AMT),
      CESS_AMOUNT: 0, ECOMM: '', MONTH_NAME: r.MONTH_NAME,
    })),
    'B2C - HSN WISE(UNREG)': () => hsnWise(lineRows(slUnreg).filter((r) => r.HAS_TAX)).map((r) => ({
      HSN_CODE: r.HSN_CODE, NET_QTY: r.NET_QTY, TAXABLE_AMT: r.TAXABLE_AMT, NET_VALUE: r.NET_AMOUNT,
      IGST_AMT: r.IGST_AMT, CGST_AMT: r.CGST_AMT, SGST_AMT: r.SGST_AMT, TYPE: r.TYPE,
    })),
    'B2CHSN.NONGST': () => hsnWise(lineRows(slUnreg).filter((r) => !r.HAS_TAX)).map((r) => ({
      HSN_CODE: r.HSN_CODE, NET_QTY: r.NET_QTY, TAXABLE_AMT: r.TAXABLE_AMT, NET_VALUE: r.NET_AMOUNT,
      IGST_AMT: r.IGST_AMT, CGST_AMT: r.CGST_AMT, SGST_AMT: r.SGST_AMT, TYPE: r.TYPE,
    })),
    'DBCDNR.NONGST': async () => {
      const zero = (xs) => xs.filter((n) => Math.abs(n.SGST_AMT) + Math.abs(n.CGST_AMT) + Math.abs(n.IGST_AMT) <= 0.004);
      const [c, d] = await Promise.all([
        deps.notes?.['DBCDNR.NONGST_C'] || noteRows(companyId, 'Credit', true),
        deps.notes?.['DBCDNR.NONGST_D'] || noteRows(companyId, 'Debit', true),
      ]);
      return [...noteSheet(zero(c), 'CREDIT NOTE'), ...noteSheet(zero(d), 'DEBIT NOTE')];
    },
    'SALES - HSN WISE': () => hsnWise(slLines.filter((r) => r.HAS_TAX)),
    'SL.HSN.NONGST': () => hsnWise(slLines.filter((r) => !r.HAS_TAX)),
    'PURCHASE - HSN WISE': () => hsnWise(puLines.filter((r) => r.HAS_TAX)),
    'PU.HSN.NONGST': () => hsnWise(puLines.filter((r) => !r.HAS_TAX)),
    'SALES TAX RATE WISE': () => rateWise(slLines.filter((r) => r.HAS_TAX)),
    'SL.TAX.NONGST': () => rateWise(slLines.filter((r) => !r.HAS_TAX)),
    'PURCHASE - TAXRATE WISE': () => rateWise(puLines.filter((r) => r.HAS_TAX)),
    'PU.TAX.NONGST': () => rateWise(puLines.filter((r) => !r.HAS_TAX)),
  };

  const noteSheets = {
    'CDNR - REG': ['Credit', true, 'CREDIT NOTE'], 'CDNR - UNREG': ['Credit', false, 'CREDIT NOTE'],
    'DBNR - REG': ['Debit', true, 'DEBIT NOTE'], 'DBNR - UNREG': ['Debit', false, 'DEBIT NOTE'],
  };

  const rows = [];
  for (const name of wanted) {
    let sheet;
    if (noteSheets[name]) {
      const [type, reg, label] = noteSheets[name];
      sheet = noteSheet(deps.notes?.[name] || await noteRows(companyId, type, reg), label);
    } else {
      sheet = await sheetRows[name]();
    }
    for (const r of sheet) rows.push({ SHEET: name, ...r });
  }

  return {
    rows,
    grid: {
      layout: 'JSM_VW_GSTR9_OLD',
      variant: 1,
      groupColumns: ['SHEET'],
      groupDisplays: ['SHEET'],
      captions: {},
      title: 'Gstr-9 Working Sheets',
      period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
      pageWise: false,
      notice: `Skipped (not in MERN): ${UNAVAILABLE.join(', ')}`,
    },
  };
}

async function options() { return { sheets: SHEETS }; }

module.exports = { run, options, SHEETS, UNAVAILABLE };
