/**
 * Offline sync safety, against an ISOLATED in-memory MongoDB (never the configured cluster):
 *  - Idempotency-Key: a retried write (lost reply) is applied once and replays the first reply
 *  - offline renumber: an offline bill whose number the cloud already used takes the next number
 */
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { startMemoryDb, stopMemoryDb } = require('../helpers/memoryDb');

test.describe('Offline sync (isolated DB)', () => {
  let mongoose; let express; let server; let base; let Thing;
  const companyId = '64b000000000000000000001';

  test.before(async () => {
    await startMemoryDb();
    mongoose = require('mongoose');
    express = require('express');
    const idempotency = require('../../middlewares/idempotency.middleware');
    await require('../../models/IdempotencyRecord').init();
    Thing = mongoose.models.OfflineSyncThing
      || mongoose.model('OfflineSyncThing', new mongoose.Schema({ companyId: String, n: Number }));

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.companyId = req.headers['x-test-company'] || companyId; next(); });
    app.use(idempotency);
    app.post('/things', async (req, res) => {
      if (req.body.fail) return res.status(400).json({ success: false, message: 'bad' });
      if (req.body.slowMs) await new Promise((r) => setTimeout(r, req.body.slowMs));
      const t = await Thing.create({ companyId: req.companyId, n: req.body.n });
      return res.status(201).json({ success: true, data: { _id: t._id, n: t.n } });
    });
    app.put('/things', (_req, res) => res.json({ success: true }));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  test.after(async () => {
    await new Promise((r) => server.close(r));
    await stopMemoryDb();
  });

  const call = async (method, body, headers = {}) => {
    const res = await fetch(`${base}/things`, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json(), replay: res.headers.get('idempotent-replay') };
  };
  const settle = () => new Promise((r) => setTimeout(r, 50)); // reply is stored asynchronously

  test.it('same key twice: one write, second gets the first reply', async () => {
    const a = await call('POST', { n: 1 }, { 'idempotency-key': 'k-1' });
    await settle();
    const b = await call('POST', { n: 1 }, { 'idempotency-key': 'k-1' });
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    assert.equal(b.replay, 'true');
    assert.equal(String(b.body.data._id), String(a.body.data._id));
    assert.equal(await Thing.countDocuments({ n: 1 }), 1);
  });

  test.it('no key: every request writes (unchanged behaviour)', async () => {
    await call('POST', { n: 2 });
    await call('POST', { n: 2 });
    assert.equal(await Thing.countDocuments({ n: 2 }), 2);
  });

  test.it('failed write frees the key so the retry can succeed', async () => {
    const a = await call('POST', { n: 3, fail: true }, { 'idempotency-key': 'k-3' });
    await settle();
    const b = await call('POST', { n: 3 }, { 'idempotency-key': 'k-3' });
    assert.equal(a.status, 400);
    assert.equal(b.status, 201);
    assert.equal(await Thing.countDocuments({ n: 3 }), 1);
  });

  test.it('retry while the first is still saving gets 409, never a second write', async () => {
    const first = call('POST', { n: 4, slowMs: 300 }, { 'idempotency-key': 'k-4' });
    await new Promise((r) => setTimeout(r, 60));
    const second = await call('POST', { n: 4 }, { 'idempotency-key': 'k-4' });
    assert.equal(second.status, 409);
    assert.equal(second.body.code, 'IDEMPOTENCY_IN_PROGRESS');
    assert.equal((await first).status, 201);
    assert.equal(await Thing.countDocuments({ n: 4 }), 1);
  });

  test.it('key reused for a different request is rejected', async () => {
    await call('POST', { n: 5 }, { 'idempotency-key': 'k-5' });
    await settle();
    const other = await call('PUT', {}, { 'idempotency-key': 'k-5' });
    assert.equal(other.status, 422);
  });

  test.it('keys are per company: same key in another company is a new write', async () => {
    await call('POST', { n: 6 }, { 'idempotency-key': 'k-6' });
    await settle();
    const other = await call('POST', { n: 6 }, { 'idempotency-key': 'k-6', 'x-test-company': '64b000000000000000000002' });
    assert.equal(other.status, 201);
    assert.equal(other.replay, null);
    assert.equal(await Thing.countDocuments({ n: 6 }), 2);
  });

  test.describe('offline renumber', () => {
    let Purchase; let Job; let reserveNumber; let renumberIfTaken;
    const cid = () => new mongoose.Types.ObjectId(companyId);
    const fakeRes = () => { const h = {}; return { headers: h, set: (k, v) => { h[k] = v; } }; };
    const req = (body, offline = true) => ({ companyId: cid(), body, headers: offline ? { 'x-offline-sync': '1' } : {} });

    test.before(async () => {
      Purchase = require('../../models/Purchase');
      Job = require('../../models/Job');
      ({ reserveNumber } = require('../../services/voucherSeriesService'));
      ({ renumberIfTaken } = require('../../utils/offlineRenumber'));
      // Cloud already has purchase 6 (made online) and challan 12.
      await Purchase.collection.insertOne({ companyId: cid(), invoiceNo: '6' });
      await Job.collection.insertOne({ companyId: cid(), jobCardNo: '12', challanNo: '12' });
      await reserveNumber(cid(), 'purchase', '6');
    });

    test.it('offline purchase 6 when cloud has 6 -> AUTO, next number is 7', async () => {
      const r = req({ invoiceNo: '6' }); const res = fakeRes();
      const from = await renumberIfTaken(r, res, { Model: Purchase, field: 'invoiceNo' });
      assert.equal(from, '6');
      assert.equal(r.body.invoiceNo, 'AUTO');
      assert.equal(res.headers['X-Renumbered-From'], '6');
      assert.equal(await reserveNumber(cid(), 'purchase', r.body.invoiceNo), '7');
    });

    test.it('free number is kept', async () => {
      const r = req({ invoiceNo: '9' });
      assert.equal(await renumberIfTaken(r, fakeRes(), { Model: Purchase, field: 'invoiceNo' }), null);
      assert.equal(r.body.invoiceNo, '9');
    });

    test.it('normal online save is never renumbered', async () => {
      const r = req({ invoiceNo: '6' }, false);
      assert.equal(await renumberIfTaken(r, fakeRes(), { Model: Purchase, field: 'invoiceNo' }), null);
      assert.equal(r.body.invoiceNo, '6');
    });

    test.it('offline placeholder numbers become the next real number', async () => {
      const r = req({ invoiceNo: 'OFF-PUR-1761300000000' });
      await renumberIfTaken(r, fakeRes(), { Model: Purchase, field: 'invoiceNo' });
      assert.equal(r.body.invoiceNo, 'AUTO');
    });

    test.it('job challan clash checks challanNo too and lets the series pick', async () => {
      const r = req({ jobCardNo: '12', challanNo: '12' });
      await renumberIfTaken(r, fakeRes(), { Model: Job, field: 'jobCardNo', alsoCheck: ['challanNo'], clear: ['challanNo'] });
      assert.equal(r.body.jobCardNo, 'AUTO');
      assert.equal(r.body.challanNo, undefined);
    });
  });
});
