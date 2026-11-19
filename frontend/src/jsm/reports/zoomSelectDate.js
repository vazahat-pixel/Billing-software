import { toIsoDate } from '../winforms.js';

/**
 * JSM: Others Reports > Outstanding > UnAdjust Setup (Zoom_SelectDate_List)
 * Uses captured JSM_VW_LEDGER_ACCOUNT layout (and bank reconciliation when Btn_Reconcilation clicked).
 */
export default {
  form: 'Zoom_SelectDate_List',
  runButtons: ['Btn_Ok', 'Btn_Confirmation', 'Btn_Interest', 'Btn_Reconcilation'],
  exitButtons: ['Btn_Exit'],
  lists: {},
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    txt_Head: '',
    txt_pname: '',
    CheckBox_WithRemark: true,
    CheckBox_Address: false,
    CheckBox_CoPath: false,
  }),
  overrides: (opts) => ({
    txt_pname: { kind: 'ComboBox', items: opts?.ledgers || [] },
  }),
  toParams: (s, btnName) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    account: s.txt_pname || '',
    ledgers: s.txt_pname ? [s.txt_pname] : [],
    withNarration1: Boolean(s.CheckBox_WithRemark),
    withNarration2: Boolean(s.CheckBox_WithRemark),
    action: btnName || 'Btn_Ok',
  }),
};

