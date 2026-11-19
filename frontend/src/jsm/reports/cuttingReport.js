import { toIsoDate } from '../winforms.js';

/**
 * JSM:
 *  - Reports › Process Reports › Cutting Reports (Rpt_Cutting_Report)
 *  - Reports › Process Reports › Cutting Stock Reports (Rpt_Stk_Cutting_At_Shop)
 */
const PENDING_COLUMNS = [
  { field: 'BILL_DATE', caption: 'REC.DATE', kind: 'D', len: 10 },
  { field: 'NCBILL_NO', caption: 'BILL NO', kind: 'C', len: 10 },
  { field: 'AC_NAME', caption: 'MILL NAME', kind: 'C', len: 22 },
  { field: 'LOTNO', caption: 'LOT NO', kind: 'C', len: 10 },
  { field: 'ITEM_NAME', caption: 'ITEM NAME', kind: 'C', len: 20 },
  { field: 'GP_PCS', caption: 'PCS', kind: 'N', dec: 0, total: true, len: 8 },
  { field: 'REC_QTY', caption: 'REC.QTY', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'USED_QTY', caption: 'USED.QTY', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'BAL_QTY', caption: 'BAL.QTY', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'CUT_PEND', caption: 'CP', kind: 'C', len: 5 },
];

const CLEAR_COLUMNS = [
  { field: 'ENT_DATE', caption: 'CUT DATE', kind: 'D', len: 10 },
  { field: 'SRAL_NO', caption: 'ENTRY NO', kind: 'C', len: 13 },
  { field: 'LOT_NO', caption: 'LOT NO', kind: 'C', len: 10 },
  { field: 'ITEM_NAME', caption: 'ITEM NAME', kind: 'C', len: 22 },
  { field: 'ORIG_QTY', caption: 'ORIG.QTY', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'CUT_PCS', caption: 'CUT PCS', kind: 'N', dec: 0, total: true, len: 9 },
  { field: 'CUT_QTY', caption: 'CUT QTY', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'WASTAGE_QTY', caption: 'WASTAGE', kind: 'N', dec: 2, total: true, len: 10 },
  { field: 'USED_QTY', caption: 'USED QTY', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'REMARK', caption: 'REMARK', kind: 'C', len: 18 },
];

const STK_COLUMNS = [
  { field: 'BILL_DATE', caption: 'BILL.DATE', kind: 'D', len: 10 },
  { field: 'AC_NAME', caption: 'MILL NAME', kind: 'C', len: 22 },
  { field: 'LOTNO', caption: 'LOT NO', kind: 'C', len: 10 },
  { field: 'ITEM_NAME', caption: 'ITEM NAME', kind: 'C', len: 20 },
  { field: 'NCBILL_NO', caption: 'BILL NO', kind: 'C', len: 10 },
  { field: 'GP_PCS', caption: 'REC.PCS', kind: 'N', dec: 0, total: true, len: 9 },
  { field: 'REC_QTY', caption: 'REC.QTY', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'TO_PCS', caption: 'CUT.PCS', kind: 'N', dec: 0, total: true, len: 9 },
  { field: 'TO_QTY', caption: 'CUT.QTY', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'BAL_QTY', caption: 'BAL.QTY', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'CUT_PEND', caption: 'STATUS', kind: 'C', len: 6 },
];

export const CUTTING_REPORTS = [
  {
    form: 'Rpt_Cutting_Report',
    lists: { lst_vw1: 'mills' },
    defaults: ({ fyFrom, fyTo }) => ({
      txt_dt_from: fyFrom,
      txt_dt_to: fyTo,
      Rdbtn_A1: true,
      Rdbtn_B1: true,
      Rdbtn_C1: true,
    }),
    toParams: (s) => ({
      from: toIsoDate(s.txt_dt_from),
      to: toIsoDate(s.txt_dt_to),
      fromText: s.txt_dt_from,
      toText: s.txt_dt_to,
      groupBy: s.Rdbtn_A2 ? '2-Mill' : '1-Normal',
      status: s.Rdbtn_C3 ? '3-All' : (s.Rdbtn_C2 ? '2-Clear' : '1-Pending'),
      mills: s.lst_vw1 || [],
    }),
    fallbackColumns: {
      JSM_VW_CUTTING_PENDING: PENDING_COLUMNS,
      JSM_VW_CUTTING_CLEAR: CLEAR_COLUMNS,
    },
  },
  {
    form: 'Rpt_Stk_Cutting_At_Shop',
    lists: { lst_vw1: 'mills' },
    defaults: ({ fyFrom, fyTo }) => ({
      txt_dt_from: fyFrom,
      txt_dt_to: fyTo,
      txt_from: '',
      txt_to: '',
      Rdbtn_A1: true,
      Rdbtn_B1: true,
      Rdbtn_C1: true,
    }),
    toParams: (s) => ({
      from: toIsoDate(s.txt_dt_from),
      to: toIsoDate(s.txt_dt_to),
      fromText: s.txt_dt_from,
      toText: s.txt_dt_to,
      lotFrom: s.txt_from,
      lotTo: s.txt_to,
      groupBy: s.Rdbtn_A2 ? '2-Mill' : '1-Normal',
      orderBy: s.Rdbtn_B2 ? 'Lot' : 'Date',
      status: s.Rdbtn_C3 ? '3-All' : (s.Rdbtn_C2 ? '2-Clear' : '1-Pending'),
      mills: s.lst_vw1 || [],
    }),
    fallbackColumns: { JSM_VW_CUTTING_STK: STK_COLUMNS },
  },
];

