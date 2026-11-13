import { toIsoDate } from '../winforms.js';

const JOB_BROK_COLS = [
  { field: 'BILL_DATE', caption: 'BILL.DATE', kind: 'D', len: 10 },
  { field: 'NCBILL_NO', caption: 'BILL.NO', kind: 'C', len: 10 },
  { field: 'BOOK', caption: 'BOOK', kind: 'C', len: 18 },
  { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 24 },
  { field: 'BILL_AMT', caption: 'BILL.AMT', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'TDS_AMT', caption: 'TDS.AMT', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'PAID_AMT', caption: 'PAID.AMT', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'BRK_COMMI', caption: 'COMMI%', kind: 'N', dec: 2, len: 8 },
  { field: 'BROKERAGE', caption: 'BROKERAGE', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'TDS', caption: 'TDS', kind: 'N', dec: 2, total: true, len: 10 },
  { field: 'NET_COMMISION', caption: 'NET.COMM', kind: 'N', dec: 2, total: true, len: 12 },
];

const STMT_COLS = [
  { field: 'BILL_DATE', caption: 'BILL.DATE', kind: 'D', len: 10 },
  { field: 'NCBILL_NO', caption: 'BILL.NO', kind: 'C', len: 10 },
  { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 24 },
  { field: 'BILL_AMT', caption: 'BILL.AMT', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'TAXABLE_AMT', caption: 'TAXABLE', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'PAID_AMT', caption: 'PAID', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'BASE_AMT', caption: 'ON.AMT', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'BROKREG_AMT', caption: 'BROKREG', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'TDS_AMT', caption: 'TDS', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'NET_BROKREG', caption: 'NET.BROKREG', kind: 'N', dec: 2, total: true, len: 13 },
];

const FALLBACKS = {
  JSM_VW_JOB_BROK_STATE_RPT: JOB_BROK_COLS,
  JSM_VW_BROKREG_STATEMENT: STMT_COLS,
  JSM_VW_BROKREG_STATEMENT_SUMMARY: STMT_COLS,
};

export const BROKERAGE_JOB_AND_ALL = [
  {
    form: 'Rpt_Job_Brokerage',
    lists: { lst_vw1: 'books', lst_vw2: 'brokers' },
    defaults: ({ fyFrom, fyTo }) => ({
      txt_dt_from: fyFrom,
      txt_dt_to: fyTo,
      txt_2: 'B',
      txt_4: '2.00',
      txt_1: '0.00',
    }),
    toParams: (s) => ({
      from: toIsoDate(s.txt_dt_from),
      to: toIsoDate(s.txt_dt_to),
      fromText: s.txt_dt_from,
      toText: s.txt_dt_to,
      base: s.txt_2 === 'T' ? 'taxable' : (s.txt_2 === 'P' ? 'paid' : 'bill'),
      commissionPer: Number(s.txt_4 || 0) || 0,
      tdsPer: Number(s.txt_1 || 0) || 0,
      books: s.lst_vw1 || [],
      brokers: s.lst_vw2 || [],
    }),
    fallbackColumns: FALLBACKS,
  },
  {
    form: 'A_Jsm_Brokreg_Statement_Report',
    lists: { ListView5: 'brokers', ListView6: 'books', ListView7: 'parties' },
    defaults: ({ fyFrom, fyTo }) => ({
      txt_dt_from: fyFrom,
      txt_dt_to: fyTo,
      Cmb_rpt: 'Sales',
      Cmb_Date_Wise: 'Bill.Date Wise',
      cbo_status: 'Pending',
      txt_CommissionPer: '2.00',
      txt_TdsPer: '0.00',
      Rdbtn_OnBill: true,
      CheckBox_LastYear: true,
    }),
    toParams: (s) => ({
      from: toIsoDate(s.txt_dt_from),
      to: toIsoDate(s.txt_dt_to),
      fromText: s.txt_dt_from,
      toText: s.txt_dt_to,
      reportType: s.Cmb_rpt || 'Sales',
      dateWise: s.Cmb_Date_Wise || 'Bill.Date Wise',
      status: s.cbo_status === 'Clear' ? '2-Clear' : (s.cbo_status === 'All' ? '3-All' : '1-Pending'),
      base: s.Rdbtn_Taxable ? 'taxable' : (s.Rdbtn_OnPaid ? 'paid' : 'bill'),
      commissionPer: Number(s.txt_CommissionPer || 0) || 0,
      tdsPer: Number(s.txt_TdsPer || 0) || 0,
      gstLess: Boolean(s.CheckBox_GstLess),
      summary: Boolean(s.CheckBox_Summary),
      includeLastYear: s.CheckBox_LastYear !== false,
      printout: s.cbo_printout,
      brokers: s.ListView5 || [],
      books: s.ListView6 || [],
      parties: s.ListView7 || [],
    }),
    fallbackColumns: FALLBACKS,
  },
];

