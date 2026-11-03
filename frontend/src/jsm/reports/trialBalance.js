import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › Final Reports › Trail Balance (Rpt_Trail_Bal_101).
 * A-Current/Opening, B-Double/Single/SingleGroupWiseTotal/Summary/DoubleGroup, C-GroupWise/
 * Alphabet/ScheduleWise, date range, account tick list, "With Zero Balance" — matching the real
 * form's controls (captured blueprint, confirmed against the owner's own JSM screenshot, 03/11/2026).
 *
 * No STP_REPORT row backs this screen's columns (JSM builds them from its own TMP_VW_TR_BAL view
 * at runtime) — the two columns below (Account Name, Debit, Credit) come from the owner's own
 * printed Trial Balance Report, not a guess.
 */
export default {
  form: 'Rpt_Trail_Bal_101',
  lists: {},
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    Rdbtn_Current: true,
    Rdbtn_B2: true,
    Rdbtn_C1: true,
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    opening: Boolean(s.Rdbtn_Opening),
    format: s.Rdbtn_B1 ? '1' : s.Rdbtn_B3 ? '3' : s.Rdbtn_B4 ? '4' : s.Rdbtn_B5 ? '5' : '2',
    orderBy: s.Rdbtn_C2 ? '2' : s.Rdbtn_C3 ? '3' : '1',
    withZero: Boolean(s.chk_zero),
  }),
  fallbackColumns: {
    JSM_VW_TR_BAL: [
      { field: 'AC_NAME', caption: 'Account_Name', kind: 'C', len: 30 },
      { field: 'DR_AMOUNT', caption: 'Debit', kind: 'N', dec: 2, total: true, len: 15 },
      { field: 'CR_AMOUNT', caption: 'Credit', kind: 'N', dec: 2, total: true, len: 15 },
    ],
  },
};
