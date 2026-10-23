'use strict';

/** JSM: Reports › JobWork Reports › Receipt Summary (Rpt_JobWork_Receipt_Summary), bill-wise mode. */
const { detailReport } = require('../detailReport');
const { loadMillReceiptSummaryRows } = require('../sources/millReceiptSummary');

const load = (companyId) => loadMillReceiptSummaryRows(companyId, 'jobRec');

module.exports = detailReport({
  load,
  dateField: 'BILL_DATE',
  filters: { parties: 'PARTY', brokers: 'BROKER', books: 'BOOK', msmeTypes: 'MSME_TYPE' },
  groupBy1: ['Register', 'Party', 'Broker', 'MSME_Type', 'Month'],
  groupBy2: ['None', 'Party', 'Broker', 'Month', 'DateWise'],
  xColumns: { Register: 'XREGISTER', Party: 'XPARTY', Broker: 'XBROKER', MSME_Type: 'XMSME_TYPE', Month: 'XMONTH', DateWise: 'XDateWise' },
  xSource: {
    XENT_NO: 'ENT_NO', XCO_ENT_NO: 'CO_ENT_NO', XBOOK: 'BOOK', XPARTY: 'PARTY', XBROKER: 'BROKER', XMSME_TYPE: 'MSME_TYPE', XREGISTER: 'BOOK', XMONTH: 'MONTH', XDateWise: 'DATEWISE',
  },
  // JSM sorts months by YEAR_NO, MONTH_NO before the month name.
  orderColumns(o1, o2, x1, x2) {
    if (o1 === 'Month') return ['YEAR_NO', 'MONTH_NO', x1, x2];
    if (o2 === 'Month') return [x1, 'YEAR_NO', 'MONTH_NO', x2];
    return [x1, x2];
  },
  tieBreak: ['BILL_DATE', 'SRAL_NO', 'NCBILL_NO'],
  variant: { Register: 1, Party: 2, Broker: 3, MSME_Type: 2, Month: 1 },
  layout: 'JSM_VW_JOBWORK_RECEIPT_REPORT',
  titleSuffix: 'Wise JobWork Receipt(Summary) Report',
  async options(companyId) {
    const rows = await load(companyId);
    const u = (f) => [...new Set(rows.map((r) => r[f]))].sort((a, b) => String(a).localeCompare(String(b)));
    return { parties: u('PARTY'), brokers: u('BROKER'), books: u('BOOK'), msmeTypes: u('MSME_TYPE') };
  },
});
