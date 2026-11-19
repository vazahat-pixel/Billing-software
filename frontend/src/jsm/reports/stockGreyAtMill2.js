import { toIsoDate } from '../winforms.js';

/**
 * JSM: Rpt1_Stk_Grey_At_Mill ("Gray In Mill - Stock Reports"), Grey At Mill Stock - Format 2.
 * Dates, W-Item / X-Category / Y-Date+Month wise, Item or Category list and "Upto Rec Date".
 * JSM prints this from a Crystal template; the grid carries the columns of TMP_VW_GR_ML_STK.
 */
const N = (field, caption, dec = 2, len = 11) => ({ field, caption, kind: 'N', dec, total: true, len });

export default {
  form: 'Rpt1_Stk_Grey_At_Mill',
  lists: { lst_vw1: 'items', lst_vw2: 'categories' },
  runButtons: ['btn_screen', 'btn_print', 'btn_word'],
  defaults: ({ fyFrom, fyTo }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo, txt_Recdt_to: fyTo, Rdbtn_A1: true }),
  overrides: (s) => ({ lst_vw1: { visible: !s.Rdbtn_A2 }, lst_vw2: { visible: Boolean(s.Rdbtn_A2) } }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    recTo: s.txt_Recdt_to ? toIsoDate(s.txt_Recdt_to) : '',
    mode: s.Rdbtn_A3 ? 'month' : s.Rdbtn_A2 ? 'category' : 'item',
    items: s.lst_vw1 || [],
    categories: s.lst_vw2 || [],
  }),
  fallbackColumns: {
    RPT_GREY_AT_MILL_REGISTER: [
      { field: 'ITEM_NAME', caption: 'ITEM', kind: 'C', len: 24 },
      N('OP_PCS', 'OP.PCS', 0, 8), N('OP_MTS', 'OP.MTS'),
      N('ML_SND_PCS', 'SEND.PCS', 0, 8), N('ML_SND_MTS', 'SEND.MTS'),
      N('ML_PCS', 'REC.PCS', 0, 8), N('ML_RCPT', 'REC.QTY'),
      N('SHRTG_MTS', 'SHORT'), N('NET_MTS', 'NET.MTS'), N('DMG_LOSS', 'DMG/LOSS'),
      N('CL_MTS', 'CLOSING'),
    ],
  },
};
