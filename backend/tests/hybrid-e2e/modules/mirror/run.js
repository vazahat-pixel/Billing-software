'use strict';

/**
 * DESKTOP MIRROR CERTIFICATION
 * ============================
 * Two real API servers, two real databases, and — unlike the older suites — the desktop database
 * starts EMPTY. Nothing is copied behind the scenes: the desktop gets the company only by signing in
 * (auto-activate + download), exactly like a customer PC.
 *
 *  A  Activation    cloud already has history; empty desktop signs in, downloads, matches exactly
 *  B  Lock          Desktop-only entries ON → web is view-only, reports still open
 *  C  Offline work  cloud is DOWN; desktop makes every kind of entry, edits and deletes
 *  D  Sync          cloud back; one sync; desktop and cloud compared document by document, and
 *                   trial balance / party ledger / outstanding / stock compared figure by figure
 *  E  Durability    entry made, app killed before upload, app restarted → still reaches the cloud
 *  F  Web entries   lock OFF, web makes a party → arrives on the desktop
 *  G  Security      other company / lower role / billing collections are refused
 *
 * NEVER connects to production. Usage: node tests/hybrid-e2e/modules/mirror/run.js
 */

const crypto = require('crypto');
process.env.MONGOMS_SPAWN_TIMEOUT = process.env.MONGOMS_SPAWN_TIMEOUT || '60000';
const { MongoMemoryServer, MongoMemoryReplSet } = require('mongodb-memory-server');
const { MongoClient, BSON } = require('mongodb');
const { spawnApi, stopProc, waitHealth, findFreePort } = require('../../lib/env');
const { seedCentralFixtures, withMongoose } = require('../../lib/fixtures');
const { api, request } = require('../../lib/http');
const { assertNotProduction } = require('../../../helpers/memoryDb');
const scope = require('../../../../services/replication/scope');

const { EJSON } = BSON;
let passed = 0;
let failed = 0;
const failures = [];

async function test(label, fn) {
  try {
    await fn();
    passed += 1;
    process.stdout.write(`  v ${label}\n`);
  } catch (err) {
    failed += 1;
    failures.push({ label, error: err.message });
    process.stdout.write(`  x ${label}\n    ${String(err.message).split('\n').join('\n    ')}\n`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

const data = (res) => res.body?.data ?? res.body;
const ok2xx = (res, what) => assert(res.status >= 200 && res.status < 300, `${what} failed ${res.status}: ${JSON.stringify(res.body).slice(0, 600)}`);

async function withDb(uri, fn) {
  const client = new MongoClient(uri);
  await client.connect();
  try {
    return await fn(client.db(new URL(uri).pathname.replace('/', '') || 'test'));
  } finally {
    await client.close();
  }
}

/**
 * Every mirrored collection, desktop vs cloud, compared as exact EJSON (types included).
 * Returns a list of human-readable differences; empty means identical.
 */
async function diffMirror(localUri, centralUri, companyIds, collections = scope.BOTH) {
  const read = (uri) => withDb(uri, async (db) => {
    const out = {};
    for (const c of collections) {
      const docs = await db.collection(c).find(scope.scopeFilter(c, companyIds)).sort({ _id: 1 }).toArray();
      out[c] = new Map(docs.map((d) => [EJSON.stringify(d._id), EJSON.stringify(d, { relaxed: false })]));
    }
    return out;
  });
  const [local, cloud] = await Promise.all([read(localUri), read(centralUri)]);
  const diffs = [];
  for (const c of collections) {
    const L = local[c];
    const C = cloud[c];
    for (const [id, s] of L) {
      if (!C.has(id)) diffs.push(`${c} ${id}: only on desktop`);
      else if (C.get(id) !== s) diffs.push(`${c} ${id}: content differs${s.length < 300 ? `\n      desktop ${s}\n      cloud   ${C.get(id)}` : ''}`);
    }
    for (const id of C.keys()) if (!L.has(id)) diffs.push(`${c} ${id}: only on cloud`);
  }
  return diffs;
}

async function main() {
  const stamp = Date.now();
  console.log('\n' + '='.repeat(68));
  console.log('  DESKTOP MIRROR CERTIFICATION (empty desktop, no cloning)');
  console.log('='.repeat(68) + '\n');

  // The cloud runs on a replica set (Atlas) — vouchers use real transactions, so the test must too.
  const cloudMms = await MongoMemoryReplSet.create({ replSet: { count: 1 }, instanceOpts: [{ launchTimeout: 60000 }] });
  await cloudMms.waitUntilRunning();
  // A single-node replica set, as the installed desktop runs (needed to watch changes).
  const deskMms = await MongoMemoryReplSet.create({ replSet: { count: 1 }, instanceOpts: [{ launchTimeout: 60000 }] });
  await deskMms.waitUntilRunning();
  const centralUri = cloudMms.getUri(`central_mirror_e2e_test_${stamp}`);
  const localUri = deskMms.getUri(`local_mirror_e2e_test_${stamp}`);
  assertNotProduction(centralUri);
  assertNotProduction(localUri);

  const centralPort = await findFreePort();
  const localPort = await findFreePort();
  const centralBase = `http://127.0.0.1:${centralPort}/api`;
  const localBase = `http://127.0.0.1:${localPort}/api`;
  let centralProc = null;
  let localProc = null;

  const startCentral = async () => {
    await stopProc(centralProc);
    centralProc = spawnApi({
      name: 'central', mongoUri: centralUri, port: centralPort,
      extraEnv: { DESKTOP_LOCAL: 'false', DESKTOP_HYBRID: 'false', MONGO_REPLICA_SET: 'true', MODULE_GATE_ENFORCE: 'false', DEVICE_BINDING_ENFORCE: 'false' },
    });
    await waitHealth(centralPort, 90000, centralProc);
  };
  const stopCentral = async () => { await stopProc(centralProc); centralProc = null; };
  const startLocal = async () => {
    await stopProc(localProc);
    localProc = spawnApi({
      name: 'local', mongoUri: localUri, port: localPort,
      extraEnv: {
        DESKTOP_LOCAL: 'true', DESKTOP_REPLICATION: 'true', DESKTOP_HYBRID: 'false', HYBRID_SYNC_ENABLED: 'false',
        MONGO_REPLICA_SET: 'true', CENTRAL_API_BASE_URL: centralBase,
        MODULE_GATE_ENFORCE: 'false', DEVICE_BINDING_ENFORCE: 'false',
        SYNC_AGENT_INTERVAL_MS: '3600000', // the test drives every sync itself
      },
    });
    await waitHealth(localPort, 90000, localProc);
  };
  const stopLocal = async () => { await stopProc(localProc); localProc = null; };
  const logs = () => ({ local: localProc?._hybridLogs?.stderr?.slice(-1500), central: centralProc?._hybridLogs?.stderr?.slice(-1500) });

  const central = api(centralBase);
  const local = api(localBase);
  const syncNow = async () => data(await local.post('/desktop/sync-now', {}));
  const pending = async () => data(await local.get('/desktop/sync-pending'));

  try {
    const fx = await seedCentralFixtures(centralUri, stamp);
    const deviceId = fx.deviceId;
    // What a real company has after onboarding: system ledgers (Cash A/c, Bank A/c, …). And a
    // licence + owner for company B, so the security checks below test the scope rule itself.
    await withMongoose(centralUri, async () => {
      await require('../../../../services/accountingService').seedSystemLedgers(fx.companyId);
      const User = require('../../../../models/User');
      const License = require('../../../../models/License');
      const Company = require('../../../../models/Company');
      const { generateLicenseKey } = require('../../../../utils/license');
      const b = await User.findOne({ email: fx.userBEmail });
      b.companyRole = 'owner';
      await b.save();
      const key = generateLicenseKey(String(b.companyId));
      await License.create({
        companyId: b.companyId, licenseKey: key, expiresAt: new Date(Date.now() + 365 * 864e5),
        checksum: 'E2E', isActive: true, planTier: 'pro', maxDevices: 1, devices: [],
      });
      await Company.updateOne({ _id: b.companyId }, { $set: { licenseKey: key } });
      // A live cloud database already has every collection; a fresh test one does not, and a
      // first write inside a transaction races their creation.
      const fs = require('fs');
      const path = require('path');
      const modelsDir = path.join(__dirname, '..', '..', '..', '..', 'models');
      for (const f of fs.readdirSync(modelsDir)) if (f.endsWith('.js')) { try { require(path.join(modelsDir, f)); } catch { /* optional model */ } }
      const mongoose = require('mongoose');
      for (const n of mongoose.modelNames()) await mongoose.model(n).init().catch(() => {});
    });
    await startCentral();

    const cloudLogin = data(await central.post('/auth/login', {
      body: { email: fx.email, password: fx.password, deviceId: 'WEB-CHROME', deviceName: 'CHROME-WEB' },
    }));
    const webToken = cloudLogin.token;
    let companyIds = [fx.companyId];

    // ────────────────────────────────────────────────────────────────
    console.log('[A] Activation — cloud has history, desktop starts empty');
    let cloudSaleId = '';
    let cloudSaleNo = '';

    await test('Cloud already has a sale and a receipt (made on the web)', async () => {
      const sale = await central.post('/sales', {
        token: webToken,
        body: {
          customerId: fx.partyId, invoiceNo: 'AUTO', invoiceType: 'Tax', paymentMode: 'CREDIT',
          gstType: 'CGST+SGST', gstRate: 5,
          items: [{ itemId: fx.itemId, mts: 10, pcs: 0, rate: 250, amount: 2500 }],
        },
      });
      ok2xx(sale, 'web sale');
      cloudSaleId = String(data(sale)._id);
      cloudSaleNo = data(sale).invoiceNo;
      const rec = await central.post('/accounting/receipts', {
        token: webToken,
        body: {
          partyId: fx.partyId, amount: 1000, date: new Date().toISOString(), paymentMode: 'Cash',
          bookKind: 'cash', status: 'Posted', againstInvoices: [{ invoiceId: cloudSaleId, amount: 1000 }],
        },
      });
      ok2xx(rec, 'web receipt');
    });

    await startLocal();
    let deskToken = '';

    await test('Empty desktop: first sign-in activates and downloads the company', async () => {
      const act = await local.post('/desktop/auto-activate', {
        body: { email: fx.email, password: fx.password, deviceId, deviceName: 'OFFICE-PC' },
      });
      ok2xx(act, 'auto-activate');
      deskToken = data(act).token;
      assert(deskToken, 'no local token');
      const deadline = Date.now() + 120000;
      for (;;) {
        const s = await pending();
        if (s?.snapshot === 'done') break;
        if (s?.snapshot === 'failed') {
          const why = await withDb(localUri, (db) => db.collection('sync_state').findOne({ key: 'mirror:snapshot' }));
          throw new Error(`download failed: ${why?.value?.error}\n${(localProc?._hybridLogs?.stderr || '').slice(-1500)}`);
        }
        if (Date.now() > deadline) throw new Error(`download did not finish: ${JSON.stringify(s)}`);
        await new Promise((r) => setTimeout(r, 500));
      }
    });

    await test('After download, every document matches the cloud exactly (same _id, same content)', async () => {
      const diffs = await diffMirror(localUri, centralUri, companyIds, scope.ALL.filter((c) => c !== 'users'));
      assert(diffs.length === 0, `${diffs.length} differences:\n${diffs.slice(0, 15).join('\n')}`);
    });

    await test('Signing in again on the desktop works with the same password (offline-capable)', async () => {
      const again = await local.post('/auth/login', { body: { email: fx.email, password: fx.password, deviceId } });
      ok2xx(again, 'local login');
      deskToken = data(again).token || deskToken;
    });

    await test('Desktop trial balance equals the cloud trial balance', async () => {
      const a = data(await local.get('/accounting/trial-balance', { token: deskToken }));
      const b = data(await central.get('/accounting/trial-balance', { token: webToken }));
      assert(JSON.stringify(a) === JSON.stringify(b), `trial balance differs\ndesktop: ${JSON.stringify(a).slice(0, 500)}\ncloud:   ${JSON.stringify(b).slice(0, 500)}`);
    });

    // ────────────────────────────────────────────────────────────────
    console.log('\n[B] Desktop-only entries lock');

    await test('Owner turns the lock ON from the desktop (forwarded to the cloud)', async () => {
      const r = await local.put('/sync/mirror/lock', { token: deskToken, body: { desktopOnly: true } });
      ok2xx(r, 'set lock');
      assert(data(r).desktopOnly === true, 'lock not on');
    });

    await test('Web cannot save a bill while the lock is ON (423)', async () => {
      const r = await central.post('/sales', {
        token: webToken,
        body: { customerId: fx.partyId, invoiceNo: 'AUTO', items: [{ itemId: fx.itemId, mts: 1, rate: 1, amount: 1 }] },
      });
      assert(r.status === 423, `expected 423, got ${r.status}`);
      assert(r.body?.code === 'DESKTOP_ONLY_ENTRIES', 'wrong code');
    });

    await test('Web can still open reports while the lock is ON', async () => {
      const tb = await central.post('/accounting/reports/trial-balance', { token: webToken, body: {} });
      assert(tb.status === 200, `trial balance report ${tb.status}`);
      const list = await central.get('/sales', { token: webToken });
      assert(list.status === 200, `sales list ${list.status}`);
    });

    // ────────────────────────────────────────────────────────────────
    console.log('\n[C] Offline work — cloud is DOWN');
    await stopCentral();

    let newPartyId = '';
    let newSaleId = '';
    let tempPurchaseId = '';

    await test('Desktop works with the cloud down: new party', async () => {
      const r = await local.post('/parties', {
        token: deskToken,
        body: { name: `OFFLINE CUSTOMER ${stamp}`, type: 'Customer', state: 'Gujarat' },
      });
      ok2xx(r, 'offline party');
      newPartyId = String(data(r)._id);
    });

    await test('Offline sale for that new party', async () => {
      const r = await local.post('/sales', {
        token: deskToken,
        body: {
          customerId: newPartyId, invoiceNo: 'AUTO', invoiceType: 'Tax', paymentMode: 'CREDIT',
          gstType: 'CGST+SGST', gstRate: 5,
          items: [{ itemId: fx.itemId, mts: 20, pcs: 0, rate: 300, amount: 6000 }],
        },
      });
      ok2xx(r, 'offline sale');
      newSaleId = String(data(r)._id);
      const no = data(r).invoiceNo;
      assert(no && no !== 'AUTO', 'sale got no number');
      assert(String(no) !== String(cloudSaleNo), `offline sale reused the cloud's number ${no}`);
    });

    await test('Offline receipt from the new party against that sale', async () => {
      const r = await local.post('/accounting/receipts', {
        token: deskToken,
        body: {
          partyId: newPartyId, amount: 2500, date: new Date().toISOString(), paymentMode: 'Cash',
          bookKind: 'cash', status: 'Posted', againstInvoices: [{ invoiceId: newSaleId, amount: 2500 }],
        },
      });
      ok2xx(r, 'offline receipt');
    });

    await test('Offline payment to the supplier', async () => {
      const r = await local.post('/accounting/payments', {
        token: deskToken,
        // accBill 'A' = on-account (not against a bill), as the voucher screen requires.
        body: { partyId: fx.partyId, amount: 400, date: new Date().toISOString(), paymentMode: 'Cash', bookKind: 'cash', accBill: 'A', status: 'Posted' },
      });
      ok2xx(r, 'offline payment');
    });

    await test('Offline journal entry', async () => {
      const ledgers = data(await local.get('/accounting/ledgers', { token: deskToken }));
      const list = Array.isArray(ledgers) ? ledgers : (ledgers?.ledgers || ledgers?.items || []);
      const cash = list.find((l) => /^cash a\/c$/i.test(l.name));
      const other = list.find((l) => l._id !== cash?._id && l.isActive !== false);
      assert(cash && other, `need two ledgers, got ${list.map((l) => l.name).join(', ')}`);
      const r = await local.post('/accounting/journal', {
        token: deskToken,
        body: {
          entryDate: new Date().toISOString(), narration: 'offline JV',
          lines: [{ ledgerId: other._id, type: 'Dr', amount: 75 }, { ledgerId: cash._id, type: 'Cr', amount: 75 }],
        },
      });
      ok2xx(r, 'offline journal');
    });

    await test('Offline credit note', async () => {
      const r = await local.post('/notes', {
        token: deskToken,
        body: {
          noteType: 'Credit', partyLedgerId: newPartyId, amount: 105, date: new Date().toISOString(),
          reason: 'offline rate difference', status: 'Posted', gstType: 'CGST+SGST', gstRate: 5, taxableAmount: 100,
        },
      });
      ok2xx(r, 'offline credit note');
    });

    await test('Offline mill issue', async () => {
      const r = await local.post('/jobs/issue', {
        token: deskToken,
        body: { workerId: fx.partyId, lotId: fx.lotId, processType: 'Dyeing', issueQty: 5, issuePcs: 1, jobRate: 10, challanNo: `OFF-${stamp}`, date: new Date() },
      });
      ok2xx(r, 'offline mill issue');
    });

    await test('Offline purchase, then deleted offline', async () => {
      const p = await local.post('/purchases', {
        token: deskToken,
        body: {
          supplierId: fx.partyId, invoiceNo: `PUR-OFF-${stamp}`, supplierInvoiceNo: `SI-${stamp}`,
          taxableAmount: 500, cgst: 12.5, sgst: 12.5, igst: 0, gstAmount: 25, netAmount: 525, gstType: 'CGST+SGST',
          items: [{ itemId: fx.itemId, pcs: 1, mts: 25, rate: 20, amount: 500, gstPer: 5, gstAmt: 25 }],
        },
      });
      ok2xx(p, 'offline purchase');
      tempPurchaseId = String(data(p)._id);
      const d = await request(localBase, 'DELETE', `/purchases/${tempPurchaseId}`, { token: deskToken });
      ok2xx(d, 'offline purchase delete');
    });

    await test('Desktop knows entries are waiting and that the cloud is unreachable', async () => {
      const s = await syncNow();
      assert(s.pending > 0, `expected pending entries, got ${JSON.stringify(s)}`);
      assert(s.online === false, `expected offline, got ${JSON.stringify(s)}`);
    });

    // ────────────────────────────────────────────────────────────────
    console.log('\n[D] Cloud back — one sync, then compare everything');
    await startCentral();

    await test('One sync uploads everything (nothing left waiting)', async () => {
      let s = await syncNow();
      if (s.pending > 0) s = await syncNow(); // a change that landed during the first round
      assert(s.pending === 0, `still waiting: ${JSON.stringify(s)}`);
    });

    await test('Desktop and cloud hold exactly the same documents', async () => {
      const diffs = await diffMirror(localUri, centralUri, companyIds);
      assert(diffs.length === 0, `${diffs.length} differences:\n${diffs.slice(0, 20).join('\n')}`);
    });

    await test('Purchase deleted offline is cancelled on the cloud too', async () => {
      // "Delete" here is the software's own soft cancel (stock and journals reversed, status cancelled).
      const r = await central.get(`/purchases/${tempPurchaseId}`, { token: webToken });
      const p = data(r);
      assert(r.status === 404 || p?.isDeleted || /^cancel/i.test(String(p?.status || '')), `purchase still live on cloud: ${r.status} ${p?.status}`);
    });

    // Reports stamp "as on <now>"; that moment is the only thing allowed to differ.
    const stripNow = (v) => JSON.parse(JSON.stringify(v ?? null, (k, x) => (k === 'asOn' || k === 'generatedAt' ? undefined : x)));
    const compare = async (label, path) => {
      const a = stripNow(data(await local.get(path, { token: deskToken })));
      const b = stripNow(data(await central.get(path, { token: webToken })));
      assert(JSON.stringify(a) === JSON.stringify(b), `${label} differs\ndesktop: ${JSON.stringify(a).slice(0, 400)}\ncloud:   ${JSON.stringify(b).slice(0, 400)}`);
    };

    await test('Trial balance: desktop = cloud', () => compare('trial balance', '/accounting/trial-balance'));
    await test('Profit & loss: desktop = cloud', () => compare('profit & loss', '/accounting/profit-loss'));
    await test('Balance sheet: desktop = cloud', () => compare('balance sheet', '/accounting/balance-sheet'));
    await test('Outstanding: desktop = cloud', () => compare('outstanding', '/accounting/outstanding'));
    await test('Stock of the item: desktop = cloud', () => compare('stock', `/inventory/stock/${fx.itemId}`));
    await test('Sales list: desktop = cloud', () => compare('sales list', '/sales?limit=200'));

    await test('New party\'s ledger statement: desktop = cloud', async () => {
      const ledgers = data(await central.get('/accounting/ledgers', { token: webToken }));
      const list = Array.isArray(ledgers) ? ledgers : (ledgers?.ledgers || ledgers?.items || []);
      const pl = list.find((l) => String(l.partyId || '') === newPartyId || l.name === `OFFLINE CUSTOMER ${stamp}`);
      assert(pl, 'party ledger not on cloud');
      await compare('party ledger', `/accounting/ledgers/${pl._id}/statement`);
    });

    await test('No ledger was created twice under the same name', async () => {
      await withDb(centralUri, async (db) => {
        const dup = await db.collection('ledgermasters').aggregate([
          { $match: scope.scopeFilter('ledgermasters', companyIds) },
          { $group: { _id: { c: '$companyId', n: { $toLower: '$name' } }, k: { $sum: 1 } } },
          { $match: { k: { $gt: 1 } } },
        ]).toArray();
        assert(dup.length === 0, `duplicate ledgers: ${JSON.stringify(dup)}`);
      });
    });

    // ────────────────────────────────────────────────────────────────
    console.log('\n[E] Durability — app killed before it could upload');

    await test('Entry made, desktop killed at once, restarted → entry still reaches the cloud', async () => {
      const r = await local.post('/parties', { token: deskToken, body: { name: `CRASH TEST ${stamp}`, type: 'Customer' } });
      ok2xx(r, 'party before crash');
      const id = String(data(r)._id);
      await stopLocal(); // no sync ran
      await startLocal();
      let s = await syncNow();
      if (s.pending > 0) s = await syncNow();
      assert(s.pending === 0, `still waiting after restart: ${JSON.stringify(s)}`);
      await withDb(centralUri, async (db) => {
        const found = await db.collection('parties').findOne({ _id: new BSON.ObjectId(id) });
        assert(found, 'party made before the crash is not on the cloud');
      });
    });

    // ────────────────────────────────────────────────────────────────
    console.log('\n[F] Lock OFF — an entry made on the web reaches the desktop');

    await test('Web party arrives on the desktop after one sync', async () => {
      ok2xx(await local.put('/sync/mirror/lock', { token: deskToken, body: { desktopOnly: false } }), 'lock off');
      const r = await central.post('/parties', { token: webToken, body: { name: `WEB PARTY ${stamp}`, type: 'Customer' } });
      ok2xx(r, 'web party');
      const id = String(data(r)._id);
      await syncNow();
      await withDb(localUri, async (db) => {
        const found = await db.collection('parties').findOne({ _id: new BSON.ObjectId(id) });
        assert(found, 'web party not on the desktop');
      });
      const diffs = await diffMirror(localUri, centralUri, companyIds);
      assert(diffs.length === 0, `${diffs.length} differences:\n${diffs.slice(0, 15).join('\n')}`);
    });

    // ────────────────────────────────────────────────────────────────
    console.log('\n[G] Security');

    await test('Another company cannot upload into this company', async () => {
      const b = data(await central.post('/auth/login', { body: { email: fx.userBEmail, password: fx.password, deviceId: fx.deviceBId } }));
      const forged = { _id: new BSON.ObjectId(), companyId: new BSON.ObjectId(fx.companyId), name: 'FORGED' };
      const payload = EJSON.stringify([{ key: 'k1', coll: 'parties', op: 'upsert', id: forged._id, doc: forged }], { relaxed: false });
      const r = await central.post('/sync/mirror/apply', { token: b.token, body: { payload } });
      ok2xx(r, 'apply call');
      assert(data(r).results[0].ok === false && data(r).results[0].code === 'OUT_OF_SCOPE', `not refused: ${JSON.stringify(data(r))}`);
      await withDb(centralUri, async (db) => {
        assert(!(await db.collection('parties').findOne({ _id: forged._id })), 'forged party was written');
      });
    });

    await test('A number counter cannot be deleted through sync', async () => {
      // Deleting one would restart bill numbering at 1 and reissue numbers already used.
      const id = `BILLNO-sales-${fx.companyId}`;
      const before = await withDb(centralUri, (db) => db.collection('counters').findOne({ _id: id }));
      assert(before, 'sales counter should exist on the cloud');
      const payload = EJSON.stringify([{ key: 'k3', coll: 'counters', op: 'delete', id }], { relaxed: false });
      const r = await central.post('/sync/mirror/apply', { token: webToken, body: { payload } });
      assert(data(r).results[0].code === 'NOT_ALLOWED', `not refused: ${JSON.stringify(data(r))}`);
      const after = await withDb(centralUri, (db) => db.collection('counters').findOne({ _id: id }));
      assert(after && after.seq === before.seq, 'counter was changed');
    });

    await test('A desktop cannot upload billing or plan data', async () => {
      const sub = { _id: new BSON.ObjectId(), companyId: new BSON.ObjectId(fx.companyId), status: 'active', planCode: 'enterprise' };
      const payload = EJSON.stringify([{ key: 'k2', coll: 'subscriptions', op: 'upsert', id: sub._id, doc: sub }], { relaxed: false });
      const r = await central.post('/sync/mirror/apply', { token: webToken, body: { payload } });
      assert(data(r).results[0].code === 'NOT_MIRRORED', `not refused: ${JSON.stringify(data(r))}`);
    });

    await test('A salesman login cannot download or upload the company', async () => {
      const email = `salesman.${stamp}@test.local`;
      await withMongoose(centralUri, async () => {
        const User = require('../../../../models/User');
        await User.create({ name: 'SALESMAN', email, password: fx.password, role: 'user', companyRole: 'salesman', companyId: fx.companyId, isActive: true });
      });
      const s = data(await central.post('/auth/login', { body: { email, password: fx.password, deviceId: 'S1' } }));
      const m = await central.get('/sync/mirror/manifest', { token: s.token });
      assert(m.status === 403, `manifest allowed for salesman: ${m.status}`);
      const a = await central.post('/sync/mirror/apply', { token: s.token, body: { payload: '[]' } });
      assert(a.status === 403, `apply allowed for salesman: ${a.status}`);
    });
  } catch (err) {
    failed += 1;
    failures.push({ label: 'harness', error: err.message });
    console.error('\nHARNESS ERROR:', err.message, '\n', JSON.stringify(logs(), null, 1));
  } finally {
    await stopLocal().catch(() => {});
    await stopCentral().catch(() => {});
    await deskMms.stop().catch(() => {});
    await cloudMms.stop().catch(() => {});
  }

  console.log('\n' + '='.repeat(68));
  console.log(`  MIRROR CERTIFICATION: ${failed === 0 ? 'PASS' : 'FAIL'}   passed ${passed}  failed ${failed}`);
  console.log('='.repeat(68));
  if (failures.length) for (const f of failures) console.log(`  - ${f.label}: ${String(f.error).split('\n')[0]}`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
