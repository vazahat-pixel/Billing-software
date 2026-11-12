import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › Fas Reports › Bank / Cash Book › Cash/Bank Register (A_All_CashBank_Report).
 *
 * Six ticked lists across its tabs — Bank, Party, Broker, Headwise, Head2, Station — a date
 * range, the two Order By boxes, the Rec/Pay combo, the Asc/Desc combo, the Summary tick and
 * "Only Cheque Return". Neither of its two layouts is captured — JSM builds them at run time —
 * so the columns are the ones its own SELECT names, with the adjustment columns captioned by
 * what they hold rather than by JSM's AMT_1..7 numbering.
 */
const ADJUSTMENTS = [
  { field: 'DISCOUNT', caption: 'DISCOUNT', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'TDS', caption: 'TDS', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'RG_AMT', caption: 'RG', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'CLAIM', caption: 'CLAIM', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'RD', caption: 'RD', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'INTEREST', caption: 'INTEREST', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'OTH1', caption: 'OTH1', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'OTH2', caption: 'OTH2', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'AMT_BC', caption: 'BANK.CHG', kind: 'N', dec: 2, total: true, len: 12 },
];

const DETAIL_COLUMNS = [
  { field: 'REC_DATE', caption: 'REC.Date', kind: 'D', len: 10 },
  { field: 'SRAL_NO', caption: 'SRAL.NO', kind: 'C', len: 10 },
  { field: 'BOOK', caption: 'BOOK', kind: 'C', len: 14 },
  { field: 'BANK', caption: 'BANK', kind: 'C', len: 16 },
  { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 24 },
  { field: 'HEADWISE', caption: 'HEADWISE', kind: 'C', len: 14 },
  { field: 'HEAD2', caption: 'HEAD2', kind: 'C', len: 12 },
  { field: 'CHQ_NO', caption: 'CHQ.NO', kind: 'C', len: 10 },
  { field: 'REC_AMT', caption: 'REC.AMT', kind: 'N', dec: 2, total: true, len: 13 },
  ...ADJUSTMENTS,
  { field: 'REMARK_1', caption: 'REM1', kind: 'C', len: 18 },
  { field: 'REMARK_2', caption: 'REM2', kind: 'C', len: 14 },
];

const SUMMARY_COLUMNS = [
  { field: 'ZGROUP1', caption: 'GROUP1', kind: 'C', len: 24 },
  { field: 'ZGROUP2', caption: 'GROUP2', kind: 'C', len: 20 },
  { field: 'REC_AMT', caption: 'REC.AMT', kind: 'N', dec: 2, total: true, len: 14 },
  ...ADJUSTMENTS,
];

export default {
  form: 'A_All_CashBank_Report',
  lists: {
    ListView0: 'books',
    ListView1: 'parties',
    ListView2: 'brokers',
    ListView3: 'heads',
    ListView4: 'head2',
    ListView5: 'stations',
  },
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    Cbo_OrderBy1: 'None',
    Cbo_OrderBy2: 'None',
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    orderBy1: s.Cbo_OrderBy1,
    orderBy2: s.Cbo_OrderBy2,
    type: s.cbo_type,
    order: s.cbo_OrderASC_DESC,
    summary: Boolean(s.CheckBox_Summary),
    onlyChequeReturn: Boolean(s.Chk_Cheque_Rtn),
    printout: s.cbo_printout,
    books: s.ListView0 || [],
    parties: s.ListView1 || [],
    brokers: s.ListView2 || [],
    heads: s.ListView3 || [],
    head2: s.ListView4 || [],
    stations: s.ListView5 || [],
  }),
  fallbackColumns: {
    RPT_CASHBANK_DETAIL: DETAIL_COLUMNS,
    RPT_CASHBANK_SUMMARY: SUMMARY_COLUMNS,
  },
};
