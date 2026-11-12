import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › Sales › Sales Bill › Sales Order Register (Rpt_Sales_Order_Detail_Report) and
 * Reports › Purchase › Purchase Bill › Purchase Order (Rpt_Purchase_Order_Detail_Rpt).
 *
 * Tabbed ticked lists, an as-on date, the status combo and two Order By boxes. Neither layout is
 * captured, so the columns are the ones JSM's own Js_Add_NewColumn_Function names.
 */
const columns = (donePcs, doneQty, pcsCaption, qtyCaption) => [
  { field: 'ORD_DATE', caption: 'ORD.DATE', kind: 'D', len: 10 },
  { field: 'ORD_NO', caption: 'ORD.NO', kind: 'C', len: 9 },
  { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 24 },
  { field: 'BROKER', caption: 'BROKER', kind: 'C', len: 14 },
  { field: 'ITEM', caption: 'ITEM', kind: 'C', len: 20 },
  { field: 'ORD_PCS', caption: 'O.PCS', kind: 'N', dec: 0, total: true, len: 8 },
  { field: donePcs, caption: pcsCaption, kind: 'N', dec: 0, total: true, len: 8 },
  { field: 'BAL_PCS', caption: 'B.PCS', kind: 'N', dec: 0, total: true, len: 8 },
  { field: 'ORD_QTY', caption: 'O.QTY', kind: 'N', dec: 2, total: true, len: 11 },
  { field: doneQty, caption: qtyCaption, kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'BAL_QTY', caption: 'B.QTY', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'RATE', caption: 'RATE', kind: 'N', dec: 2, len: 9 },
  { field: 'AMOUNT', caption: 'IT.AMOUNT', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'BILLNO', caption: 'BILL.NO', kind: 'C', len: 9 },
  { field: 'BILLDT', caption: 'BILL.DT', kind: 'D', len: 10 },
  { field: 'STOCK_CP', caption: 'STATUS', kind: 'C', len: 6 },
  { field: 'REMARK_1', caption: 'REMARK1', kind: 'C', len: 16 },
];

const order = (form, fallbackColumns, lists) => ({
  form,
  lists,
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    cbo_status: '1-Pending',
    Cbo_OrderBy1: 'None',
    Cbo_OrderBy2: 'None',
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    status: s.cbo_status,
    orderBy1: s.Cbo_OrderBy1,
    orderBy2: s.Cbo_OrderBy2,
    printout: s.cbo_printout,
    ...Object.fromEntries(Object.entries(lists).map(([control, key]) => [key, s[control] || []])),
  }),
  fallbackColumns,
});

const SALES_COLUMNS = columns('SL_PCS', 'SL_QTY', 'I.PCS', 'I.QTY');
const PURCHASE_COLUMNS = columns('REC_PCS', 'REC_QTY', 'R.PCS', 'R.QTY');

export const ORDER_STATUSES = [
  order('Rpt_Sales_Order_Detail_Report', {
    JSM_VW_SALES_ORDER_DETAILED_REPORT: SALES_COLUMNS,
  }, {
    ListView0: 'parties', ListView1: 'brokers', ListView2: 'items',
    ListView3: 'deliveries', ListView4: 'states', ListView5: 'stations',
  }),
  order('Rpt_Purchase_Order_Detail_Rpt', {
    JSM_VW_PURCHASE_ORDER_STATUS_REPORT: PURCHASE_COLUMNS,
  }, {
    ListView0: 'parties', ListView1: 'brokers', ListView2: 'items',
  }),
];
