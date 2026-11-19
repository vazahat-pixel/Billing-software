import { toIsoDate } from '../winforms.js';

const N = (field, caption, dec = 2, len = 12) => ({ field, caption, kind: 'N', dec, total: true, len });

const DETAIL_COLS = [
  { field: 'BILL_DATE', caption: 'BILL.DT', kind: 'D', len: 10 },
  { field: 'NCBILL_NO', caption: 'BILL.NO', kind: 'C', len: 10 },
  { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 24 },
  { field: 'GSTIN_NO', caption: 'GSTIN', kind: 'C', len: 16 },
  { field: 'STATE_NAME', caption: 'STATE', kind: 'C', len: 14 },
  N('TO_PCS', 'PCS', 0, 8),
  N('TO_QTY', 'QTY', 2, 11),
  N('TAXABLE_AMT', 'TAXABLE'),
  N('SGST_AMT', 'SGST', 2, 10),
  N('CGST_AMT', 'CGST', 2, 10),
  N('IGST_AMT', 'IGST', 2, 10),
  N('NET_TOT', 'NET AMT'),
];

const SUM_COLS = [
  { field: 'ZGROUP', caption: 'GROUP', kind: 'C', len: 24 },
  N('TO_PCS', 'TO.PCS', 0, 9),
  N('TO_QTY', 'TO.QTY', 2, 12),
  N('TAXABLE_AMT', 'TAXABLE'),
  N('SGST_AMT', 'SGST', 2, 11),
  N('CGST_AMT', 'CGST', 2, 11),
  N('IGST_AMT', 'IGST', 2, 11),
  N('T_GST_AMT', 'TOT.GST', 2, 11),
  N('NET_TOT', 'NET.TOT'),
];

// The tick-list tabs, in each JSM form's own order (the lists are ListView0, ListView1, ...).
const FORM_LISTS = {
  A_Gstr1_SalesInvoiceSummary: ['parties', 'states', 'types', 'books', 'deliveries'],
  A_Gstr2_PurchaseSummary: ['parties', 'states', 'types', 'books', 'gstRates'],
  A_Gstr2_ProcessSummary: ['mills', null, null, 'types'],
  A_Gstr2_JobWorkReceiptSummary: ['parties', 'brokers', 'books', null, null, 'types'],
};
const listMapOf = (form) => Object.fromEntries((FORM_LISTS[form] || []).map((k, i) => [`ListView${i}`, k]).filter(([, k]) => k));

const mk = (form, extra = {}) => ({
  form,
  lists: extra.lists || listMapOf(form),
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    Cbo_OrderBy1: 'Register',
    Cbo_OrderBy2: 'None',
    cbo_printout: '1-Continue',
    CheckBox_Summary: false,
    ...(extra.defaults || {}),
  }),
  overrides: () => ({
    Cbo_OrderBy1: { items: extra.order1 || ['Register', 'Party', 'State_Code_Nm', 'Type', 'Month', 'GstRate'] },
    Cbo_OrderBy2: { items: extra.order2 || ['None', 'Register', 'Party', 'State_Code_Nm', 'Type', 'Month', 'GstRate'] },
    cbo_printout: { items: ['1-Continue', '2-PageWise'] },
  }),
  toParams: (s) => {
    const picked = {};
    for (const [lv, key] of Object.entries(extra.lists || listMapOf(form))) picked[key] = s[lv] || [];
    return {
      from: toIsoDate(s.txt_dt_from),
      to: toIsoDate(s.txt_dt_to),
      fromText: s.txt_dt_from,
      toText: s.txt_dt_to,
      orderBy1: s.Cbo_OrderBy1 || 'Register',
      orderBy2: s.Cbo_OrderBy2 || 'None',
      printout: s.cbo_printout || '1-Continue',
      summary: Boolean(s.CheckBox_Summary || s.chk_summary || s.chk_summary_Report),
      books: [],
      parties: [],
      states: [],
      types: [],
      gstRates: [],
      deliveries: [],
      mills: picked.mills || picked.parties || [],
      ...picked,
    };
  },
  ...(extra.fallbackColumns ? { fallbackColumns: extra.fallbackColumns } : {}),
});

const GSTIN_ALL_PURCHASE_FORM = 'A_Gstr2_PurchaseSummary#All';

/**
 * JSM opens the same purchase screen from the GSTIN shortcut as "GSTIN All Purchase Reports" with only
 * the Party and Book lists. Same backend report; only the title and the tabs shown differ.
 */
const gstinAllPurchase = () => {
  const base = mk('A_Gstr2_PurchaseSummary', { fallbackColumns: { JSM_VW_GST_PU_SMRY_GROUP: SUM_COLS } });
  return {
    ...base,
    form: GSTIN_ALL_PURCHASE_FORM,
    blueprintForm: 'A_Gstr2_PurchaseSummary',
    apiForm: 'A_Gstr2_PurchaseSummary',
    title: 'GSTIN All Purchase Reports',
    overrides: (s) => ({
      ...base.overrides(s),
      TabPage1: { visible: false },
      TabPage2: { visible: false },
      TabPage4: { visible: false },
    }),
  };
};

export const GSTIN_SUMMARY_REPORTS = [
  gstinAllPurchase(),
  mk('A_Gstr1_SalesInvoiceSummary', {
    fallbackColumns: {
      JSM_VW_GST_SALES_SUMMARY: DETAIL_COLS,
      JSM_VW_GST_SALES_SMRY_GROUP: SUM_COLS,
    },
  }),
  // JSM_VW_GST_PURCHASE_SUMMARY_REPORT is CAPTURED in layouts.json — only declare uncaptured summary fallback!
  mk('A_Gstr2_PurchaseSummary', {
    fallbackColumns: {
      JSM_VW_GST_PU_SMRY_GROUP: SUM_COLS,
    },
  }),
  mk('A_Gstr2_ProcessSummary', {
    order1: ['Register', 'Mill', 'GreyItem', 'FinishItem', 'Type', 'Month'],
    fallbackColumns: {
      JSM_VW_GST_PROC_DTL: [
        { field: 'BILL_DATE', caption: 'BILL.DT', kind: 'D', len: 10 },
        { field: 'NCBILL_NO', caption: 'BILL.NO', kind: 'C', len: 10 },
        { field: 'MILL', caption: 'MILL', kind: 'C', len: 24 },
        N('TO_PCS', 'PCS', 0, 8), N('TO_REC_QTY', 'REC.QTY', 2, 11),
        N('SUB_TOT', 'TAXABLE'), N('SGST_AMT', 'SGST', 2, 10), N('CGST_AMT', 'CGST', 2, 10), N('IGST_AMT', 'IGST', 2, 10),
        N('NET_TOT', 'NET AMT'),
      ],
      JSM_VW_GST_PROC_SMRY: SUM_COLS,
    },
  }),
  mk('A_Gstr2_JobWorkReceiptSummary', {
    order1: ['Register', 'Party', 'Broker', 'Type', 'Month'],
    fallbackColumns: {
      JSM_VW_GST_PROC_DTL: [
        { field: 'BILL_DATE', caption: 'BILL.DT', kind: 'D', len: 10 },
        { field: 'NCBILL_NO', caption: 'BILL.NO', kind: 'C', len: 10 },
        { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 24 },
        N('TO_PCS', 'PCS', 0, 8), N('TO_REC_QTY', 'REC.QTY', 2, 11),
        N('SUB_TOT', 'TAXABLE'), N('SGST_AMT', 'SGST', 2, 10), N('CGST_AMT', 'CGST', 2, 10), N('IGST_AMT', 'IGST', 2, 10),
        N('NET_TOT', 'NET AMT'),
      ],
      JSM_VW_GST_PROC_SMRY: SUM_COLS,
    },
  }),
  mk('Rpt_Journal_Details_Report', {
    lists: { ListView2: 'parties' },
    fallbackColumns: {
      JSM_VW_JOURNAL_DETAILS_RPT: [
        { field: 'BOOK', caption: 'BOOK', kind: 'C', len: 14 },
        { field: 'BILL_DATE', caption: 'DATE', kind: 'D', len: 10 },
        { field: 'NCBILL_NO', caption: 'VOU.NO', kind: 'C', len: 11 },
        { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 24 },
        { field: 'GSTIN_NO', caption: 'GSTIN', kind: 'C', len: 16 },
        N('TAXABLE_AMT', 'TAXABLE'), N('SGST_AMT', 'SGST', 2, 10), N('CGST_AMT', 'CGST', 2, 10), N('IGST_AMT', 'IGST', 2, 10),
        N('NET_TOT', 'NET AMT'),
        { field: 'REMARK', caption: 'REMARK', kind: 'C', len: 22 },
      ],
    },
  }),
  mk('A_Gstr2_Expense', {
    lists: { ListView1: 'parties' },
    fallbackColumns: {
      JSM_VW_JOURNAL_DETAILS_RPT: [
        { field: 'BOOK', caption: 'BOOK', kind: 'C', len: 14 },
        { field: 'BILL_DATE', caption: 'DATE', kind: 'D', len: 10 },
        { field: 'NCBILL_NO', caption: 'VOU.NO', kind: 'C', len: 11 },
        { field: 'PARTY', caption: 'EXPENSE / PARTY', kind: 'C', len: 24 },
        { field: 'GSTIN_NO', caption: 'GSTIN', kind: 'C', len: 16 },
        N('TAXABLE_AMT', 'TAXABLE'), N('SGST_AMT', 'SGST', 2, 10), N('CGST_AMT', 'CGST', 2, 10), N('IGST_AMT', 'IGST', 2, 10),
        N('NET_TOT', 'NET AMT'),
        { field: 'REMARK', caption: 'REMARK', kind: 'C', len: 22 },
      ],
    },
  }),
];

