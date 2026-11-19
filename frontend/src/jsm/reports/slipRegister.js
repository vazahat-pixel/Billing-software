import { toIsoDate } from '../winforms.js';

/**
 * JSM:
 *  - Reports › Sales › Sales Bill › Slip Register (Rpt_Sales_Slip_Register)
 *  - Reports › Sales › Sales Bill › Slip (New) Register (Rpt_SalesSlipDetail_Report)
 */
const SLIP_COLUMNS = [
  { field: 'BILL_DATE', caption: 'CHLN.DT', kind: 'D', len: 10 },
  { field: 'NCCHLN_NO', caption: 'CHLN.NO', kind: 'C', len: 10 },
  { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 24 },
  { field: 'TRNS_NAME', caption: 'TRANSPORT', kind: 'C', len: 14 },
  { field: 'ITEM', caption: 'ITEM', kind: 'C', len: 22 },
  { field: 'IT_PCS', caption: 'PCS', kind: 'N', dec: 0, total: true, len: 8 },
  { field: 'IT_QTY', caption: 'QTY', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'IT_RATE', caption: 'RATE', kind: 'N', dec: 2, len: 9 },
  { field: 'IT_AMOUNT', caption: 'AMOUNT', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'SL_BILLNO', caption: 'SL.BILLNO', kind: 'C', len: 10 },
  { field: 'STOCK_CP', caption: 'CP', kind: 'C', len: 5 },
];

const SLIP_NEW_DETAIL = [
  { field: 'NCCHLN_NO', caption: 'CHLN.NO', kind: 'C', len: 10 },
  { field: 'BILL_DATE', caption: 'CHLN.DT', kind: 'D', len: 10 },
  { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 24 },
  { field: 'BOOK', caption: 'BOOK', kind: 'C', len: 14 },
  { field: 'ITEM', caption: 'ITEM.NAME', kind: 'C', len: 22 },
  { field: 'IT_PCS', caption: 'PCS', kind: 'N', dec: 0, total: true, len: 8 },
  { field: 'IT_QTY', caption: 'QTY', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'SL_QTY', caption: 'SL.QTY', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'BAL_QTY', caption: 'BAL.QTY', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'IT_RATE', caption: 'RATE', kind: 'N', dec: 2, len: 9 },
  { field: 'IT_AMOUNT', caption: 'AMOUNT', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'SL_BILLNO', caption: 'SL.BILLNO', kind: 'C', len: 10 },
];

const SLIP_NEW_SUMMARY = [
  { field: 'ZGROUP', caption: 'Group', kind: 'C', len: 24 },
  { field: 'ZGROUP2', caption: 'SubGroup', kind: 'C', len: 18 },
  { field: 'TOT_PCS', caption: 'PCS', kind: 'N', dec: 0, total: true, len: 9 },
  { field: 'TOT_QTY', caption: 'QTY', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'SL_QTY', caption: 'SL.QTY', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'BAL_QTY', caption: 'BAL.QTY', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'TOT_AMOUNT', caption: 'TOTAL AMOUNT', kind: 'N', dec: 2, total: true, len: 14 },
];

export const SLIP_REGISTERS = [
  {
    form: 'Rpt_Sales_Slip_Register',
    lists: { lst_vw1: 'parties', lst_vw2: 'items' },
    defaults: ({ fyFrom, fyTo }) => ({
      txt_dt_from: fyFrom,
      txt_dt_to: fyTo,
      txt_from: '',
      txt_to: '',
      Rdbtn_B1: true,
      Rdbtn_D3: true,
      RDBTN_C1: true,
    }),
    toParams: (s) => ({
      from: toIsoDate(s.txt_dt_from),
      to: toIsoDate(s.txt_dt_to),
      fromText: s.txt_dt_from,
      toText: s.txt_dt_to,
      chFrom: s.txt_from,
      chTo: s.txt_to,
      reportType: s.Rdbtn_B3 ? '3-Item' : (s.Rdbtn_B2 ? '2-Party' : '1-Register'),
      status: s.Rdbtn_D1 ? '1-Pending' : (s.Rdbtn_D2 ? '2-Clear' : '3-Both'),
      parties: s.lst_vw1 || [],
      items: s.lst_vw2 || [],
    }),
    fallbackColumns: { JSM_VW_SALES_SLIP_REGISTER: SLIP_COLUMNS },
  },
  {
    form: 'Rpt_SalesSlipDetail_Report',
    lists: { ListView0: 'parties', ListView1: 'registers', ListView2: 'items' },
    defaults: ({ fyFrom, fyTo }) => ({
      txt_dt_from: fyFrom,
      txt_dt_to: fyTo,
      cbo_status: 'All',
      Cbo_OrderBy1: 'None',
      Cbo_OrderBy2: 'None',
      CheckBox_Summary: false,
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
      summary: Boolean(s.CheckBox_Summary),
      parties: s.ListView0 || [],
      registers: s.ListView1 || [],
      items: s.ListView2 || [],
    }),
    fallbackColumns: {
      RPT_SALES_SLIP_DETAIL_REPORT: SLIP_NEW_DETAIL,
      RPT_SALES_SLIP_SUMMARY_REPORT: SLIP_NEW_SUMMARY,
    },
  },
];

