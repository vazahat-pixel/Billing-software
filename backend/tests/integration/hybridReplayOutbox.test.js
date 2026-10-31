/**
 * Desktop hybrid: entries whose logic lives in controllers (receipts, payments, journal, notes,
 * returns, bill edits/deletes) are queued as a REPLAY of the request, so the cloud later runs its
 * own controller and cannot calculate anything differently from the desktop.
 *
 * These tests cover the capture side (what gets queued, and what must NOT be) and the push side
 * (id rewriting, holding an entry back, exactly-once on retry) against a stub central API.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { startMemoryDb, stopMemoryDb } = require('../helpers/memoryDb');

const COMPANY = '64b000000000000000000001';
const USER = '64b000000000000000000002';

test.describe('hybrid replay outbox (isolated DB)', () => {
  let mongoose; let express; let server; let base; let SyncOutbox; let SyncIdMap;

  test.before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DESKTOP_LOCAL = 'true';
    process.env.DESKTOP_HYBRID = 'true';
    await startMemoryDb();
    mongoose = require('mongoose');
    express = require('express');
    SyncOutbox = require('../../models/SyncOutbox');
    SyncIdMap = require('../../models/SyncIdMap');

    const hybridReplayOutbox = require('../../middlewares/hybridReplayOutbox');

    // A stand-in for the local API: the middleware under test, then handlers that succeed or fail.
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = { companyId: COMPANY, _id: USER };
      next();
    });
    app.use(hybridReplayOutbox);
    app.post('/accounting/receipts', (req, res) => res.status(201).json({ success: true, data: { _id: 'aaaaaaaaaaaaaaaaaaaaaa77' } }));
    app.post('/accounting/payments', (req, res) => res.status(201).json({ success: true, data: { _id: 'p1' } }));
    app.post('/notes', (req, res) => res.status(201).json({ success: true, data: { _id: 'n1' } }));
    app.post('/returns', (req, res) => res.status(201).json({ success: true, data: { _id: 'rt1' } }));
    app.put('/sales/:id', (req, res) => res.json({ success: true, data: { _id: req.params.id } }));
    app.delete('/sales/:id', (req, res) => res.json({ success: true }));
    app.post('/sales', (req, res) => res.status(201).json({ success: true, data: { _id: 's1' } }));
    app.get('/sales', (_req, res) => res.json({ success: true, data: [] }));
    app.post('/accounting/journal', (req, res) => {
      if (req.body.bad) return res.status(400).json({ success: false, message: 'unbalanced' });
      return res.status(201).json({ success: true, data: { _id: 'j1' } });
    });

    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  test.after(async () => {
    await new Promise((r) => server.close(r));
    await stopMemoryDb();
    delete process.env.DESKTOP_HYBRID;
    delete process.env.DESKTOP_LOCAL;
  });

  test.beforeEach(async () => {
    await SyncOutbox.deleteMany({});
    await SyncIdMap.deleteMany({});
  });

  const call = async (method, path, body, headers = {}) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-device-id': 'dev-1', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    await res.json().catch(() => ({}));
    return res.status;
  };

  const replayRows = () => SyncOutbox.find({ entityType: 'rest' }).lean();

  /**
   * The middleware enqueues on the response's 'finish' event, i.e. just after the reply is sent, so
   * the row appears a moment after the fetch resolves. Poll for it rather than guessing a delay —
   * the very first request of the run is much slower while indexes are built.
   */
  const waitForRows = async (n, timeoutMs = 5000) => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const rows = await replayRows();
      if (rows.length >= n) return rows;
      if (Date.now() > deadline) return rows;
      await new Promise((r) => setTimeout(r, 25));
    }
  };

  /** For "nothing must be queued": give the finish handler a chance, then confirm it stayed empty. */
  const settle = () => new Promise((r) => setTimeout(r, 300));

  test.it('a receipt made offline is queued as a replay of its own request', async () => {
    const body = { partyId: '507f1f77bcf86cd799439011', amount: 5000, mode: 'Cash' };
    assert.equal(await call('POST', '/accounting/receipts', body), 201);

    const rows = await waitForRows(1);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].operationType, 'replay');
    assert.equal(rows[0].payload.method, 'POST');
    assert.equal(rows[0].payload.path, '/accounting/receipts');
    assert.deepEqual(rows[0].payload.body, body, 'the body is kept exactly as the user entered it');
    assert.equal(rows[0].status, 'PENDING');
    assert.equal(rows[0].entityId, 'aaaaaaaaaaaaaaaaaaaaaa77', 'the new receipt id is kept so a later edit can be mapped');
  });

  test.it('payments, journal, notes and returns are all queued', async () => {
    await call('POST', '/accounting/payments', { amount: 1 });
    await call('POST', '/accounting/journal', { lines: [] });
    await call('POST', '/notes', { type: 'Credit' });
    await call('POST', '/returns', { billId: '507f1f77bcf86cd799439011' });

    const paths = (await waitForRows(4)).map((r) => r.payload.path).sort();
    assert.deepEqual(paths, ['/accounting/journal', '/accounting/payments', '/notes', '/returns']);
  });

  test.it('editing and deleting a bill are queued — the typed outbox only carries creates', async () => {
    const id = '507f1f77bcf86cd799439011';
    await call('PUT', `/sales/${id}`, { netAmount: 999 });
    await call('DELETE', `/sales/${id}`);

    const rows = await waitForRows(2);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((r) => r.payload.method).sort(), ['DELETE', 'PUT']);
    assert.ok(rows.every((r) => r.payload.path === `/sales/${id}`));
  });

  test.it('creating a sale is NOT queued here — salesService already enqueues it', async () => {
    assert.equal(await call('POST', '/sales', { invoiceNo: '1' }), 201);
    await settle();
    assert.deepEqual(await replayRows(), [], 'a second row would apply the bill twice on the cloud');
  });

  test.it('reads are never queued', async () => {
    await call('GET', '/sales');
    await settle();
    assert.deepEqual(await replayRows(), []);
  });

  test.it('a request the local API rejected is never queued', async () => {
    assert.equal(await call('POST', '/accounting/journal', { bad: true }), 400);
    await settle();
    assert.deepEqual(await replayRows(), [], 'replaying a rejected entry would create it on the cloud only');
  });

  test.it('an entry pushed down by sync is not queued back up', async () => {
    await call('POST', '/accounting/receipts', { amount: 1 }, { 'x-from-sync': 'true' });
    await settle();
    assert.deepEqual(await replayRows(), []);
  });
});

test.describe('pushing replays to the cloud', () => {
  let mongoose; let server; let base; let received; let SyncOutbox; let SyncIdMap; let worker;

  const LOCAL_PARTY = 'aaaaaaaaaaaaaaaaaaaaaaa1';
  const CLOUD_PARTY = 'bbbbbbbbbbbbbbbbbbbbbbb1';

  test.before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DESKTOP_LOCAL = 'true';
    process.env.DESKTOP_HYBRID = 'true';
    await startMemoryDb();
    mongoose = require('mongoose');
    const express = require('express');
    SyncOutbox = require('../../models/SyncOutbox');
    SyncIdMap = require('../../models/SyncIdMap');

    received = [];
    const app = express();
    app.use(express.json());
    app.all('*', (req, res) => {
      received.push({
        method: req.method,
        path: req.path,
        body: req.body,
        idempotencyKey: req.headers['idempotency-key'] || null,
      });
      res.json({ success: true, data: { _id: 'cloud-made-id' } });
    });
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));
    base = `http://127.0.0.1:${server.address().port}`;
    process.env.CENTRAL_API_BASE_URL = base;

    worker = require('../../services/syncAgentWorker');
    await worker.setAgentContext({ companyId: COMPANY, token: 'tok', deviceId: 'dev-1' });
  });

  test.after(async () => {
    await new Promise((r) => server.close(r));
    await stopMemoryDb();
    delete process.env.CENTRAL_API_BASE_URL;
    delete process.env.DESKTOP_HYBRID;
    delete process.env.DESKTOP_LOCAL;
  });

  test.beforeEach(async () => {
    received.length = 0;
    await SyncOutbox.deleteMany({});
    await SyncIdMap.deleteMany({});
  });

  const queueReplay = (operationId, payload, entityId = '') =>
    SyncOutbox.create({
      operationId, companyId: COMPANY, entityType: 'rest', entityId,
      operationType: 'replay', payload, sequenceNumber: 1, status: 'PENDING',
    });

  // tick() also renews the number lease and pulls changes, so look at the replay call only.
  const receiptCalls = () => received.filter((r) => r.path === '/accounting/receipts');

  test.it('replays the request at its own endpoint, with an idempotency key', async () => {
    await queueReplay('op-1', { method: 'POST', path: '/accounting/receipts', body: { amount: 500 } });
    await worker.tick();

    const calls = receiptCalls();
    assert.equal(calls.length, 1, 'sent exactly once');
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].body.amount, 500);
    assert.equal(calls[0].idempotencyKey, 'op-1', 'so a lost reply cannot post it twice');

    const row = await SyncOutbox.findOne({ operationId: 'op-1' }).lean();
    assert.equal(row.status, 'SYNCED');
  });

  test.it('a second tick does not send an entry that already synced', async () => {
    await queueReplay('op-1b', { method: 'POST', path: '/accounting/receipts', body: { amount: 500 } });
    await worker.tick();
    await worker.tick();
    assert.equal(receiptCalls().length, 1, 'a synced row is not picked up again');
  });

  test.it('rewrites a local id to the id the cloud gave that document', async () => {
    await SyncIdMap.create({ companyId: COMPANY, entityType: 'party', localId: LOCAL_PARTY, serverId: CLOUD_PARTY });
    await queueReplay('op-2', {
      method: 'POST', path: '/accounting/receipts', body: { partyId: LOCAL_PARTY, amount: 100 },
    });
    await worker.tick();

    const calls = receiptCalls();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.partyId, CLOUD_PARTY, 'the cloud has never seen the local id');
  });

  test.it('holds an entry back while the document it points at is still unsynced', async () => {
    // A pending create for the party: its id is not on the cloud yet.
    await SyncOutbox.create({
      operationId: 'op-party', companyId: COMPANY, entityType: 'party', entityId: LOCAL_PARTY,
      operationType: 'create', payload: { name: 'NEW PARTY' }, sequenceNumber: 1, status: 'PENDING',
    });
    await queueReplay('op-3', {
      method: 'POST', path: '/accounting/receipts', body: { partyId: LOCAL_PARTY, amount: 100 },
    }, 'receipt-local-1');

    await worker.tick();

    const receipt = received.find((r) => r.path === '/accounting/receipts');
    assert.equal(receipt, undefined, 'the receipt must not be sent before its party exists on the cloud');

    const row = await SyncOutbox.findOne({ operationId: 'op-3' }).lean();
    assert.equal(row.errorCode, 'WAITING');
    assert.match(row.errorMessage, /waiting for/);
    assert.notEqual(row.status, 'SYNCED', 'and it is kept, not dropped');
  });

  test.it('a receipt made offline and then edited offline: the edit goes to the cloud id', async () => {
    const LOCAL_RECEIPT = 'aaaaaaaaaaaaaaaaaaaaaa55';
    await SyncOutbox.create({
      operationId: 'op-r-create', companyId: COMPANY, entityType: 'rest', entityId: LOCAL_RECEIPT,
      operationType: 'replay', sequenceNumber: 10, status: 'PENDING',
      payload: { method: 'POST', path: '/accounting/receipts', body: { amount: 100 } },
    });
    await SyncOutbox.create({
      operationId: 'op-r-edit', companyId: COMPANY, entityType: 'rest', entityId: '',
      operationType: 'replay', sequenceNumber: 11, status: 'PENDING',
      payload: { method: 'PUT', path: `/accounting/payments/${LOCAL_RECEIPT}`, body: { amount: 150 } },
    });

    await worker.tick();

    const edit = received.find((r) => r.method === 'PUT');
    assert.ok(edit, 'the edit was sent in the same round, right after the create');
    assert.equal(edit.path, '/accounting/payments/cloud-made-id', 'local receipt id rewritten to the cloud one');
    assert.equal(edit.body.amount, 150);

    const map = await SyncIdMap.findOne({ localId: LOCAL_RECEIPT }).lean();
    assert.equal(map.serverId, 'cloud-made-id');
  });

  test.it('a DELETE is replayed with no body', async () => {
    await queueReplay('op-4', { method: 'DELETE', path: '/sales/507f1f77bcf86cd799439011' });
    await worker.tick();

    const del = received.find((r) => r.method === 'DELETE');
    assert.ok(del, 'the delete reached the cloud');
    assert.deepEqual(del.body, {});
  });
});
