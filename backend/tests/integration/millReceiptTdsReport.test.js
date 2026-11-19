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

describe('Mill receipt TDS reaches the TDS reports (real API)', () => {
  it('receive with TDS -> Head Wise / Party Wise / Certificate show it', async () => {
    const lotId = await mkGreyLot(100);
    const jobId = await issueJob(lotId, 100, 2);
    const res = await request(app).post('/api/jobs/receive').set(auth(tok)).send({
      jobId, receivedQty: 100, receivedPcs: 2, charges: 1000, gstAmount: 50, isFinal: true, billGpNo: 'MB-77',
      tdsBase: 1000, tdsPercent: 2, tdsAmount: 20,
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const job = await Job.findById(jobId);
    assert.equal(job.receiveTdsAmount, 20);

    const q = encodeURIComponent(JSON.stringify({ from: '2000-01-01', to: '2099-12-31', group: 'Month+TdsHead+Party', parties: [], heads: [], pers: [], accounts: [], mode: 'P' }));
    for (const form of ['Rpt_TdsReports', 'Rpt_Tds2_Prty_Mnth_Wise', 'Rpt_Tds5_Certi']) {
      const r = unwrap(await request(app).get('/api/reports/jsm/' + form + '?q=' + q).set(auth(tok)));
      assert.equal(r.rows.length, 1, form);
      assert.equal(Number(r.rows[0].TDS_AMT), 20, form);
      assert.equal(r.rows[0].PARTY, 'Job Worker Alpha', form);
    }
  });
});
