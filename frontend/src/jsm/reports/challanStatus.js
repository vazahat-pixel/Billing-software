import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › JobWork Reports › Challan Status (Rpt_Additional_Job_Bill).
 *
 * A-Pending / B-Clear / C-All picks the challans whose work bill is still to come, is already
 * raised, or both; 1-Normal / 2-Party is JSM's own grouping. This one prints through Crystal
 * (Cry_Job_Bill.rpt), so there is no STP_REPORT layout and the columns are the challan's own.
 */
const COLUMNS = [
  { field: 'CHLN_DATE', caption: 'CHLN.DATE', kind: 'D', len: 10 },
  { field: 'NCCHLN_NO', caption: 'CHLN.NO', kind: 'C', len: 10 },
  { field: 'BILL_DATE', caption: 'REC.DATE', kind: 'D', len: 10 },
  { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 26 },
  { field: 'ITEM', caption: 'ITEM', kind: 'C', len: 22 },
  { field: 'REC_PCS', caption: 'REC.PCS', kind: 'N', dec: 0, total: true, len: 9 },
  { field: 'REC_QTY', caption: 'REC.QTY', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'IT_RATE', caption: 'RATE', kind: 'N', dec: 2, len: 10 },
  { field: 'IT_AMOUNT', caption: 'AMOUNT', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'JOB_BILL_NO', caption: 'BILL.NO', kind: 'C', len: 10 },
  { field: 'JOB_BILL_DATE', caption: 'BILL.DATE', kind: 'D', len: 10 },
  { field: 'STATUS', caption: 'STATUS', kind: 'C', len: 9 },
];

export default {
  form: 'Rpt_Additional_Job_Bill',
  lists: { lst_vw1: 'parties', lst_vw2: 'registers' },
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    Rdbtn_A1: true,
    Rdbtn_B1: true,
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    status: s.Rdbtn_A3 ? '3-All' : (s.Rdbtn_A2 ? '2-Clear' : '1-Pending'),
    category: s.Rdbtn_B2 ? '2-Party' : '1-Normal',
    parties: s.lst_vw1 || [],
    registers: s.lst_vw2 || [],
  }),
  fallbackColumns: { JSM_VW_JOB_CHALLAN_STATUS: COLUMNS },
};
