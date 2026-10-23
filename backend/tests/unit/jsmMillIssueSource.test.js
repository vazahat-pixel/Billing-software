'use strict';

const { it } = require('node:test');
const assert = require('node:assert/strict');
const Job = require('../../models/Job');
const Book = require('../../models/Book');
const Company = require('../../models/Company');
const { loadMillIssueRows } = require('../../services/jsmReports/sources/millIssue');

function chain(result) {
  const c = { populate: () => c, select: () => c, sort: () => c, lean: () => Promise.resolve(result) };
  return c;
}

it('maps a MERN mill-issue job to a JSM_VW_PROCESS_ISSUE row', async () => {
  const orig = { find: Job.find, findOne: Book.findOne, findById: Company.findById };
  let jobQuery;
  Job.find = (q) => { jobQuery = q; return chain([{
    _id: 'j1', challanNo: '12', issueDate: new Date('2026-08-05T00:00:00Z'), issuePcs: 10, issueQty: 250.5,
    purchaseRate: 12, purchaseBillNo: 'PB-7', weaver: 'MAHESH SIR', remark: 'R ONE\nR TWO\nTransport: X',
    workerId: { name: 'SHREE LAV' }, lotId: { lotId: 'L-9', itemId: { name: 'GRAY MICRO' } },
  }]); };
  Book.findOne = () => chain({ name: 'PROCESS CHARGE' });
  Company.findById = () => chain({ coCode: 'SC' });
  try {
    const [r] = await loadMillIssueRows('c1');
    assert.deepEqual(jobQuery.status, { $ne: 'Cancelled' });
    assert.equal(r.BOOK, 'PROCESS CHARGE');
    assert.equal(r.MILL, 'SHREE LAV');
    assert.equal(r.PURPARTY, 'MAHESH SIR');
    assert.equal(r.ITEM, 'GRAY MICRO');
    assert.equal(r.NCCHLN_NO, '12');
    assert.equal(r.CHLN_NO, 12);
    assert.equal(r.MONTH, 'August');
    assert.equal(r.PU_AMOUNT, 3006);
    assert.equal(r.REMARK_1, 'R ONE');
    assert.equal(r.REMARK_2, 'R TWO');
    assert.equal(r.LOT_NO, 'L-9');
  } finally {
    Job.find = orig.find; Book.findOne = orig.findOne; Company.findById = orig.findById;
  }
});
