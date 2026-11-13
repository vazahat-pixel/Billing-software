import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › Inv Stock Ledger › Stock Mts New Reports (Rpt_Monthly_Stk_Qty_Value_Report).
 * Dates, Company Wise and the Wastages / Samples percentages; Generate shows the Head / Qty / Value statement.
 */
export default {
  form: 'Rpt_Monthly_Stk_Qty_Value_Report',
  lists: {},
  runButtons: ['Btn_Generate'],
  defaults: ({ fyFrom, fyTo }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo, cbo_company: 'Current', txt_samples_per: '', txt_Wastage_per: '' }),
  toParams: (s) => ({ from: toIsoDate(s.txt_dt_from), to: toIsoDate(s.txt_dt_to), fromText: s.txt_dt_from, toText: s.txt_dt_to }),
  fallbackColumns: {
    RPT_STOCK_QTY_VALUE: [
      { field: 'HEADNAME', caption: 'Head', kind: 'C', len: 34 },
      { field: 'QTY', caption: 'Qty', kind: 'N', dec: 3, total: false, len: 14 },
      { field: 'VALUE', caption: 'Value', kind: 'N', dec: 2, total: false, len: 16 },
    ],
  },
};
