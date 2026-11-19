import { toIsoDate } from '../winforms.js';

/**
 * JSM: Others Reports › Zoom Item Ledger (Zoom_SelectDate_List_Item).
 * One line per item — opening, in, out, closing and what the closing is worth — on the columns
 * JSM's own SELECT builds for its JSM_VW_STOCK_WITH_VALUE_REGISTER layout.
 */
export default {
  form: 'Zoom_SelectDate_List_Item',
  lists: { ListView0: 'items', lst_vw1: 'items' },
  // This screen's buttons are Btn_Ok ("Ledger") and Button1 ("All Item"), and its exit is Btn_Exit.
  runButtons: ['Btn_Ok', 'Button1'],
  exitButtons: ['Btn_Exit'],
  defaults: ({ fyFrom, fyTo }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo }),
  toParams: (s, button) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    // "All Item" ignores any ticked items.
    items: button === 'Button1' ? [] : s.ListView0 || s.lst_vw1 || [],
  }),
  fallbackColumns: {
    JSM_VW_STOCK_WITH_VALUE_REGISTER: [
      { field: 'ITEM', caption: 'ITEM', kind: 'C', len: 30 },
      { field: 'CATEGORY', caption: 'CATEGORY', kind: 'C', len: 16 },
      { field: 'OP_QTY', caption: 'OP.QTY', kind: 'N', dec: 2, total: true, len: 11 },
      { field: 'PU_QTY', caption: 'PU.QTY', kind: 'N', dec: 2, total: true, len: 11 },
      { field: 'SL_QTY', caption: 'SL.QTY', kind: 'N', dec: 2, total: true, len: 11 },
      { field: 'CL_QTY', caption: 'CL.QTY', kind: 'N', dec: 2, total: true, len: 12 },
      { field: 'CL_VALUE', caption: 'CL.VALUE', kind: 'N', dec: 2, total: true, len: 14 },
    ],
  },
};
