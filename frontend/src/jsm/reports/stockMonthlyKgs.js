import { toIsoDate } from '../winforms.js';

/**
 * JSM: Rpt_Stk_Meter_TanusKgs ("Soctk Meter Report (Kgs)") — Stock Mts Reports and Stock Mts Reports(Kgs).
 * As on Date, the A choice (All / Grey Stock / Grey In Mill / Finish Stock / Job Stock), orientation and
 * the Wastages / Samples percentages. JSM prints from Crystal templates; this is the month-wise
 * statement as a grid.
 */
const K = (field, caption) => ({ field, caption, kind: 'N', dec: 3, total: false, len: 12 });
const MONTH = { field: 'MONTH', caption: 'MONTH', kind: 'C', len: 12 };
const section = (cols) => [MONTH, K('OP_KGS', 'OPENING'), ...cols, K('CL_KGS', 'CLOSING')];

export default {
  form: 'Rpt_Stk_Meter_TanusKgs',
  lists: {},
  runButtons: ['btn_screen', 'btn_print', 'btn_excel'],
  defaults: ({ fyTo }) => ({ txt_dt_to: fyTo, Rdbtn_A1: true, Grp2_Landscape: true, txt_per: '0.00', txt_per1: '0.00' }),
  toParams: (s) => ({
    to: toIsoDate(s.txt_dt_to),
    toText: s.txt_dt_to,
    section: s.Rdbtn_A5 ? '5' : s.Rdbtn_A4 ? '4' : s.Rdbtn_A3 ? '3' : s.Rdbtn_A2 ? '2' : '1',
  }),
  fallbackColumns: {
    RPT_STK_METER_ALL: [MONTH, K('GREY_CL', 'GREY SHOP'), K('MILL_CL', 'GREY IN MILL'), K('FINISH_CL', 'FINISH'), K('JOB_CL', 'JOB')],
    RPT_STK_METER_GREY: [...section([K('PURCHASE', 'PURCHASE'), K('SL_RTN', 'SALES RTN'), K('PU_RTN_GRY', 'PU RTN'), K('GR_SL', 'SALES'), K('MILL_SEND', 'MILL SEND')])],
    RPT_STK_METER_MILL: [...section([K('MILL_SEND', 'MILL SEND'), K('MILL_REC', 'MILL REC')])],
    RPT_STK_METER_FINISH: [...section([K('MILL_REC', 'MILL REC'), K('FNS_PURCHASE', 'PURCHASE'), K('FNS_SL_RTN', 'SALES RTN'), K('FNS_SALES', 'SALES'), K('FNS_PU_RTN', 'PU RTN')])],
    RPT_STK_METER_JOB: [...section([K('WORK_ISS', 'JOB ISS'), K('WORK_REC', 'JOB REC')])],
  },
};
