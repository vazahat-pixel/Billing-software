import { toIsoDate } from '../winforms.js';

const PROFIT_COLS = [
  { field: 'ITEM', caption: 'ITEM', kind: 'C', len: 26 },
  { field: 'OP_QTY', caption: 'OP.QTY', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'OP_VAL', caption: 'OP.VAL', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'PU_QTY', caption: 'PU.QTY', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'PU_AMT', caption: 'PU.AMT', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'SALE_QTY', caption: 'SL.QTY', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'SALE_AMT', caption: 'SL.AMT', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'CL_QTY', caption: 'CL.QTY', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'CL_VAL', caption: 'CL.VAL', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'GP_AMT', caption: 'GROSS PROFIT', kind: 'N', dec: 2, total: true, len: 13 },
];

const STOCK_VAL_COLS = [
  { field: 'ITEM', caption: 'ITEM', kind: 'C', len: 26 },
  { field: 'CATEGORY', caption: 'CATEGORY', kind: 'C', len: 18 },
  { field: 'OP_QTY', caption: 'OP.QTY', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'PU_QTY', caption: 'PU.QTY', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'SALE_QTY', caption: 'SL.QTY', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'CL_QTY', caption: 'CL.QTY', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'RATE', caption: 'RATE', kind: 'N', dec: 2, len: 10 },
  { field: 'CL_VALUE', caption: 'CL.VALUE', kind: 'N', dec: 2, total: true, len: 13 },
];

const YARN_COLS = [
  { field: 'STOCK_AT', caption: 'STOCK AT', kind: 'C', len: 28 },
  { field: 'PU_KGS', caption: 'PU.KGS', kind: 'N', dec: 3, total: true, len: 13 },
  { field: 'ISS_KGS', caption: 'ISS.KGS', kind: 'N', dec: 3, total: true, len: 13 },
  { field: 'REC_KGS', caption: 'REC.KGS', kind: 'N', dec: 3, total: true, len: 13 },
  { field: 'BAL_KGS', caption: 'BAL.KGS', kind: 'N', dec: 3, total: true, len: 13 },
];

export const PROFIT_AND_YARN_REPORTS = [
  {
    form: 'Rpt_Sales_Pump_Profit',
    lists: { lst_vw1: 'items' },
    defaults: ({ fyFrom, fyTo }) => ({
      txt_dt_from: fyFrom,
      txt_dt_to: fyTo,
      grp_detail: true,
      grp_monthly: true,
    }),
    toParams: (s) => ({
      from: toIsoDate(s.txt_dt_from),
      to: toIsoDate(s.txt_dt_to),
      fromText: s.txt_dt_from,
      toText: s.txt_dt_to,
      summary: Boolean(s.grp_summary),
      items: s.lst_vw1 || [],
    }),
    fallbackColumns: { RUNTIME_STOCK_PROFIT_GP: PROFIT_COLS },
  },
  {
    form: 'A_StockValueReport',
    lists: {},
    defaults: ({ fyFrom, fyTo }) => ({
      txt_dt_from: fyFrom,
      txt_dt_to: fyTo,
      txt_Exp: '0.00',
    }),
    toParams: (s) => ({
      from: toIsoDate(s.txt_dt_from),
      to: toIsoDate(s.txt_dt_to),
      fromText: s.txt_dt_from,
      toText: s.txt_dt_to,
      totalExp: Number(s.txt_Exp || 0) || 0,
    }),
    fallbackColumns: { JSM_VW_STOCK_WITH_VALUE_REGISTER: STOCK_VAL_COLS },
  },
  {
    form: 'A_ReportYarnStock',
    lists: {},
    defaults: ({ fyFrom, fyTo }) => ({
      txt_dt_from: fyFrom,
      txt_dt_to: fyTo,
    }),
    toParams: (s) => ({
      from: toIsoDate(s.txt_dt_from),
      to: toIsoDate(s.txt_dt_to),
      fromText: s.txt_dt_from,
      toText: s.txt_dt_to,
    }),
    fallbackColumns: { RUNTIME_YARN_KGS_STOCK: YARN_COLS },
  },
];
