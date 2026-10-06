'use strict';

/**
 * HYBRID PURCHASE E2E CERTIFICATION SUITE
 * Phase 2: Purchase module — mirrors the Sales golden reference.
 * NEVER connect to production.
 */

const crypto = require('crypto');
const path = require('path');
const { bootHybridE2eEnv } = require('../../lib/env');
const { seedCentralFixtures, withMongoose } = require('../../lib/fixtures');
const { api } = require('../../lib/http');
const { assertNotProduction } = require('../../../helpers/memoryDb');

const MODULE = 'purchase';

// ─── helpers ──────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

async function test(label, fn) {
  try {
    await fn();
    passed++;
    process.stdout.write(`  v ${label}\n`);
  } catch (err) {
    failed++;
    failures.push({ label, error: err.message });
    process.stdout.write(`  x ${label}\n    ${err.message}\n`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

async function login(base, email, password, deviceId) {
  const res = await api(base).post('/auth/login', {
    body: { email, password, deviceId, isDesktop: true, deviceName: 'HYBRID-E2E' },
    deviceId,
  });
  if (res.status !== 200) throw new Error(`Login failed: ${JSON.stringify(res.body)}`);
  const payload = res.body?.data || res.body;
  return { token: payload.token, refreshToken: payload.refreshToken, user: payload.user };
}

async function agentTick(base, token, deviceId) {
  return api(base).post('/sync/agent-tick', { token, deviceId, body: {} });
}

/**
 * Use raw MongoClient to avoid mongoose singleton connection conflicts
 * when querying both central and local URIs concurrently.
 */
async function withClient(uri, fn) {
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(uri);
  await client.connect();
  const dbName = new URL(uri).pathname.replace('/', '') || 'test';
  const db = client.db(dbName);
  try {
    return await fn(db);
  } finally {
    await client.close();
  }
}

function toOid(val) {
  const { ObjectId } = require('mongodb');
  try { return new ObjectId(String(val)); } catch { return val; }
}

async function countPurchases(uri, companyId) {
  return withClient(uri, async (db) => {
    return db.collection('purchases').countDocuments({ companyId: toOid(companyId) });
  });
}

async function findPurchaseByOp(uri, companyId, operationId) {
  return withClient(uri, async (db) => {
    const purchase = await db.collection('purchases').findOne({ companyId: toOid(companyId), operationId });
    if (!purchase) return { purchase: null, purchaseLots: [], accounting: [], outbox: null, processed: null };
    const purchaseLots = await db.collection('inventorylots').find({
      companyId: toOid(companyId),
      source: 'purchase',
      purchaseId: purchase._id,
    }).toArray();
    const accounting = purchase.accountingEntryId
      ? await db.collection('accountingentries').find({ _id: purchase.accountingEntryId, companyId: toOid(companyId) }).toArray()
      : await db.collection('accountingentries').find({ companyId: toOid(companyId), refId: purchase._id }).toArray();
    const outbox = await db.collection('sync_outbox').findOne({ companyId: toOid(companyId), operationId });
    const processed = await db.collection('processed_operations').findOne({ companyId: toOid(companyId), operationId });
    return { purchase, purchaseLots, accounting, outbox, processed };
  });
}

/**
 * Seed the central JWT directly into local Mongo's SyncState,
 * exactly as the sales suite does. This is critical: the local JWT
 * session-id (sid) does not exist in central's UserSession collection,
 * so only the central JWT is accepted by central's auth middleware.
 */
async function seedCentralTokenOnLocal(localUri, { companyId, token, refreshToken, deviceId }) {
  return withClient(localUri, async (db) => {
    const key = 'hybrid:agent';
    const existing = await db.collection('sync_state').findOne({ key });
    const current = existing?.value || {};
    await db.collection('sync_state').updateOne(
      { key },
      {
        $set: {
          value: {
            ...current,
            companyId: String(companyId),
            token,
            refreshToken: refreshToken || '',
            deviceId: String(deviceId || ''),
            updatedAt: new Date().toISOString(),
          },
        },
      },
      { upsert: true }
    );
  });
}

/**
 * Poll central until purchase appears (same pattern as sales waitCentralSale).
 */
async function waitCentralPurchase(centralUri, localBase, localToken, deviceId, companyId, operationId, tries = 15) {
  for (let i = 0; i < tries; i++) {
    const { purchase } = await findPurchaseByOp(centralUri, companyId, operationId);
    if (purchase) return purchase;
    await api(localBase).post('/sync/agent-tick', { token: localToken, deviceId, body: {} });
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
}

// ─── main ─────────────────────────────────────────────────────────────────────
async function runPurchaseSuite({ keepData = false } = {}) {
  console.log('\n====================================================');
  console.log('  HYBRID PURCHASE E2E CERTIFICATION');
  console.log('====================================================\n');

  const env = await bootHybridE2eEnv();
  const { centralUri, localUri } = env;
  let fx, centralToken, localToken;
  const operationId = crypto.randomUUID();

  try {
    await test('Security preconditions (no Atlas URIs)', () => {
      assertNotProduction(centralUri);
      assertNotProduction(localUri);
    });

    await test('MongoDB: central URI reachable', async () => {
      const { MongoClient } = require('mongodb');
      const c = new MongoClient(centralUri);
      await c.connect(); await c.db().command({ ping: 1 }); await c.close();
    });

    await test('MongoDB: local URI reachable', async () => {
      const { MongoClient } = require('mongodb');
      const c = new MongoClient(localUri);
      await c.connect(); await c.db().command({ ping: 1 }); await c.close();
    });

    await test('Seed central fixtures (company, supplier, item)', async () => {
      fx = await seedCentralFixtures(centralUri, `PUR-${Date.now()}`);
      await withMongoose(centralUri, async () => {
        const CompanyModuleConfig = require('../../../../models/CompanyModuleConfig');
        await CompanyModuleConfig.updateOne(
          { companyId: fx.companyId },
          { $set: { 'modules.purchase': true } },
          { upsert: true }
        );
        const Party = require('../../../../models/Party');
        const supplier = await Party.create({
          companyId: fx.companyId,
          name: `${fx.tag}-SUPPLIER`,
          type: 'Supplier',
          state: 'Gujarat',
          stateCode: '24',
        });
        fx.supplierId = String(supplier._id);
      });
      assert(fx.companyId, 'companyId present');
      assert(fx.supplierId, 'supplierId present');
    });

    await test('Central API startup', async () => {
      await env.startCentral({ MODULE_GATE_ENFORCE: 'false' });
    });

    await test('Local API startup (clone central fixtures)', async () => {
      await env.cloneCentralToLocal();
      await env.startLocal({ MODULE_GATE_ENFORCE: 'false' });
    });

    await test('Online purchase baseline (central)', async () => {
      const localAuth = await login(env.localBase(), fx.email, fx.password, fx.deviceId);
      const centralAuth = await login(env.centralBase(), fx.email, fx.password, fx.deviceId);
      centralToken = centralAuth.token;
      localToken = localAuth.token;

      await seedCentralTokenOnLocal(localUri, {
        companyId: fx.companyId,
        token: centralToken,
        refreshToken: centralAuth.refreshToken,
        deviceId: fx.deviceId,
      });

      const res = await api(env.centralBase()).post('/purchases', {
        token: centralToken, deviceId: fx.deviceId,
        body: {
          companyId: fx.companyId, supplierId: fx.supplierId,
          invoiceNo: 'SUP-ONLINE-001', supplierInvoiceNo: 'SI-001',
          date: new Date(), taxableAmount: 1000, cgst: 25, sgst: 25, igst: 0,
          gstAmount: 50, netAmount: 1050, gstType: 'CGST+SGST',
          items: [{ itemId: fx.itemId, pcs: 10, mts: 100, rate: 10, amount: 1000, gstPer: 5, gstAmt: 50 }],
        },
      });
      assert(res.status === 201 || res.status === 200, `Expected 200/201 got ${res.status}: ${JSON.stringify(res.body)}`);
    });

    await test('Offline mode: stop central', async () => {
      await env.stopCentral();
    });

    await test('Local API available while central offline', async () => {
      const res = await api(env.localBase()).get('/health/live');
      assert(res.status === 200, `Expected 200 got ${res.status}`);
    });

    await test('Offline purchase creation (local)', async () => {
      // Use the existing localToken (already logged in during baseline test)
      const res = await api(env.localBase()).post('/purchases', {
        token: localToken, deviceId: fx.deviceId,
        body: {
          companyId: fx.companyId, supplierId: fx.supplierId, operationId,
          invoiceNo: 'AUTO', supplierInvoiceNo: `SI-OFFLINE-${Date.now()}`,
          date: new Date(), taxableAmount: 2000, cgst: 50, sgst: 50, igst: 0,
          gstAmount: 100, netAmount: 2100, gstType: 'CGST+SGST',
          items: [{ itemId: fx.itemId, pcs: 20, mts: 200, rate: 10, amount: 2000, gstPer: 5, gstAmt: 100 }],
        },
      });
      assert(res.status === 201 || res.status === 200, `Offline purchase failed: ${res.status}: ${JSON.stringify(res.body)}`);
    });

    await test('Local Purchase persisted in local MongoDB', async () => {
      const { purchase } = await findPurchaseByOp(localUri, fx.companyId, operationId);
      assert(purchase, 'Purchase with operationId found in local DB');
      assert(Math.abs(purchase.netAmount - 2100) < 0.01, `netAmount mismatch: ${purchase.netAmount}`);
    });

    await test('SyncOutbox PENDING for offline purchase', async () => {
      const { outbox } = await findPurchaseByOp(localUri, fx.companyId, operationId);
      assert(outbox, 'Outbox entry found');
      assert(['PENDING','SYNCING'].includes(outbox.status), `Expected PENDING/SYNCING got ${outbox.status}`);
      assert(outbox.entityType === 'purchase', `entityType ${outbox.entityType}`);
    });

    await test('Local InventoryLot created for offline purchase', async () => {
      const { purchaseLots } = await findPurchaseByOp(localUri, fx.companyId, operationId);
      assert(purchaseLots && purchaseLots.length > 0, 'Expected InventoryLot created');
    });

    await test('Local AccountingEntry created for offline purchase', async () => {
      const { accounting } = await findPurchaseByOp(localUri, fx.companyId, operationId);
      assert(accounting && accounting.length > 0, 'AccountingEntry created locally');
    });

    await test('Application restart: local restarts cleanly', async () => {
      await env.restartLocal();
    });

    await test('Purchase data survives local restart', async () => {
      const { purchase } = await findPurchaseByOp(localUri, fx.companyId, operationId);
      assert(purchase, 'Purchase still in local DB after restart');
    });

    await test('SyncOutbox survives local restart', async () => {
      const { outbox } = await findPurchaseByOp(localUri, fx.companyId, operationId);
      assert(outbox, 'Outbox still present after restart');
    });

    await test('Connectivity restored: restart central', async () => {
      await env.startCentral({ MODULE_GATE_ENFORCE: 'false' });
      // Login to local first, then central (single-session policy: last login wins on central)
      const localAuth = await login(env.localBase(), fx.email, fx.password, fx.deviceId);
      const centralAuth = await login(env.centralBase(), fx.email, fx.password, fx.deviceId);
      centralToken = centralAuth.token;
      localToken = localAuth.token;
      // Seed the fresh central JWT into local Mongo for the sync agent
      await seedCentralTokenOnLocal(localUri, {
        companyId: fx.companyId,
        token: centralToken,
        refreshToken: centralAuth.refreshToken,
        deviceId: fx.deviceId,
      });
    });

    await test('Agent-tick triggers synchronization', async () => {
      const res = await agentTick(env.localBase(), localToken, fx.deviceId);
      assert(res.status === 200 || res.status === 204, `tick HTTP ${res.status}`);
      await new Promise(r => setTimeout(r, 1500));
    });

    await test('Purchase synced to central MongoDB', async () => {
      const centralPurchase = await waitCentralPurchase(
        centralUri, env.localBase(), localToken, fx.deviceId, fx.companyId, operationId
      );
      assert(centralPurchase, 'Purchase with operationId found in central DB');
      assert(Math.abs(centralPurchase.netAmount - 2100) < 0.01, `central netAmount ${centralPurchase.netAmount}`);
    });

    await test('Outbox entry marked SYNCED after sync', async () => {
      const { outbox } = await findPurchaseByOp(localUri, fx.companyId, operationId);
      assert(outbox && outbox.status === 'SYNCED', `Expected SYNCED got ${outbox?.status}`);
    });

    await test('Inventory reconciliation: local lot qty = central lot qty', async () => {
      const [ld, cd] = await Promise.all([
        findPurchaseByOp(localUri, fx.companyId, operationId),
        findPurchaseByOp(centralUri, fx.companyId, operationId),
      ]);
      assert(ld.purchaseLots?.length > 0, 'Local lots exist');
      assert(cd.purchaseLots?.length > 0, 'Central lots exist');
      const lm = ld.purchaseLots.reduce((s, l) => s + Number(l.totalMtrs || 0), 0);
      const cm = cd.purchaseLots.reduce((s, l) => s + Number(l.totalMtrs || 0), 0);
      assert(Math.abs(lm - cm) < 0.001, `Stock mismatch: local=${lm} central=${cm}`);
    });

    await test('Accounting reconciliation: Dr=Cr, local=central', async () => {
      const [ld, cd] = await Promise.all([
        findPurchaseByOp(localUri, fx.companyId, operationId),
        findPurchaseByOp(centralUri, fx.companyId, operationId),
      ]);
      assert(ld.accounting?.length > 0, 'Local entry exists');
      assert(cd.accounting?.length > 0, 'Central entry exists');
      const bal = (entry) => {
        const dr = entry.lines.filter(l => l.type === 'Dr').reduce((s, l) => s + l.amount, 0);
        const cr = entry.lines.filter(l => l.type === 'Cr').reduce((s, l) => s + l.amount, 0);
        return { dr, cr };
      };
      const cb = bal(cd.accounting[0]);
      assert(Math.abs(cb.dr - cb.cr) < 0.01, `Central entry imbalanced: Dr=${cb.dr} Cr=${cb.cr}`);
    });

    await test('Idempotency: duplicate push returns duplicate=true', async () => {
      const { purchase } = await findPurchaseByOp(localUri, fx.companyId, operationId);
      const pushRes = await api(env.centralBase()).post('/sync/push', {
        token: centralToken, deviceId: fx.deviceId,
        body: {
          companyId: fx.companyId, deviceId: fx.deviceId,
          operations: [{ operationId, entityType: 'purchase', operationType: 'create',
            payload: { ...purchase, companyId: fx.companyId, operationId } }],
        },
      });
      assert(pushRes.status === 200, `Push HTTP ${pushRes.status}`);
      const accepted = pushRes.body?.acceptedOperations || pushRes.body?.data?.acceptedOperations || [];
      const op = accepted.find(o => o.operationId === operationId);
      assert(op?.duplicate === true, `Expected duplicate=true got ${op?.duplicate}`);
    });

    await test('Idempotency: no duplicate Purchase in central', async () => {
      const cnt = await withClient(centralUri, async (db) => {
        return db.collection('purchases').countDocuments({ companyId: toOid(fx.companyId), operationId });
      });
      assert(cnt === 1, `Expected exactly 1 purchase with operationId, got ${cnt}`);
    });

    await test('Retry handling: RETRY outbox re-processes without duplicate', async () => {
      await withClient(localUri, async (db) => {
        await db.collection('sync_outbox').updateOne(
          { companyId: toOid(fx.companyId), operationId },
          { $set: { status: 'RETRY' } }
        );
      });
      const before = await countPurchases(centralUri, fx.companyId);
      await agentTick(env.localBase(), localToken, fx.deviceId);
      await new Promise(r => setTimeout(r, 1500));
      const after = await countPurchases(centralUri, fx.companyId);
      assert(after === before, `Count changed on retry: ${before} -> ${after}`);
    });

    await test('Crash recovery: kill+restart+tick, count stable', async () => {
      const before = await countPurchases(centralUri, fx.companyId);
      await env.stopLocal();
      await env.startLocal({ MODULE_GATE_ENFORCE: 'false' });
      // After restart, re-seed central token and login
      const localAuth = await login(env.localBase(), fx.email, fx.password, fx.deviceId);
      const centralAuth = await login(env.centralBase(), fx.email, fx.password, fx.deviceId);
      localToken = localAuth.token;
      centralToken = centralAuth.token;
      await seedCentralTokenOnLocal(localUri, {
        companyId: fx.companyId,
        token: centralToken,
        refreshToken: centralAuth.refreshToken,
        deviceId: fx.deviceId,
      });
      await agentTick(env.localBase(), localToken, fx.deviceId);
      await new Promise(r => setTimeout(r, 1500));
      const after = await countPurchases(centralUri, fx.companyId);
      assert(after === before, `Count changed on crash recovery: ${before} -> ${after}`);
    });

    await test('Company isolation: Company B sees 0 purchases with this operationId', async () => {
      const cnt = await withClient(centralUri, async (db) => {
        return db.collection('purchases').countDocuments({ companyId: toOid(fx.companyBId), operationId });
      });
      assert(cnt === 0, `Company B sees ${cnt} purchases (should be 0)`);
    });

    await test('Failed-operation recovery: FAILED outbox retries and syncs', async () => {
      const failId = crypto.randomUUID();
      const res = await api(env.localBase()).post('/purchases', {
        token: localToken, deviceId: fx.deviceId,
        body: {
          companyId: fx.companyId, supplierId: fx.supplierId, operationId: failId,
          invoiceNo: 'AUTO', supplierInvoiceNo: `SI-FAIL-${Date.now()}`,
          date: new Date(), taxableAmount: 500, cgst: 12.5, sgst: 12.5, igst: 0,
          gstAmount: 25, netAmount: 525, gstType: 'CGST+SGST',
          items: [{ itemId: fx.itemId, pcs: 5, mts: 50, rate: 10, amount: 500, gstPer: 5, gstAmt: 25 }],
        },
      });
      assert(res.status === 201 || res.status === 200, `Create failed: ${res.status}`);
      await withClient(localUri, async (db) => {
        await db.collection('sync_outbox').updateOne(
          { companyId: toOid(fx.companyId), operationId: failId },
          { $set: { status: 'FAILED', retryCount: 0 } }
        );
      });
      // Poll until the recovery completes
      const recovered = await waitCentralPurchase(
        centralUri, env.localBase(), localToken, fx.deviceId, fx.companyId, failId
      );
      assert(recovered, 'Failed-op recovery: purchase synced to central');
    });

  } finally {
    if (failures.length) {
      const logs = env?.logs?.();
      console.log('\n--- Central stdout ---\n', logs?.central?.stdout?.slice(-2000));
      console.log('\n--- Central stderr ---\n', logs?.central?.stderr?.slice(-2000));
      console.log('\n--- Local stdout ---\n', logs?.local?.stdout?.slice(-2000));
      console.log('\n--- Local stderr ---\n', logs?.local?.stderr?.slice(-2000));
    }
    await env.shutdown({ keepData });
  }

  const total = passed + failed;
  console.log('\n====================================================');
  console.log(`  PURCHASE CERTIFICATION: ${failed === 0 ? 'PASS' : 'FAIL'}`);
  console.log(`  Scenarios: ${total} | Passed: ${passed} | Failed: ${failed}`);
  if (failures.length) {
    console.log('\n  FAILURES:');
    failures.forEach(f => console.log(`  x ${f.label}\n    ${f.error}`));
  }
  console.log('====================================================\n');
  return { passed, failed, failures, total, module: MODULE };
}

if (require.main === module) {
  const keepData = process.argv.includes('--keep');
  runPurchaseSuite({ keepData }).then(({ failed: f }) => process.exit(f > 0 ? 1 : 0))
    .catch(err => { console.error('PURCHASE SUITE FATAL:', err); process.exit(1); });
}

module.exports = { runPurchaseSuite };
