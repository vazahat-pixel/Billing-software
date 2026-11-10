import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › Acc Stock Reports › Stock SubItem Wise / Stock SubItem(Detail) Wise /
 * Stock Register. What came in and went out per item and the sub-item on the line.
 *
 * Columns are the ones JSM's own runtime view selects; its layout is built at run time, so
 * there is no STP_REPORT row for either shape.
 */
const SUMMARY_COLUMNS = [
  { field: 'ITEM', caption: 'ITEM', kind: 'C', len: 28 },
  { field: 'SUBITEM', caption: 'SUBITEM', kind: 'C', len: 20 },
  { field: 'CATEGORY', caption: 'CATEGORY', kind: 'C', len: 16 },
  { field: 'PUQTY', caption: 'PUR.QTY', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'SLQTY', caption: 'SAL.QTY', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'SLRQTY', caption: 'SL.RTN', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'PURQTY', caption: 'PU.RTN', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'BALQTY', caption: 'BALANCE', kind: 'N', dec: 2, total: true, len: 13 },
];

const DETAIL_COLUMNS = [
  { field: 'BOOK', caption: 'BOOK', kind: 'C', len: 6 },
  { field: 'BILL_DATE', caption: 'DATE', kind: 'D', len: 10 },
  { field: 'NCBILL_NO', caption: 'BILL.NO', kind: 'C', len: 10 },
  { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 24 },
  { field: 'SUBITEM', caption: 'SUBITEM', kind: 'C', len: 18 },
  { field: 'PUQTY', caption: 'PUR.QTY', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'SLQTY', caption: 'SAL.QTY', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'SLRQTY', caption: 'SL.RTN', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'PURQTY', caption: 'PU.RTN', kind: 'N', dec: 2, total: true, len: 12 },
];

const FALLBACKS = {
  JSM_VW_ACC_STOCK: SUMMARY_COLUMNS,
  JSM_VW_ACC_STOCK_DETAIL: DETAIL_COLUMNS,
};

const accStock = (form) => ({
  form,
  lists: { ListView0: 'items', lst_vw1: 'items' },
  defaults: ({ fyFrom, fyTo }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    items: s.ListView0 || s.lst_vw1 || [],
    printout: s.cbo_printout,
  }),
  fallbackColumns: FALLBACKS,
});

export const ACC_STOCK_REPORTS = [
  accStock('Rpt_StockSubItemAccReport'),
  accStock('Rpt_StockSubItemAcc_DetailReport'),
  accStock('Rpt_StockSubItemAcc_DetailReport_Online'),
];
