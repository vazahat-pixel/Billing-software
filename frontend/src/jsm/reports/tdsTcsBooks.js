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

const tdsPartyMonth = (key, mode) => ({
  form: key,
  blueprintForm: 'Rpt_Tds2_Prty_Mnth_Wise',
  apiForm: 'Rpt_Tds2_Prty_Mnth_Wise',
  title: mode === 'M' ? 'Month Wise Report' : 'Party Wise Report',
  lists: {},
  dynamicLists: (s, o) => ({ lst_vw1: s.Rdbtn_A2 ? (o.heads || []) : (o.parties || []) }),
  runButtons: ['btn_screen', 'btn_print', 'btn_word'],
  defaults: ({ fyFrom, fyTo, today }) => ({
    txt_dt_from: fyFrom, txt_dt_to: fyTo, txt_prn_dt: today, Grp_With: true, Grp_Dtl: true, Rdbtn_A1: true,
  }),
  toParams: (s) => ({
    mode,
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    byHead: Boolean(s.Rdbtn_A2),
    accounts: s.lst_vw1 || [],
    withChq: Boolean(s.Grp_With),
    summary: Boolean(s.Grp_Smry),
  }),
  fallbackColumns: {
    RPT_TDS_PARTY_MONTH: [
      { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 24 },
      { field: 'PANNO', caption: 'PAN NO', kind: 'C', len: 11 },
      { field: 'MONTH', caption: 'MONTH', kind: 'C', len: 10 },
      { field: 'ENT_DATE', caption: 'DATE', kind: 'D', len: 10 },
      { field: 'NCBILL_NO', caption: 'BILL.NO', kind: 'C', len: 8 },
      N('AMOUNT', 'AMOUNT'),
      { field: 'TDS_PER', caption: 'TDS%', kind: 'N', dec: 2, len: 6 },
      N('TDS_AMT', 'TDS.AMT'),
      { field: 'CHQ_DDNO', caption: 'CHQ.NO', kind: 'C', len: 10 },
      { field: 'PAY_DATE', caption: 'PAY.DT', kind: 'D', len: 10 },
      { field: 'BSR_CODE', caption: 'BSR', kind: 'C', len: 8 },
      { field: 'TRNS_VOU', caption: 'CHALLAN', kind: 'C', len: 8 },
    ],
  },
});

export const TDS_PARTY_FORM = 'Rpt_Tds2_Prty_Mnth_Wise';
export const TDS_MONTH_FORM = 'Rpt_Tds2_Prty_Mnth_Wise#Month';

export const TCS_SALES_FORM = 'Rpt_TcsReports#Sales';
export const TCS_PURCHASE_FORM = 'Rpt_TcsReports#Purchase';

export const TDS_TCS_REPORTS = [
  tdsReports,
  tdsPartyMonth(TDS_PARTY_FORM, 'P'),
  tdsPartyMonth(TDS_MONTH_FORM, 'M'),
  tcs(TCS_SALES_FORM, 'Rpt_TcsSalesRegister'),
  tcs(TCS_PURCHASE_FORM, 'Rpt_TcsPurchaseRegister'),
];
