import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › Sales › Sales Bill › Sales Challan (Rpt_Sales_Challan_Detail_Report).
 *
 * Four ticked lists across its tab pages — the register, then Party, Broker and Item, the three
 * its own Load fills — a date range and the two Order By boxes. JSM_VW_SALES_CHALLAN_DTL_REPORT
 * is built at run time, so the columns are the ones Js_Add_NewColumn_Function names.
 */
const COLUMNS = [
  { field: 'BILL_DATE', caption: 'CHLN.DT', kind: 'D', len: 10 },
  { field: 'NCCHLN_NO', caption: 'CHLN.NO', kind: 'C', len: 10 },
  { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 24 },
  { field: 'BROKER', caption: 'BROKER', kind: 'C', len: 16 },
  { field: 'ORD_NO', caption: 'ORD.NO', kind: 'C', len: 10 },
  { field: 'ITEM', caption: 'ITEM', kind: 'C', len: 22 },
  { field: 'IT_DISC1', caption: 'DISC1', kind: 'C', len: 10 },
  { field: 'IT_DISC2', caption: 'DISC2', kind: 'C', len: 10 },
  { field: 'IT_PCS', caption: 'PCS', kind: 'N', dec: 0, total: true, len: 8 },
  { field: 'IT_QTY', caption: 'QTY', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'IT_RATE', caption: 'RATE', kind: 'N', dec: 2, len: 10 },
  { field: 'IT_AMOUNT', caption: 'AMOUNT', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'REMARK_1', caption: 'REMARK1', kind: 'C', len: 18 },
  { field: 'REMARK_2', caption: 'REMARK2', kind: 'C', len: 14 },
  { field: 'HASTE', caption: 'HASTE', kind: 'C', len: 12 },
];

export default {
  form: 'Rpt_Sales_Challan_Detail_Report',
  lists: { ListView0: 'parties', ListView1: 'brokers', ListView2: 'items' },
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    Cbo_OrderBy1: 'None',
    Cbo_OrderBy2: 'None',
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    orderBy1: s.Cbo_OrderBy1,
    orderBy2: s.Cbo_OrderBy2,
    printout: s.cbo_printout,
    registers: [],
    parties: s.ListView0 || [],
    brokers: s.ListView1 || [],
    items: s.ListView2 || [],
  }),
  fallbackColumns: { JSM_VW_SALES_CHALLAN_DTL_REPORT: COLUMNS },
};
