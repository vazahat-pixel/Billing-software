import { toIsoDate } from '../winforms.js';

/**
 * JSM: Others Reports › Outstanding › Month O/s. › Sales / Purchase.
 *
 * One JSM screen (A_Textiles_Outstanding_MonthWise, "Month Wise Outstanding") serves both menu
 * entries, so each is its own config pointing at that screen and at its own side's report.
 *
 * JSM reads JSM_VW_OS_SALES_SUMMARY / JSM_VW_OS_PURCHASE_SUMMARY, for which this installation's
 * STP_REPORT holds no row — those summary views are built at run time — so the columns are the
 * outstanding ones the screen prints: the bill, the party, what is owed and for how long.
 */
const COLUMNS = [
  { field: 'BILL_DATE', caption: 'BILL.DATE', kind: 'D', len: 10 },
  { field: 'NCBILL_NO', caption: 'BILL.NO', kind: 'C', len: 10 },
  { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 26 },
  { field: 'STATION', caption: 'CITY', kind: 'C', len: 14 },
  { field: 'NET_TOT', caption: 'BILL.AMT', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'ADJUST', caption: 'ADJUST', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'TOT_BALANCE', caption: 'BALANCE', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'OS_DAYS', caption: 'DAYS', kind: 'N', dec: 0, len: 7 },
];

const month = (side) => ({
  form: `A_Textiles_Outstanding_MonthWise_${side}`,
  blueprintForm: 'A_Textiles_Outstanding_MonthWise',
  apiForm: `A_Textiles_Outstanding_MonthWise_${side}`,
  lists: { ListView_Party: 'parties' },
  defaults: ({ fyFrom, fyTo }) => ({ txt_dt_from: fyFrom, txt_dt_to: fyTo }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    printout: s.cbo_printout,
    parties: s.ListView_Party || [],
  }),
  fallbackColumns: {
    JSM_VW_OS_SALES_SUMMARY: COLUMNS,
    JSM_VW_OS_PURCHASE_SUMMARY: COLUMNS,
  },
});

export const MONTH_OUTSTANDINGS = [month('Sales'), month('Purchase')];
