/**
 * Two JSM accounts with the same GSTIN (one firm with two accounts): the import must not stop on the
 * one-GSTIN-per-company rule. Bills of both go under one party, each account keeps its own ledger, report has 0 mismatches.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const mongoose = require('mongoose');
const { bootIsolatedApp } = require('../helpers/isolatedApp');
const { authHeader, unwrapBody } = require('../helpers/setup');

const YEARS = ['SC27', 'SCC28'];
const FIXTURE = process.env.JSM_DEMO_PACKAGE || path.join(__dirname, '..', 'fixtures', 'migration', 'jsm_demo_anonymised.ndjson.gz');
const GSTIN = '27AFAPJ1646J1ZJ';

/** The demo package with two different sales customers given the same GSTIN. */
function packageWithSharedGstin() {
  const lines = zlib.gunzipSync(fs.readFileSync(FIXTURE)).toString('utf8').split('\n');
  const rows = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } });
  const customers = [...new Set(rows.filter((x) => x && x._ === 'row' && x.t === 'T_SALES' && YEARS.includes(String(x.r.CO_PATH).trim())).map((x) => String(x.r.AC_CODE).trim()))].slice(0, 2);
  const out = lines.map((l, i) => {
    const x = rows[i];
    if (!x || x._ !== 'row' || x.t !== 'MST_AC_MAST' || !customers.includes(String(x.r.AC_CODE).trim())) return l;
    return JSON.stringify({ ...x, r: { ...x.r, GST_NO: GSTIN, NW_GST_NO: GSTIN } });
  });
  return { buf: zlib.gzipSync(Buffer.from(out.join('\n'))), customers };
}

describe('JSM import: two accounts with the same GSTIN (isolated DB)', { skip: fs.existsSync(FIXTURE) ? false : 'no local JSM package' }, () => {
  let app; let request; let shutdown; let h; let companyId;
  const api = (m, p, body) => { const r = request(app)[m](`/api/migration${p}`).set(h); return body === undefined ? r : r.send(body); };

  before(async () => {
    ({ app, request, shutdown } = await bootIsolatedApp());
    const reg = await request(app).post('/api/auth/register').send({ name: 'Gst Owner', email: `gst-${Date.now()}@example.com`, password: 'TestPass123!', companyName: 'Gstin Co' });
    h = authHeader(reg.body.token);
    companyId = unwrapBody(await request(app).get('/api/auth/me').set(h)).companyId;
  });
  after(async () => { if (shutdown) await shutdown(); });

  it('imports, with one party for the shared GSTIN, two ledgers, and 0 mismatches', async () => {
    const { buf, customers } = packageWithSharedGstin();
    assert.equal(customers.length, 2);
    const runId = unwrapBody(await api('post', '/runs', {})).id;
    await request(app).put(`/api/migration/runs/${runId}/chunk?index=0`).set(h).set('Content-Type', 'application/octet-stream').send(buf);
    assert.equal(unwrapBody(await api('post', `/runs/${runId}/complete`, { bytes: buf.length })).status, 'uploaded');
    assert.equal((await api('post', `/runs/${runId}/apply`, { years: YEARS })).status, 200);
    let r;
    for (let i = 0; i < 200; i += 1) { r = unwrapBody(await api('get', `/runs/${runId}`)); if (['applied', 'failed'].includes(r.status)) break; await new Promise((x) => setTimeout(x, 300)); }
    assert.equal(r.status, 'applied', r.error);

    const { companyId: cid } = await require('../../models/MigrationRun').MigrationRun.findById(runId).lean();
    const parties = await require('../../models/Party').collection.find({ companyId: cid, gstin: GSTIN }).toArray();
    const allG = await require('../../models/Party').collection.find({ companyId: cid }, { projection: { name: 1, gstin: 1, accd: 1 } }).toArray();
    assert.equal(parties.length, 1, `one party for the GSTIN: ${JSON.stringify(allG.filter((p) => p.gstin || customers.includes(String(p.accd))))} total ${allG.length}`);
    const ledgers = await require('../../models/LedgerMaster').collection.find({ companyId: cid, code: { $in: customers } }).toArray();
    assert.equal(ledgers.length, 2, 'each JSM account keeps its own ledger');
    assert.ok(ledgers.every((l) => String(l.linkedPartyId) === String(parties[0]._id)));

    const rep = unwrapBody(await api('post', `/runs/${runId}/reconcile`, {}));
    assert.equal(rep.mismatched, 0, JSON.stringify(rep.checks.filter((c) => !c.ok).slice(0, 6)));
    assert.ok(rep.warnings.some((w) => String(w.message || w).includes(GSTIN)), 'the shared GSTIN is reported');
  });

  it('parties left behind by an earlier failed attempt do not stop the import', async () => {
    const reg = await request(app).post('/api/auth/register').send({ name: 'Left Owner', email: `left-${Date.now()}@example.com`, password: 'TestPass123!', companyName: 'Leftover Co' });
    const h2 = authHeader(reg.body.token);
    const api2 = (m, pth, body) => { const r = request(app)[m](`/api/migration${pth}`).set(h2); return body === undefined ? r : r.send(body); };
    const buf = fs.readFileSync(FIXTURE);
    const runId = unwrapBody(await api2('post', '/runs', {})).id;
    const { MigrationRun } = require('../../models/MigrationRun');
    const cid = (await MigrationRun.findById(runId).lean()).companyId;
    // what an earlier attempt left: a party with a JSM code but another name, and a same-name party with another code
    const { loadPackage } = require('../../services/migration/packageReader');
    const { buildPlan } = require('../../services/migration/jsmMapper');
    const pkg = await loadPackage(FIXTURE);
    const keep = (rows) => rows.filter((r) => !r.CO_PATH || YEARS.includes(String(r.CO_PATH).trim()));
    const tables = Object.fromEntries(Object.entries(pkg.tables).map(([k, v]) => [k, keep(v)]));
    const [a, b] = buildPlan(tables, { companyId: cid }).docs.Party.filter((x) => x.accd > 0);
    const Party = require('../../models/Party').collection;
    await Party.insertMany([{ companyId: cid, name: 'LEFT FROM EARLIER', accd: a.accd, isDeleted: false }, { companyId: cid, name: b.name, accd: 99999, isDeleted: false }]);

    await request(app).put(`/api/migration/runs/${runId}/chunk?index=0`).set(h2).set('Content-Type', 'application/octet-stream').send(buf);
    assert.equal(unwrapBody(await api2('post', `/runs/${runId}/complete`, { bytes: buf.length })).status, 'uploaded');
    assert.equal((await api2('post', `/runs/${runId}/apply`, { years: YEARS })).status, 200);
    let r;
    for (let i = 0; i < 200; i += 1) { r = unwrapBody(await api2('get', `/runs/${runId}`)); if (['applied', 'failed'].includes(r.status)) break; await new Promise((x) => setTimeout(x, 300)); }
    assert.equal(r.status, 'applied', r.error);
    assert.equal(await Party.countDocuments({ companyId: cid, accd: a.accd }), 1, 'the party with that JSM code is reused');
    const rep = unwrapBody(await api2('post', `/runs/${runId}/reconcile`, {}));
    assert.equal(rep.mismatched, 0, JSON.stringify(rep.checks.filter((c) => !c.ok).slice(0, 6)));
  });

  it('two JSM items with the same item code (and a code already in the company) do not stop the import', async () => {
    const reg = await request(app).post('/api/auth/register').send({ name: 'Code Owner', email: `code-${Date.now()}@example.com`, password: 'TestPass123!', companyName: 'Item Code Co' });
    const h3 = authHeader(reg.body.token);
    const api3 = (m, pth, body) => { const r = request(app)[m](`/api/migration${pth}`).set(h3); return body === undefined ? r : r.send(body); };
    const lines = zlib.gunzipSync(fs.readFileSync(FIXTURE)).toString('utf8').split('\n');
    const items = [...new Set(lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((x) => x && x._ === 'row' && x.t === 'MST_IT_MAST' && YEARS.includes(String(x.r.CO_PATH).trim()) && Number(x.r.ITEM_CODE) > 0).map((x) => String(x.r.ITEM_CODE).trim()))].slice(0, 3);
    const out = lines.map((l) => { let x; try { x = JSON.parse(l); } catch { return l; } if (!x || x._ !== 'row' || x.t !== 'MST_IT_MAST') return l;
      const i = items.indexOf(String(x.r.ITEM_CODE).trim()); if (i < 0) return l; return JSON.stringify({ ...x, r: { ...x.r, CHR_CODE: i < 2 ? 'DF962' : 'TAKEN1' } }); });
    const buf = zlib.gzipSync(Buffer.from(out.join('\n')));
    const runId = unwrapBody(await api3('post', '/runs', {})).id;
    const cid = (await require('../../models/MigrationRun').MigrationRun.findById(runId).lean()).companyId;
    await require('../../models/Item').collection.insertOne({ companyId: cid, name: 'ALREADY HERE', itemCode: 'TAKEN1', isDeleted: false });
    await request(app).put(`/api/migration/runs/${runId}/chunk?index=0`).set(h3).set('Content-Type', 'application/octet-stream').send(buf);
    assert.equal(unwrapBody(await api3('post', `/runs/${runId}/complete`, { bytes: buf.length })).status, 'uploaded');
    assert.equal((await api3('post', `/runs/${runId}/apply`, { years: YEARS })).status, 200);
    let r;
    for (let i = 0; i < 200; i += 1) { r = unwrapBody(await api3('get', `/runs/${runId}`)); if (['applied', 'failed'].includes(r.status)) break; await new Promise((x) => setTimeout(x, 300)); }
    assert.equal(r.status, 'applied', r.error);
    const codes = (await require('../../models/Item').collection.find({ companyId: cid }).toArray()).map((x) => x.itemCode).filter(Boolean).sort();
    assert.ok(codes.includes('DF962') && codes.includes('DF962/2') && codes.includes('TAKEN1') && codes.includes('TAKEN1/2'), JSON.stringify(codes));
    const rep = unwrapBody(await api3('post', `/runs/${runId}/reconcile`, {}));
    assert.equal(rep.mismatched, 0, JSON.stringify(rep.checks.filter((c) => !c.ok).slice(0, 6)));
  });

  it('an account already in the company (TDS, Round Off ...) takes JSM opening and head; undo puts it back', async () => {
    const reg = await request(app).post('/api/auth/register').send({ name: 'Ob Owner', email: `ob-${Date.now()}@example.com`, password: 'TestPass123!', companyName: 'Opening Co' });
    const h4 = authHeader(reg.body.token);
    const api4 = (m, pth, body) => { const r = request(app)[m](`/api/migration${pth}`).set(h4); return body === undefined ? r : r.send(body); };
    const buf = fs.readFileSync(FIXTURE);
    const runId = unwrapBody(await api4('post', '/runs', {})).id;
    const cid = (await require('../../models/MigrationRun').MigrationRun.findById(runId).lean()).companyId;
    // a JSM account with an opening balance, already present here (by name) with opening 0
    const { loadPackage } = require('../../services/migration/packageReader');
    const { buildPlan } = require('../../services/migration/jsmMapper');
    const pkg = await loadPackage(FIXTURE);
    const keep = (rows) => rows.filter((r) => !r.CO_PATH || YEARS.includes(String(r.CO_PATH).trim()));
    const tables = Object.fromEntries(Object.entries(pkg.tables).map(([k, v]) => [k, keep(v)]));
    const target = buildPlan(tables, { companyId: cid }).docs.LedgerMaster.find((l) => l.openingBalance > 0 && !l.linkedPartyId);
    assert.ok(target, 'a JSM account with an opening balance');
    const Ledger = require('../../models/LedgerMaster').collection;
    const { insertedId } = await Ledger.insertOne({ companyId: cid, name: target.name, group: target.group, accountType: 'System', openingBalance: 0, openingBalanceType: 'Dr', isActive: true, isDeleted: false });

    await request(app).put(`/api/migration/runs/${runId}/chunk?index=0`).set(h4).set('Content-Type', 'application/octet-stream').send(buf);
    assert.equal(unwrapBody(await api4('post', `/runs/${runId}/complete`, { bytes: buf.length })).status, 'uploaded');
    assert.equal((await api4('post', `/runs/${runId}/apply`, { years: YEARS })).status, 200);
    let r;
    for (let i = 0; i < 200; i += 1) { r = unwrapBody(await api4('get', `/runs/${runId}`)); if (['applied', 'failed'].includes(r.status)) break; await new Promise((x) => setTimeout(x, 300)); }
    assert.equal(r.status, 'applied', r.error);
    const after = await Ledger.findOne({ _id: insertedId });
    assert.equal(after.openingBalance, target.openingBalance);
    assert.equal(after.openingBalanceType, target.openingBalanceType);
    assert.equal(after.jsmHead, target.jsmHead);
    const rep = unwrapBody(await api4('post', `/runs/${runId}/reconcile`, {}));
    assert.equal(rep.mismatched, 0, JSON.stringify(rep.checks.filter((c) => !c.ok).slice(0, 6)));

    assert.equal((await api4('post', `/runs/${runId}/undo`, {})).status, 200);
    const back = await Ledger.findOne({ _id: insertedId });
    assert.equal(back.openingBalance, 0);
    assert.equal(back.jsmHead || '', '');
  });
});
