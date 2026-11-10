import { toIsoDate } from '../winforms.js';

/**
 * JSM: Others Reports › Others Reports › Finish At Shp Kgs / Grey At Shop Kgs / Grey At Mill Kgs.
 * Stock in kilos per item, on the terms JSM's own closing figure adds up.
 */
const COLUMNS = [
  { field: 'ITEM_NAME', caption: 'ITEM', kind: 'C', len: 30 },
  { field: 'OP_KGS', caption: 'OP.KGS', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'PU_KGS', caption: 'PUR.KGS', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'SL_KGS', caption: 'SAL.KGS', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'SLR_KGS', caption: 'SL.RTN', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'PUR_KGS', caption: 'PU.RTN', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'ISS_KGS', caption: 'ISSUE.KGS', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'REC_KGS', caption: 'REC.KGS', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'CL_KGS', caption: 'CL.KGS', kind: 'N', dec: 2, total: true, len: 13 },
];

const kgs = (form) => ({
  form,
  lists: { ListView0: 'items', lst_vw1: 'items' },
  defaults: ({ fyFrom, fyTo }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    items: s.ListView0 || s.lst_vw1 || [],
  }),
  fallbackColumns: { JSM_VW_KGS_STOCK: COLUMNS },
});

export const KGS_STOCK_REPORTS = [
  kgs('Rpt_StkKgsFinishAtShop'),
  kgs('Rpt_StkKgsGreyAtshop'),
  kgs('Rpt_StkKgsGreyAtMill'),
];
