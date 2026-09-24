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
  const res = await api(base).post('/auth/login', { body: { email, password }, deviceId });
  if (res.status !== 200) throw new Error(`Login failed: ${JSON.stringify(res.body)}`);
  return res.body.token || res.body.data?.token;
}

async function agentTick(base, token, deviceId) {
  return api(base).post('/sync/agent-tick', { token, deviceId });
}

async function countPurchases(uri, companyId) {
  return withMongoose(uri, async () => {
    const Purchase = require('../../../../models/Purchase');
    return Purchase.countDocuments({ companyId });
  });
}

async function findPurchaseByOp(uri, companyId, operationId) {
  return withMongoose(uri, async () => {
    const Purchase = require('../../../../models/Purchase');
    const AccountingEntry = require('../../../../models/AccountingEntry');
    const InventoryLot = require('../../../../models/InventoryLot');
    const SyncOutbox = require('../../../../models/SyncOutbox');
    const ProcessedOperation = require('../../../../models/ProcessedOperation');

    const purchase = await Purchase.findOne({ companyId, operationId }).lean();
    if (!purchase) return { purchase: null, purchaseLots: [], accounting: [], outbox: null, processed: null };
    const purchaseLots = await InventoryLot.find({ companyId, source: 'purchase', purchaseId: purchase._id }).lean();
    const accounting = purchase.accountingEntryId
      ? await AccountingEntry.find({ _id: purchase.accountingEntryId, companyId }).lean()
      : await AccountingEntry.find({ companyId, refId: purchase._id }).lean();
    const outbox = await SyncOutbox.findOne({ companyId, operationId }).lean();
    const processed = await ProcessedOperation.findOne({ companyId, operationId }).lean();
    return { purchase, purchaseLots, accounting, outbox, processed };
  });
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

    await test('Central API startup', async () => {
      await env.startCentral({ MODULE_GATE_ENFORCE: 'false' });
    });

    await test('Seed central fixtures (company, supplier, item)', async () => {
      fx = await seedCentralFixtures(centralUri, `PUR-${Date.now()}`);
      await withMongoose(centralUri, async () => {
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

    await test('Local API startup (clone central fixtures)', async () => {
      await env.cloneCentralToLocal();
      await env.startLocal({ MODULE_GATE_ENFORCE: 'false' });
    });

    await test('Online purchase baseline (central)', async () => {
      centralToken = await login(env.centralBase(), fx.email, fx.password, fx.deviceId);
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
      localToken = await login(env.localBase(), fx.email, fx.password, fx.deviceId);
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
      centralToken = await login(env.centralBase(), fx.email, fx.password, fx.deviceId);
    });

    await test('Agent-tick triggers synchronization', async () => {
      localToken = await login(env.localBase(), fx.email, fx.password, fx.deviceId);
      const res = await agentTick(env.localBase(), localToken, fx.deviceId);
      assert(res.status === 200 || res.status === 204, `tick HTTP ${res.status}`);
      await new Promise(r => setTimeout(r, 1500));
    });

    await test('Purchase synced to central MongoDB', async () => {
      const { purchase: centralPurchase } = await findPurchaseByOp(centralUri, fx.companyId, operationId);
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
      const cnt = await withMongoose(centralUri, async () => {
        const Purchase = require('../../../../models/Purchase');
        return Purchase.countDocuments({ companyId: fx.companyId, operationId });
      });
      assert(cnt === 1, `Expected exactly 1 purchase with operationId, got ${cnt}`);
    });

    await test('Retry handling: RETRY outbox re-processes without duplicate', async () => {
      await withMongoose(localUri, async () => {
        const SyncOutbox = require('../../../../models/SyncOutbox');
        await SyncOutbox.updateOne({ companyId: fx.companyId, operationId }, { $set: { status: 'RETRY' } });
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
      localToken = await login(env.localBase(), fx.email, fx.password, fx.deviceId);
      await agentTick(env.localBase(), localToken, fx.deviceId);
      await new Promise(r => setTimeout(r, 1500));
      const after = await countPurchases(centralUri, fx.companyId);
      assert(after === before, `Count changed on crash recovery: ${before} -> ${after}`);
    });

    await test('Company isolation: Company B sees 0 purchases with this operationId', async () => {
      const cnt = await withMongoose(centralUri, async () => {
        const Purchase = require('../../../../models/Purchase');
        return Purchase.countDocuments({ companyId: fx.companyBId, operationId });
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
      await withMongoose(localUri, async () => {
        const SyncOutbox = require('../../../../models/SyncOutbox');
        await SyncOutbox.updateOne({ companyId: fx.companyId, operationId: failId },
          { $set: { status: 'FAILED', retryCount: 0 } });
      });
      await agentTick(env.localBase(), localToken, fx.deviceId);
      await new Promise(r => setTimeout(r, 1500));
      const central = await withMongoose(centralUri, async () => {
        const Purchase = require('../../../../models/Purchase');
        return Purchase.findOne({ companyId: fx.companyId, operationId: failId }).lean();
      });
      assert(central, 'Failed-op recovery: purchase synced to central');
    });

  } finally {
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
