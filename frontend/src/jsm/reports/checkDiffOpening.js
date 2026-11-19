import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › Final Reports › Chek Diff Os.Bill/Op.Balance (Mst1_Check_Diff).
 * Book radio (Sale / Purchase / Process / JobWork / Agency), the account list, X-Summary / Y-Detail.
 */
export default {
  form: 'Mst1_Check_Diff',
  lists: { lst_vw1: 'accounts' },
  runButtons: ['btn_screen', 'btn_print', 'btn_word'],
  defaults: ({ fyTo }) => ({ Rdbtn_B1: true, RdbtnX_Smry: true, txt_find1: '', _to: fyTo }),
  toParams: (s) => ({
    book: s.Rdbtn_B5 ? 'Agency' : s.Rdbtn_B4 ? 'JobWork' : s.Rdbtn_B3 ? 'Process' : s.Rdbtn_B2 ? 'Purchase' : 'Sale',
    detail: Boolean(s.RdbtnY_Dtl),
    accounts: s.lst_vw1 || [],
    to: s._to ? toIsoDate(s._to) : undefined,
  }),
  fallbackColumns: {
    RPT_CHK_DIFF_LASTYEAR: [
      { field: 'AC_NAME', caption: 'PARTY', kind: 'C', len: 30 },
      { field: 'OP_BAL', caption: 'OP.BAL', kind: 'N', dec: 2, total: true, len: 14 },
      { field: 'OS_AMOUNT', caption: 'O/S BILLS', kind: 'N', dec: 2, total: true, len: 14 },
      { field: 'DIFF', caption: 'DIFFERENCE', kind: 'N', dec: 2, total: true, len: 14 },
    ],
  },
};
