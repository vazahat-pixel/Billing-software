/**
 * Job Work partial receive — isolated in-memory MongoDB.
 *
 * Covers the reported gap: receiving less than the full issued quantity used to
 * permanently close the job (status forced to 'Received', no way to receive the rest).
 * jobService.receiveFromJob now accumulates across tranches and only finalizes when the
 * caller says isFinal (default true, preserving old one-call-and-done behaviour for any
 * existing caller that doesn't know about partial receiving).
 */
'use strict';

const path = require('path');
const ROOT = path.resolve(__dirname, '../..');

require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env') });
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'ci-test-jwt-secret-minimum-32-chars!!';

const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');
const mongoose = require(path.join(ROOT, 'node_modules/mongoose'));
const { MongoMemoryServer } = require(path.join(ROOT, 'node_modules/mongodb-memory-server'));
const request = require(path.join(ROOT, 'node_modules/supertest'));

let mongoServer, app;
let tok, companyId, workerId, itemId;
let Job, AccountingEntry, InventoryLot;

before(async () => {
  mongoServer = await MongoMemoryServer.create({ instance: { timeoutMs: 60_000 } });
  process.env.MONGO_URI = mongoServer.getUri();
  app = require(path.join(ROOT, 'server'));

  await new Promise((resolve, reject) => {
    if (mongoose.connection.readyState === 1) return resolve();
    const t = setTimeout(() => reject(new Error('Mongoose connect timeout')), 20000);
    mongoose.connection.once('connected', () => { clearTimeout(t); resolve(); });
    mongoose.connection.once('error', (e) => { clearTimeout(t); reject(e); });
  });

  const realStartSession = mongoose.startSession.bind(mongoose);
  mongoose.startSession = async function () {
    const session = await realStartSession();
    session.startTransaction = () => {};
    session.commitTransaction = async () => {};
    session.abortTransaction = async () => {};
    session.inTransaction = () => false;
    return session;
  };

  Job = require(path.join(ROOT, 'models/Job'));
  AccountingEntry = require(path.join(ROOT, 'models/AccountingEntry'));
  InventoryLot = require(path.join(ROOT, 'models/InventoryLot'));
  const accountingService = require(path.join(ROOT, 'services/accountingService'));

  const reg = await request(app).post('/api/auth/register').send({
    name: 'Job Partial Auditor', email: `job-partial-${Date.now()}@test.com`,
    password: 'TestPass123!', companyName: 'JOB PARTIAL TEST CORP',
  });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  tok = reg.body.token;

  const me = unwrap(await request(app).get('/api/auth/me').set(auth(tok)));
  companyId = me.companyId || me.user?.companyId;
  await accountingService.seedSystemLedgers(companyId);

  workerId = unwrap(await request(app).post('/api/parties').set(auth(tok))
    .send({ name: 'Job Worker Alpha', type: 'Job Worker' }))._id;
  itemId = unwrap(await request(app).post('/api/items').set(auth(tok))
    .send({ name: 'Grey Cotton Partial', category: 'Grey', gstRate: 5, unit: 'MTRS' }))._id;
});

after(async () => {
  mongoose.connection.removeAllListeners('disconnected');
  try { await mongoose.connection.close(); } catch (_) {}
  try { await mongoServer.stop(); } catch (_) {}
});

function auth(t) { return { Authorization: `Bearer ${t}` }; }
function unwrap(res) {
  if (res.body?.success === false) throw new Error(`API ${res.status}: ${res.body.message || JSON.stringify(res.body)}`);
  return res.body.data !== undefined ? res.body.data : res.body;
}

/** A fresh grey lot to issue from, via a real Purchase (mirrors fullBusinessFlow.test.js). */
let purchaseSeq = 0;
async function mkGreyLot(mts) {
  const res = await request(app).post('/api/purchases').set(auth(tok)).send({
    supplierId: workerId, // any party id is fine here — not under test
    invoiceNo: `JP-PUR-${Date.now()}-${purchaseSeq++}`,
    date: new Date('2026-07-01').toISOString(),
    gstType: 'CGST+SGST',
    items: [{ itemId, mts, pcs: 0, rate: 50, amount: mts * 50 }],
    taxableAmount: mts * 50, netAmount: Math.round(mts * 50 * 1.05),
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const lots = unwrap(await request(app).get(`/api/inventory/lots?itemId=${itemId}`).set(auth(tok)));
  // Pick the freshest untouched lot (highest remaining stock) rather than assuming sort
  // order — earlier tests' lots may already be partially/fully consumed.
  const freshest = lots.reduce((a, b) => (Number(b.remainingMtrs) > Number(a.remainingMtrs) ? b : a));
  return freshest._id;
}

async function issueJob(lotId, issueQty, issuePcs = 0) {
  const res = await request(app).post('/api/jobs/issue').set(auth(tok)).send({
    workerId, lotId, issueQty, issuePcs, processType: 'Dyeing', jobRate: 10,
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return unwrap(res)._id;
}

describe('Job Work partial receive', () => {
  it('a partial receive leaves the job Partial with the correct pending balance, not closed', async () => {
    const lotId = await mkGreyLot(100);
    const jobId = await issueJob(lotId, 100, 2);

    const res = await request(app).post('/api/jobs/receive').set(auth(tok)).send({
      jobId, receivedQty: 50, receivedPcs: 1, charges: 500, gstAmount: 25, isFinal: false,
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const data = unwrap(res);
    assert.equal(data.job.status, 'Partial');
    assert.equal(Number(data.job.receivedQty), 50);
    assert.equal(data.pendingQty, 50);

    const job = await Job.findById(jobId);
    assert.equal(job.status, 'Partial');
    assert.equal(job.pendingQty, 50, 'virtual pendingQty reflects the balance');
    assert.equal(job.pendingPcs, 1);

    // Physical stock already available even though the job isn't closed.
    const finishedLot = await InventoryLot.findById(job.finishedLotId);
    assert.ok(finishedLot, 'finished lot created on the first tranche');
    assert.equal(Number(finishedLot.totalMtrs), 50);
    assert.equal(Number(finishedLot.remainingMtrs), 50);

    // Charges posted for this tranche, but stock VALUATION (WIP->Stock) deferred to
    // closure — accountingService.onJobReceiveStockPost values off the full issueQty,
    // so firing it now (before the job is done) would be wrong.
    const chargeEntries = await AccountingEntry.find({ companyId, refId: job._id, refType: 'JobWorkCharges' });
    assert.equal(chargeEntries.length, 1, 'this tranche\'s charges posted once');
    const stockEntries = await AccountingEntry.find({ companyId, refId: job._id, refType: 'JobReceive' });
    assert.equal(stockEntries.length, 0, 'no stock-valuation entry yet — job is not closed');
  });

  it('re-opening Receive for that same job pre-fills (via pendingQty) the remaining balance, and a second, final tranche closes it', async () => {
    const lotId = await mkGreyLot(100);
    const jobId = await issueJob(lotId, 100, 2);

    await request(app).post('/api/jobs/receive').set(auth(tok))
      .send({ jobId, receivedQty: 50, receivedPcs: 1, charges: 500, gstAmount: 25, isFinal: false });

    // Simulates re-opening the Receive screen: GET /api/jobs and read the SAME job's
    // pendingQty/pendingPcs — this is exactly what ReceiveModal.jsx now pre-fills from.
    const jobsList = unwrap(await request(app).get('/api/jobs').set(auth(tok)));
    const reopened = jobsList.find((j) => String(j._id) === String(jobId));
    assert.ok(reopened, 'partially-received job still appears in the job list (not hidden as fully Received)');
    assert.equal(reopened.pendingQty, 50, 'pending balance auto-calculated for the next Receive, not the original 100');
    assert.equal(reopened.pendingPcs, 1);

    const finalRes = await request(app).post('/api/jobs/receive').set(auth(tok)).send({
      jobId, receivedQty: 50, receivedPcs: 1, charges: 500, gstAmount: 25, isFinal: true,
    });
    assert.equal(finalRes.status, 201, JSON.stringify(finalRes.body));
    const finalData = unwrap(finalRes);
    assert.equal(finalData.job.status, 'Received');
    assert.equal(Number(finalData.job.receivedQty), 100);
    assert.equal(finalData.pendingQty, 0);

    const job = await Job.findById(jobId);
    assert.equal(job.status, 'Received');
    assert.equal(job.pendingQty, 0);
    assert.equal(Number(job.wastage), 0, 'fully received — no wastage');

    // Same finished lot GREW across both tranches — not a second, fragmented lot.
    const finishedLot = await InventoryLot.findById(job.finishedLotId);
    assert.equal(Number(finishedLot.totalMtrs), 100);
    assert.equal(Number(finishedLot.remainingMtrs), 100);

    // Charges: one entry per tranche (two total). Stock valuation: exactly ONE entry,
    // posted only now, at closure.
    const chargeEntries = await AccountingEntry.find({ companyId, refId: job._id, refType: 'JobWorkCharges' });
    assert.equal(chargeEntries.length, 2, 'one charges entry per tranche');
    const stockEntries = await AccountingEntry.find({ companyId, refId: job._id, refType: 'JobReceive' });
    assert.equal(stockEntries.length, 1, 'stock valuation posts exactly once, at final closure');

    const dr = stockEntries[0].lines.filter((l) => l.type === 'Dr').reduce((s, l) => s + Number(l.amount), 0);
    const cr = stockEntries[0].lines.filter((l) => l.type === 'Cr').reduce((s, l) => s + Number(l.amount), 0);
    assert.ok(Math.abs(dr - cr) < 0.01, 'stock valuation entry is balanced');
  });

  it('a normal single-shot full receive (no isFinal sent) behaves exactly as before — full backward compatibility', async () => {
    const lotId = await mkGreyLot(30);
    const jobId = await issueJob(lotId, 30, 0);

    const res = await request(app).post('/api/jobs/receive').set(auth(tok)).send({
      jobId, receivedQty: 28, receivedPcs: 0, charges: 500, gstAmount: 50,
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const job = await Job.findById(jobId);
    assert.equal(job.status, 'Received', 'omitting isFinal defaults to a final/complete receive, like before');
    assert.ok(Math.abs(Number(job.wastage) - 2) < 0.01, 'shortfall books as wastage exactly like the old single-shot design');
  });

  it('over-receiving beyond the pending balance is rejected (error message unchanged for existing callers)', async () => {
    const lotId = await mkGreyLot(30);
    const jobId = await issueJob(lotId, 30, 0);

    const res = await request(app).post('/api/jobs/receive').set(auth(tok)).send({
      jobId, receivedQty: 35, receivedPcs: 0, charges: 500, gstAmount: 50,
    });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /cannot exceed/i);
  });

  it('receiving against an already-Received job is rejected', async () => {
    const lotId = await mkGreyLot(20);
    const jobId = await issueJob(lotId, 20, 0);
    await request(app).post('/api/jobs/receive').set(auth(tok))
      .send({ jobId, receivedQty: 20, receivedPcs: 0, charges: 0, gstAmount: 0 });

    const res = await request(app).post('/api/jobs/receive').set(auth(tok))
      .send({ jobId, receivedQty: 5, receivedPcs: 0, charges: 0, gstAmount: 0 });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /already been fully received/i);
  });

  it('reverse-receive resets a fully-received job back to Issued with zeroed totals, ready to receive again from scratch', async () => {
    const lotId = await mkGreyLot(40);
    const jobId = await issueJob(lotId, 40, 0);
    await request(app).post('/api/jobs/receive').set(auth(tok))
      .send({ jobId, receivedQty: 38, receivedPcs: 0, charges: 200, gstAmount: 10 });

    const revRes = await request(app).put('/api/jobs/reverse-receive').set(auth(tok)).send({ jobId });
    assert.equal(revRes.status, 200, JSON.stringify(revRes.body));

    const job = await Job.findById(jobId);
    assert.equal(job.status, 'Issued');
    assert.equal(Number(job.receivedQty), 0);
    assert.equal(Number(job.receivedPcs), 0);
    assert.equal(Number(job.processCharges), 0);
    assert.equal(job.finishedLotId, null);
    assert.equal(job.pendingQty, 40, 'back to the full issued amount, ready for a fresh receive');

    // A fresh receive after reversal must not add onto stale pre-reversal totals.
    const freshRes = await request(app).post('/api/jobs/receive').set(auth(tok))
      .send({ jobId, receivedQty: 15, receivedPcs: 0, charges: 100, gstAmount: 5, isFinal: false });
    assert.equal(freshRes.status, 201, JSON.stringify(freshRes.body));
    assert.equal(Number(unwrap(freshRes).job.receivedQty), 15, 'accumulation restarted from zero, not from the reversed 38');
  });

  it('reverse-receive also works on a Partial (not-yet-fully-received) job', async () => {
    const lotId = await mkGreyLot(60);
    const jobId = await issueJob(lotId, 60, 0);
    await request(app).post('/api/jobs/receive').set(auth(tok))
      .send({ jobId, receivedQty: 20, receivedPcs: 0, charges: 0, gstAmount: 0, isFinal: false });

    let job = await Job.findById(jobId);
    assert.equal(job.status, 'Partial');

    const revRes = await request(app).put('/api/jobs/reverse-receive').set(auth(tok)).send({ jobId });
    assert.equal(revRes.status, 200, JSON.stringify(revRes.body));

    job = await Job.findById(jobId);
    assert.equal(job.status, 'Issued');
    assert.equal(Number(job.receivedQty), 0);
    assert.equal(job.pendingQty, 60);
  });
});
