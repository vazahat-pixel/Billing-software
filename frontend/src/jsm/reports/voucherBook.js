import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › Fas Reports › Voucher Book (Rpt_JvBook1, "Voucher Reports").
 * A JV / DN / CN combo, a date range and the X-Detail / Y-Summary radio — the captured form's
 * own controls. Columns are JSM's own VW_T_JV_BOOK.
 */
export default {
  form: 'Rpt_JvBook1',
  lists: {},
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    cbo_bk_type: 'JV',
    Rdbtn_C1: true,
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    voucherType: s.cbo_bk_type || 'JV',
    summary: Boolean(s.Rdbtn_C2),
  }),
  fallbackColumns: {
    JSM_VW_JV_BOOK: [
      { field: 'ENT_DATE', caption: 'Date', kind: 'D', len: 10 },
      { field: 'SRAL_NO', caption: 'V.No', kind: 'C', len: 10 },
      { field: 'J_NAME', caption: 'Account Name', kind: 'C', len: 32 },
      { field: 'R_P', caption: 'D/C', kind: 'C', len: 4 },
      { field: 'AMOUNT', caption: 'Amount', kind: 'N', dec: 2, total: true, len: 15 },
    ],
    JSM_VW_JV_BOOK_SUMMARY: [
      { field: 'J_NAME', caption: 'Account Name', kind: 'C', len: 32 },
      { field: 'AMOUNT', caption: 'Amount', kind: 'N', dec: 2, total: true, len: 15 },
    ],
  },
};
