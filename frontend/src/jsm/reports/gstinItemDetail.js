import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › Gst Reports › Gstin - Sales › Sales Detail (Item) / Sales Rtn Detail (Item) and
 * Gstin - Purchase › Purchase Detail ( Item ) / Purchase Rtn Detail (Item).
 *
 * Four separate JSM screens of the same shape: eight ticked lists across their tabs — the ones
 * their Load fills are Book, Party, State, Type, Item, GstRate and Delivery — a date range, the
 * two Order By boxes and the Summary tick. None of their layouts is captured, so the columns are
 * the ones Js_Add_NewColumn_Function names for each view.
 */
const LINE_COLUMNS = [
  { field: 'BILL_DATE', caption: 'BILL.DT', kind: 'D', len: 10 },
  { field: 'BILL_NO', caption: 'BILL.NO', kind: 'C', len: 10 },
  { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 24 },
  { field: 'GSTIN_NO', caption: 'GSTIN.NO', kind: 'C', len: 16 },
  { field: 'STATE_NAME', caption: 'STATE.NAME', kind: 'C', len: 14 },
  { field: 'ITEM_NAME', caption: 'ITEM.NAME', kind: 'C', len: 22 },
  { field: 'HSN_CODE', caption: 'HSN.CODE', kind: 'C', len: 10 },
  { field: 'UNIT_NAME', caption: 'UNIT.NAME', kind: 'C', len: 8 },
  { field: 'IT_PCS', caption: 'IT.PCS', kind: 'N', dec: 0, total: true, len: 8 },
  { field: 'IT_QTY', caption: 'IT.QTY', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'IT_RATE', caption: 'SL.RATE', kind: 'N', dec: 2, len: 10 },
  { field: 'IT_TAXABLE', caption: 'TAXABLEAMT', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'TOT_GST_P', caption: 'GST.RATE%', kind: 'N', dec: 2, len: 9 },
  { field: 'IT_SGST_A', caption: 'IT_SGST.AMT', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'IT_CGST_A', caption: 'IT_CGST.AMT', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'IT_IGST_A', caption: 'IT_IGST.AMT', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'IT_NET_TOT', caption: 'NET.AMT', kind: 'N', dec: 2, total: true, len: 13 },
];

const SLAB_COLUMNS = [
  { field: 'ZGROUP', caption: 'Group', kind: 'C', len: 22 },
  { field: 'ZGROUP2', caption: 'Group2', kind: 'C', len: 18 },
  { field: 'IT_PCS', caption: 'TO.PCS', kind: 'N', dec: 0, total: true, len: 9 },
  { field: 'IT_QTY', caption: 'TO.QTY', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'IT_TAXABLE', caption: 'TAXABLE', kind: 'N', dec: 2, total: true, len: 14 },
  { field: 'IT_SGST_A', caption: 'IT_SGST.AMT', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'IT_CGST_A', caption: 'IT_CGST.AMT', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'IT_IGST_A', caption: 'IT_IGST.AMT', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'IT_NET_TOT', caption: 'NET.TOT', kind: 'N', dec: 2, total: true, len: 14 },
];

const detail = (form, apiForm, fallbackColumns) => ({
  form,
  apiForm,
  lists: {
    ListView0: 'books',
    ListView1: 'parties',
    ListView2: 'states',
    ListView3: 'types',
    ListView4: 'items',
    ListView5: 'gstRates',
    ListView6: 'deliveries',
  },
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    Cbo_OrderBy1: 'Register',
    Cbo_OrderBy2: 'None',
    CheckBox_Total: true,
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    orderBy1: s.Cbo_OrderBy1,
    orderBy2: s.Cbo_OrderBy2,
    summary: Boolean(s.CheckBox_Summary),
    printout: s.cbo_printout,
    books: s.ListView0 || [],
    parties: s.ListView1 || [],
    states: s.ListView2 || [],
    types: s.ListView3 || [],
    items: s.ListView4 || [],
    gstRates: s.ListView5 || [],
    deliveries: s.ListView6 || [],
  }),
  fallbackColumns,
});

export const GSTIN_ITEM_DETAILS = [
  detail('A_Gstr1_SalesInvoiceDetail', 'A_Gstr1_SalesInvoiceDetail', {
    JSM_VW_GST_SALES_GSTR1_REPORT: LINE_COLUMNS,
    JSM_VW_GST_SALES_GSTR1_SLAB_REPORT: SLAB_COLUMNS,
    JSM_VW_GST_SALES_GSTR1_SLAB_SUMMARY: SLAB_COLUMNS,
  }),
  detail('A_Gstr1_SalesReturnDetails', 'A_Gstr1_SalesReturnDetails', {
    JSM_VW_GST_SALES_RTN_GSTR1_REPORT: LINE_COLUMNS,
    JSM_VW_GST_SALES_RTN_GSTR1_SLAB_REPORT: SLAB_COLUMNS,
    JSM_VW_GST_SALES_RTN_GSTR1_SLAB_SUMMARY: SLAB_COLUMNS,
  }),
  detail('A_Gstr2_PurchaseDetail', 'A_Gstr2_PurchaseDetail', {
    JSM_VW_GST_PURCHASE_GSTR2_REPORT: LINE_COLUMNS,
    JSM_VW_GST_PURCHASE_GSTR2_SLAB_REPORT: SLAB_COLUMNS,
    JSM_VW_GST_PURCHASE_GSTR2_SLAB_SUMMARY: SLAB_COLUMNS,
  }),
  detail('A_Gstr2_PurchaseReturnDetails', 'A_Gstr2_PurchaseReturnDetails', {
    JSM_VW_GST_PURCHASE_RTN_GSTR2_REPORT: LINE_COLUMNS,
    JSM_VW_GST_PURCHASE_RTN_GSTR2_SLAB_REPORT: SLAB_COLUMNS,
    JSM_VW_GST_PURCHASE_RTN_GSTR2_SLAB_SUMMARY: SLAB_COLUMNS,
  }),
];
