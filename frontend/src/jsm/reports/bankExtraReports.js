import { toIsoDate } from '../winforms.js';

const RECON_COLS = [
  { field: 'ENT_DATE', caption: 'Chq Date', kind: 'D', len: 10 },
  { field: 'CHQ_DD_NO', caption: 'Chq No', kind: 'C', len: 12 },
  { field: 'BOOK', caption: 'Party', kind: 'C', len: 26 },
  { field: 'DEPOSITS', caption: 'Deposits', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'WITHDRAWAL', caption: 'Withdrawal', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'CLEAR_DATE', caption: 'ClearDate', kind: 'D', len: 10 },
  { field: 'BAL_AMT', caption: 'Balance', kind: 'N', dec: 2, len: 14 },
  { field: 'REMARK_1', caption: 'Narration', kind: 'C', len: 22 },
];

const OD_COLS = [
  { field: 'BOOK', caption: 'BANK', kind: 'C', len: 20 },
  { field: 'ENT_DATE', caption: 'DATE', kind: 'D', len: 10 },
  { field: 'PARTICULARS', caption: 'PARTICULARS', kind: 'C', len: 26 },
  { field: 'CHQ_NO', caption: 'CHQ.NO', kind: 'C', len: 11 },
  { field: 'DR_AMOUNT', caption: 'DEPOSIT', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'CR_AMOUNT', caption: 'WITHDRAWAL', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'CL_BAL', caption: 'BALANCE', kind: 'N', dec: 2, len: 13 },
  { field: 'DRCR', caption: 'DR/CR', kind: 'C', len: 6 },
  { field: 'DAYS', caption: 'DAYS', kind: 'N', dec: 0, total: true, len: 7 },
  { field: 'INT_AMT', caption: 'OD INT', kind: 'N', dec: 2, total: true, len: 12 },
];

const VOUCHER_COLS = [
  { field: 'REC_DATE', caption: 'REC.DATE', kind: 'D', len: 10 },
  { field: 'SRAL_NO', caption: 'V.NO', kind: 'C', len: 10 },
  { field: 'BANK', caption: 'BANK', kind: 'C', len: 18 },
  { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 24 },
  { field: 'NCBILL_NO', caption: 'BILL.NO', kind: 'C', len: 10 },
  { field: 'BILL_DATE', caption: 'BILL.DATE', kind: 'D', len: 10 },
  { field: 'BILL_AMT', caption: 'BILL.AMT', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'ADJUST', caption: 'REC.AMT', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'DISCOUNT', caption: 'DISC', kind: 'N', dec: 2, total: true, len: 10 },
  { field: 'TDS', caption: 'TDS', kind: 'N', dec: 2, total: true, len: 10 },
  { field: 'NET_OS', caption: 'NET O/S', kind: 'N', dec: 2, total: true, len: 12 },
];

export const BANK_EXTRA_REPORTS = [
  {
    form: 'Rpt_CB1_Reconsilation',
    lists: { txt_name1: 'banks' },
    defaults: ({ fyFrom, fyTo }) => ({
      txt_dt_from: fyFrom,
      txt_dt_to: fyTo,
      Rdbtn_Both: true,
      Rdbtn_ByDate: true,
      Cbo_Tick: 'All',
    }),
    toParams: (s) => ({
      from: toIsoDate(s.txt_dt_from),
      to: toIsoDate(s.txt_dt_to),
      fromText: s.txt_dt_from,
      toText: s.txt_dt_to,
      bankName: Array.isArray(s.txt_name1) ? (s.txt_name1[0] || '') : (s.txt_name1 || ''),
      txType: s.Rdbtn_Receipt ? 'Receipt' : (s.Rdbtn_Payment ? 'Payment' : 'Both'),
      sortBy: s.Rdbtn_ByClearDate ? 'By ClearDate' : (s.Rdbtn_ByChqNo ? 'By ChqNo' : 'By Date'),
      status: s.Cbo_Tick || 'All',
    }),
    fallbackColumns: { RUNTIME_BANK_RECON: RECON_COLS },
  },
  {
    form: 'A_CashBankLedgerSingleSide',
    lists: { ListView_Party: 'parties' },
    defaults: ({ fyFrom, fyTo }) => ({
      txt_dt_from: fyFrom,
      txt_dt_to: fyTo,
      Rdbtn_ODCC_Intrest: true,
      txt_Interest: '9.00',
      txt_yearDays: '360',
    }),
    toParams: (s) => ({
      from: toIsoDate(s.txt_dt_from),
      to: toIsoDate(s.txt_dt_to),
      fromText: s.txt_dt_from,
      toText: s.txt_dt_to,
      mode: s.Rdbtn_ODCC_Intrest ? 'Interest' : 'Normal',
      interestRate: Number(s.txt_Interest || 0) || 0,
      yearDays: Number(s.txt_yearDays || 360) || 360,
      printout: s.cbo_printout,
      parties: s.ListView_Party || [],
    }),
    fallbackColumns: { RUNTIME_BANK_OD_INTEREST: OD_COLS },
  },
  {
    form: 'A_Bank_Receipt_Bill_Os_Details',
    lists: { ListView0: 'books', ListView1: 'parties' },
    defaults: ({ fyFrom, fyTo }) => ({
      txt_dt_from: fyFrom,
      txt_dt_to: fyTo,
      Cbo_OrderBy1: 'Bank',
      Cbo_OrderBy2: 'None',
    }),
    toParams: (s) => ({
      from: toIsoDate(s.txt_dt_from),
      to: toIsoDate(s.txt_dt_to),
      fromText: s.txt_dt_from,
      toText: s.txt_dt_to,
      orderBy1: s.Cbo_OrderBy1 || 'Bank',
      orderBy2: s.Cbo_OrderBy2 || 'None',
      printout: s.cbo_printout,
      books: s.ListView0 || [],
      parties: s.ListView1 || [],
    }),
    fallbackColumns: { RUNTIME_BANK_VOUCHER_PRINT: VOUCHER_COLS },
  },
];

