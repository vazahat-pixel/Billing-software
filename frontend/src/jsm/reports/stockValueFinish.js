import { toIsoDate } from '../winforms.js';

/**
 * JSM: Rpt_Stk_Acc_Finish_Summary_Value — Acc Stock Reports › Stock With Value Report.
 * Dates, W-Item / X-Category list, 1-Qty / 2-Pcs, With Value, "/100". JSM prints from a Crystal
 * template; this is the same figures as a grid.
 */
const N = (field, caption, len = 11) => ({ field, caption, kind: 'N', dec: 2, total: true, len });

export default {
  form: 'Rpt_Stk_Acc_Finish_Summary_Value',
  lists: {},
  dynamicLists: (s, o) => ({ lst_vw1: s.Rdbtn_A2 ? (o.categories || []) : (o.items || []) }),
  runButtons: ['btn_screen', 'btn_print', 'btn_word', 'Js1_Button1'],
  defaults: ({ fyFrom, fyTo }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo, Rdbtn_A1: true, Rdbtn_B1: true, Rdbtn_D1: true, chk_Value: true }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    pcs: Boolean(s.Rdbtn_B2),
    div100: Boolean(s.chk_100),
    byCategory: Boolean(s.Rdbtn_A2),
    ...(s.Rdbtn_A2 ? { categories: s.lst_vw1 || [] } : { items: s.lst_vw1 || [] }),
  }),
  fallbackColumns: {
    RPT_STOCK_WITH_VALUE: [
      { field: 'ITEM_NAME', caption: 'ITEM', kind: 'C', len: 24 },
      { field: 'PU_RATE', caption: 'RATE', kind: 'N', dec: 2, len: 9 },
      N('OP_STOCK', 'OP.STOCK'), N('PROCESS', 'PROCESS'), N('FNS_PU', 'PURCHASE'), N('FNS_SL', 'SALES'),
      N('SL_RTN', 'SALES RTN'), N('FNS_RTN', 'PU RTN'), N('CL_STOCK', 'CLOSING'), N('STOCK_VALUE', 'VALUE', 13),
    ],
  },
};
