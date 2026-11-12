import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › Inv Stock Ledger › Grey At Mill Stock - Format 1 (Rpt_Jsm_Stock_Grey_At_Mill).
 * Dates, Book (All / Selected), Item or Category, Summary Reports. JSM_VW_STOCK_MILL is captured.
 */
export default {
  form: 'Rpt_Jsm_Stock_Grey_At_Mill',
  lists: {},
  runButtons: ['btn_screen', 'btn_print'],
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    cbo_category: '1-Item',
    cbo_book: '1-All',
    cbo_company: '1-Current Company',
    cbo_report_type: '1-Default',
    CheckBox_Summary: false,
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    category: s.cbo_category || '1-Item',
    summary: Boolean(s.CheckBox_Summary),
  }),
};
