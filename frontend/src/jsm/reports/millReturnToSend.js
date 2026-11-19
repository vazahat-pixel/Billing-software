/**
 * JSM: Reports › Purchase › Mill Return To Send (Rpt_1StockSubItemAcc_DetailReport).
 *
 * The screen was copied from the Stock (Detail) one and keeps its six tab lists, which its own
 * SELECT then ignores; here the first list offers the mills in the timeline and is honoured, so
 * the control does something rather than nothing. Its columns are the ones JSM's export prints.
 */
const COLUMNS = [
  { field: 'ENT_DATE', caption: 'Date', kind: 'D', len: 10 },
  { field: 'SRAL_NO', caption: 'SralNo', kind: 'C', len: 9 },
  { field: 'NCBILL_NO', caption: 'BillNo', kind: 'C', len: 10 },
  { field: 'RTN_FROM_MILL', caption: 'Rtn_From_Mill', kind: 'N', dec: 2, total: true, len: 14 },
  { field: 'PARTY', caption: 'Party', kind: 'C', len: 24 },
  { field: 'NCCHLN_NO', caption: 'ChlnNo', kind: 'C', len: 10 },
  { field: 'ISS_QTY', caption: 'IssQty', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'BAL_QTY', caption: 'BalQty', kind: 'N', dec: 2, len: 13 },
  { field: 'REMARK1', caption: 'Remark', kind: 'C', len: 20 },
];

export default {
  form: 'Rpt_1StockSubItemAcc_DetailReport',
  lists: { ListView0: 'parties' },
  defaults: () => ({}),
  toParams: (s) => ({
    printout: s.cbo_printout,
    parties: s.ListView0 || [],
  }),
  fallbackColumns: { JSM_VW_MILL_RTN_TO_SEND: COLUMNS },
};
