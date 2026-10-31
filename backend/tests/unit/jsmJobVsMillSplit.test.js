'use strict';

/**
 * JSM keeps mill and job work in separate tables (I_MILL_CH vs I_JOB_ISSUE), so the
 * Process (mill) reports and the JobWork reports must never show each other's challans.
 * MERN stores both as Job documents, split by workKind (older rows fall back to processType).
 */

const { it } = require('node:test');
const assert = require('node:assert/strict');
const Job = require('../../models/Job');
const Book = require('../../models/Book');
const Company = require('../../models/Company');
const { loadMillIssueRows } = require('../../services/jsmReports/sources/millIssue');
const { loadMillReceiptRows } = require('../../services/jsmReports/sources/millReceipt');
const { loadMillReceiptSummaryRows } = require('../../services/jsmReports/sources/millReceiptSummary');

function chain(result) {
  const c = { populate: () => c, select: () => c, sort: () => c, lean: () => Promise.resolve(result) };
  return c;
}

/** One challan of each kind, plus two legacy rows that have no workKind at all. */
const FIXTURE = [
  { _id: 'mill1', challanNo: '1', workKind: 'Mill', processType: 'Process Charge',
    issueDate: new Date('2026-08-01T00:00:00Z'), receiveDate: new Date('2026-08-10T00:00:00Z'),
    issuePcs: 10, issueQty: 100, receivedPcs: 10, receivedQty: 100, purchaseRate: 10, jobRate: 5,
    workerId: { name: 'MILL A' }, lotId: { lotId: 'L1', itemId: { name: 'GREY' } } },

  { _id: 'job1', challanNo: '2', workKind: 'Job', processType: 'Job Work',
    issueDate: new Date('2026-08-02T00:00:00Z'), receiveDate: new Date('2026-08-11T00:00:00Z'),
    issuePcs: 20, issueQty: 200, receivedPcs: 20, receivedQty: 200, purchaseRate: 20, jobRate: 6,
    workerId: { name: 'JOBBER B' }, lotId: { lotId: 'L2', itemId: { name: 'GREY' } } },

  // Legacy rows saved before workKind existed — processType decides.
  { _id: 'legacyMill', challanNo: '3', processType: 'Process Charge',
    issueDate: new Date('2026-08-03T00:00:00Z'), receiveDate: new Date('2026-08-12T00:00:00Z'),
    issuePcs: 5, issueQty: 50, receivedPcs: 5, receivedQty: 50, purchaseRate: 10, jobRate: 5,
    workerId: { name: 'MILL C' }, lotId: { lotId: 'L3', itemId: { name: 'GREY' } } },

  { _id: 'legacyJob', challanNo: '4', processType: 'Job Work',
    issueDate: new Date('2026-08-04T00:00:00Z'), receiveDate: new Date('2026-08-13T00:00:00Z'),
    issuePcs: 7, issueQty: 70, receivedPcs: 7, receivedQty: 70, purchaseRate: 10, jobRate: 5,
    workerId: { name: 'JOBBER D' }, lotId: { lotId: 'L4', itemId: { name: 'GREY' } } },
];

function withStubs(fn) {
  const orig = { find: Job.find, findOne: Book.findOne, findById: Company.findById };
  Job.find = () => chain(FIXTURE);
  Book.findOne = () => chain(null);
  Company.findById = () => chain({ coCode: 'SC' });
  return Promise.resolve(fn()).finally(() => {
    Job.find = orig.find; Book.findOne = orig.findOne; Company.findById = orig.findById;
  });
}

const ids = (rows) => rows.map((r) => r.ENT_NO).sort();

it('Issue: mill register excludes job work challans, and vice versa', () => withStubs(async () => {
  const mill = await loadMillIssueRows('c1', 'millIssue');
  const job = await loadMillIssueRows('c1', 'jobIssue');

  assert.deepEqual(ids(mill), ['legacyMill', 'mill1'], 'Mill Issue must show only mill challans');
  assert.deepEqual(ids(job), ['job1', 'legacyJob'], 'Job Issue must show only job work challans');
  assert.equal(mill.length + job.length, FIXTURE.length, 'every challan belongs to exactly one side');
}));

it('Receipt detail: mill and job work registers do not overlap', () => withStubs(async () => {
  const mill = await loadMillReceiptRows('c1', 'millRec');
  const job = await loadMillReceiptRows('c1', 'jobRec');

  assert.deepEqual(ids(mill), ['legacyMill', 'mill1']);
  assert.deepEqual(ids(job), ['job1', 'legacyJob']);
  assert.equal(mill.length + job.length, FIXTURE.length);
}));

it('Receipt summary: mill and job work registers do not overlap', () => withStubs(async () => {
  const mill = await loadMillReceiptSummaryRows('c1', 'millRec');
  const job = await loadMillReceiptSummaryRows('c1', 'jobRec');

  assert.deepEqual(ids(mill), ['legacyMill', 'mill1']);
  assert.deepEqual(ids(job), ['job1', 'legacyJob']);
  assert.equal(mill.length + job.length, FIXTURE.length);
}));

it('totals are split, not duplicated across the two registers', () => withStubs(async () => {
  const mill = await loadMillIssueRows('c1', 'millIssue');
  const job = await loadMillIssueRows('c1', 'jobIssue');
  const sum = (rows, f) => rows.reduce((t, r) => t + Number(r[f] || 0), 0);

  // mill1 100 + legacyMill 50 = 150 ; job1 200 + legacyJob 70 = 270 ; all four = 420
  assert.equal(sum(mill, 'ISS_QTY'), 150);
  assert.equal(sum(job, 'ISS_QTY'), 270);
  assert.equal(sum(mill, 'ISS_QTY') + sum(job, 'ISS_QTY'), 420);
}));
