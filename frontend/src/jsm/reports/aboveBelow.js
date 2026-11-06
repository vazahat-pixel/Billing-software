import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › Fas Reports › Above Below Rs. (Rpt_Above_Below, "Above/Below Reports").
 * Six source radios (Sales, Purchase, Process, Jobwork, Cash Rec, Cash Pay), an Above/Below
 * radio and the amount to compare against — the captured form's own controls.
 *
 * No STP_REPORT row backs it; the columns are the ones JSM's own view selects.
 */
export default {
  form: 'Rpt_Above_Below',
  lists: {},
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    Rdbtn_A1: true,
    Rdbtn_B1: true,
    txt_1: '0.00',
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    source: s.Rdbtn_A2 ? 2 : s.Rdbtn_A3 ? 3 : s.Rdbtn_JobWork ? 4 : s.Rdbtn_Cash_Rec ? 5 : s.Rdbtn_Cash_Pay ? 6 : 1,
    direction: s.Rdbtn_B2 ? 'B' : 'A',
    amount: Number(String(s.txt_1 || '0').replace(/,/g, '')) || 0,
  }),
  fallbackColumns: {
    JSM_VW_GRATER_OR_LESS: [
      { field: 'AC_NAME', caption: 'Account Name', kind: 'C', len: 32 },
      { field: 'ST_NAME', caption: 'Station', kind: 'C', len: 18 },
      { field: 'AC_TOTAL', caption: 'Total', kind: 'N', dec: 2, total: true, len: 15 },
    ],
  },
};
