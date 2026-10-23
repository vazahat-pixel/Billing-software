'use strict';

/** JSM: Reports › JobWork Reports › Send (Rpt_Job_IssueReport, view JSM_VW_JOBWORK_ISSUE). */
const { detailReport } = require('../detailReport');
const { loadMillIssueRows } = require('../sources/millIssue');

module.exports = detailReport({
  load: (companyId) => loadMillIssueRows(companyId, 'jobIssue'),
  dateField: 'CHLN_DATE',
  filters: { parties: 'PARTY', brokers: 'BROKER', items: 'ITEM', books: 'BOOK' },
  groupBy1: ['Register', 'Party', 'Broker', 'Item', 'Book'],
  groupBy2: ['None', 'Party', 'Broker', 'Item', 'Book'],
  xColumns: { Register: 'XREGISTER', Party: 'XPARTY', Broker: 'XBROKER', Item: 'XITEM', Book: 'XBOOK' },
  xSource: { XREGISTER: 'BOOK', XPARTY: 'PARTY', XBROKER: 'BROKER', XITEM: 'ITEM', XBOOK: 'BOOK', XCO_ENT_NO: 'CO_ENT_NO' },
  tieBreak: ['CHLN_DATE', 'CHLN_NO', 'NCCHLN_NO'],
  // JSM compares "Buyer" and "BOOK" (never equal to the combo text), so those keep variant 1 here.
  variant: { Register: 1, Party: 2, Item: 4 },
  layout: 'JSM_VW_JOBWORK_ISSUE_REPORT',
  titleSuffix: 'Wise Job Issue Report',
  async options(companyId) {
    const Party = require('../../../models/Party');
    const Item = require('../../../models/Item');
    const Book = require('../../../models/Book');
    const { masterId } = require('../../companyGroupService');
    const m = await masterId(companyId);
    const [parties, brokers, items, books] = await Promise.all([
      Party.find({ companyId: m, type: { $in: ['Job Worker', 'Both', 'Supplier'] } }).select('name').lean(),
      Party.find({ companyId: m, type: 'Broker' }).select('name').lean(),
      Item.find({ companyId: m }).select('name').lean(),
      Book.find({ companyId, module: 'jobIssue' }).select('name').lean(),
    ]);
    const names = (l) => [...new Set(l.map((x) => x.name).filter(Boolean))].sort((a, b) => a.toUpperCase().localeCompare(b.toUpperCase()));
    return { parties: names(parties), brokers: names(brokers), items: names(items), books: names(books) };
  },
});
