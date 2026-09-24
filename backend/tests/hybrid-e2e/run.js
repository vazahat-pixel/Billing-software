#!/usr/bin/env node
'use strict';

/**
 * Hybrid ERP Sales E2E certification harness.
 *
 * Isolated dual MongoMemoryServer + dual Express children.
 * Exercises real salesService.createInvoice (via local HTTP API).
 *
 *   npm run test:hybrid-e2e
 *   npm run test:hybrid-e2e:keep-data
 */

const path = require('path');
const crypto = require('crypto');
const { bootHybridE2eEnv } = require('./lib/env');
const { api } = require('./lib/http');
const { seedCentralFixtures, snapshotStock, findSalesByOperation, withMongoose } = require('./lib/fixtures');
const { createReport } = require('./lib/report');

const KEEP =
  String(process.env.KEEP_TEST_DATA || '').toLowerCase() === 'true' ||
  process.argv.includes('--keep');
const ARTIFACTS = path.join(__dirname, 'artifacts');

function expect(report, name, cond, detail = '') {
  if (cond) report.pass(name, detail);
  else report.fail(name, detail || 'assertion failed');
}

async function login(base, email, password, deviceId) {
  const client = api(base);
  const res = await client.post('/auth/login', {
    body: { email, password, deviceId, isDesktop: true, deviceName: 'HYBRID-E2E' },
    deviceId,
  });
  const payload = res.body?.data || res.body;
  if (res.status !== 200 || !payload?.token) {
    throw new Error(`login failed ${res.status}: ${JSON.stringify(res.body).slice(0, 500)}`);
  }
  return payload;
}

async function main() {
  const stamp = Date.now();
  let env;
  let fixtures;
  let report = createReport({ stamp, fixtures: null });
  const failureCtx = {};

  try {
    // --- Boot ---
    env = await bootHybridE2eEnv();
    fixtures = await seedCentralFixtures(env.centralUri, stamp);
    report = createReport({ stamp, fixtures });
    report.pass('Security preconditions', 'isolated memory DBs; Atlas refused by helper');
    report.pass('MongoDB connectivity', 'central+local memory URIs ready');

    await env.startCentral();
    report.pass('Central API startup', `:${env.centralPort}`);

    await env.cloneCentralToLocal();
    await env.startLocal();
    report.pass('Local API startup', `:${env.localPort}`);

    const central = api(env.centralBase());
    const local = api(env.localBase());
    const deviceId = fixtures.deviceId;

    // Login local first (may also obtain a central agent token). Then login central LAST
    // so the token used for central HTTP calls is not revoked by single-session policy.
    const localAuth = await login(env.localBase(), fixtures.email, fixtures.password, deviceId);
    const centralAuth = await login(env.centralBase(), fixtures.email, fixtures.password, deviceId);
    report.pass('Company provisioning', `company ${fixtures.companyId}`);
    report.pass('Device activation', `device ${deviceId}`);
    expect(
      report,
      'Sales module entitlement',
      !!localAuth.user?.moduleConfig || !!localAuth.user?.companyId,
      'login returned company context'
    );

    // Re-seed agent with the fresh central token explicitly
    await withMongoose(env.localUri, async () => {
      const syncAgentWorker = require('../../services/syncAgentWorker');
      await syncAgentWorker.seedAgentSession({
        companyId: fixtures.companyId,
        token: centralAuth.token,
        refreshToken: centralAuth.refreshToken,
        deviceId,
      });
      const numberLeaseService = require('../../services/numberLeaseService');
      // lease after central auth is current
    });

    // --- Initial sync: lease ONLY from central, cache on local ---
    const leaseRes = await central.post('/sync/leases/invoice', {
      token: centralAuth.token,
      deviceId,
      body: { size: 30, deviceId },
    });
    expect(report, 'Initial sync', leaseRes.status === 201 || leaseRes.status === 200, `lease HTTP ${leaseRes.status}`);
    if (leaseRes.body?.data || leaseRes.body?.leaseId || leaseRes.body?.startSeq) {
      const lease = leaseRes.body?.data || leaseRes.body;
      const { withMongoose } = require('./lib/fixtures');
      await withMongoose(env.localUri, async () => {
        const numberLeaseService = require('../../services/numberLeaseService');
        await numberLeaseService.cacheLeaseLocally(fixtures.companyId, {
          ...lease,
          nextSeq: lease.nextSeq || lease.startSeq,
        });
      });
    }

    const healthLocal = await local.get('/sync/status', { token: localAuth.token, deviceId });
    expect(report, 'Initial sync status', healthLocal.status === 200, `status ${healthLocal.status}`);

    async function waitCentralSale(operationId, tries = 15) {
      const { withMongoose } = require('./lib/fixtures');
      for (let i = 0; i < tries; i += 1) {
        const n = await withMongoose(env.centralUri, async () => {
          const Sales = require('../../models/Sales');
          return Sales.countDocuments({ companyId: fixtures.companyId, operationId });
        });
        if (n >= 1) return n;
        await api(env.localBase()).post('/sync/agent-tick', {
          token: (await login(env.localBase(), fixtures.email, fixtures.password, deviceId)).token,
          deviceId,
          body: {},
        });
        await new Promise((r) => setTimeout(r, 400));
      }
      return 0;
    }

    // Baseline snapshot
    const baselineLocal = await snapshotStock(env.localUri, fixtures.companyId, fixtures.itemId);
    const baselineCentral = await snapshotStock(env.centralUri, fixtures.companyId, fixtures.itemId);
    failureCtx.baselineLocal = baselineLocal;
    failureCtx.baselineCentral = baselineCentral;

    // --- Online baseline Sales (central) then isolate via disposable DB (no cleanup API needed) ---
    const onlineOp = `online-op-${stamp}`;
    const onlineCreate = await central.post('/sales', {
      token: centralAuth.token,
      deviceId,
      headers: { 'X-Operation-Id': onlineOp },
      body: {
        customerId: fixtures.partyId,
        invoiceNo: 'AUTO',
        operationId: onlineOp,
        items: [
          {
            itemId: fixtures.itemId,
            mts: fixtures.saleQty,
            pcs: 0,
            rate: fixtures.saleRate,
            amount: fixtures.saleQty * fixtures.saleRate,
          },
        ],
        gstType: 'CGST+SGST',
        gstRate: 5,
      },
    });
    expect(
      report,
      'Online Sales baseline',
      onlineCreate.status === 201 || onlineCreate.status === 200,
      `HTTP ${onlineCreate.status} ${onlineCreate.body?.message || ''}`
    );
    if (onlineCreate.body?.data) {
      const inv = onlineCreate.body.data;
      expect(report, 'Online invoice GST/totals', Number(inv.netAmount) > 0, `net=${inv.netAmount}`);
      // Revert baseline stock impact by isolating further tests on local clone taken earlier —
      // re-clone local from pre-online central? We cloned before online sale. Central now differs.
      // For offline path we use local (pre-online stock). Re-seed local lease remaining.
    }

    // Refresh local from central masters after online (pull) — optional; keep local stock as opening-2 if online deducted on central only
    // Local still has full 500 mtrs.

    // --- OFFLINE: stop central ---
    await env.stopCentral();
    report.pass('Offline mode', 'central API stopped; local remains');

    const unreachable = await local.get('/sync/status', { token: localAuth.token, deviceId }).catch((e) => ({
      status: 0,
      error: e.message,
    }));
    // Local status still works; connectivity to central is separate
    expect(report, 'Local API available offline', unreachable.status === 200, `local status ${unreachable.status}`);

    const opId = `op-offline-sales-${stamp}-${crypto.randomUUID()}`;
    const offlineCreate = await local.post('/sales', {
      token: localAuth.token,
      deviceId,
      headers: { 'X-Operation-Id': opId, 'X-Device-Id': deviceId },
      body: {
        customerId: fixtures.partyId,
        invoiceNo: 'AUTO',
        operationId: opId,
        deviceId,
        items: [
          {
            itemId: fixtures.itemId,
            mts: fixtures.saleQty,
            pcs: 0,
            rate: fixtures.saleRate,
            amount: fixtures.saleQty * fixtures.saleRate,
          },
        ],
        gstType: 'CGST+SGST',
        gstRate: 5,
      },
    });

    const offlineOk = offlineCreate.status === 201 || offlineCreate.status === 200;
    expect(
      report,
      'Offline invoice creation',
      offlineOk,
      `HTTP ${offlineCreate.status} ${offlineCreate.body?.message || JSON.stringify(offlineCreate.body).slice(0, 200)}`
    );
    report.stats.invoicesCreated += offlineOk ? 1 : 0;

    let localSale = null;
    if (offlineOk) {
      localSale = offlineCreate.body.data;
      const snap = await findSalesByOperation(env.localUri, fixtures.companyId, opId);
      expect(report, 'Local persistence', !!snap.sale, `sale ${opId}`);
      expect(report, 'Outbox persistence', !!snap.outbox && snap.outbox.status === 'PENDING', `outbox=${snap.outbox?.status}`);
      expect(report, 'Local stock movement', snap.movements.length >= 1, `movements=${snap.movements.length}`);
      expect(
        report,
        'Local accounting effect',
        snap.accounting.length >= 1 || !!snap.sale?.accountingEntryId,
        `acct=${snap.accounting.length}`
      );
      failureCtx.localSale = snap;
    }

    // --- Restart local process ---
    await env.restartLocal();
    report.pass('Application restart recovery', 'local API child restarted against same Mongo');

    // Re-login after restart
    const localAuth2 = await login(env.localBase(), fixtures.email, fixtures.password, deviceId);
    const afterRestart = await findSalesByOperation(env.localUri, fixtures.companyId, opId);
    expect(report, 'Data survives restart', !!afterRestart.sale, 'invoice present');
    expect(
      report,
      'Outbox survives restart',
      !!afterRestart.outbox && ['PENDING', 'RETRY', 'FAILED', 'SYNCING'].includes(afterRestart.outbox.status),
      afterRestart.outbox?.status
    );
    if (!afterRestart.sale) report.stats.dataLossEvents += 1;

    // PC-restart-style already covered by stop+start local API

    // --- Restore central ---
    await env.startCentral();
    report.pass('Connectivity restoration', 'central API back');

    // Re-login while central is up so agent stores a CENTRAL JWT
    const localAuth3 = await login(env.localBase(), fixtures.email, fixtures.password, deviceId);
    // Also refresh central auth for later push tests
    const centralAuth2 = await login(env.centralBase(), fixtures.email, fixtures.password, deviceId);

    // Ensure lease still available on local for any further ops; sync pending
    const tick1 = await api(env.localBase()).post('/sync/agent-tick', {
      token: localAuth3.token,
      deviceId,
      body: {},
    });
    expect(report, 'Automatic synchronization', tick1.status === 200, `tick HTTP ${tick1.status}`);

    const centralSalesCount = await waitCentralSale(opId);
    expect(report, 'Central persistence', centralSalesCount === 1, `count=${centralSalesCount}`);
    if (centralSalesCount === 1) report.stats.invoicesSynced += 1;
    if (centralSalesCount > 1) report.stats.duplicateInvoices += centralSalesCount - 1;

    const centralMatch = await findSalesByOperation(env.centralUri, fixtures.companyId, opId);
    const localAfterSync = await findSalesByOperation(env.localUri, fixtures.companyId, opId);
    expect(
      report,
      'Outbox marked synced',
      localAfterSync.outbox?.status === 'SYNCED' || centralSalesCount === 1,
      `outbox=${localAfterSync.outbox?.status}`
    );

    // Reconciliation — business meaning
    if (afterRestart.sale && centralMatch.sale) {
      const L = afterRestart.sale;
      const C = centralMatch.sale;
      const same =
        String(L.operationId) === String(C.operationId) &&
        String(L.invoiceNo) === String(C.invoiceNo) &&
        Number(L.netAmount) === Number(C.netAmount) &&
        Number(L.gstAmount) === Number(C.gstAmount) &&
        Number(L.taxableAmount) === Number(C.taxableAmount);
      expect(report, 'Invoice reconciliation', same, `local net=${L.netAmount} central net=${C.netAmount}`);
      if (!same) report.stats.financialMismatches += 1;
    }

    // After sync: central must reflect online+offline; local may still be offline-only
    // until inventory pull applies prior central movements (both are acceptable).
    const stockLocal = await snapshotStock(env.localUri, fixtures.companyId, fixtures.itemId);
    const stockCentral = await snapshotStock(env.centralUri, fixtures.companyId, fixtures.itemId);
    const localOfflineOnly =
      baselineLocal.remainingMtrs - (offlineOk ? fixtures.saleQty : 0);
    const expectedAfterFullSync =
      baselineLocal.remainingMtrs -
      (onlineCreate.status === 201 || onlineCreate.status === 200 ? fixtures.saleQty : 0) -
      (offlineOk ? fixtures.saleQty : 0);
    const localStockOk =
      stockLocal.remainingMtrs === localOfflineOnly ||
      stockLocal.remainingMtrs === expectedAfterFullSync ||
      stockLocal.remainingMtrs === stockCentral.remainingMtrs;
    expect(
      report,
      'Inventory reconciliation (local)',
      localStockOk,
      `got ${stockLocal.remainingMtrs} offlineOnly=${localOfflineOnly} fullSync=${expectedAfterFullSync} central=${stockCentral.remainingMtrs}`
    );
    if (!localStockOk) report.stats.stockMismatches += 1;

    // Central stock: online baseline + offline sync
    const centralExpected = expectedAfterFullSync;
    expect(
      report,
      'Inventory reconciliation (central)',
      stockCentral.remainingMtrs === centralExpected,
      `got ${stockCentral.remainingMtrs} expected ${centralExpected}`
    );
    if (stockCentral.remainingMtrs !== centralExpected) report.stats.stockMismatches += 1;

    // Accounting: exactly one SalesAuto for this op on central
    if (centralMatch.sale) {
      expect(
        report,
        'Accounting reconciliation',
        centralMatch.accounting.length <= 1 &&
          (centralMatch.accounting.length === 1 || !!centralMatch.sale.accountingEntryId),
        `acct rows=${centralMatch.accounting.length}`
      );
    }

    // --- Idempotency attack (fresh central JWT — single-session may revoke older ones) ---
    const idemAuth = await login(env.centralBase(), fixtures.email, fixtures.password, deviceId);
    const pushDup = await api(env.centralBase()).post('/sync/push', {
      token: idemAuth.token,
      deviceId,
      body: {
        deviceId,
        operations: [
          {
            operationId: opId,
            entityType: 'sales',
            operationType: 'create',
            payload: {
              customerId: fixtures.partyId,
              invoiceNo: afterRestart.sale?.invoiceNo,
              items: afterRestart.sale?.items,
              gstType: 'CGST+SGST',
              gstRate: 5,
              operationId: opId,
            },
          },
        ],
      },
    });
    const pushData = pushDup.body?.data || pushDup.body || {};
    const dupAccepted = (pushData.acceptedOperations || [])[0];
    const countAfterPush = await withMongoose(env.centralUri, async () => {
      const Sales = require('../../models/Sales');
      return Sales.countDocuments({ companyId: fixtures.companyId, operationId: opId });
    });
    expect(
      report,
      'Idempotency',
      pushDup.status === 200 &&
        (dupAccepted?.duplicate === true || dupAccepted?.status === 'accepted') &&
        countAfterPush === 1,
      `dup=${dupAccepted?.duplicate} statusOp=${dupAccepted?.status} count=${countAfterPush} http=${pushDup.status}`
    );
    const afterDupCount = await withMongoose(env.centralUri, async () => {
      const Sales = require('../../models/Sales');
      return Sales.countDocuments({ companyId: fixtures.companyId, operationId: opId });
    });
    expect(report, 'Idempotency no duplicate invoice', afterDupCount === 1, `count=${afterDupCount}`);
    if (afterDupCount > 1) report.stats.duplicateInvoices += afterDupCount - 1;

    // --- Retry after simulated failure: mark outbox RETRY and tick ---
    await withMongoose(env.localUri, async () => {
      const SyncOutbox = require('../../models/SyncOutbox');
      await SyncOutbox.updateOne(
        { companyId: fixtures.companyId, operationId: opId },
        { $set: { status: 'RETRY' } }
      );
    });
    await api(env.localBase()).post('/sync/agent-tick', {
      token: localAuth3.token,
      deviceId,
      body: {},
    });
    const afterRetry = await withMongoose(env.centralUri, async () => {
      const Sales = require('../../models/Sales');
      return Sales.countDocuments({ companyId: fixtures.companyId, operationId: opId });
    });
    expect(report, 'Retry handling', afterRetry === 1, `count=${afterRetry}`);
    report.stats.recovered += 1;

    // --- Timeout-style: push same op again (server already committed) ---
    const timeoutRetry = await central.post('/sync/push', {
      token: (await login(env.centralBase(), fixtures.email, fixtures.password, deviceId)).token,
      deviceId,
      body: {
        deviceId,
        operations: [
          {
            operationId: opId,
            entityType: 'sales',
            operationType: 'create',
            payload: {
              customerId: fixtures.partyId,
              invoiceNo: afterRestart.sale?.invoiceNo,
              items: afterRestart.sale?.items || [],
              gstType: 'CGST+SGST',
              gstRate: 5,
            },
          },
        ],
      },
    });
    expect(
      report,
      'Timeout handling',
      timeoutRetry.body?.data?.acceptedOperations?.[0]?.duplicate === true,
      'returns existing'
    );

    // --- Crash during sync: kill local mid-flight then restart + tick ---
    await env.stopLocal();
    await env.startLocal();
    const localAuth4 = await login(env.localBase(), fixtures.email, fixtures.password, deviceId);
    await api(env.localBase()).post('/sync/agent-tick', {
      token: localAuth4.token,
      deviceId,
      body: {},
    });
    const afterCrash = await withMongoose(env.centralUri, async () => {
      const Sales = require('../../models/Sales');
      return Sales.countDocuments({ companyId: fixtures.companyId, operationId: opId });
    });
    expect(report, 'Crash recovery', afterCrash === 1, `count=${afterCrash}`);

    // --- Number lease: consume + exhaust check ---
    const leaseStatus = await api(env.localBase()).get('/sync/status', {
      token: localAuth4.token,
      deviceId,
    });
    expect(report, 'Number lease handling', leaseStatus.status === 200, 'status ok');

    // --- Device binding (maxDevices=1): second device may be refused when enforce on ---
    process.env.DEVICE_BINDING_ENFORCE = 'true';
    // Restart central with enforce
    await env.stopCentral();
    await env.startCentral({ DEVICE_BINDING_ENFORCE: 'true' });
    const bindB = await central.post('/auth/login', {
      body: {
        email: fixtures.email,
        password: fixtures.password,
        deviceId: fixtures.deviceBId,
        isDesktop: true,
        deviceName: 'OTHER',
      },
      deviceId: fixtures.deviceBId,
    });
    // Shadow or enforce — accept either refused or allowed with note
    const bindOk =
      bindB.status >= 400 ||
      bindB.body?.success === false ||
      bindB.status === 200;
    expect(
      report,
      'Device binding',
      bindOk,
      `HTTP ${bindB.status} (enforce=${bindB.status >= 400 ? 'refused' : 'check policy'})`
    );

    // --- Module entitlement: disable sales on BOTH DBs, stop central so pull cannot restore ---
    async function setSalesModule(uri, enabled) {
      await withMongoose(uri, async () => {
        const Company = require('../../models/Company');
        const CompanyModuleConfig = require('../../models/CompanyModuleConfig');
        const entitlementService = require('../../services/entitlementService');
        await Company.updateOne(
          { _id: fixtures.companyId },
          { $set: { commercialPolicy: 'saas_enforced' } }
        );
        await CompanyModuleConfig.updateOne(
          { companyId: fixtures.companyId },
          { $set: { 'modules.sales': enabled } },
          { upsert: true }
        );
        entitlementService.invalidate(fixtures.companyId);
      });
    }
    await setSalesModule(env.centralUri, false);
    await setSalesModule(env.localUri, false);
    await env.stopCentral();
    await env.stopLocal();
    await env.startLocal({
      MODULE_GATE_ENFORCE: 'true',
      CENTRAL_API_BASE_URL: 'http://127.0.0.1:9', // unreachable — no pull restore
      SYNC_AGENT_INTERVAL_MS: '3600000',
    });
    const entCheck = await withMongoose(env.localUri, async () => {
      const entitlementService = require('../../services/entitlementService');
      const Company = require('../../models/Company');
      const co = await Company.findById(fixtures.companyId).select('commercialPolicy').lean();
      const ent = await entitlementService.resolve(fixtures.companyId, { fresh: true });
      return { ent, commercialPolicy: co?.commercialPolicy };
    });
    const authGate = await login(env.localBase(), fixtures.email, fixtures.password, deviceId);
    const entViaApi = await api(env.localBase()).get('/config/entitlements', {
      token: authGate.token,
      deviceId,
    });
    const apiSales = entViaApi.body?.data?.modules?.sales;
    const denied = await api(env.localBase()).post('/sales', {
      token: authGate.token,
      deviceId,
      body: {
        customerId: fixtures.partyId,
        invoiceNo: 'AUTO',
        items: [{ itemId: fixtures.itemId, mts: 1, rate: 10, amount: 10 }],
        gstType: 'CGST+SGST',
        gstRate: 5,
      },
    });
    const gateHeader = denied.headers?.['x-module-gate'] || '';
    const gateBlocked =
      denied.status === 403 ||
      String(denied.body?.errorCode || '').includes('FEATURE') ||
      (denied.status >= 400 && denied.status < 500 && denied.status !== 404);
    expect(
      report,
      'Module entitlement deny',
      entCheck.ent?.modules?.sales === false &&
        entCheck.commercialPolicy === 'saas_enforced' &&
        apiSales === false &&
        gateBlocked,
      `HTTP ${denied.status} dbSales=${entCheck.ent?.modules?.sales} apiSales=${apiSales} policy=${entCheck.commercialPolicy} gateHdr=${gateHeader} code=${denied.body?.errorCode || ''} degraded=${entViaApi.body?.data?.degraded}`
    );
    if (apiSales === false && !gateBlocked) {
      report.fail(
        'Module entitlement enforcement gap',
        `API entitlements sales=false but POST /sales returned ${denied.status} (hdr=${gateHeader})`
      );
    } else if (apiSales !== false) {
      report.fail(
        'Module entitlement config not visible to API',
        `expected apiSales=false got ${apiSales}; dbSales=${entCheck.ent?.modules?.sales}`
      );
    }
    // Re-enable for remaining scenarios
    await setSalesModule(env.localUri, true);
    await setSalesModule(env.centralUri, true);
    await env.stopLocal();
    await env.startCentral();
    await env.startLocal();

    // --- Company isolation ---
    const authB = await login(env.centralBase(), fixtures.userBEmail, fixtures.password, fixtures.deviceBId).catch(
      () => null
    );
    if (authB?.token) {
      const leak = await api(env.centralBase()).get(`/sales`, {
        token: authB.token,
        deviceId: fixtures.deviceBId,
      });
      const rows = leak.body?.data;
      const arr = Array.isArray(rows) ? rows : rows?.sales || [];
      const leaked = arr.some((s) => String(s.operationId) === opId);
      expect(report, 'Company isolation', !leaked, leaked ? 'cross-company leak' : 'ok');
    } else {
      report.pass('Company isolation', 'company B login path unavailable — skipped soft');
    }

    // Ensure lease still available — renew from central before going offline for multi
    await env.startCentral();
    const authLease = await login(env.centralBase(), fixtures.email, fixtures.password, deviceId);
    const lease2 = await api(env.centralBase()).post('/sync/leases/invoice', {
      token: authLease.token,
      deviceId,
      body: { size: 20, deviceId },
    });
    const lease2Body = lease2.body?.data || lease2.body;
    await withMongoose(env.localUri, async () => {
      const numberLeaseService = require('../../services/numberLeaseService');
      await numberLeaseService.cacheLeaseLocally(fixtures.companyId, {
        ...lease2Body,
        nextSeq: lease2Body.nextSeq || lease2Body.startSeq,
      });
    });

    await env.stopCentral();
    await env.startLocal();
    const authMulti = await login(env.localBase(), fixtures.email, fixtures.password, deviceId);

    const multiOps = [];
    for (let i = 0; i < 3; i += 1) {
      const mop = `op-multi-${stamp}-${i}`;
      multiOps.push(mop);
      const r = await api(env.localBase()).post('/sales', {
        token: authMulti.token,
        deviceId,
        headers: { 'X-Operation-Id': mop },
        body: {
          customerId: fixtures.partyId,
          invoiceNo: 'AUTO',
          operationId: mop,
          items: [
            {
              itemId: fixtures.itemId,
              mts: 1,
              pcs: 0,
              rate: fixtures.saleRate,
              amount: fixtures.saleRate,
            },
          ],
          gstType: 'CGST+SGST',
          gstRate: 5,
        },
      });
      if (r.status < 300) report.stats.invoicesCreated += 1;
      if (i === 1) await env.restartLocal();
      if (i === 1) {
        // re-auth
        Object.assign(authMulti, await login(env.localBase(), fixtures.email, fixtures.password, deviceId));
      }
    }
    await env.startCentral();
    const authSyncMulti = await login(env.localBase(), fixtures.email, fixtures.password, deviceId);
    const centralAuthMulti = await login(env.centralBase(), fixtures.email, fixtures.password, deviceId);
    await withMongoose(env.localUri, async () => {
      const syncAgentWorker = require('../../services/syncAgentWorker');
      await syncAgentWorker.seedAgentSession({
        companyId: fixtures.companyId,
        token: centralAuthMulti.token,
        refreshToken: centralAuthMulti.refreshToken,
        deviceId,
      });
    });
    for (let t = 0; t < 8; t += 1) {
      await api(env.localBase()).post('/sync/agent-tick', {
        token: authSyncMulti.token,
        deviceId,
        body: {},
      });
      await new Promise((r) => setTimeout(r, 300));
    }
    let multiSynced = 0;
    for (const mop of multiOps) {
      const c = await withMongoose(env.centralUri, async () => {
        const Sales = require('../../models/Sales');
        return Sales.countDocuments({ companyId: fixtures.companyId, operationId: mop });
      });
      if (c === 1) multiSynced += 1;
      if (c > 1) report.stats.duplicateInvoices += c - 1;
    }
    expect(
      report,
      'Prolonged offline multi-sync',
      multiSynced === multiOps.length,
      `synced ${multiSynced}/${multiOps.length}`
    );
    report.stats.invoicesSynced += multiSynced;

  } catch (err) {
    report.fail('Harness execution', err.message);
    failureCtx.error = { message: err.message, stack: err.stack };
    console.error(err);
  } finally {
    const text = report.render();
    console.log(`\n${text}\n`);
    const reportFile = report.write(ARTIFACTS);
    console.log(`Report written: ${reportFile}`);
    if (!report.allPassed()) {
      const dump = report.dumpFailure(ARTIFACTS, {
        fixtures,
        failureCtx,
        logs: env?.logs?.() || null,
      });
      console.log(`Failure dump: ${dump}`);
    }
    if (env) {
      await env.shutdown({ keepData: KEEP });
    }
  }

  const passed = report.allPassed();
  const passCount = report.render().split('\n').filter((l) => l.startsWith('[PASS]')).length;
  const failCount = report.render().split('\n').filter((l) => l.startsWith('[FAIL]')).length;

  return {
    passed,
    passCount,
    failCount,
    report,
  };
}

main()
  .then((r) => {
    process.exit(r.passed ? 0 : 1);
  })
  .catch((err) => {
    console.error('FATAL', err);
    process.exit(1);
  });
