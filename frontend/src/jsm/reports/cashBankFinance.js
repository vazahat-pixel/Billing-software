import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › Final Reports › CashBank Finance (Rpt_Cash_Bank_Finance_Report).
 * Book / Party lists, dates, GroupBy 1 (Book or Party). Columns as JSM's Js_Add_NewColumn_Function names them.
 */
const N = (field, caption, len = 12) => ({ field, caption, kind: 'N', dec: 2, total: true, len });

export default {
  form: 'Rpt_Cash_Bank_Finance_Report',
  lists: { ListView0: 'books', ListView1: 'parties' },
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    Cbo_OrderBy1: 'Book',
    cbo_printout: '1-Continue',
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    orderBy1: s.Cbo_OrderBy1 || 'Book',
    printout: s.cbo_printout || '1-Continue',
    books: s.ListView0 || [],
    parties: s.ListView1 || [],
  }),
  fallbackColumns: {
    JSM_VW_GST_BC_FINANCE_RPT: [
      { field: 'BOOK', caption: 'BOOK', kind: 'C', len: 14 },
      { field: 'AC_NAME', caption: 'PARTY', kind: 'C', len: 24 },
      { field: 'PBANK', caption: 'P.BANK', kind: 'C', len: 16 },
      { field: 'ENT_NO', caption: 'ENT.NO', kind: 'N', dec: 0, len: 8 },
      { field: 'SRAL_NO', caption: 'VOU.NO', kind: 'N', dec: 0, len: 8 },
      { field: 'REC_DATE', caption: 'REC.DATE', kind: 'D', len: 10 },
      N('REC_AMT', 'REC.AMT'),
      { field: 'REC_PAY', caption: 'REC/PAY', kind: 'C', len: 7 },
      { field: 'CHQ_NO', caption: 'CHQ.NO', kind: 'C', len: 10 },
      { field: 'CHQ_DATE', caption: 'CHQ.DATE', kind: 'D', len: 10 },
      N('TOT_ADJUST', 'TOT.ADJ'),
      N('FNCE_AMT', 'FINANCE.AMT'),
    ],
  },
};
