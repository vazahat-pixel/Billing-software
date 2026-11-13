import { toIsoDate } from '../winforms.js';

/**
 * JSM: Rpt_Stk_Meter_TanusKgs ("Soctk Meter Report (Kgs)") — Stock Mts Reports and Stock Mts Reports(Kgs).
 * As on Date, the A choice (All / Grey Stock / Grey In Mill / Finish Stock / Job Stock), orientation and the
 * Wastages / Samples percentages. JSM prints one statement (Grey, Mill Grey, Mill Rf, Finish blocks); this
 * carries the same lines as a grid.
 */
const stock = (key, kgs) => ({
  form: key,
  blueprintForm: 'Rpt_Stk_Meter_TanusKgs',
  apiForm: 'Rpt_Stk_Meter_TanusKgs',
  lists: {},
  runButtons: ['btn_screen', 'btn_print', 'btn_excel'],
  defaults: ({ fyTo }) => ({ txt_dt_to: fyTo, Rdbtn_A1: true, Grp2_Landscape: true, txt_per: '0.00', txt_per1: '0.00' }),
  toParams: (s) => ({
    to: toIsoDate(s.txt_dt_to),
    toText: s.txt_dt_to,
    kgs,
    section: s.Rdbtn_A5 ? '5' : s.Rdbtn_A4 ? '4' : s.Rdbtn_A3 ? '3' : s.Rdbtn_A2 ? '2' : '1',
  }),
  fallbackColumns: {
    RPT_STK_METER_STATEMENT: [
      { field: 'SECTION', caption: '', kind: 'C', len: 14 },
      { field: 'HEADNAME', caption: 'PARTICULARS', kind: 'C', len: 28 },
      { field: 'VALUE', caption: kgs ? 'KGS' : 'MTS', kind: 'N', dec: 2, total: false, len: 14 },
    ],
  },
});

export const STOCK_MTS_FORM = 'Rpt_Stk_Meter_TanusKgs';
export const STOCK_KGS_FORM = 'Rpt_Stk_Meter_TanusKgs#Kgs';
export const STOCK_METER_REPORTS = [stock(STOCK_MTS_FORM, false), stock(STOCK_KGS_FORM, true)];
