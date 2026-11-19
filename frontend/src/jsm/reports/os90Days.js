import { toIsoDate } from '../winforms.js';

/**
 * JSM: Others Reports › Outstanding › Debitors › 90 Days (Rpt_Os_90Days_Eklvya, "Eklv O/s.").
 *
 * One line per account: the bills raised on it, what came back, what is left, and how long since
 * it last bought anything. JSM prints this one through Crystal (Cry_sales_eklv.rpt), so there is
 * no STP_REPORT layout for it and the columns are the ones its own view selects.
 */
const COLUMNS = [
  { field: 'AC_NAME', caption: 'PARTY', kind: 'C', len: 30 },
  { field: 'TOT_SALES', caption: 'SALES', kind: 'N', dec: 2, total: true, len: 14 },
  { field: 'TOT_REC', caption: 'RECEIVED', kind: 'N', dec: 2, total: true, len: 14 },
  { field: 'TOT_OS', caption: 'OUTSTANDING', kind: 'N', dec: 2, total: true, len: 14 },
  { field: 'BLDT', caption: 'LAST BILL', kind: 'D', len: 10 },
  { field: 'NO_OF_DAYS', caption: 'DAYS', kind: 'N', dec: 0, len: 7 },
];

export default {
  form: 'Rpt_Os_90Days_Eklvya',
  lists: { lst_vw1: 'parties' },
  defaults: ({ today }) => ({ txt_r_dt1: today }),
  toParams: (s) => ({
    asOn: toIsoDate(s.txt_r_dt1),
    asOnText: s.txt_r_dt1,
    parties: s.lst_vw1 || [],
  }),
  fallbackColumns: { JSM_VW_OS_90DAYS: COLUMNS },
};
