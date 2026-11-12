import { toIsoDate } from '../winforms.js';

const SHARE_COLS = [
  { field: 'GRIT_NAME', caption: 'CATEGORY', kind: 'C', len: 18 },
  { field: 'ITEM_NAME', caption: 'ITEM NAME', kind: 'C', len: 28 },
  { field: 'PU_RATE', caption: 'RATE', kind: 'N', dec: 2, len: 10 },
  { field: 'OP_QTY', caption: 'OP.QTY', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'PU_QTY', caption: 'PU.QTY', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'SL_QTY', caption: 'SL.QTY', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'BAL_QTY', caption: 'BAL.QTY', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'OP_VAL', caption: 'OP.VAL', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'PU_VAL', caption: 'PU.VAL', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'SL_VAL', caption: 'SL.VAL', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'BAL_VAL', caption: 'BAL.VAL', kind: 'N', dec: 2, total: true, len: 12 },
];

const SIZE_COLS = [
  { field: 'REGISTER', caption: 'REGISTER', kind: 'C', len: 14 },
  { field: 'ITEM_NAME', caption: 'ITEM', kind: 'C', len: 26 },
  { field: 'SIZECHART', caption: 'SIZE', kind: 'C', len: 14 },
  { field: 'PU_PCS', caption: 'PU.PCS', kind: 'N', dec: 0, total: true, len: 10 },
  { field: 'PU_QTY', caption: 'PU.QTY', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'SL_PCS', caption: 'SL.PCS', kind: 'N', dec: 0, total: true, len: 10 },
  { field: 'SL_QTY', caption: 'SL.QTY', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'CLS_PCS', caption: 'CL.PCS', kind: 'N', dec: 0, total: true, len: 10 },
  { field: 'CLS_QTY', caption: 'CL.QTY', kind: 'N', dec: 2, total: true, len: 12 },
];

const GREY_DATE_COLS = [
  { field: 'BILL_DATE', caption: 'DATE', kind: 'D', len: 11 },
  { field: 'ITEM_NAME', caption: 'ITEM', kind: 'C', len: 24 },
  { field: 'OP_STOCK', caption: 'OPENING', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'PURCHASE', caption: 'PURCHASE', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'MILL_GR_RTN', caption: 'MILL RTN', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'MILL_SEND', caption: 'MILL SEND', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'GREY_SL', caption: 'GREY SALE', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'PU_RTN_GRY', caption: 'PU.RTN', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'BAL_QTY', caption: 'BALANCE', kind: 'N', dec: 2, total: true, len: 12 },
];

export const OLD_STOCK_REPORTS = [
  {
    form: 'Rpt_Stock_Share',
    lists: { ListView0: 'items', ListView1: 'categories' },
    defaults: ({ fyFrom, fyTo }) => ({
      txt_dt_from: fyFrom,
      txt_dt_to: fyTo,
      ListView0: [],
      ListView1: [],
    }),
    toParams: (s) => ({
      from: toIsoDate(s.txt_dt_from),
      to: toIsoDate(s.txt_dt_to),
      fromText: s.txt_dt_from,
      toText: s.txt_dt_to,
      items: s.ListView0 || [],
      categories: s.ListView1 || [],
    }),
    fallbackColumns: {
      JSM_VW_RUNTIME_ITEM_CAT_RPT: SHARE_COLS,
    },
  },
  {
    form: 'Rpt_StockSizeWise',
    lists: { ListView0: 'items' },
    defaults: ({ fyFrom, fyTo }) => ({
      txt_dt_from: fyFrom,
      txt_dt_to: fyTo,
      Cbo_OrderBy1: 'None',
      cbo_printout: '1-Continue',
      ListView0: [],
    }),
    toParams: (s) => ({
      from: toIsoDate(s.txt_dt_from),
      to: toIsoDate(s.txt_dt_to),
      fromText: s.txt_dt_from,
      toText: s.txt_dt_to,
      orderBy1: s.Cbo_OrderBy1 || 'None',
      printout: s.cbo_printout || '1-Continue',
      items: s.ListView0 || [],
    }),
    fallbackColumns: {
      JSM_VW_STOCK_SIZEWISE: SIZE_COLS,
    },
  },
  {
    form: 'Rpt_Stk_Grey_At_Shop_DateWise',
    lists: { lst_vw1: 'items', lst_vw2: 'categories' },
    defaults: ({ fyFrom, fyTo }) => ({
      txt_dt_from: fyFrom,
      txt_dt_to: fyTo,
      lst_vw1: [],
      lst_vw2: [],
    }),
    toParams: (s) => ({
      from: toIsoDate(s.txt_dt_from),
      to: toIsoDate(s.txt_dt_to),
      fromText: s.txt_dt_from,
      toText: s.txt_dt_to,
      items: s.lst_vw1 || [],
      categories: s.lst_vw2 || [],
    }),
    fallbackColumns: {
      JSM_VW_GREY_STK_DATE: GREY_DATE_COLS,
    },
  },
];

