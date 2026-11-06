import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › Sales › Sales Bill › Sales Summary (Rpt_SalesRegisterSummary_Report) and
 * Reports › Purchase › Purchase Bill › Purchase Summary (Rpt_PurchaseRegisterSummary_Report).
 *
 * Not the Category Wise registers — this screen has two Order By combos and groups on both, with
 * "Summary Reports" deciding between the grouped totals and one row per bill, and an
 * Amt Asc / Amt Desc radio. Controls and their opening values are the captured blueprint's.
 *
 * JSM's grouped layout (JSM_VW_REGISTER_SALES_SUMMARY_SUMMARYREPORT) has no column set captured
 * for any variant, so its own column list is given here as the fallback.
 */
const COMMON = {
  renderer: undefined,
  lists: { lst_vw1: 'parties' },
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    Cbo_OrderBy1: 'Register',
    Cbo_OrderBy2: 'Month',
    CheckBox_Summary: true,
    CheckBox_Total: true,
    rdo_None: true,
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    orderBy1: s.Cbo_OrderBy1,
    orderBy2: s.Cbo_OrderBy2,
    summaryReports: s.CheckBox_Summary !== false,
    sort: s.rdo_asc_sales_prt ? 'asc' : (s.rdo_desc_sales_prt ? 'desc' : null),
    printout: s.cbo_printout,
    parties: s.lst_vw1 || [],
  }),
  fallbackColumns: {
    JSM_VW_REGISTER_SALES_SUMMARY_SUMMARYREPORT: [
      { field: 'GROUP1', caption: 'GRP1', kind: 'C', len: 22 },
      { field: 'GROUP2', caption: 'GRP2', kind: 'C', len: 22 },
      { field: 'TPCS', caption: 'T.PCS', kind: 'N', dec: 2, total: true, len: 10 },
      { field: 'TQTY', caption: 'T.QTY', kind: 'N', dec: 2, total: true, len: 12 },
      { field: 'T_ADD', caption: 'T.ADD', kind: 'N', dec: 2, total: true, len: 12 },
      { field: 'T_LESS', caption: 'T.LESS', kind: 'N', dec: 2, total: true, len: 12 },
      { field: 'BILLAMT', caption: 'NET.AMOUNT', kind: 'N', dec: 2, total: true, len: 14 },
    ],
  },
};

export const salesRegisterSummary = { ...COMMON, form: 'Rpt_SalesRegisterSummary_Report' };
export const purchaseRegisterSummary = { ...COMMON, form: 'Rpt_PurchaseRegisterSummary_Report' };

export const REGISTER_SUMMARIES = [salesRegisterSummary, purchaseRegisterSummary];
