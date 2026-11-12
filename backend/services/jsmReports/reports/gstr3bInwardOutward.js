'use strict';

/**
 * JSM: Reports › Gst Reports › 3B Monthly Return › 3B - Inward & Outward Supply
 * (Gstr_3B_Detail_Inward_Outwardard_supply).
 *
 * Unifies outward supplies (Sales, Sales Returns [-1], Sales Debit/Credit Notes) and
 * inward supplies (Purchase, Purchase Returns [-1], Mill/JobWork Receipts, Purchase Debit/Credit Notes)
 * using only stored bill amounts and tax splits. Supports Summary (RUNTIME_B_SUMMARY_IN_OUT)
 * and Detail (RUNTIME_B_DETAIL_IN_OUT) modes, with Cbo_InOut and 8 filter tabs.
 */
const { orderRows, inList, inDateRange, groupBy, round, MONTHS } = require('../jcEngine');
const billSrc = require('../sources/billRegister');
const mrSrc = require('../sources/millReceipt');

const GROUP_FIELD = {
  Book: 'BOOK',
  'Book(BookWise)': 'BOOK',
  Party: 'PARTY',
  State_Name: 'STATE_NAME',
  Type: 'TYPE',
  TaxRate: 'TAX_RATE_LABEL',
  Month: 'MONTH',
  Gst_No: 'GST_NO',
  Head: 'HEAD',
  None: null,
};

function monthMeta(d) {
  if (!d) return { YEAR_NO: 0, MONTH_NO: 0, MONTH: '' };
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return { YEAR_NO: 0, MONTH_NO: 0, MONTH: '' };
  return { YEAR_NO: dt.getUTCFullYear(), MONTH_NO: dt.getUTCMonth() + 1, MONTH: MONTHS[dt.getUTCMonth()] };
}

function toBillRow(b, entType, head, sign = 1) {
  const m = monthMeta(b.BILL_DATE);
  const rate = round(b.GST_RATE ?? b.TAX_RATE ?? 0);
  const hsn = (b._lines || []).map((l) => l.HSN_CODE).filter(Boolean)[0] || '';
  return {
    ENT_NO: b.ENT_NO || '',
    CO_PATH: b.CO_PATH || '',
    BOOK: b.BOOK || '',
    BILL_NO: b.NCBILL_NO || b.SRAL_NO || '',
    SRAL_NO: b.SRAL_NO || b.NCBILL_NO || '',
    BILL_DATE: b.BILL_DATE,
    PARTY: b.PARTY || '',
    GST_NO: b.GSTIN_NO || '',
    STATE_NAME: b.STATE || '',
    TYPE: entType,
    TaxRate: rate,
    TAX_RATE_LABEL: String(rate),
    TAXABLE_AMT: round(sign * Number(b.TAXABLE_AMT || 0)),
    SGST_AMT: round(sign * Number(b.SGST_AMT || 0)),
    CGST_AMT: round(sign * Number(b.CGST_AMT || 0)),
    IGST_AMT: round(sign * Number(b.IGST_AMT || 0)),
    BILL_AMT: round(sign * Number(b.NET_TOT || 0)),
    HEAD: head,
    TO_PCS: sign * Number(b.TO_PCS || 0),
    TO_QTY: round(sign * Number(b.TO_QTY || 0)),
    TO_KGS: round(sign * (b._lines || []).reduce((s, l) => s + Number(l.IT_KGS || 0), 0)),
    HSN_CODE: hsn,
    ENT_TYPE: entType,
    ...m,
  };
}

async function loadJobRows(companyId) {
  const [mill, job] = await Promise.all([
    mrSrc.loadMillReceiptRows(companyId),
    mrSrc.loadJobReceiptRows(companyId),
  ]);
  const mapJob = (r, book, entType) => {
    const m = monthMeta(r.BILL_DATE);
    const sgst = Number(r.SGST_AMT || 0);
    const cgst = Number(r.CGST_AMT || 0);
    const igst = Number(r.IGST_AMT || 0);
    const tax = Number(r.TAXABLE_AMT || r.SUB_TOT || 0);
    const rate = tax > 0 ? round(((sgst + cgst + igst) / tax) * 100) : 0;
    return {
      ENT_NO: r.ENT_NO || '', CO_PATH: r.CO_PATH || '', BOOK: book,
      BILL_NO: r.NCBILL_NO || r.CHALLAN_NO || '', SRAL_NO: r.CHALLAN_NO || '', BILL_DATE: r.BILL_DATE,
      PARTY: r.PARTY || '', GST_NO: '', STATE_NAME: r.STATION || '', TYPE: entType,
      TaxRate: rate, TAX_RATE_LABEL: String(rate),
      TAXABLE_AMT: round(tax), SGST_AMT: round(sgst), CGST_AMT: round(cgst), IGST_AMT: round(igst),
      BILL_AMT: round(r.NET_TOT || tax + sgst + cgst + igst),
      HEAD: 'JOBWORK', TO_PCS: Number(r.TO_PCS || 0), TO_QTY: round(r.TO_QTY || 0), TO_KGS: 0,
      HSN_CODE: '', ENT_TYPE: entType, ...m,
    };
  };
  return [...mill.map((r) => mapJob(r, 'MILL', 'MIL')), ...job.map((r) => mapJob(r, 'JOBWORK', 'JOB'))];
}

async function loadNoteRows(companyId) {
  const DebitCreditNote = require('../../../models/DebitCreditNote');
  const notes = await DebitCreditNote.find({ companyId }).lean();
  return notes.map((n) => {
    const isOutward = n.noteType === 'Credit';
    const entType = isOutward ? 'SCN' : 'PDN';
    const m = monthMeta(n.date);
    return {
      ENT_NO: String(n._id), CO_PATH: '', BOOK: n.accountHeadName || (isOutward ? 'CREDIT NOTE' : 'DEBIT NOTE'),
      BILL_NO: n.vNo || n.billNo || '', SRAL_NO: n.vNo || '', BILL_DATE: n.date,
      PARTY: n.partyName || '', GST_NO: n.partyGstin || '', STATE_NAME: n.placeOfSupply || '',
      TYPE: entType, TaxRate: round(n.gstRate || 0), TAX_RATE_LABEL: String(round(n.gstRate || 0)),
      TAXABLE_AMT: round(n.taxableAmount || 0), SGST_AMT: round(n.sgst || 0),
      CGST_AMT: round(n.cgst || 0), IGST_AMT: round(n.igst || 0),
      BILL_AMT: round(n.netAmount ?? n.totalAmount ?? n.amount ?? 0),
      HEAD: isOutward ? 'OUTWARD NOTE' : 'INWARD NOTE',
      TO_PCS: 0, TO_QTY: 0, TO_KGS: 0, HSN_CODE: n.hsnSac || '', ENT_TYPE: entType, ...m,
    };
  });
}

async function run(companyId, p = {}, deps = {}) {
  const inOut = p.inOut || 'Both';
  const loadOutward = async () => {
    const [sl, slRtn] = await Promise.all([
      deps.sales || billSrc.loadSalesRegisterRows(companyId),
      deps.salesRtn || billSrc.loadReturnRegisterRows(companyId, 'Sales'),
    ]);
    return [...sl.map((b) => toBillRow(b, 'SLS', 'OUTWARD', 1)), ...slRtn.map((b) => toBillRow(b, 'SLR', 'OUTWARD RTN', -1))];
  };
  const loadInward = async () => {
    const [pu, puRtn, jobs] = await Promise.all([
      deps.purchases || billSrc.loadPurchaseRegisterRows(companyId),
      deps.purchaseRtn || billSrc.loadReturnRegisterRows(companyId, 'Purchase'),
      deps.jobs || loadJobRows(companyId),
    ]);
    return [...pu.map((b) => toBillRow(b, 'PUR', 'INWARD', 1)), ...puRtn.map((b) => toBillRow(b, 'PUR_RTN', 'INWARD RTN', -1)), ...jobs];
  };

  let raw = [];
  if (inOut === 'OutwardSupply') raw = await loadOutward();
  else if (inOut === 'InwardSupply') raw = await loadInward();
  else raw = [...(await loadOutward()), ...(await loadInward())];

  const notes = deps.notes || await loadNoteRows(companyId);
  for (const n of notes) {
    const isOut = n.ENT_TYPE === 'SCN';
    if (inOut === 'Both' || (inOut === 'OutwardSupply' && isOut) || (inOut === 'InwardSupply' && !isOut)) raw.push(n);
  }

  let rows = inDateRange(raw, 'BILL_DATE', p.from, p.to);
  if (p.books?.length) rows = inList(rows, 'BOOK', p.books);
  if (p.parties?.length) rows = inList(rows, 'PARTY', p.parties);
  if (p.states?.length) rows = inList(rows, 'STATE_NAME', p.states);
  if (p.types?.length) rows = inList(rows, 'TYPE', p.types);
  if (p.taxRates?.length) rows = inList(rows, 'TAX_RATE_LABEL', p.taxRates);
  if (p.months?.length) rows = inList(rows, 'MONTH', p.months);
  if (p.gstNos?.length) rows = inList(rows, 'GST_NO', p.gstNos);

  const f1 = GROUP_FIELD[p.groupBy1] || 'BOOK';
  const f2 = GROUP_FIELD[p.groupBy2] || null;
  const g1 = p.groupBy1 || 'Book';
  const g2 = f2 ? (p.groupBy2 || '') : '';
  const period = `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''} - ${g1} Wise ${inOut}`;

  if (p.summary) {
    const keys = f2 ? [f1, f2] : [f1];
    const summed = groupBy(rows, keys, {
      sum: ['TAXABLE_AMT', 'SGST_AMT', 'CGST_AMT', 'IGST_AMT', 'BILL_AMT', 'TO_PCS', 'TO_QTY', 'TO_KGS'],
    }, (first) => ({ GST_NO: first.GST_NO || '', YEAR_NO: first.YEAR_NO, MONTH_NO: first.MONTH_NO }));
    const out = orderRows(summed.map((r) => ({
      ZGROUP1: f2 ? (r[f1] || '') : '',
      ZGROUP2: f2 ? (r[f2] || '') : (r[f1] || ''),
      TAXABLE_AMT: round(r.TAXABLE_AMT),
      SGST_AMT: round(r.SGST_AMT),
      CGST_AMT: round(r.CGST_AMT),
      IGST_AMT: round(r.IGST_AMT),
      BILL_AMT: round(r.BILL_AMT),
      GST_NO: r.GST_NO || '',
      TO_PCS: r.TO_PCS,
      TO_QTY: round(r.TO_QTY),
      TO_KGS: round(r.TO_KGS),
      YEAR_NO: r.YEAR_NO,
      MONTH_NO: r.MONTH_NO,
    })), f2 ? ['ZGROUP1', { field: 'YEAR_NO', numeric: true }, { field: 'MONTH_NO', numeric: true }, 'ZGROUP2'] : [{ field: 'YEAR_NO', numeric: true }, { field: 'MONTH_NO', numeric: true }, 'ZGROUP2']);
    return {
      rows: out,
      grid: {
        layout: 'RUNTIME_B_SUMMARY_IN_OUT',
        variant: 1,
        groupColumns: f2 ? ['ZGROUP1'] : [],
        groupDisplays: f2 ? ['ZGROUP1'] : [],
        captions: { ZGROUP1: g1.toUpperCase(), ZGROUP2: (f2 ? g2 : g1).toUpperCase() },
        title: `3B ${inOut} Summary`,
        period,
        pageWise: p.printout === '2-PageWise',
      },
    };
  }

  const mapped = orderRows(rows.map((r) => ({ ...r, ZGROUP1: r[f1] || '' })), ['ZGROUP1', 'BILL_DATE', 'BILL_NO']);
  return {
    rows: mapped,
    grid: {
      layout: 'RUNTIME_B_DETAIL_IN_OUT',
      variant: 1,
      groupColumns: ['ZGROUP1'],
      groupDisplays: ['ZGROUP1'],
      captions: {},
      title: `3B ${inOut} Detail`,
      period,
      pageWise: p.printout === '2-PageWise',
      primaryDetailColumn: 'BILL_NO',
    },
  };
}

async function options(companyId) {
  const [sl, pu] = await Promise.all([billSrc.loadSalesRegisterRows(companyId), billSrc.loadPurchaseRegisterRows(companyId)]);
  const all = [...sl, ...pu];
  const uniq = (fn) => [...new Set(all.map(fn).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
  return {
    books: uniq((r) => r.BOOK),
    parties: uniq((r) => r.PARTY),
    states: uniq((r) => r.STATE),
    types: ['SLS', 'SLR', 'PUR', 'PUR_RTN', 'MIL', 'JOB', 'SCN', 'PDN'],
    taxRates: [...new Set(all.map((r) => String(round(r.GST_RATE || 0))))].sort((a, b) => Number(a) - Number(b)),
    months: MONTHS,
    gstNos: uniq((r) => r.GSTIN_NO),
  };
}

module.exports = { run, options };
