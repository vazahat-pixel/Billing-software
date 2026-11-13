'use strict';

/**
 * JSM GSTIN Summary Screens (6 forms):
 *   - A_Gstr1_SalesInvoiceSummary   (Sales Summary - GSTIN)
 *   - A_Gstr2_PurchaseSummary       (Purchase Summary - GSTIN, captured JSM_VW_GST_PURCHASE_SUMMARY_REPORT)
 *   - A_Gstr2_ProcessSummary        (Process Summary - GSTIN)
 *   - A_Gstr2_JobWorkReceiptSummary (JobWork Summary - GSTIN)
 *   - Rpt_Journal_Details_Report    (GST Journal Details)
 *   - A_Gstr2_Expense               (GSTR-2 Expense Details)
 */
const { orderRows, inList, inDateRange, groupBy, round } = require('../jcEngine');
const billSrc = require('../sources/billRegister');
const mrSrc = require('../sources/millReceipt');

const GROUP_FIELDS = {
  None: null,
  Register: 'BOOK',
  Book: 'BOOK',
  Party: 'PARTY',
  State_Code_Nm: 'STATE_NAME',
  State_Name: 'STATE_NAME',
  Type: 'TYPE',
  Delivery: 'DELIVERY',
  Month: 'MONTH',
  GstRate: 'T_GST_PER',
  SubBook: 'SUBBOOK',
  Mill: 'MILL',
  GreyItem: 'GREYITEM',
  FinishItem: 'FINISHITEM',
  Broker: 'BROKER',
};

const monthOf = (d) => (d ? new Date(d).toISOString().slice(0, 7) : '');
const gstTypeLabel = (b) => {
  if (String(b.GSTIN_NO || '').trim()) return Number(b.IGST_AMT || 0) > 0 ? 'B2B-IGST' : 'B2B-LOCAL';
  return Number(b.SGST_AMT || b.CGST_AMT || b.IGST_AMT || 0) > 0 ? 'UNREG-TAX' : 'EXEMPT/NIL';
};

function enrichBill(b) {
  return {
    ...b,
    STATE_NAME: b.STATE || '',
    TYPE: gstTypeLabel(b),
    DELIVERY: b.HASTE || b.DELIVERY || '',
    MONTH: monthOf(b.BILL_DATE),
    T_GST_PER: round(b.GST_RATE || 0),
    SUBBOOK: b.SUBBOOK || b.BOOK || '',
    SUB_GST_AMT: round(b.TAXABLE_AMT || 0),
    NET_GST_AMT: round(b.NET_TOT || 0),
    T_GST_AMT: round(Number(b.SGST_AMT || 0) + Number(b.CGST_AMT || 0) + Number(b.IGST_AMT || 0)),
    T_ADD: round(b.T_ADD || 0),
    T_LESS: round(b.T_LESS || 0),
    T_TDS_PER: round(b.T_TDS_PER || 0),
    T_TDS_AMT: round(b.T_TDS_AMT || 0),
    TCS_AMT: round(b.TCS_AMT || 0),
    TO_QTY1: round(b.TO_QTY || 0),
    TO_KGS: round(b.TO_KGS || 0),
    SUB_TOT: round(b.TAXABLE_AMT || 0),
    RVRS_CHRG_YN: b.RVRS_CHRG_YN || 'No',
  };
}

function makeSummaryRows(rows, g1Field, g2Field) {
  const keys = [g1Field, g2Field].filter(Boolean);
  if (!keys.length) keys.push('BOOK');
  return groupBy(rows, keys, {
    sum: ['TO_PCS', 'TO_QTY', 'TO_QTY1', 'TO_KGS', 'SUB_TOT', 'TAXABLE_AMT', 'SGST_AMT', 'CGST_AMT', 'IGST_AMT', 'T_GST_AMT', 'TCS_AMT', 'NET_TOT'],
  }).map((r) => ({
    REGISTER: 'SUMMARY',
    ZGROUP: r[keys[0]] ?? '',
    ZGROUP2: keys[1] ? (r[keys[1]] ?? '') : '',
    ...r,
  }));
}

async function runSalesSummary(companyId, p = {}, deps = {}) {
  let rows = (deps.sales || await billSrc.loadSalesRegisterRows(companyId)).map(enrichBill);
  rows = inDateRange(rows, 'BILL_DATE', p.from, p.to);
  rows = inList(rows, 'BOOK', p.books);
  rows = inList(rows, 'PARTY', p.parties);
  rows = inList(rows, 'STATE_NAME', p.states);
  rows = inList(rows, 'TYPE', p.types);
  rows = inList(rows, 'T_GST_PER', p.gstRates);
  rows = inList(rows, 'DELIVERY', p.deliveries);

  const g1 = GROUP_FIELDS[p.orderBy1 || 'Register'] || 'BOOK';
  const g2 = GROUP_FIELDS[p.orderBy2 || 'None'] || null;

  if (p.summary) {
    return {
      rows: orderRows(makeSummaryRows(rows, g1, g2), ['ZGROUP', 'ZGROUP2']),
      grid: {
        layout: 'JSM_VW_GST_SALES_SMRY_GROUP',
        variant: 1,
        groupColumns: [],
        groupDisplays: [],
        captions: {},
        title: `${p.orderBy1 || 'Register'} Wise Sales Summary (GSTIN)`,
        period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
        pageWise: false,
      },
    };
  }

  return {
    rows: orderRows(rows, [g1, g2, 'BILL_DATE', { field: 'NCBILL_NO', dir: 'asc', numeric: true }].filter(Boolean)),
    grid: {
      layout: 'JSM_VW_GST_SALES_SUMMARY',
      variant: 1,
      groupColumns: [g1, g2].filter(Boolean),
      groupDisplays: [p.orderBy1 || 'Register', p.orderBy2 && p.orderBy2 !== 'None' ? p.orderBy2 : null].filter(Boolean),
      captions: {},
      title: `${p.orderBy1 || 'Register'} Wise Sales List GSTIN`,
      period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
      pageWise: String(p.printout || '').startsWith('2'),
    },
  };
}

async function runPurchaseSummary(companyId, p = {}, deps = {}) {
  let rows = (deps.purchases || await billSrc.loadPurchaseRegisterRows(companyId)).map(enrichBill);
  rows = inDateRange(rows, 'BILL_DATE', p.from, p.to);
  rows = inList(rows, 'BOOK', p.books);
  rows = inList(rows, 'PARTY', p.parties);
  rows = inList(rows, 'STATE_NAME', p.states);
  rows = inList(rows, 'TYPE', p.types);
  rows = inList(rows, 'T_GST_PER', p.gstRates);

  const g1 = GROUP_FIELDS[p.orderBy1 || 'Register'] || 'BOOK';
  const g2 = GROUP_FIELDS[p.orderBy2 || 'None'] || null;

  if (p.summary) {
    return {
      rows: orderRows(makeSummaryRows(rows, g1, g2), ['ZGROUP', 'ZGROUP2']),
      grid: {
        layout: 'JSM_VW_GST_PU_SMRY_GROUP',
        variant: 1,
        groupColumns: [],
        groupDisplays: [],
        captions: {},
        title: `${p.orderBy1 || 'Register'} Wise Purchase Summary (GSTIN)`,
        period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
        pageWise: false,
      },
    };
  }

  return {
    rows: orderRows(rows, [g1, g2, 'BILL_DATE', { field: 'NCBILL_NO', dir: 'asc', numeric: true }].filter(Boolean)),
    grid: {
      layout: 'JSM_VW_GST_PURCHASE_SUMMARY_REPORT', // captured in layouts.json!
      variant: 1,
      groupColumns: [g1, g2].filter(Boolean),
      groupDisplays: [p.orderBy1 || 'Register', p.orderBy2 && p.orderBy2 !== 'None' ? p.orderBy2 : null].filter(Boolean),
      captions: {},
      title: `${p.orderBy1 || 'Register'} Wise Purchase List GSTIN`,
      period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
      pageWise: String(p.printout || '').startsWith('2'),
    },
  };
}

async function runReceiptGstSummary(companyId, p = {}, deps = {}, kind = 'Mill') {
  const raw = deps.receipts || await mrSrc.loadMillReceiptRows(companyId, kind);
  let rows = inDateRange(raw, 'BILL_DATE', p.from, p.to).map((r) => ({
    BOOK: r.BOOK || (kind === 'Job' ? 'JOB WORK' : 'PROCESS RECEIPT'),
    BILL_DATE: r.BILL_DATE,
    NCBILL_NO: r.NCBILL_NO || '',
    MILL: r.PARTY || r.MILL_NAME || '',
    PARTY: r.PARTY || r.MILL_NAME || '',
    BROKER: r.BROKER || '',
    GREYITEM: r.GREY_ITEM || '',
    FINISHITEM: r.FINISH_ITEM || r.ITEM || '',
    TYPE: r.GSTIN_NO ? 'REGISTERED' : 'UNREG',
    MONTH: monthOf(r.BILL_DATE),
    TO_PCS: Number(r.TO_PCS || r.REC_PCS || 0),
    TO_REC_QTY: round(r.TO_REC_QTY || r.REC_QTY || 0),
    SUB_TOT: round(r.SUB_TOT || r.TAXABLE_AMT || 0),
    TDS_AMT: round(r.TDS_AMT || 0),
    SGST_AMT: round(r.SGST_AMT || 0),
    CGST_AMT: round(r.CGST_AMT || 0),
    IGST_AMT: round(r.IGST_AMT || 0),
    T_GST_AMT: round(Number(r.SGST_AMT || 0) + Number(r.CGST_AMT || 0) + Number(r.IGST_AMT || 0)),
    NET_TOT: round(r.NET_TOT || 0),
  }));
  rows = inList(rows, 'MILL', p.mills);
  rows = inList(rows, 'BOOK', p.books);
  const g1 = GROUP_FIELDS[p.orderBy1 || 'Register'] || 'BOOK';

  if (p.summary) {
    const grp = groupBy(rows, [g1], { sum: ['TO_PCS', 'TO_REC_QTY', 'SUB_TOT', 'TDS_AMT', 'SGST_AMT', 'CGST_AMT', 'IGST_AMT', 'T_GST_AMT', 'NET_TOT'] })
      .map((r) => ({ ZGROUP: r[g1] || '', ...r }));
    return {
      rows: orderRows(grp, ['ZGROUP']),
      grid: { layout: 'JSM_VW_GST_PROC_SMRY', variant: 1, groupColumns: [], groupDisplays: [], captions: {}, title: `${kind} GST Summary`, period: `DATE : FROM ${p.fromText || p.from || ''} TO ${p.toText || p.to || ''}`, pageWise: false },
    };
  }
  return {
    rows: orderRows(rows, [g1, 'BILL_DATE', { field: 'NCBILL_NO', dir: 'asc', numeric: true }]),
    grid: {
      layout: 'JSM_VW_GST_PROC_DTL',
      variant: 1,
      groupColumns: [g1],
      groupDisplays: [p.orderBy1 || 'Register'],
      captions: {},
      title: `${kind} Receipt List GSTIN`,
      period: `DATE : FROM ${p.fromText || p.from || ''} TO ${p.toText || p.to || ''}`,
      pageWise: false,
    },
  };
}

async function loadJournalRows(companyId, mode) {
  let rows;
  {
    const DebitCreditNote = require('../../../models/DebitCreditNote');
    const AccountingEntry = require('../../../models/AccountingEntry');
    require('../../../models/LedgerMaster');
    const [notes, jvs] = await Promise.all([
      DebitCreditNote.find({ companyId }).lean(),
      AccountingEntry.find({ companyId, voucherType: mode === 'Expense' ? { $in: ['Purchase', 'Payment', 'Journal'] } : 'Journal', status: { $ne: 'Cancelled' } }).populate('lines.ledgerId', 'name gstin').lean(),
    ]);
    rows = [
      ...notes.map((n) => ({
        BILL_DATE: n.date, NCBILL_NO: n.vNo || n.billNo || String(n._id).slice(-6),
        BOOK: n.noteType === 'Credit' ? 'CREDIT NOTE' : 'DEBIT NOTE',
        PARTY: n.partyName || '', GSTIN_NO: n.partyGstin || '',
        TAXABLE_AMT: round(n.taxableAmount || 0), SGST_AMT: round(n.sgst || 0), CGST_AMT: round(n.cgst || 0), IGST_AMT: round(n.igst || 0),
        NET_TOT: round(n.netAmount ?? n.amount ?? 0), REMARK: n.narration || '',
      })),
      ...jvs.filter((e) => mode === 'Journal' || /EXP/i.test(e.narration || '')).map((e) => {
        const dr = (e.lines || []).find((l) => Number(l.debit || 0) > 0);
        const cr = (e.lines || []).find((l) => Number(l.credit || 0) > 0);
        const amt = round(dr?.debit || cr?.credit || 0);
        return {
          BILL_DATE: e.entryDate, NCBILL_NO: e.entryNo || '', BOOK: e.voucherType || 'Journal',
          PARTY: dr?.ledgerId?.name || cr?.ledgerId?.name || '', GSTIN_NO: dr?.ledgerId?.gstin || '',
          TAXABLE_AMT: amt, SGST_AMT: 0, CGST_AMT: 0, IGST_AMT: 0, NET_TOT: amt, REMARK: e.narration || '',
        };
      }),
    ];
  }
  return rows;
}

async function runJournalOrExpense(companyId, p = {}, deps = {}, mode = 'Journal') {
  const rows = deps.rows || await loadJournalRows(companyId, mode);
  const filtered = inList(inDateRange(rows, 'BILL_DATE', p.from, p.to), 'PARTY', p.parties);
  return {
    rows: orderRows(filtered, ['BOOK', 'BILL_DATE', 'NCBILL_NO']),
    grid: {
      layout: 'JSM_VW_JOURNAL_DETAILS_RPT',
      variant: 1,
      groupColumns: ['BOOK'],
      groupDisplays: ['BOOK'],
      captions: {},
      title: mode === 'Expense' ? 'GST Expense Summary (GSTR-2)' : 'GST Journal Voucher Details',
      period: `DATE : FROM ${p.fromText || p.from || ''} TO ${p.toText || p.to || ''}`,
      pageWise: false,
    },
  };
}

const uniq = (xs, f) => [...new Set(xs.map((r) => r[f]).filter(Boolean))].sort();

/** The tick-lists list what the screen reports on: sales bills for the sales screen, purchases for the purchase one. */
const sideOptions = (load, withDelivery) => async (companyId) => {
  const rows = await load(companyId);
  return {
    books: uniq(rows, 'BOOK'),
    parties: uniq(rows, 'PARTY'),
    states: uniq(rows, 'STATE'),
    types: ['B2B-LOCAL', 'B2B-IGST', 'UNREG-TAX', 'EXEMPT/NIL'],
    gstRates: [...new Set(rows.map((r) => round(r.GST_RATE || 0)))].sort((x, y) => x - y).map(String),
    deliveries: withDelivery ? uniq(rows, 'HASTE') : [],
    mills: [],
  };
};

const receiptOptions = (kind) => async (companyId) => {
  const rows = await mrSrc.loadMillReceiptRows(companyId, kind);
  const parties = [...new Set(rows.map((r) => r.PARTY || r.MILL_NAME).filter(Boolean))].sort();
  return {
    books: [...new Set(rows.map((r) => r.BOOK || (kind === 'Job' ? 'JOB WORK' : 'PROCESS RECEIPT')))].sort(),
    parties,
    mills: parties,
    brokers: uniq(rows, 'BROKER'),
    types: ['REGISTERED', 'UNREG'],
    states: [],
    gstRates: [],
    deliveries: [],
  };
};

// Journal and Expense screens list the parties of their own vouchers.
const journalOptions = (mode) => async (companyId) => {
  const rows = await loadJournalRows(companyId, mode);
  return { parties: uniq(rows, 'PARTY'), books: uniq(rows, 'BOOK') };
};

const options = async (companyId) => {
  const [sl, pu] = await Promise.all([sideOptions(billSrc.loadSalesRegisterRows, true)(companyId), sideOptions(billSrc.loadPurchaseRegisterRows)(companyId)]);
  const m = (k) => [...new Set([...sl[k], ...pu[k]])].sort();
  return { ...sl, books: m('books'), parties: m('parties'), states: m('states'), gstRates: pu.gstRates };
};

module.exports = {
  salesSummary: { run: runSalesSummary, options: sideOptions(billSrc.loadSalesRegisterRows, true) },
  purchaseSummary: { run: runPurchaseSummary, options: sideOptions(billSrc.loadPurchaseRegisterRows) },
  processSummary: { run: (c, p, d) => runReceiptGstSummary(c, p, d, 'Mill'), options: receiptOptions('Mill') },
  jobworkSummary: { run: (c, p, d) => runReceiptGstSummary(c, p, d, 'Job'), options: receiptOptions('Job') },
  journalDetails: { run: (c, p, d) => runJournalOrExpense(c, p, d, 'Journal'), options: journalOptions('Journal') },
  expenseGstr2: { run: (c, p, d) => runJournalOrExpense(c, p, d, 'Expense'), options: journalOptions('Expense') },
};

