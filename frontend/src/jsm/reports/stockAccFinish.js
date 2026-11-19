import { toIsoDate } from '../winforms.js';

/**
 * JSM: Rpt_Stock_Acc_Finish_Summary ("Summary - Stock Reports") — Acc Stock Reports › Stock Ledger New and
 * Inv Stock Ledger › Finish At Shop Stock(Book-Acc). Item / Category / Book lists, Item By Qty / Pcs / Kgs,
 * GroupBy 1 / 2 and X-Detail / Y-Summary. Columns are the ones JSM's Js_Add_NewColumn_Function names.
 */
const N = (field, caption, len = 11) => ({ field, caption, kind: 'N', dec: 2, total: true, len });

export default {
  form: 'Rpt_Stock_Acc_Finish_Summary',
  lists: { ListView0: 'items', ListView1: 'categories', ListView2: 'books' },
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    Rdbtn_B1: true,
    Rdbtn_D2: true,
    Cbo_OrderBy1: 'Item',
    Cbo_OrderBy2: 'None',
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    itemBy: s.Rdbtn_B3 ? '3-Kgs' : s.Rdbtn_B2 ? '2-Pcs' : '1-Qty',
    summary: Boolean(s.Rdbtn_D2),
    orderBy1: s.Cbo_OrderBy1 || 'Item',
    orderBy2: s.Cbo_OrderBy2 || 'None',
    items: s.ListView0 || [],
    categories: s.ListView1 || [],
    books: s.ListView2 || [],
  }),
  fallbackColumns: {
    JSM_VW_FINISH_STOCK_SUMMARY_REPORT: [
      { field: 'GRIT_NAME', caption: 'GRIT.NAME', kind: 'C', len: 16 },
      { field: 'ITEM_NAME', caption: 'ITEM.NAME', kind: 'C', len: 24 },
      { field: 'BILL_DATE', caption: 'BILL.DATE', kind: 'D', len: 10 },
      { field: 'BOOK_NAME', caption: 'BOOK.NAME', kind: 'C', len: 14 },
      N('OP_STOCK', 'OP.STOCK'),
      N('PURCHASE', 'PURCHASE'),
      N('SALES', 'SALES'),
      N('SL_RTN', 'SALES.RETURN'),
      N('PU_RTN', 'PURCHASE.RETURN'),
      N('CL_STK', 'CLS.STK'),
    ],
  },
};
