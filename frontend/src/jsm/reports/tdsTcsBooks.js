import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › Tds Reports › Head Wise Report / Tds Register (Rpt_TdsReports) and
 * Reports › Tcs Reports › Tcs Sales Register / Tcs Purchase Register (Rpt_TcsReports).
 *
 * One screen each: a date range, ticked Party / TdsHead / TdsPer lists, the Report Type combo and
 * Summary Reports. The TCS screen shows only its Party tab and the single Report Type JSM offers.
 */
const N = (field, caption, dec = 2, len = 12) => ({ field, caption, kind: 'N', dec, total: true, len });

// Columns as JSM's own format scripts (JS_Table_Reset_Column_DefaultFormat) set them for these views.
const TDS_COLUMNS = [
  { field: 'MONTH', caption: 'MONTH', kind: 'C', len: 10 },
  { field: 'TDSHEAD', caption: 'TDSHEAD', kind: 'C', len: 18 },
  { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 20 },
  { field: 'PANNO', caption: 'PANNO', kind: 'C', len: 10 },
  { field: 'AMOUNT', caption: 'AMOUNT', kind: 'N', dec: 2, len: 12 },
  { field: 'TDS_PER', caption: 'TDS_PER', kind: 'N', dec: 2, len: 6 },
  { field: 'TDS_AMT', caption: 'TDS_AMT', kind: 'N', dec: 2, len: 12 },
];

const TCS_SUMMARY_COLUMNS = [
  { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 20 },
  { field: 'PANNO', caption: 'PANNO', kind: 'C', len: 10 },
  N('TAXABLE_AMT', 'TAXABLEAMT'),
  N('NET_TOT', 'NETAMT'),
  { field: 'TCS_PER', caption: 'TCS_PER', kind: 'N', dec: 3, len: 6 },
  N('TCS_AMT', 'TCS_AMT'),
  { field: 'TCSHEAD', caption: 'TCSHEAD', kind: 'C', len: 18 },
];

const TCS_DETAIL_COLUMNS = [
  { field: 'MONTH', caption: 'MONTH', kind: 'C', len: 10 },
  { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 20 },
  { field: 'PANNO', caption: 'PANNO', kind: 'C', len: 10 },
  N('TAXABLE_AMT', 'TAXABLEAMT'),
  N('NET_TOT', 'NETAMT'),
  { field: 'TCS_PER', caption: 'TCS_PER', kind: 'N', dec: 3, len: 6 },
  N('TCS_AMT', 'TCS_AMT'),
  { field: 'NCBILL_NO', caption: 'BILL.NO', kind: 'C', len: 6 },
  { field: 'BILL_DATE', caption: 'BILL.DT', kind: 'D', len: 10 },
  { field: 'TCSHEAD', caption: 'TCSHEAD', kind: 'C', len: 18 },
];

const baseParams = (s) => ({
  from: toIsoDate(s.txt_dt_from),
  to: toIsoDate(s.txt_dt_to),
  fromText: s.txt_dt_from,
  toText: s.txt_dt_to,
  summary: Boolean(s.CheckBox_Summary),
  printout: s.cbo_printout || '1-Continue',
  parties: s.ListView0 || [],
});

const baseDefaults = ({ fyFrom, fyTo }) => ({
  txt_dt_from: fyFrom,
  txt_dt_to: fyTo,
  CheckBox_Summary: false,
  cbo_printout: '1-Continue',
  Cbo_Company: 'Current',
});

export const tdsReports = {
  form: 'Rpt_TdsReports',
  lists: { ListView0: 'parties', ListView1: 'heads', ListView2: 'pers' },
  defaults: (fy) => ({ ...baseDefaults(fy), CboGroup: 'Month+TdsHead+TdsPer' }),
  // JSM shows only the Party, TdsHead and TdsPer lists; the two spare tabs stay hidden.
  overrides: () => ({ TabPage3: { visible: false }, TabPage4: { visible: false } }),
  toParams: (s) => ({ ...baseParams(s), group: s.CboGroup, heads: s.ListView1 || [], pers: s.ListView2 || [] }),
  fallbackColumns: { JSM_VW_TDS_BOOK_DETAILREPORT: TDS_COLUMNS },
};

const tcs = (key, apiForm) => ({
  form: key,
  blueprintForm: 'Rpt_TcsReports',
  apiForm,
  lists: { ListView0: 'parties' },
  defaults: (fy) => ({ ...baseDefaults(fy), CboGroup: 'Month+TdsHead+Party' }),
  overrides: () => ({
    TabPage1: { visible: false }, TabPage2: { visible: false }, TabPage3: { visible: false }, TabPage4: { visible: false },
  }),
  toParams: (s) => baseParams(s),
  fallbackColumns: { TCS_SUMMARYREPORT: TCS_SUMMARY_COLUMNS, TCS_DETAILREPORT: TCS_DETAIL_COLUMNS },
});

export const TCS_SALES_FORM = 'Rpt_TcsReports#Sales';
export const TCS_PURCHASE_FORM = 'Rpt_TcsReports#Purchase';

export const TDS_TCS_REPORTS = [
  tdsReports,
  tcs(TCS_SALES_FORM, 'Rpt_TcsSalesRegister'),
  tcs(TCS_PURCHASE_FORM, 'Rpt_TcsPurchaseRegister'),
];
