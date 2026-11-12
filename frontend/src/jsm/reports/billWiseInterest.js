import { toIsoDate } from '../winforms.js';

const INT_COLS = [
  { field: 'NCBILL_NO', caption: 'BILL.NO', kind: 'C', len: 10 },
  { field: 'BILL_DATE', caption: 'BILL.DT', kind: 'D', len: 10 },
  { field: 'PartyName', caption: 'PRTY.NAME', kind: 'C', len: 24 },
  { field: 'NET_TOT', caption: 'AMT', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'TAXABLE_AMT', caption: 'TAXABLE.AMT', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'R_DATE', caption: 'REC.DT', kind: 'D', len: 10 },
  { field: 'R_AMT', caption: 'REC.AMT', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'OS_DAYS', caption: 'Os.Dy', kind: 'N', dec: 0, len: 7 },
  { field: 'GRS_DAY', caption: 'GrsDy', kind: 'N', dec: 0, len: 7 },
  { field: 'INT_DAYS', caption: 'IntDy', kind: 'N', dec: 0, len: 7 },
  { field: 'INT_RATE', caption: 'IntRate', kind: 'N', dec: 2, len: 8 },
  { field: 'INT_AMT', caption: 'INT.AMT', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'PAID_INT', caption: 'PAID.INTREST', kind: 'N', dec: 2, total: true, len: 12 },
  { field: 'FNL_AMT', caption: 'FINAL.AMT', kind: 'N', dec: 2, total: true, len: 13 },
];

const FALLBACKS = {
  JSM_VW_INT_WISE_SALES_RPT: INT_COLS,
  RPT_BILLWISE_DETAIL: INT_COLS,
};

function zoomConfig(form, blueprintForm, defaultDays) {
  return {
    form,
    blueprintForm,
    apiForm: form,
    lists: { ListView0: 'parties' },
    defaults: ({ fyFrom, fyTo, today }) => ({
      txt_dt_from: fyFrom,
      txt_dt_to: fyTo,
      txt_till_dt: today,
      txt_rate: '12.00',
      txt_grsdy: '0',
      txt_DayofYear: String(defaultDays),
      Cbo_OnAmt: 'TaxableAmt',
      cbo_status: 'Pending',
      Cbo_OrderBy1: 'PartyName',
      CheckBox_WithLastYear: true,
    }),
    toParams: (s) => ({
      from: toIsoDate(s.txt_dt_from),
      to: toIsoDate(s.txt_dt_to),
      fromText: s.txt_dt_from,
      toText: s.txt_dt_to,
      tillDate: toIsoDate(s.txt_till_dt),
      tillDateText: s.txt_till_dt,
      rate: Number(s.txt_rate || 0) || 0,
      graceDays: Number(s.txt_grsdy || 0) || 0,
      yearDays: Number(s.txt_DayofYear || defaultDays) || defaultDays,
      onAmt: s.Cbo_OnAmt || 'TaxableAmt',
      status: s.cbo_status || 'Pending',
      orderBy1: s.Cbo_OrderBy1 || 'PartyName',
      withLastYear: s.CheckBox_WithLastYear !== false,
      parties: s.ListView0 || [],
    }),
    fallbackColumns: FALLBACKS,
  };
}

export const BILL_WISE_INTEREST_REPORTS = [
  {
    form: 'Rpt_Sales_Interest',
    lists: { lst_vw1: 'parties' },
    defaults: ({ fyFrom, fyTo, today }) => ({
      txt_dt_from: fyFrom,
      txt_dt_to: fyTo,
      txt_till_dt: today,
      txt_rate: '12.00',
      txt_1: '0',
      cbo_status: 'Pending',
      CheckBox_WithLastYear: true,
    }),
    toParams: (s) => ({
      from: toIsoDate(s.txt_dt_from),
      to: toIsoDate(s.txt_dt_to),
      fromText: s.txt_dt_from,
      toText: s.txt_dt_to,
      tillDate: toIsoDate(s.txt_till_dt),
      tillDateText: s.txt_till_dt,
      rate: Number(s.txt_rate || 0) || 0,
      graceDays: Number(s.txt_1 || 0) || 0,
      yearDays: 365,
      onAmt: 'BillAmt',
      status: s.cbo_status || 'Pending',
      onlyUnPaidBill: Boolean(s.CheckBox_UnPaidBill),
      withLastYear: s.CheckBox_WithLastYear !== false,
      parties: s.lst_vw1 || [],
    }),
    fallbackColumns: FALLBACKS,
  },
  zoomConfig('New_Rpt_Sales_Intrest_ZoomIn_New_Sales', 'New_Rpt_Sales_Intrest_ZoomIn_New', 365),
  zoomConfig('New_Rpt_Sales_Intrest_ZoomIn_New_Purchase', 'New_Rpt_Sales_Intrest_ZoomIn_New', 365),
  zoomConfig('New_Rpt_Sales_Intrest_ZoomIn', 'New_Rpt_Sales_Intrest_ZoomIn', 360),
];
