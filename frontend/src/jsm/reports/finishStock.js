import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › Inv Stock Ledger › Finish Stock Excel (Rpt_FinishStockReport).
 *
 * Two ticked lists — Item and Category, the two its own Load fills — a date range and the two
 * Order By boxes (Item, Category, DateWise, Item+Date, None). JSM_VW_STOCK_DETAIL_FINISH_REPORT
 * has a captured STP_REPORT row, so its columns are JSM's own — no hand-written list here.
 */
export default {
  form: 'Rpt_FinishStockReport',
  lists: { ListView0: 'items', ListView1: 'categories' },
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    Cbo_OrderBy1: 'Item',
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
    items: s.ListView0 || [],
    categories: s.ListView1 || [],
  }),
};
