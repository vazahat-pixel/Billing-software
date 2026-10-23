'use strict';

/** JSM: Reports › JobWork Reports › Receipt Detail (Rpt_JobWork_Receipt_Detail). Unit Pcs/Qty picks variant 1-5 / 6-10. */
const { detailReport } = require('../detailReport');
const { loadMillReceiptRows } = require('../sources/millReceipt');

const PCS = { Register: 1, Party: 2, Broker: 3, Item: 4, RecItem: 5, Rate: 4, DateWise: 4, It_Desc1: 1 };
const QTY = { Register: 6, Party: 7, Broker: 8, Item: 9, RecItem: 10, Rate: 6, DateWise: 6, It_Desc1: 6 };
const spec = {
  load: (companyId) => loadMillReceiptRows(companyId, 'jobRec'),
  dateField: 'BILL_DATE',
  filters: { parties: 'PARTY', brokers: 'BROKER', books: 'BOOK', items: 'ITEM', recItems: 'RECITEM', rates: 'IT_RATE', desc1: 'IT_DESC1' },
  groupBy1: ['Register', 'Party', 'Broker', 'Item', 'RecItem', 'Rate', 'DateWise', 'It_Desc1'],
  groupBy2: ['None', 'Party', 'Broker', 'Item', 'RecItem', 'Rate', 'DateWise', 'It_Desc1'],
  xColumns: {
    Register: 'XREGISTER', Party: 'XPARTY', Broker: 'XBROKER', Item: 'XITEM', RecItem: 'XRECITEM', Rate: 'XRATE', DateWise: 'XDateWise', It_Desc1: 'XIT_DESC1',
  },
  xSource: {
    XREGISTER: 'BOOK', XPARTY: 'PARTY', XBROKER: 'BROKER', XITEM: 'ITEM', XRECITEM: 'RECITEM', XRATE: 'IT_RATE', XDateWise: 'BILL_DATE', XIT_DESC1: 'IT_DESC1', XCO_ENT_NO: 'CO_ENT_NO',
  },
  tieBreak: ['BILL_DATE', 'SRAL_NO', 'NCBILL_NO'],
  variant: PCS,
  layout: 'JSM_VW_JOBWORK_RECEIPT_DETAIL',
  titleSuffix: 'Wise JobWork Receipt Report',
};
const pcsReport = detailReport(spec);
const qtyReport = detailReport({ ...spec, variant: QTY });

module.exports = {
  run: (companyId, p = {}, deps) => (p.unit === 'Qty' ? qtyReport : pcsReport).run(companyId, p, deps),
  async options(companyId) {
    const rows = await loadMillReceiptRows(companyId, 'jobRec');
    const u = (f) => [...new Set(rows.map((r) => r[f]))].sort((a, b) => String(a).localeCompare(String(b)));
    return {
      parties: u('PARTY'), brokers: u('BROKER'), books: u('BOOK'), items: u('ITEM'), recItems: u('RECITEM'), rates: u('IT_RATE'), desc1: u('IT_DESC1'),
    };
  },
};
