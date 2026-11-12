import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › Monthly Reports › Bank Rec. Payment (Rpt_BankBookRec_GstMonthWise).
 * Dates, Company Wise and the BANK BOOK list; the grid is MONTH, DEBIT, CREDIT under REGISTER.
 */
export default {
  form: 'Rpt_BankBookRec_GstMonthWise',
  lists: { ListView0: 'banks' },
  defaults: ({ fyFrom, fyTo }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo, Cbo_Company: 'Current' }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    banks: s.ListView0 || [],
  }),
  fallbackColumns: {
    JSM_VW_T_CASHBANK_MONTH_WISE: [
      { field: 'REGISTER', caption: 'REGISTER', kind: 'C', len: 12 },
      { field: 'MONTH', caption: 'MONTH', kind: 'C', len: 12 },
      { field: 'DEBIT', caption: 'DEBIT', kind: 'N', dec: 2, total: true, len: 15 },
      { field: 'CREDIT', caption: 'CREDIT', kind: 'N', dec: 2, total: true, len: 15 },
    ],
  },
};
