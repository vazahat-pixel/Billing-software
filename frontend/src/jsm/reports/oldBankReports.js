const BANK_DETAIL_COLS = [
  { field: 'KIND', caption: 'TYPE', kind: 'C', len: 8 },
  { field: 'BANK_NAME', caption: 'BANK / CASH A/C', kind: 'C', len: 28 },
  { field: 'OP_BAL', caption: 'OP.BAL', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'BANK_DR', caption: 'DEPOSIT (DR)', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'BANK_CR', caption: 'WITHDRAW (CR)', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'BANK_BAL', caption: 'BOOK BAL', kind: 'N', dec: 2, total: true, len: 14 },
  { field: 'RECON_BAL', caption: 'RECON BAL', kind: 'N', dec: 2, total: true, len: 14 },
  { field: 'UNCLEAR_BAL', caption: 'UNCLEAR', kind: 'N', dec: 2, total: true, len: 12 },
];

const TAB_COLS = [
  { field: 'KIND', caption: 'TYPE', kind: 'C', len: 8 },
  { field: 'AC_NAME', caption: 'ACCOUNT NAME', kind: 'C', len: 30 },
  { field: 'OPBAL', caption: 'OP.BAL', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'INCOME', caption: 'DEPOSIT / DR', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'EXPENSE', caption: 'WITHDRAW / CR', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'CLBAL', caption: 'CLOSING BAL', kind: 'N', dec: 2, total: true, len: 14 },
  { field: 'CLEAR_BAL', caption: 'CLEAR BAL', kind: 'N', dec: 2, total: true, len: 14 },
  { field: 'UNCLEAR_BAL', caption: 'UNCLEAR', kind: 'N', dec: 2, total: true, len: 12 },
];

export const OLD_BANK_REPORTS = [
  {
    form: 'Tran_BankDetail',
    lists: {},
    defaults: () => ({}),
    toParams: (_s, btn) => ({
      mode: btn === 'Js1_Button1' ? 'CashSummary' : (btn === 'Js1_Button2' ? 'CashOnly' : 'BankBalance'),
    }),
    runButtons: ['Js1_Button1', 'Js1_Button2', 'Js1_Button3'],
    exitButtons: ['btn_cn'],
    fallbackColumns: {
      JSM_VW_TRAN_BANK_DETAIL: BANK_DETAIL_COLS,
    },
  },
  {
    form: 'Frm_TabReport',
    lists: {},
    defaults: () => ({}),
    toParams: () => ({}),
    runButtons: ['BtnLoad'],
    exitButtons: ['btn_exit'],
    fallbackColumns: {
      JSM_VW_FRM_TAB_REPORT: TAB_COLS,
    },
  },
];
