'use strict';

/** JSM: Reports › Process Reports › Receipt Detail (Rpt_Process_Receipt_Detail). */
const { detailReport } = require('../detailReport');
const { loadMillReceiptRows } = require('../sources/millReceipt');

module.exports = detailReport({
  load: loadMillReceiptRows,
  dateField: 'BILL_DATE',
  filters: { mills: 'MILL', greyItems: 'GREYITEM', finishItems: 'FINISHITEM', rates: 'IT_RATE', desc1: 'IT_DESC1' },
  // MERN records no grey returns, so "GreyReturn" has nothing to list.
  extraFilter: (rows, p) => (p.processType === 'GreyReturn' ? [] : rows),
  groupBy1: ['Register', 'Mill', 'GreyItem', 'FinishItem', 'Rate', 'DateWise', 'It_Desc1'],
  groupBy2: ['None', 'Mill', 'GreyItem', 'FinishItem', 'Rate', 'DateWise', 'It_Desc1'],
  xColumns: {
    Register: 'XREGISTER', Mill: 'XMILL', GreyItem: 'XGREYITEM', FinishItem: 'XFINISHITEM', Rate: 'XRATE', DateWise: 'XDateWise', It_Desc1: 'XIT_DESC1',
  },
  xSource: {
    XREGISTER: 'BOOK', XMILL: 'MILL', XGREYITEM: 'GREYITEM', XFINISHITEM: 'FINISHITEM', XRATE: 'IT_RATE', XDateWise: 'BILL_DATE', XIT_DESC1: 'IT_DESC1', XCO_ENT_NO: 'CO_ENT_NO',
  },
  tieBreak: ['BILL_DATE', 'SRAL_NO', 'NCBILL_NO'],
  variant: { Register: 1, Mill: 2, GreyItem: 3, FinishItem: 4, Rate: 1, DateWise: 1, It_Desc1: 2 },
  layout: 'JSM_VW_PROCESS_RECEIPT_DETAIL_REPORT',
  titleSuffix: 'Wise Process Report',
  async options(companyId) {
    const rows = await loadMillReceiptRows(companyId);
    const u = (f) => [...new Set(rows.map((r) => r[f]))].sort((a, b) => String(a).localeCompare(String(b)));
    return { mills: u('MILL'), greyItems: u('GREYITEM'), finishItems: u('FINISHITEM'), rates: u('IT_RATE'), desc1: u('IT_DESC1') };
  },
});
