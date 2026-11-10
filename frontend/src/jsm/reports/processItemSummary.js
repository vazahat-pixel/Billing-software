import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › Process Reports › Item Wise Summary (Rpt_Jsm_Process_ItemSummary).
 * Category Wise over the mill receipts, with JSM's Month Wise box — the captured form's controls.
 */
export default {
  form: 'Rpt_Jsm_Process_ItemSummary',
  lists: { ListView0: 'parties', ListView1: 'items' },
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    cbo_category: '1-Normal',
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    category: s.cbo_category,
    monthWise: Boolean(s.Chk_Month || s.CheckBox_MonthWise),
    printout: s.cbo_printout,
    parties: s.ListView0 || [],
    items: s.ListView1 || [],
  }),
};
