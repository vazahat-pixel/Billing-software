import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › Inv Stock Ledger › Finish At Shop Stock (Rpt_Jsm_Stock_Finish_New1).
 * Unit (Qty / Pcs / Kgs), Item or Category, and the Datewise+Mix / Datewise / Month / Summary choice.
 * Qty and Pcs columns are JSM's captured JSM_VW_STOCK_FINISH(_PCS); Kgs is listed from AddColoumns.
 */
const N = (field, caption, dec = 2, len = 10) => ({ field, caption, kind: 'N', dec, total: true, len });

export default {
  form: 'Rpt_Jsm_Stock_Finish_New1',
  lists: {},
  runButtons: ['btn_screen', 'btn_print', 'Btn_Excel'],
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    cbo_unit: '1-Qty',
    cbo_category: '1-Item',
    cbo_company: '1-Current Company',
    cbo_report_type: '1-Default',
    RdBtn_Summary: true,
    CheckBox_CLStk_0: false,
    CheckBox_ItemSummary: false,
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    unit: s.cbo_unit || '1-Qty',
    category: s.cbo_category || '1-Item',
    mode: s.RdBtn_Monthly ? 'month' : s.RdBtn_DateWise ? 'datewise' : s.RdBtn_DateWise_Mix ? 'datewiseMix' : 'summary',
    closingZero: Boolean(s.CheckBox_CLStk_0),
  }),
  fallbackColumns: {
    JSM_VW_STOCK_FINISH__KGS: [
      { field: 'ITEM_NAME', caption: 'ITEM NAME', kind: 'C', len: 20 },
      N('OP_KGS', 'OPENING'), N('ML_RF_KGS', 'REFINISH'), N('ML_REC_KGS', 'PROCESS'), N('FNS_PU_KGS', 'PURCHASE'),
      N('FNS_SL_KGS', 'SALES'), N('FNS_SLR_KGS', 'SL RETURN'), N('FNS_PUR_KGS', 'PU RETURN'),
      N('JB_ISS_KGS', 'JOB ISS'), N('JB_REC_KGS', 'JOB REC'), N('CL_KGS', 'CLOSING'),
    ],
  },
};
