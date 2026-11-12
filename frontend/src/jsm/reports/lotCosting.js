import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › Process Reports › Lot Wise Costing (Rpt_Lot_Costing).
 */
const BASE_COLUMNS = [
  { field: 'LOT_NO', caption: 'LOT NO', kind: 'C', len: 10 },
  { field: 'NCCHLN_NO', caption: 'CHLN NO', kind: 'C', len: 9 },
  { field: 'CHLN_DATE', caption: 'CHLN DT', kind: 'D', len: 10 },
  { field: 'MILL_NAME', caption: 'MILL NAME', kind: 'C', len: 22 },
  { field: 'PU_NAME', caption: 'WEAVER', kind: 'C', len: 18 },
  { field: 'ITEM_NAME', caption: 'GREY ITEM', kind: 'C', len: 18 },
  { field: 'FINISH_ITEM', caption: 'FINISH ITEM', kind: 'C', len: 18 },
  { field: 'NCBILL_NO', caption: 'REC BILL', kind: 'C', len: 9 },
  { field: 'REC_DATE', caption: 'REC DATE', kind: 'D', len: 10 },
  { field: 'GREY_MTS', caption: 'GREY MTS', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'PU_RATE', caption: 'PU RATE', kind: 'N', dec: 2, len: 9 },
  { field: 'PUR_AMT', caption: 'PUR AMT', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'FINISH_MTS', caption: 'FINISH MTS', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'IT_RATE', caption: 'JOB RATE', kind: 'N', dec: 2, len: 9 },
  { field: 'PROCESS_AMT', caption: 'PROC AMT', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'TOTAL_AMT', caption: 'TOTAL AMT', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'EFF_RATE', caption: 'COST/MT', kind: 'N', dec: 2, len: 9 },
];

const KGS_COLUMNS = [
  { field: 'LOT_NO', caption: 'LOT NO', kind: 'C', len: 10 },
  { field: 'NCCHLN_NO', caption: 'CHLN NO', kind: 'C', len: 9 },
  { field: 'MILL_NAME', caption: 'MILL NAME', kind: 'C', len: 22 },
  { field: 'ITEM_NAME', caption: 'GREY ITEM', kind: 'C', len: 18 },
  { field: 'FINISH_ITEM', caption: 'FINISH ITEM', kind: 'C', len: 18 },
  { field: 'NCBILL_NO', caption: 'REC BILL', kind: 'C', len: 9 },
  { field: 'REC_DATE', caption: 'REC DATE', kind: 'D', len: 10 },
  { field: 'GREY_KGS', caption: 'GREY KGS', kind: 'N', dec: 3, total: true, len: 11 },
  { field: 'PU_RATE', caption: 'PU RATE', kind: 'N', dec: 2, len: 9 },
  { field: 'PUR_KGS_AMT', caption: 'PUR AMT', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'FINISH_KGS', caption: 'FIN KGS', kind: 'N', dec: 3, total: true, len: 11 },
  { field: 'IT_RATE', caption: 'JOB RATE', kind: 'N', dec: 2, len: 9 },
  { field: 'PROCESS_AMT', caption: 'PROC AMT', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'TOTAL_AMT', caption: 'TOTAL AMT', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'EFF_RATE', caption: 'COST/KG', kind: 'N', dec: 2, len: 9 },
];

export default {
  form: 'Rpt_Lot_Costing',
  lists: { lst_vw1: 'mills' },
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    txt_from: '',
    txt_to: '',
    txt_avg_exp_rate: '0.00',
    Rdbtn_A1: true,
    Rdbtn_B1: true,
    Chk_Kgs: false,
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    lotFrom: s.txt_from,
    lotTo: s.txt_to,
    avgExpRate: s.txt_avg_exp_rate,
    orderBy: s.Rdbtn_A2 ? 'Lot' : 'Date',
    groupBy: s.Rdbtn_B3 ? '3-Item' : (s.Rdbtn_B2 ? '2-Mill' : '1-Normal'),
    kgs: Boolean(s.Chk_Kgs),
    mills: s.lst_vw1 || [],
  }),
  fallbackColumns: {
    JSM_VW_LOT_COSTING: BASE_COLUMNS,
    JSM_VW_LOT_COSTING_KGS: KGS_COLUMNS,
  },
};

