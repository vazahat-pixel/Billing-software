import { toIsoDate } from '../winforms.js';

/**
 * JSM: Rpt_Stk_Grey_At_Shop ("Grey In Shop - Stock Reports") — Inv Stock Ledger › Grey At Shop Stock and
 * Old Stock Reports › GreyAtShop. Dates, W-Item / X-Category / Y-Date+Month wise, Qty or Pcs and the
 * Item or Category list. JSM prints this from a Crystal template; the grid carries the columns of
 * its TMP_VW_GREY_STK view.
 */
const N = (field, caption, len = 12) => ({ field, caption, kind: 'N', dec: 2, total: true, len });

export default {
  form: 'Rpt_Stk_Grey_At_Shop',
  lists: { lst_vw1: 'items', lst_vw2: 'categories' },
  runButtons: ['btn_screen', 'btn_print', 'btn_word'],
  defaults: ({ fyFrom, fyTo }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo, Rdbtn_A1: true, Rdbtn_B2: true }),
  overrides: (s) => ({ lst_vw1: { visible: !s.Rdbtn_A2 }, lst_vw2: { visible: Boolean(s.Rdbtn_A2) } }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    mode: s.Rdbtn_A3 ? 'month' : s.Rdbtn_A2 ? 'category' : 'item',
    pcs: !s.Rdbtn_B1,
    items: s.lst_vw1 || [],
    categories: s.lst_vw2 || [],
  }),
  fallbackColumns: {
    RPT_GREY_AT_SHOP: [
      { field: 'ITEM_NAME', caption: 'ITEM', kind: 'C', len: 26 },
      N('OP_STOCK', 'OP.STOCK'),
      N('PURCHASE', 'PURCHASE'),
      N('MILL_GR_RTN', 'MILL.RTN'),
      N('MILL_SEND', 'MILL.SEND'),
      N('GREY_SL', 'SALES'),
      N('PU_RTN_GRY', 'PU.RETURN'),
      N('CL_STOCK', 'CLOSING'),
    ],
  },
};
