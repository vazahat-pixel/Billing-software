import { toIsoDate } from '../winforms.js';

/**
 * JSM: Others Reports › Daily Transaction (Rpt_Daily_TransactionNew).
 *
 * Three ticked lists — Party, Book and Type (its Load reads DISTINCT(AC_NAME), DISTINCT(BOOK) and
 * DISTINCT(TYPE) into the three tab pages) — a date range, two Order By boxes, the Debit/Credit
 * radio and an amount condition.
 *
 * VW_DAILY_TRANS_DATEWISE is built at run time, so this installation's STP_REPORT holds no row
 * for it and the columns are the ones JSM's own Js_Add_NewColumn_Function names.
 */
const COLUMNS = [
  { field: 'BILL_DATE', caption: 'BILL.DATE', kind: 'D', len: 10 },
  { field: 'SRAL_NO', caption: 'VOU.NO', kind: 'C', len: 10 },
  { field: 'BOOK', caption: 'BOOK', kind: 'C', len: 14 },
  { field: 'TYPE', caption: 'TYPE', kind: 'C', len: 10 },
  { field: 'AC_NAME', caption: 'PARTY', kind: 'C', len: 26 },
  { field: 'PARTY_BANK', caption: 'P.BANK', kind: 'C', len: 14 },
  { field: 'DR_AMOUNT', caption: 'DR.AMT', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'CR_AMOUNT', caption: 'CR.AMT', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'REMARK_1', caption: 'REM1', kind: 'C', len: 20 },
  { field: 'REMARK_2', caption: 'REM2', kind: 'C', len: 20 },
];

const SUMMARY_COLUMNS = [
  { field: 'ZGROUP1', caption: 'GROUP1', kind: 'C', len: 26 },
  { field: 'ZGROUP2', caption: 'GROUP2', kind: 'C', len: 22 },
  { field: 'DR_AMOUNT', caption: 'DR.AMT', kind: 'N', dec: 2, total: true, len: 14 },
  { field: 'CR_AMOUNT', caption: 'CR.AMT', kind: 'N', dec: 2, total: true, len: 14 },
  { field: 'ISS_QTY', caption: 'ISS.QTY', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'REC_QTY', caption: 'REC.QTY', kind: 'N', dec: 2, total: true, len: 12 },
];

export default {
  form: 'Rpt_Daily_TransactionNew',
  lists: { ListView0: 'parties', ListView1: 'books', ListView2: 'types' },
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    Cbo_OrderBy1: 'DateWise',
    Cbo_OrderBy2: 'None',
    Cbo_EntryType: 'Both',
    CheckBox_Total: true,
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    orderBy1: s.Cbo_OrderBy1,
    orderBy2: s.Cbo_OrderBy2,
    side: s.Cbo_EntryType,
    summary: Boolean(s.CheckBox_Summary),
    amount: Number(String(s.txt_amount_op ?? '0').replace(/[^0-9.-]/g, '')) || 0,
    amountOp: s.cbo_operater,
    printout: s.cbo_printout,
    parties: s.ListView0 || [],
    books: s.ListView1 || [],
    types: s.ListView2 || [],
  }),
  fallbackColumns: {
    JSM_VW_DAILY_TRANS: COLUMNS,
    JSM_VW_DAILY_TRANS_SUMMARY: SUMMARY_COLUMNS,
  },
};
