import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › Sales › Sales Bill › Haste/Transport (Rpt_Sales_Haste).
 * A-Haste / B-Packers / C-Transport / D-Lr Dispatch radio, date range, two tick lists (the
 * grouping accounts, and parties) — matching the real form's controls.
 *
 * No STP_REPORT row exists for this screen (its form has no captured layout at all), so the
 * columns come straight from the owner's own printed output (Sales_Report.pdf, 03/11/2026):
 * Bill_No, Bill Date, Party, Haste, Item, Pcs, Rate, Amount.
 */
export default {
  form: 'Rpt_Sales_Haste',
  // The tab's own list always shows Haste names — the report's "account" tab follows whichever
  // radio is active in real JSM, which needs the radio wired into the list source; ticking still
  // filters correctly for the default (and most used) Haste grouping.
  lists: { lst_vw1: 'hastes', lst_vw2: 'parties' },
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    Rdbtn_Haste: true,
  }),
  toParams: (s) => {
    const mode = s.Rdbtn_Packers ? 'B' : s.Rdbtn_Transport ? 'C' : s.Rdbtn_Lr_Dispetch ? 'D' : 'A';
    return {
      from: toIsoDate(s.txt_dt_from),
      to: toIsoDate(s.txt_dt_to),
      fromText: s.txt_dt_from,
      toText: s.txt_dt_to,
      mode,
      accounts: mode === 'A' ? (s.lst_vw1 || []) : [],
      parties: s.lst_vw2 || [],
    };
  },
  fallbackColumns: {
    JSM_VW_SALES_HASTE_REPORT: [
      { field: 'NCBILL_NO', caption: 'BILL.NO', kind: 'C', len: 8 },
      { field: 'BILL_DATE', caption: 'BILL.DATE', kind: 'D', len: 10 },
      { field: 'PARTY', caption: 'PARTY', kind: 'C', len: 22 },
      { field: 'HASTE', caption: 'HASTE', kind: 'C', len: 8 },
      { field: 'ITEM_NAME', caption: 'ITEM', kind: 'C', len: 18 },
      { field: 'IT_PCS', caption: 'PCS', kind: 'N', dec: 0, total: true, len: 6 },
      { field: 'IT_RATE', caption: 'RATE', kind: 'N', dec: 2, len: 8 },
      { field: 'IT_AMOUNT', caption: 'AMOUNT', kind: 'N', dec: 2, total: true, len: 10 },
    ],
  },
};
