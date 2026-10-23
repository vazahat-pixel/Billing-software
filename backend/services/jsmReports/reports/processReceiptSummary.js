'use strict';

/** JSM: Reports › Process Reports › Receipt Summary (Rpt_Process_Receipt_Summary), bill-wise mode. */
const { detailReport } = require('../detailReport');
const { loadMillReceiptSummaryRows } = require('../sources/millReceiptSummary');

const SGC = { All: (r) => r.SGC !== 'x', Receipt: (r) => r.SGC !== '2', GreyReturn: (r) => r.SGC === '2' };

module.exports = detailReport({
  load: loadMillReceiptSummaryRows,
  dateField: 'BILL_DATE',
  filters: { mills: 'MILL', msmeTypes: 'MSME_TYPE' },
  extraFilter: (rows, p) => rows.filter(SGC[p.processType] || SGC.All),
  groupBy1: ['Register', 'Mill', 'Msme_Type', 'Month', 'Book'],
  groupBy2: ['None', 'Month', 'Mill', 'DateWise'],
  xColumns: { Register: 'XREGISTER', Mill: 'XMILL', Msme_Type: 'XMSME_TYPE', Month: 'XMONTH', Book: 'XBOOK', DateWise: 'XDateWise' },
  xSource: {
    XENT_NO: 'ENT_NO', XCO_ENT_NO: 'CO_ENT_NO', XBOOK: 'BOOK', XMILL: 'MILL', XMSME_TYPE: 'MSME_TYPE', XREGISTER: 'BOOK', XMONTH: 'MONTH', XDateWise: 'DATEWISE',
  },
  // JSM sorts months by YEAR_NO, MONTH_NO before the month name.
  orderColumns(o1, o2, x1, x2) {
    if (o1 === 'Month') return ['YEAR_NO', 'MONTH_NO', x1, x2];
    if (o2 === 'Month') return [x1, 'YEAR_NO', 'MONTH_NO', x2];
    return [x1, x2];
  },
  tieBreak: ['BILL_DATE', 'SRAL_NO', 'NCBILL_NO'],
  variant: { Register: 1, Mill: 2, Msme_Type: 2, Book: 1, Month: 1 },
  layout: 'JSM_VW_PROCESS_RECEIPT_REPORT',
  titleSuffix: 'Wise Process Report',
  async options(companyId) {
    const rows = await loadMillReceiptSummaryRows(companyId);
    const u = (f) => [...new Set(rows.map((r) => r[f]))].sort((a, b) => String(a).localeCompare(String(b)));
    return { mills: u('MILL'), msmeTypes: u('MSME_TYPE') };
  },
});
