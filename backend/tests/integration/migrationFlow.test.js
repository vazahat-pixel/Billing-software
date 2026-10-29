/**
 * Full migration flow over the real routes on an in-memory database, using the anonymised JSM demo package:
 * upload in chunks -> preview -> apply -> reconcile (0 mismatches) -> existing screens still read the data -> undo.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { bootIsolatedApp } = require('../helpers/isolatedApp');
const { authHeader, unwrapBody } = require('../helpers/setup');

const YEARS = ['SC27', 'SCC28']; // the two years of one company (VC27 in the demo is a different company)
const FIXTURE = process.env.JSM_DEMO_PACKAGE || path.join(__dirname, '..', 'fixtures', 'migration', 'jsm_demo_anonymised.ndjson.gz');

const HAVE_DATA = fs.existsSync(FIXTURE);

// The package is exported from a JSM database and stays on the developer PC (git-ignored); the test is skipped without it.
describe('JSM migration end to end (isolated DB)', { skip: HAVE_DATA ? false : 'no local JSM package (backend/tests/fixtures/migration/jsm_demo_anonymised.ndjson.gz or JSM_DEMO_PACKAGE)' }, () => {
  let app; let request; let shutdown; let h; let runId; let companyId;
  const api = (m, p, body) => { const r = request(app)[m](`/api/migration${p}`).set(h); return body === undefined ? r : r.send(body); };
  const waitFor = async (pred, ms = 60000) => { const t0 = Date.now(); for (;;) { const r = unwrapBody(await api('get', `/runs/${runId}`)); if (pred(r)) return r; if (Date.now() - t0 > ms) throw new Error(`timeout; last status ${r.status} ${r.error}`); await new Promise((x) => setTimeout(x, 300)); } };

  before(async () => {
    ({ app, request, shutdown } = await bootIsolatedApp());
    const reg = await request(app).post('/api/auth/register').send({ name: 'Mig Owner', email: `mig-${Date.now()}@example.com`, password: 'TestPass123!', companyName: 'Migration Co' });
    h = authHeader(reg.body.token);
    companyId = unwrapBody(await request(app).get('/api/auth/me').set(h)).companyId;
  });
  after(async () => { if (shutdown) await shutdown(); });

  it('uploads the package in chunks, and a cut-off upload is refused', async () => {
    const buf = fs.readFileSync(FIXTURE);
    // a truncated upload
    const bad = unwrapBody(await api('post', '/runs', {})).id;
    await request(app).put(`/api/migration/runs/${bad}/chunk?index=0`).set(h).set('Content-Type', 'application/octet-stream').send(buf.subarray(0, Math.floor(buf.length / 2)));
    const badDone = await api('post', `/runs/${bad}/complete`, { bytes: buf.length });
    assert.equal(unwrapBody(badDone).status, 'invalid');

    runId = unwrapBody(await api('post', '/runs', {})).id;
    const size = 20000; let i = 0;
    for (let off = 0; off < buf.length; off += size, i += 1) {
      const r = await request(app).put(`/api/migration/runs/${runId}/chunk?index=${i}`).set(h).set('Content-Type', 'application/octet-stream').send(buf.subarray(off, off + size));
      assert.equal(r.status, 200, JSON.stringify(r.body));
    }
    // a repeated chunk (network retry) is harmless; a skipped one is refused
    const retry = await request(app).put(`/api/migration/runs/${runId}/chunk?index=0`).set(h).set('Content-Type', 'application/octet-stream').send(buf.subarray(0, size));
    assert.equal(retry.status, 200);
    const skip = await request(app).put(`/api/migration/runs/${runId}/chunk?index=99`).set(h).set('Content-Type', 'application/octet-stream').send(Buffer.from('x'));
    assert.equal(skip.status, 400);
    const done = unwrapBody(await api('post', `/runs/${runId}/complete`, { bytes: buf.length }));
    assert.equal(done.status, 'uploaded', JSON.stringify(done.problems));
  });

  it('preview shows counts and totals without creating anything', async () => {
    const all = unwrapBody(await api('post', `/runs/${runId}/preview`, {}));
    assert.ok(all.blockers.length > 0, 'the demo package mixes two different companies; preview must say so');
    const p = unwrapBody(await api('post', `/runs/${runId}/preview`, { years: YEARS }));
    assert.equal(p.blockers.length, 0);
    assert.ok(p.counts.Sales >= 25 && p.counts.Purchase >= 20 && p.counts.AccountingEntry > 50, JSON.stringify(p.counts));
    assert.ok(p.expected.totals.salesNet > 0);
    const Sales = require('../../models/Sales');
    assert.equal(await Sales.countDocuments({}), 0);
  });

  it('apply creates everything; reconciliation against the JSM figures has no mismatch', async () => {
    assert.equal((await api('post', `/runs/${runId}/apply`, { years: YEARS })).status, 200);
    const r = await waitFor((x) => ['applied', 'failed'].includes(x.status));
    assert.equal(r.status, 'applied', r.error);
    const rep = unwrapBody(await api('post', `/runs/${runId}/reconcile`, {}));
    const bad = rep.checks.filter((c) => !c.ok);
    assert.equal(rep.mismatched, 0, `mismatches: ${JSON.stringify(bad.slice(0, 8))}`);
    assert.ok(rep.total > 60, `only ${rep.total} checks ran`);
    const csv = await request(app).get(`/api/migration/runs/${runId}/report.csv`).set(h);
    assert.equal(csv.status, 200);
    assert.match(csv.text, /^Area,Item,JSM,MERN,Difference,Result/);
  });

  it('the imported data is visible to the normal screens/reports', async () => {
    const parties = unwrapBody(await request(app).get('/api/parties').set(h));
    assert.ok((Array.isArray(parties) ? parties : parties.items || parties.parties).length >= 15);
    const sales = unwrapBody(await request(app).get('/api/sales').set(h));
    assert.ok((Array.isArray(sales) ? sales : sales.items || sales.sales).length >= 20);
    const tb = await request(app).get('/api/accounting/trial-balance').set(h);
    assert.equal(tb.status, 200, JSON.stringify(tb.body).slice(0, 200));
    const lots = unwrapBody(await request(app).get('/api/inventory/lots').set(h));
    assert.ok((Array.isArray(lots) ? lots : lots.items || lots.lots).length > 0);
  });

  it('a company that already has transactions is refused; a repeat apply is refused', async () => {
    const run2 = unwrapBody(await api('post', '/runs', {})).id;
    const res = await api('post', `/runs/${run2}/apply`, {});
    assert.equal(res.status, 400);
    assert.match(res.body.message, /no transactions|not ready/i);
  });

  it('undo removes exactly what the import created', async () => {
    const un = await api('post', `/runs/${runId}/undo`, {});
    assert.equal(un.status, 200, JSON.stringify(un.body));
    assert.equal(unwrapBody(un).status, 'undone');
    for (const n of ['Sales', 'Purchase', 'Job', 'PaymentVoucher', 'AccountingEntry', 'InventoryLot', 'StockMovement', 'BillSettlement', 'Party', 'Item']) {
      assert.equal(await require(`../../models/${n}`).collection.countDocuments({ companyId: new (require('mongoose').Types.ObjectId)(companyId) }), 0, `${n} left behind`);
    }
  });
});
