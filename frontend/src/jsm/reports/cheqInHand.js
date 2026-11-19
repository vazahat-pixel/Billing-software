/**
 * JSM: Reports › Fas Reports › Bank / Cash Book › Cheq In Hand (Rpt_BankStockInHandCheq).
 *
 * One ticked party list, a group combo, and that is the whole screen — it carries no date boxes,
 * so the range is left open as JSM leaves it. JSM_VW_CHEQ_IN_HAND is built at run time, so the
 * columns are the ones Js_Add_NewColumn_Function names.
 */
const COLUMNS = [
  { field: 'BOOK', caption: 'BOOK', kind: 'C', len: 14 },
  { field: 'AC_NAME', caption: 'PARTY', kind: 'C', len: 26 },
  { field: 'PBANK', caption: 'P.BANK', kind: 'C', len: 16 },
  { field: 'SRAL_NO', caption: 'SRAL.NO', kind: 'C', len: 10 },
  { field: 'REC_DATE', caption: 'REC.DT', kind: 'D', len: 10 },
  { field: 'REC_AMT', caption: 'REC.AMT', kind: 'N', dec: 2, total: true, len: 13 },
  { field: 'CHQ_NO', caption: 'CHQ.NO', kind: 'C', len: 12 },
  { field: 'CHQ_DATE', caption: 'CHQ.DATE', kind: 'D', len: 10 },
  { field: 'PAY_DATE', caption: 'PAY.DT', kind: 'D', len: 10 },
  { field: 'PAY_AMT', caption: 'PAY.AMT', kind: 'N', dec: 2, total: true, len: 13 },
];

export default {
  form: 'Rpt_BankStockInHandCheq',
  lists: { ListView_Party: 'parties' },
  defaults: () => ({ CboGroup: 'None' }),
  toParams: (s) => ({
    group: s.CboGroup,
    printout: s.cbo_printout,
    parties: s.ListView_Party || [],
  }),
  fallbackColumns: { JSM_VW_CHEQ_IN_HAND: COLUMNS },
};
