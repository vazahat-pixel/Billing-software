'use strict';

/**
 * JSM: Reports › JobWork Reports › Jobwork Stock/Pending Report (Rpt_JobWork_Stock_Report).
 * Columns come from JSM_VW_JOBWORK_STOCK_REPORT, which names them differently from the
 * Process Stock view, and the form has only two GroupBy combos plus a Unit combo.
 */

const { it } = require('node:test');
const assert = require('node:assert/strict');
const jobStock = require('../../services/jsmReports/reports/jobStock');
const jsmReports = require('../../services/jsmReports');

/** Two job work challans: one still pending, one fully cleared. */
const ROWS = [
  { CO_ENT_NO: 'a1', ENT_NO: 'a1', NCCHLN_NO: '1', CHLN_NO: 1, CHLN_DATE: new Date('2026-08-05T00:00:00Z'),
    PARTY: 'JOBBER A', BROKER: 'BRK 1', ITEM: 'GREY', REGISTER: 'JOB ISSUE', RANGE: 'R1',
    ISS_PCS: 10, ISS_QTY: 100, BILLNO: 'B1', BILLDT: new Date('2026-08-09T00:00:00Z'), SRAL_NO: 1,
    REC_PCS: 4, REC_QTY: 40, PLAIN_QTY: 38, SHORT_QTY: 2, PLAIN_PCS: 0, CONS_PCS: 0, CONS_QTY: 0, SHORT_PCS: 0,
    BAL_PCS: 6, BAL_QTY: 60, BAL_AMT: 600, JOB_RATE: 5, PENDING: 'PENDING' },

  { CO_ENT_NO: 'b1', ENT_NO: 'b1', NCCHLN_NO: '2', CHLN_NO: 2, CHLN_DATE: new Date('2026-08-06T00:00:00Z'),
    PARTY: 'JOBBER B', BROKER: 'BRK 2', ITEM: 'GREY', REGISTER: 'JOB ISSUE', RANGE: 'R2',
    ISS_PCS: 5, ISS_QTY: 50, BILLNO: 'B2', BILLDT: new Date('2026-08-10T00:00:00Z'), SRAL_NO: 1,
    REC_PCS: 5, REC_QTY: 50, PLAIN_QTY: 50, SHORT_QTY: 0, PLAIN_PCS: 0, CONS_PCS: 0, CONS_QTY: 0, SHORT_PCS: 0,
    BAL_PCS: 0, BAL_QTY: 0, BAL_AMT: 0, JOB_RATE: 6, PENDING: 'CLEAR' },
];

const P = { from: '2026-04-01', to: '2027-03-31' };

it('is registered under its JSM form name', () => {
  assert.equal(typeof jsmReports.get('Rpt_JobWork_Stock_Report').run, 'function');
  assert.ok(jsmReports.ids().includes('Rpt_JobWork_Stock_Report'));
});

it('uses the JobWork stock view, not the Process stock one', async () => {
  const r = await jobStock.run('c1', P, { rows: ROWS });
  assert.equal(r.grid.layout, 'JSM_VW_JOBWORK_STOCK_REPORT');
  assert.match(r.grid.title, /JobWork Stock Report$/);
});

it('status Pending / Clear / All filter on the challan balance', async () => {
  const pending = await jobStock.run('c1', { ...P, status: 'Pending' }, { rows: ROWS });
  const clear = await jobStock.run('c1', { ...P, status: 'Clear' }, { rows: ROWS });
  const all = await jobStock.run('c1', { ...P, status: 'All' }, { rows: ROWS });

  assert.deepEqual(pending.rows.map((r) => r.ENT_NO), ['a1']);
  assert.deepEqual(clear.rows.map((r) => r.ENT_NO), ['b1']);
  assert.deepEqual(all.rows.map((r) => r.ENT_NO).sort(), ['a1', 'b1']);
});

it('Unit picks the column set: Pcs keeps the GroupBy variant, Qty forces variant 6', async () => {
  const pcsReg = await jobStock.run('c1', { ...P, status: 'All', unit: 'Pcs', orderBy1: 'Register' }, { rows: ROWS });
  const pcsParty = await jobStock.run('c1', { ...P, status: 'All', unit: 'Pcs', orderBy1: 'Party' }, { rows: ROWS });
  const qty = await jobStock.run('c1', { ...P, status: 'All', unit: 'Qty', orderBy1: 'Register' }, { rows: ROWS });

  assert.equal(pcsReg.grid.variant, 1, 'Register wise + Pcs = variant 1');
  assert.equal(pcsParty.grid.variant, 2, 'Party wise + Pcs = variant 2');
  assert.equal(qty.grid.variant, 6, 'Qty mode = variant 6 (metre columns)');
});

it('GroupBy 1 / 2 produce the X columns JSM groups on, and reject a repeated column', async () => {
  const r = await jobStock.run('c1', { ...P, status: 'All', orderBy1: 'Party', orderBy2: 'Item' }, { rows: ROWS });
  assert.deepEqual(r.grid.groupColumns, ['XPARTY', 'XITEM']);
  assert.deepEqual(r.grid.groupDisplays, ['PARTY', 'ITEM']);
  assert.equal(r.rows[0].XPARTY, 'JOBBER A');

  await assert.rejects(
    () => jobStock.run('c1', { ...P, status: 'All', orderBy1: 'Item', orderBy2: 'Item' }, { rows: ROWS }),
    /specified more than once/
  );
});

it('tab tick lists filter by party, broker, item, book and range', async () => {
  const byParty = await jobStock.run('c1', { ...P, status: 'All', parties: ['JOBBER B'] }, { rows: ROWS });
  const byRange = await jobStock.run('c1', { ...P, status: 'All', ranges: ['R1'] }, { rows: ROWS });
  const byBroker = await jobStock.run('c1', { ...P, status: 'All', brokers: ['BRK 2'] }, { rows: ROWS });

  assert.deepEqual(byParty.rows.map((r) => r.ENT_NO), ['b1']);
  assert.deepEqual(byRange.rows.map((r) => r.ENT_NO), ['a1']);
  assert.deepEqual(byBroker.rows.map((r) => r.ENT_NO), ['b1']);
});

it('issue-date window excludes earlier challans unless Including Last Year is ticked', async () => {
  const narrow = { from: '2026-08-06', to: '2026-08-31', status: 'All' };
  const inWindow = await jobStock.run('c1', narrow, { rows: ROWS });
  const withLastYear = await jobStock.run('c1', { ...narrow, includeLastYear: true }, { rows: ROWS });

  assert.deepEqual(inWindow.rows.map((r) => r.ENT_NO), ['b1'], 'challan of 05-Aug is outside the window');
  assert.deepEqual(withLastYear.rows.map((r) => r.ENT_NO).sort(), ['a1', 'b1']);
});

it('options expose every tab list, built from the job work challans only', async () => {
  const Job = require('../../models/Job');
  const Book = require('../../models/Book');
  const Company = require('../../models/Company');
  const Party = require('../../models/Party');
  const chain = (result) => {
    const c = { populate: () => c, select: () => c, sort: () => c, lean: () => Promise.resolve(result) };
    return c;
  };
  const orig = { jf: Job.find, bf: Book.findOne, cf: Company.findById, pf: Party.find };
  // One job work challan and one mill challan — only the job work one may reach the lists.
  Job.find = () => chain([
    { _id: 'j1', workKind: 'Job', challanNo: '1', issueDate: new Date('2026-08-05T00:00:00Z'),
      issuePcs: 10, issueQty: 100, jobRate: 5, range: 'R1',
      workerId: { name: 'JOBBER A' }, lotId: { lotId: 'L1', itemId: { name: 'GREY' } } },
    { _id: 'm1', workKind: 'Mill', challanNo: '2', issueDate: new Date('2026-08-06T00:00:00Z'),
      issuePcs: 5, issueQty: 50, jobRate: 6, range: 'RMILL',
      workerId: { name: 'MILL ONLY' }, lotId: { lotId: 'L2', itemId: { name: 'GREY' } } },
  ]);
  Book.findOne = () => chain({ name: 'JOB ISSUE' });
  Company.findById = () => chain({ coCode: 'SC', name: 'CO' });
  Party.find = () => chain([]);
  try {
    const o = await jobStock.options('c1');
    assert.deepEqual(Object.keys(o).sort(), ['books', 'brokers', 'items', 'parties', 'ranges']);
    assert.deepEqual(o.parties, ['JOBBER A'], 'the mill challan must not appear in the Party tab');
    assert.deepEqual(o.ranges, ['R1']);
  } finally {
    Job.find = orig.jf; Book.findOne = orig.bf; Company.findById = orig.cf; Party.find = orig.pf;
  }
});
