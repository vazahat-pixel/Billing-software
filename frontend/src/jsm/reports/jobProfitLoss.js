/**
 * JSM: Reports › JobWork Reports › Job P & L (Tran_WorkChallan_PL_Repo).
 *
 * One grid and a Refresh button — no date boxes, no lists — and a radio that asks for the pieces
 * alone. Its columns are the ones JSM's own export names (Button1_Click).
 */
const COLUMNS = [
  { field: 'ITEM_NAME', caption: 'Item Name', kind: 'C', len: 28 },
  { field: 'READY_PCS', caption: 'ReadyPcs', kind: 'N', dec: 0, total: true, len: 10 },
  { field: 'SALES_PCS', caption: 'SalesPcs', kind: 'N', dec: 0, total: true, len: 10 },
  { field: 'CLOSE_PCS', caption: 'Clos.Pcs', kind: 'N', dec: 0, total: true, len: 10 },
  { field: 'READY_AMT', caption: 'ReadyAmt', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'READY_RATE', caption: 'ReadyRt', kind: 'N', dec: 2, len: 10 },
  { field: 'SALES_AMT', caption: 'SalesAmt', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'SALES_RATE', caption: 'SalesRt', kind: 'N', dec: 2, len: 10 },
  { field: 'CLOSE_AMT', caption: 'CloseAmt', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'PL_RS', caption: 'Pl_Rs', kind: 'N', dec: 2, total: true, len: 13 },
];

const PCS_COLUMNS = [
  { field: 'ITEM_NAME', caption: 'Item Name', kind: 'C', len: 28 },
  { field: 'READY_PCS', caption: 'ReadyPcs', kind: 'N', dec: 0, total: true, len: 10 },
  { field: 'SALES_PCS', caption: 'SalesPcs', kind: 'N', dec: 0, total: true, len: 10 },
  { field: 'CLOSE_PCS', caption: 'Clos.Pcs', kind: 'N', dec: 0, total: true, len: 10 },
];

export default {
  form: 'Tran_WorkChallan_PL_Repo',
  runButtons: ['Btn_Refresh', 'Button1'],
  exitButtons: ['Btn_Exit'],
  lists: {},
  defaults: () => ({ RdBtn1: true }),
  toParams: (s) => ({ pcsOnly: Boolean(s.RdBtn2) }),
  fallbackColumns: {
    JSM_VW_JOB_PROFIT_REG: COLUMNS,
    JSM_VW_JOB_PROFIT_REG_PCS: PCS_COLUMNS,
  },
};
