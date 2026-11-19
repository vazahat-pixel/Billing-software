import { toIsoDate } from '../winforms.js';

/**
 * JSM: Others Reports › Others Reports › Box Stock (Rpt_Box_Stock_ItemDesc).
 *
 * The ticked sub-items — JSM's "online key" — a date range, the unit radio (Qty / Pcs / Kgs), the
 * shape radio (Normal / Date Wise / Month Wise) and the With Value tick. It prints through Crystal
 * (Cry_Stk_Box_ItemDesc_Detail.rpt), so the columns are the ones its own view selects.
 */
const BASE = [
  { field: 'ITEM_NAME', caption: 'ITEM', kind: 'C', len: 26 },
  { field: 'CATEGORY', caption: 'CATEGORY', kind: 'C', len: 16 },
  { field: 'OP_STOCK', caption: 'OPENING', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'PURCHASE', caption: 'PURCHASE', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'SALES', caption: 'SALES', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'SL_RTN', caption: 'SL.RTN', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'PU_RTN', caption: 'PU.RTN', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'CL_STOCK', caption: 'CLOSING', kind: 'N', dec: 2, total: true, len: 12 },
];

const VALUE_COLUMNS = [
  ...BASE,
  { field: 'PURCHASE_VAL', caption: 'PU.VALUE', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'SALES_VAL', caption: 'SL.VALUE', kind: 'N', dec: 2, total: true, len: 13 },
];

export default {
  form: 'Rpt_Box_Stock_ItemDesc',
  lists: { lst_vw1: 'subItems' },
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    Rdbtn_B1: true,
    Rdbtn_C1: true,
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    unit: s.Rdbtn_B3 ? '3-Kgs' : (s.Rdbtn_B2 ? '2-Pcs' : '1-Qty'),
    shape: s.Rdbtn_C3 ? '3-Month' : (s.Rdbtn_C2 ? '2-Date' : '1-Normal'),
    withValue: Boolean(s.Chk_WithValue),
    subItems: s.lst_vw1 || [],
  }),
  fallbackColumns: {
    JSM_VW_BOX_STOCK: BASE,
    JSM_VW_BOX_STOCK_VALUE: VALUE_COLUMNS,
  },
};
