import { toIsoDate } from '../winforms.js';

/**
 * JSM: Others Reports › Outstanding Zoom › Debitors / Creditors / Process / JobWork.
 *
 * One JSM screen (Rpt_Outstating_Report, titled "Outstanding") serves all four menu entries, so
 * each is its own config pointing at that screen and at its own side's backend report — the same
 * arrangement the bill registers' Summary and Detail entries use.
 *
 * Columns are the outstanding ones; JSM's layout for this older window is built at run time, so
 * there is no STP_REPORT row for it.
 */
const COLUMNS = [
  { field: 'BILL_DATE', caption: 'BILL.DATE', kind: 'D', len: 10 },
  { field: 'NCBILL_NO', caption: 'BILL.NO', kind: 'C', len: 10 },
  { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 26 },
  { field: 'NET_TOT', caption: 'BILL.AMT', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'ADJUST', caption: 'ADJUST', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'GOODS_RTN', caption: 'RTN.AMT', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'TOT_BALANCE', caption: 'BALANCE', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'OS_DAYS', caption: 'DAYS', kind: 'N', dec: 0, len: 7 },
];

const SUMMARY_COLUMNS = [
  { field: 'ZGROUP1', caption: 'GROUP', kind: 'C', len: 26 },
  { field: 'ZGROUP2', caption: 'GROUP2', kind: 'C', len: 22 },
  { field: 'NET_TOT', caption: 'BILL.AMT', kind: 'N', dec: 2, total: true, len: 14 },
  { field: 'ADJUST', caption: 'ADJUST', kind: 'N', dec: 2, total: true, len: 14 },
  { field: 'TOT_BALANCE', caption: 'BALANCE', kind: 'N', dec: 2, total: true, len: 14 },
];

const FALLBACKS = { JSM_VW_OS_ZOOM: COLUMNS, JSM_VW_OS_ZOOM_SUMMARY: SUMMARY_COLUMNS };

const zoom = (side) => ({
  form: `Rpt_Outstating_Report_${side}`,
  blueprintForm: 'Rpt_Outstating_Report',
  apiForm: `Rpt_Outstating_Report_${side}`,
  lists: { ListView1: 'parties', ListView2: 'brokers', ListView3: 'stations', ListView4: 'books' },
  defaults: ({ fyFrom, fyTo }) => ({
    txt_bill_dt_from: fyFrom,
    txt_bill_dt_to: fyTo,
    Cbo_GroupBy1: 'Party',
    Cbo_GroupBy2: 'None',
    Cbo_GroupBy3: 'None',
    cbo_status: '1-Pending',
    CheckBox_NewYear: true,
    CheckBox_LastYear: true,
    CheckBox_Total: true,
    CheckBox_Address: true,
    CheckBox_Unadjust: true,
    CheckBox_Ledger: true,
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_bill_dt_from),
    to: toIsoDate(s.txt_bill_dt_to),
    fromText: s.txt_bill_dt_from,
    toText: s.txt_bill_dt_to,
    groupBy1: s.Cbo_GroupBy1,
    groupBy2: s.Cbo_GroupBy2,
    groupBy3: s.Cbo_GroupBy3,
    summary: Boolean(s.CheckBox_Summary),
    status: s.cbo_status,
    includeLastYear: s.CheckBox_LastYear !== false,
    onlyFullBill: Boolean(s.CheckBox_ESC_OnlyPart),
    onlyPartReceived: Boolean(s.CheckBox_OnlyPart),
    printout: s.cbo_printout,
    parties: s.ListView1 || [],
    brokers: s.ListView2 || [],
    stations: s.ListView3 || [],
    books: s.ListView4 || [],
  }),
  fallbackColumns: FALLBACKS,
});

export const OUTSTANDING_ZOOMS = [zoom('Sales'), zoom('Purchase'), zoom('Process'), zoom('Jobwork')];
