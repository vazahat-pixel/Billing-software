import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › Tcs Reports › Tcs Rec/Pay Report (Rpt_Tcs).
 * Type Wise (Receipt / Pay), dates, ticked parties and "Applicable PartyOnly"; grouped by Register.
 * Columns as JSM's own format script for JSM_VW_REC_TCS1 sets them.
 */
const N = (field, caption, dec, len, total = true) => ({ field, caption, kind: 'N', dec, total, len });

export default {
  form: 'Rpt_Tcs',
  lists: { ListView0: 'parties' },
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    Cbo_Head: 'Receipt',
    cbo_printout: '1-Continue',
    Cbo_OrderBy1: 'Register',
    Cbo_OrderBy2: 'None',
    CheckBox_ApplicableParty: false,
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    head: s.Cbo_Head || 'Receipt',
    applicableOnly: Boolean(s.CheckBox_ApplicableParty),
    printout: s.cbo_printout || '1-Continue',
    parties: s.ListView0 || [],
  }),
  fallbackColumns: {
    JSM_VW_REC_TCS1: [
      { field: 'AC_NAME', caption: 'PARTY', kind: 'C', len: 30 },
      { field: 'PAN_NO', caption: 'PAN NO', kind: 'C', len: 15 },
      N('OP_RECEIPT', 'OPENING', 2, 15),
      N('CUR_RECEIPT', 'CURRENT', 2, 15),
      N('TOTAL_RECEIPT', 'TOTAL', 2, 15),
      N('APPLICABLE_VALUE', 'APPL.VALUE', 2, 12),
      N('TCS_PER', 'TCS.PER', 4, 8, false),
      N('TCS_AMT', 'TCS.AMT', 2, 12),
    ],
  },
};
