import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › Monthly Reports › Sales G/F (Rpt_Stk_Grey_Finish_Summary).
 * Sales per day, grey on one side and finish on the other — the columns of JSM's own
 * TMP_VW_ROW_FINISH_STOCK view (its FINISH_AMOINT spelling included).
 */
export default {
  form: 'Rpt_Stk_Grey_Finish_Summary',
  lists: {},
  defaults: ({ fyFrom, fyTo }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
  }),
  fallbackColumns: {
    JSM_VW_ROW_FINISH_STOCK: [
      { field: 'BILL_DATE', caption: 'DATE', kind: 'D', len: 10 },
      { field: 'GREY_PCS', caption: 'GREY.PCS', kind: 'N', dec: 0, total: true, len: 10 },
      { field: 'GREY_QTY', caption: 'GREY.QTY', kind: 'N', dec: 2, total: true, len: 12 },
      { field: 'GREY_AMOUNT', caption: 'GREY.AMOUNT', kind: 'N', dec: 2, total: true, len: 14 },
      { field: 'FINISH_PCS', caption: 'FINISH.PCS', kind: 'N', dec: 0, total: true, len: 10 },
      { field: 'FINISH_QTY', caption: 'FINISH.QTY', kind: 'N', dec: 2, total: true, len: 12 },
      { field: 'FINISH_AMOINT', caption: 'FINISH.AMOUNT', kind: 'N', dec: 2, total: true, len: 14 },
    ],
  },
};
