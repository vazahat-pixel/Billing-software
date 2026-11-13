import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › Purchase › Purchase Stock / Purchase Stock(Godown) / Purchase Stock(Old).
 *
 * Three separate JSM screens on one question, so three configs. None of their layouts is captured
 * — the Old one prints through Crystal and the other two build their view at run time — so the
 * columns are the ones JSM's own SELECT and Js_Add_NewColumn_Function name.
 */
const OLD_COLUMNS = [
  { field: 'BILL_DATE', caption: 'BILL.DATE', kind: 'D', len: 10 },
  { field: 'BILL_NO', caption: 'BILL.NO', kind: 'C', len: 10 },
  { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 24 },
  { field: 'ST_NAME', caption: 'CITY', kind: 'C', len: 13 },
  { field: 'ITEM', caption: 'ITEM', kind: 'C', len: 20 },
  { field: 'PU_PCS', caption: 'PU.PCS', kind: 'N', dec: 0, total: true, len: 9 },
  { field: 'PU_MTS', caption: 'PU.MTS', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'PU_RATE', caption: 'RATE', kind: 'N', dec: 2, len: 10 },
  { field: 'NET_TOT', caption: 'AMOUNT', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'CH_NO', caption: 'CH.NO', kind: 'C', len: 9 },
  { field: 'CHLN_DATE', caption: 'CH.DATE', kind: 'D', len: 10 },
  { field: 'ISS_PCS', caption: 'ISS.PCS', kind: 'N', dec: 0, total: true, len: 9 },
  { field: 'ISS_MTS', caption: 'ISS.MTS', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'BILL_MTS', caption: 'BILL.MTS', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'STK_MTS', caption: 'STK.MTS', kind: 'N', dec: 2, total: true, len: 12 },
];

const LR_COLUMNS = [
  { field: 'BILL_DATE', caption: 'BILL.DATE', kind: 'D', len: 10 },
  { field: 'SRAL_NO', caption: 'SRALNO', kind: 'C', len: 9 },
  { field: 'NCBILL_NO', caption: 'BILLNO', kind: 'C', len: 10 },
  { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 24 },
  { field: 'ITEM', caption: 'ITEM', kind: 'C', len: 20 },
  { field: 'LRNO', caption: 'LRNO', kind: 'C', len: 12 },
  { field: 'SP_TYPE', caption: 'TYPE', kind: 'C', len: 12 },
  { field: 'TO_PCS', caption: 'PCS', kind: 'N', dec: 0, total: true, len: 8 },
  { field: 'TO_QTY', caption: 'MTS', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'IT_RATE', caption: 'RATE', kind: 'N', dec: 2, len: 10 },
  { field: 'NET_TOT', caption: 'AMOUNT', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'STK_MTS', caption: 'STK.MTS', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'LR_COUNT', caption: 'COUNT', kind: 'N', dec: 0, len: 7 },
];

const GODOWN_COLUMNS = [
  { field: 'BILL_DATE', caption: 'BILL.DATE', kind: 'D', len: 10 },
  { field: 'SRAL_NO', caption: 'SRALNO', kind: 'C', len: 9 },
  { field: 'GP_NO', caption: 'GP.NO', kind: 'C', len: 12 },
  { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 24 },
  { field: 'ITEM', caption: 'ITEM', kind: 'C', len: 20 },
  { field: 'GODOWN', caption: 'GODOWN', kind: 'C', len: 14 },
  { field: 'G_PCS', caption: 'G.PCS', kind: 'N', dec: 0, total: true, len: 9 },
  { field: 'G_QTY', caption: 'G.QTY', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'NCCHLN_NO', caption: 'CH.NO', kind: 'C', len: 9 },
  { field: 'CHLN_DATE', caption: 'CH.DATE', kind: 'D', len: 10 },
  { field: 'ISS_PCS', caption: 'ISS.PCS', kind: 'N', dec: 0, total: true, len: 9 },
  { field: 'ISS_QTY', caption: 'ISS.QTY', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'BAL_PCS', caption: 'B.PCS', kind: 'N', dec: 0, total: true, len: 9 },
  { field: 'BAL_QTY', caption: 'B.QTY', kind: 'N', dec: 2, total: true, len: 12 },
];

/** The two newer screens share their shape: four lists, two Order By boxes, a status combo. */
const tabbed = (form, fallbackColumns) => ({
  form,
  lists: { ListView0: 'parties', ListView1: 'items', ListView2: 'registers', ListView3: 'godowns' },
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    CBo_status: '1-Pending',
    Cbo_OrderBy1: 'None',
    Cbo_OrderBy2: 'None',
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    status: s.CBo_status,
    orderBy1: s.Cbo_OrderBy1,
    orderBy2: s.Cbo_OrderBy2,
    printout: s.cbo_printout,
    parties: s.ListView0 || [],
    items: s.ListView1 || [],
    registers: s.ListView2 || [],
    godowns: s.ListView3 || [],
  }),
  fallbackColumns,
});

const old = {
  form: 'Rpt_Purchase_Stock',
  lists: { lst_vw1: 'parties', ListView1: 'items' },
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    Rdbtn_A1: true,
    Rdbtn_C1: true,
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    status: s.Rdbtn_A3 ? '3-All' : (s.Rdbtn_A2 ? '2-Clear' : '1-Pending'),
    category: s.Rdbtn_C3 ? '3-Item' : (s.Rdbtn_C2 ? '2-Party' : '1-Normal'),
    withUnadjust: Boolean(s.Chk_Unadjust),
    parties: s.lst_vw1 || [],
    items: s.ListView1 || [],
  }),
  fallbackColumns: { JSM_VW_PUR_STK: OLD_COLUMNS },
};

export const PURCHASE_STOCKS = [
  tabbed('Rpt_Purchase_Stock_LRWiseReport', { JSM_VW_PURCHASE_STOCK_LRWISE_REPORT: LR_COLUMNS }),
  tabbed('Rpt_Purchase_Stock_Godown_Report', { JSM_VW_PURCHASE_STOCK_GODOWN: GODOWN_COLUMNS }),
  old,
];
