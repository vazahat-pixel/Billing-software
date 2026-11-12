import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › Gst Reports › 3B Monthly Return › 3B - Inward Supply / 3B - Outward Supply
 * (A_All_Inward_Supply_Purchase, A_All_Outward_Supply_Sales).
 *
 * Two JSM screens of one shape: five ticked lists (Book, Party, State, Type, GstRate), a date
 * range, two Order By boxes and the Summary tick. Neither layout is captured, so the columns are
 * the ones Js_Add_NewColumn_Function names.
 */
const DETAIL = [
  { field: 'BILL_DATE', caption: 'BILL.DATE', kind: 'D', len: 10 },
  { field: 'BILL_NO', caption: 'BILL.NO', kind: 'C', len: 10 },
  { field: 'BOOK', caption: 'BOOK', kind: 'C', len: 14 },
  { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 24 },
  { field: 'GST_NO', caption: 'GST.NO', kind: 'C', len: 16 },
  { field: 'STATE_NAME', caption: 'STATE', kind: 'C', len: 14 },
  { field: 'TYPE', caption: 'TYPE', kind: 'C', len: 10 },
  { field: 'TAX_RATE', caption: 'TAX.RATE', kind: 'N', dec: 2, len: 9 },
  { field: 'BILL_AMT', caption: 'BILL.AMT', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'SGST_AMT', caption: 'SGST', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'CGST_AMT', caption: 'CGST', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'IGST_AMT', caption: 'IGST', kind: 'N', dec: 2, total: true, len: 11 },
  { field: 'TAXABLE_AMT', caption: 'TAXABLE', kind: 'N', dec: 2, total: true, len: 13 },
];
const SUMMARY = DETAIL.filter((c) => !['BILL_DATE', 'BILL_NO'].includes(c.field));

const supply = (form, fallbackColumns) => ({
  form,
  lists: { ListView0: 'books', ListView1: 'parties', ListView2: 'states', ListView3: 'types', ListView4: 'gstRates' },
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom, txt_dt_to: fyTo, Cbo_OrderBy1: 'Register', Cbo_OrderBy2: 'None',
  }),
  toParams: (s) => ({
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    orderBy1: s.Cbo_OrderBy1,
    orderBy2: s.Cbo_OrderBy2,
    summary: Boolean(s.CheckBox_Summary),
    printout: s.cbo_printout,
    books: s.ListView0 || [],
    parties: s.ListView1 || [],
    states: s.ListView2 || [],
    types: s.ListView3 || [],
    gstRates: s.ListView4 || [],
  }),
  fallbackColumns,
});

export const SUPPLY_REGISTERS = [
  supply('A_All_Inward_Supply_Purchase', {
    JSM_VW_ALL_INWARD_SUPPLY_PURCHASE_DET: DETAIL,
    JSM_VW_ALL_INWARD_SUPPLY_PURCHASE_SUM: SUMMARY,
  }),
  supply('A_All_Outward_Supply_Sales', {
    JSM_VW_ALL_OUTWARD_SUPPLY_SALES_DET: DETAIL,
    JSM_VW_ALL_OUTWARD_SUPPLY_SALES_SUM: SUMMARY,
  }),
];
