import { toIsoDate } from '../winforms.js';

/**
 * JSM: Reports › Fas Reports › Bank / Cash Book › Bank Book / Cash Book (Rpt_cashbank1 — one
 * screen, titled "Cash/Bank Report", serves both menu entries; which book you get depends only on
 * which accounts you tick). Date range, X-Detail/Y-Summary/Z-Dtl+VNo radio (X checked by default),
 * account tick list — matching the real form's controls (captured blueprint, confirmed against
 * the owner's own screenshots, 03/11/2026).
 *
 * No STP_REPORT row backs this screen either; its columns come from the owner's own two printed
 * Cash_Bank_Report.pdf runs (03/11/2026) — X-Detail (Receipt/Payment, no Vno) and Z-Dtl+VNo
 * (adds Vno, captions Debit/Credit instead). Receipt/Payment cells are blank, not "0.00", when
 * that side carries no amount — exactly as both prints show it.
 */
export default {
  form: 'Rpt_cashbank1',
  lists: { lst_vw1: 'accounts' },
  defaults: ({ fyFrom, fyTo }) => ({
    txt_dt_from: fyFrom,
    txt_dt_to: fyTo,
    Rdbtn_C1: true,
  }),
  toParams: (s) => ({
    accounts: s.lst_vw1 || [],
    from: toIsoDate(s.txt_dt_from),
    to: toIsoDate(s.txt_dt_to),
    fromText: s.txt_dt_from,
    toText: s.txt_dt_to,
    variant: s.Rdbtn_C2 ? 'summary' : s.Rdbtn_C3 ? 'dtlvno' : 'detail',
  }),
  fallbackColumns: {
    JSM_VW_CASHBANK_DETAIL: [
      { field: 'ENT_DATE', caption: 'Date', kind: 'D', len: 10 },
      { field: 'DESCRIPTION', caption: 'Description', kind: 'C', len: 30 },
      { field: 'CHQ_NO', caption: 'ChqNo', kind: 'C', len: 10 },
      { field: 'RECEIPT', caption: 'Receipt', kind: 'C', len: 12 },
      { field: 'PAYMENT', caption: 'Payment', kind: 'C', len: 12 },
      { field: 'BALANCE', caption: 'Balance', kind: 'C', len: 15 },
    ],
    JSM_VW_CASHBANK_DTLVNO: [
      { field: 'ENT_DATE', caption: 'Date', kind: 'D', len: 10 },
      { field: 'VNO', caption: 'Vno', kind: 'C', len: 6 },
      { field: 'DESCRIPTION', caption: 'Description', kind: 'C', len: 30 },
      { field: 'CHQ_NO', caption: 'ChqNo', kind: 'C', len: 10 },
      { field: 'RECEIPT', caption: 'Debit', kind: 'C', len: 12 },
      { field: 'PAYMENT', caption: 'Credit', kind: 'C', len: 12 },
      { field: 'BALANCE', caption: 'Balance', kind: 'C', len: 15 },
    ],
  },
};
