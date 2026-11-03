import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › Final Reports › BalanceSheet (A_Final_BalanceSheet).
 * As On Date, From Date, 1-GroupWise/2-Alphabet/3-ScheduleWise, Single/Double, checkboxes —
 * matching the real form's controls (captured blueprint, confirmed against the owner's own
 * screenshot, 03/11/2026: Group Wise + Double checked, a two-column "GridReports" window).
 *
 * No STP_REPORT row backs this screen (JSM builds it from its own TMP_VW_TR_BAL-derived logic at
 * runtime); its two columns (Account Name, Rs) come from the owner's own printed Balance Sheet.
 * Renders through JsmGridReportsTwoColumn, not the usual single-table grid — the backend report
 * returns pre-built {left,right} line lists directly, so there is no fallbackColumns here.
 */
export default {
  form: 'A_Final_BalanceSheet',
  renderer: 'twoColumn',
  lists: {},
  defaults: ({ fyFrom, fyTo }) => ({
    Txt_FromDate: fyFrom,
    Txt_AsOnDate: fyTo,
    Rdbtn_GroupWise: true,
    Rdbtn_DoubleSide: true,
  }),
  toParams: (s) => ({
    from: toIsoDate(s.Txt_FromDate),
    to: toIsoDate(s.Txt_AsOnDate),
    fromText: s.Txt_FromDate,
    toText: s.Txt_AsOnDate,
    orderBy: s.Rdbtn_Alphabet ? 'alphabet' : s.Rdbtn_ScheduleWise ? 'schedule' : 'group',
    format: s.Rdbtn_SingleSide ? 'single' : 'double',
  }),
};
