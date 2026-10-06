'use strict';

/**
 * PHASE 3: SAME COMPANY WEB + DESKTOP SYNCHRONIZATION CERTIFICATION SUITE
 * =======================================================================
 * Certifies:
 *   3.1 Company Identity & Multi-tenant Isolation
 *   3.2 Cloud Data Visibility (Desktop Offline -> Cloud -> Web, and Web -> Desktop)
 *   3.3 Master Data Synchronization (Customers, Suppliers, Items, Warehouses, Units)
 *       + Versioning/Conflict Protection (No blind overwrites)
 *   3.4 Web Regression & ERP Integrity
 *
 * NEVER connects to production. Runs in isolated memory DBs.
 */

const crypto = require('crypto');
const path = require('path');
const { bootHybridE2eEnv } = require('../../lib/env');
const { seedCentralFixtures, withMongoose } = require('../../lib/fixtures');
const { api } = require('../../lib/http');
const { assertNotProduction } = require('../../../helpers/memoryDb');

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

async function login(base, email, password, deviceId, isDesktop = false) {
  const res = await api(base).post('/auth/login', {
    body: { email, password, deviceId, isDesktop, deviceName: isDesktop ? 'OFFICE-DESKTOP' : 'CHROME-WEB' },
    deviceId,
  });
  if (res.status !== 200) throw new Error(`Login failed (${res.status}): ${JSON.stringify(res.body)}`);
  const payload = res.body?.data || res.body;
  return { token: payload.token, refreshToken: payload.refreshToken, user: payload.user };
}

async function agentTick(base, token, deviceId) {
  return api(base).post('/sync/agent-tick', { token, deviceId, body: {} });
}

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

async function main() {
  const stamp = Date.now();
  console.log('\n' + '='.repeat(68));
  console.log('  PHASE 3: WEB + DESKTOP SYNCHRONIZATION CERTIFICATION');
  console.log('='.repeat(68) + '\n');

  let env;
  try {
    env = await bootHybridE2eEnv();
    const fixtures = await seedCentralFixtures(env.centralUri, stamp);

    // Create a distinct web user in the same company (Home laptop user)
    const webUserEmail = `web.user.${stamp}@test.local`;
    await withMongoose(env.centralUri, async () => {
      const User = require('../../../../models/User');
      await User.create({
        name: 'WEB-HOME-LAPTOP-USER',
        email: webUserEmail,
        password: fixtures.password,
        role: 'user',
        companyRole: 'admin',
        companyId: fixtures.companyId,
        isActive: true,
      });
    });

    await env.startCentral();
    await env.cloneCentralToLocal();
    await env.startLocal();

    const central = api(env.centralBase());
    const local = api(env.localBase());
    const deviceId = fixtures.deviceId;

    // Login Desktop user locally and on Central (agent session)
    const localAuth = await login(env.localBase(), fixtures.email, fixtures.password, deviceId, true);
    const centralAgentAuth = await login(env.centralBase(), fixtures.email, fixtures.password, deviceId, true);

    // Login Web user on Central (Home Laptop Web browser)
    const webAuth = await login(env.centralBase(), webUserEmail, fixtures.password, 'WEB-BROWSER-CHROME-1', false);

    // Seed agent with central token for syncAgentWorker
    await withMongoose(env.localUri, async () => {
      const syncAgentWorker = require('../../../../services/syncAgentWorker');
      await syncAgentWorker.seedAgentSession({
        companyId: fixtures.companyId,
        token: centralAgentAuth.token,
        refreshToken: centralAgentAuth.refreshToken,
        deviceId,
      });
    });

    // Allocate invoice leases from central and cache locally
    const leaseRes = await central.post('/sync/leases/invoice', {
      token: centralAgentAuth.token,
      deviceId,
      body: { size: 50, deviceId },
    });
    assert(leaseRes.status === 201, `Central lease failed: ${leaseRes.status}`);
    const lease = leaseRes.body?.data || leaseRes.body;
    await withMongoose(env.localUri, async () => {
      const numberLeaseService = require('../../../../services/numberLeaseService');
      await numberLeaseService.cacheLeaseLocally(fixtures.companyId, {
        ...lease,
        nextSeq: lease.nextSeq || lease.startSeq,
      });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // GROUP 1: PHASE 3.1 — COMPANY IDENTITY & TENANT ISOLATION
    // ──────────────────────────────────────────────────────────────────────────
    console.log('[Phase 3.1] Company Identity & Multi-tenant Isolation');

    await test('Desktop and Web authenticate into the same logical companyId', async () => {
      assert(String(localAuth.user.companyId) === String(fixtures.companyId), 'Local user company mismatch');
      assert(String(webAuth.user.companyId) === String(fixtures.companyId), 'Web user company mismatch');
      assert(String(localAuth.user.companyId) === String(webAuth.user.companyId), 'Desktop and Web companyId must match');
    });

    await test('Company identity strictly derived from JWT — client body companyId cannot hijack tenant', async () => {
      const fakeCompanyId = new (require('mongodb').ObjectId)().toString();
      // Try creating a party while injecting a spoofed companyId in request body
      const res = await central.post('/parties', {
        token: webAuth.token,
        body: {
          name: `Spoof-Test-Party-${stamp}`,
          type: 'Customer',
          companyId: fakeCompanyId,
        },
      });
      assert(res.status === 201, `Expected 201, got ${res.status}`);
      const party = res.body?.data || res.body;
      assert(String(party.companyId) === String(fixtures.companyId), 'CompanyId was not overridden by server auth context');
      assert(String(party.companyId) !== fakeCompanyId, 'Security vulnerability: client spoofed companyId accepted');
    });

    await test('Multi-company isolation: Company B cannot access Company A data', async () => {
      const bAuth = await login(env.centralBase(), fixtures.userBEmail, fixtures.password, fixtures.deviceBId, false);
      const bParties = await central.get('/parties', { token: bAuth.token });
      const partyItems = bParties.body?.data?.items || bParties.body?.data || [];
      assert(partyItems.length === 0, `Company B should see 0 of Company A parties, got ${partyItems.length}`);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // GROUP 2: PHASE 3.2 — CLOUD DATA VISIBILITY (OFFLINE DESKTOP -> CLOUD -> WEB)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[Phase 3.2] Cloud Data Visibility (Offline Desktop -> Cloud -> Web)');

    const offlineSalesOpId = crypto.randomUUID();
    let createdSalesInvoiceNo = '';

    await test('Office Desktop creates transaction offline (Sales)', async () => {
      // Disconnect local from central by stopping central temporarily
      await env.stopCentral();

      const saleRes = await local.post('/sales', {
        token: localAuth.token,
        deviceId,
        body: {
          operationId: offlineSalesOpId,
          customerId: fixtures.partyId,
          invoiceNo: 'AUTO',
          deviceId,
          invoiceType: 'Tax',
          paymentMode: 'CREDIT',
          items: [{
            itemId: fixtures.itemId,
            mts: 10,
            pcs: 0,
            rate: 250,
            amount: 2500,
          }],
          gstType: 'CGST+SGST',
          gstRate: 5,
        },
      });
      assert(saleRes.status === 201 || saleRes.status === 200, `Offline sales create failed ${saleRes.status}: ${JSON.stringify(saleRes.body)}`);
      createdSalesInvoiceNo = saleRes.body?.data?.invoiceNo || saleRes.body?.invoiceNo;
      assert(createdSalesInvoiceNo, 'Expected leased invoiceNo in created sale');

      // Verify transaction committed locally in local MongoDB
      await withClient(env.localUri, async (db) => {
        const found = await db.collection('sales').findOne({ operationId: offlineSalesOpId });
        assert(found, 'Sale not found in local MongoDB');
        const outbox = await db.collection('sync_outbox').findOne({ operationId: offlineSalesOpId });
        assert(outbox, 'Outbox record not found locally');
        assert(outbox.status === 'PENDING', `Expected PENDING outbox, got ${outbox.status}`);
      });
    });

    await test('Internet ON -> Sync -> Desktop pushes transaction to Central', async () => {
      // Restart central (internet restored)
      await env.startCentral();

      // Trigger sync agent tick on local
      const tickRes = await agentTick(env.localBase(), localAuth.token, deviceId);
      assert(tickRes.status === 200, `Agent tick failed: ${tickRes.status}`);

      // Verify outbox on local is SYNCED
      await withClient(env.localUri, async (db) => {
        const outbox = await db.collection('sync_outbox').findOne({ operationId: offlineSalesOpId });
        assert(outbox && outbox.status === 'SYNCED', `Outbox not SYNCED, status=${outbox?.status}`);
      });
    });

    await test('Home Laptop Web logs in to same company and immediately sees offline sale', async () => {
      // Web user queries Central
      const webSalesRes = await central.get('/sales', { token: webAuth.token });
      assert(webSalesRes.status === 200, `Web sales query failed: ${webSalesRes.status}`);
      const salesList = webSalesRes.body?.data?.sales || webSalesRes.body?.data || [];
      const foundSale = salesList.find(s => s.invoiceNo === createdSalesInvoiceNo || s.operationId === offlineSalesOpId);
      assert(foundSale, `Invoice ${createdSalesInvoiceNo} not visible on Web! Found: ${JSON.stringify(salesList.map(s => s.invoiceNo))}`);
      assert(Number(foundSale.netAmount) > 0, `Expected netAmount > 0, got ${foundSale.netAmount}`);
    });

    const offlinePurOpId = crypto.randomUUID();
    let createdPurInvoiceNo = `PUR-OFFLINE-${stamp}`;

    await test('Office Desktop creates offline Purchase -> Syncs -> Visible on Web', async () => {
      const purRes = await local.post('/purchases', {
        token: localAuth.token,
        deviceId,
        body: {
          operationId: offlinePurOpId,
          supplierId: fixtures.partyId,
          invoiceNo: createdPurInvoiceNo,
          supplierInvoiceNo: `SI-OFFLINE-${stamp}`,
          taxableAmount: 2000,
          cgst: 50,
          sgst: 50,
          igst: 0,
          gstAmount: 100,
          netAmount: 2100,
          gstType: 'CGST+SGST',
          items: [{
            itemId: fixtures.itemId,
            pcs: 5,
            mts: 100,
            rate: 20,
            amount: 2000,
            gstPer: 5,
            gstAmt: 100,
          }],
        },
      });
      assert(purRes.status === 201 || purRes.status === 200, `Purchase create failed: ${purRes.status}: ${JSON.stringify(purRes.body)}`);

      // Sync to central
      await agentTick(env.localBase(), localAuth.token, deviceId);

      // Web user checks purchases on Central
      const webPurRes = await central.get('/purchases', { token: webAuth.token });
      assert(webPurRes.status === 200, `Web purchase query failed: ${webPurRes.status}`);
      const purList = webPurRes.body?.data?.purchases || webPurRes.body?.data || [];
      const foundPur = purList.find(p => p.invoiceNo === createdPurInvoiceNo || p.operationId === offlinePurOpId);
      assert(foundPur, `Purchase ${createdPurInvoiceNo} not visible on Web!`);
      assert(Number(foundPur.netAmount) === 2100, `Purchase netAmount mismatch: ${foundPur.netAmount}`);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // GROUP 3: PHASE 3.3 — MASTER DATA SYNCHRONIZATION & CONFLICT HANDLING
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[Phase 3.3] Master Data Synchronization (Bidirectional & Conflict Protection)');

    const webCustomerName = `Web-Customer-${stamp}`;
    const webItemName = `Web-Item-Fabric-${stamp}`;
    const webWarehouseCode = `WH-WEB-${String(stamp).slice(-4)}`;
    const webSubMasterName = `Unit-Bundle-${stamp}`;
    let webCreatedCustomer, webCreatedItem, webCreatedWarehouse, webCreatedSubMaster;

    await test('Web user creates Master Data on Central (Customer, Item, Warehouse, SubMaster)', async () => {
      // 1. Party (Customer)
      const pRes = await central.post('/parties', {
        token: webAuth.token,
        body: {
          name: webCustomerName,
          type: 'Customer',
          mobile: '9876543210',
          city: 'Surat',
        },
      });
      assert(pRes.status === 201, `Customer create failed: ${pRes.status}`);
      webCreatedCustomer = pRes.body?.data || pRes.body;

      // 2. Item
      const iRes = await central.post('/items', {
        token: webAuth.token,
        body: {
          name: webItemName,
          itemCode: `ITM-WEB-${String(stamp).slice(-4)}`,
          salesRate: 350,
          purchaseRate: 280,
          unit: 'MTRS',
        },
      });
      assert(iRes.status === 201, `Item create failed: ${iRes.status}`);
      webCreatedItem = iRes.body?.data || iRes.body;

      // 3. Warehouse
      const wRes = await central.post('/warehouses', {
        token: webAuth.token,
        body: {
          name: `Godown Web ${stamp}`,
          code: webWarehouseCode,
          type: 'Godown',
        },
      });
      assert(wRes.status === 201, `Warehouse create failed: ${wRes.status}`);
      webCreatedWarehouse = wRes.body?.data || wRes.body;

      // 4. SubMaster
      const sRes = await central.post('/submasters', {
        token: webAuth.token,
        body: {
          type: 'Unit',
          name: webSubMasterName,
        },
      });
      assert(sRes.status === 201, `SubMaster create failed: ${sRes.status}`);
      webCreatedSubMaster = sRes.body?.data || sRes.body;
    });

    await test('Desktop agent pulls incremental changes -> local MongoDB receives Web-created masters', async () => {
      // Run agent tick to pull masters from Central
      const tickRes = await agentTick(env.localBase(), localAuth.token, deviceId);
      if (tickRes.status !== 200) throw new Error(`Agent tick failed (${tickRes.status}): ${JSON.stringify(tickRes.body)}`);
      if (tickRes.body?.data?.agent?.lastError) throw new Error(`Agent tick error: ${tickRes.body.data.agent.lastError}`);

      // Verify on Desktop local Mongo
      await withClient(env.localUri, async (db) => {
        const party = await db.collection('parties').findOne({ name: webCustomerName, companyId: toOid(fixtures.companyId) });
        assert(party, 'Web-created customer not found on local Desktop DB');
        assert(party.city === 'Surat', `Party city mismatch: ${party.city}`);

        const item = await db.collection('items').findOne({ name: webItemName, companyId: toOid(fixtures.companyId) });
        assert(item, 'Web-created item not found on local Desktop DB');
        assert(Number(item.salesRate) === 350, `Item salesRate mismatch: ${item.salesRate}`);

        const wh = await db.collection('warehouses').findOne({ code: webWarehouseCode, companyId: toOid(fixtures.companyId) });
        assert(wh, 'Web-created warehouse not found on local Desktop DB');

        const sm = await db.collection('submasters').findOne({ name: webSubMasterName, companyId: toOid(fixtures.companyId) });
        assert(sm, 'Web-created submaster not found on local Desktop DB');
      });
    });

    const desktopPartyName = `Desktop-Party-${stamp}`;
    await test('Desktop creates Master Data locally -> Pushes -> Visible on Web', async () => {
      const pRes = await local.post('/parties', {
        token: localAuth.token,
        deviceId,
        body: {
          name: desktopPartyName,
          type: 'Supplier',
          city: 'Mumbai',
        },
      });
      assert(pRes.status === 201, `Desktop party create failed: ${pRes.status}`);

      // Push to central
      const pushTickRes = await agentTick(env.localBase(), localAuth.token, deviceId);
      if (pushTickRes.status !== 200) throw new Error(`Push tick failed (${pushTickRes.status}): ${JSON.stringify(pushTickRes.body)}`);
      if (pushTickRes.body?.data?.agent?.lastError) throw new Error(`Push tick error: ${pushTickRes.body.data.agent.lastError}`);

      // Web user queries Central
      const webParties = await central.get('/parties', { token: webAuth.token });
      const partyList = webParties.body?.data?.items || webParties.body?.data || [];
      const found = partyList.find(p => p.name === desktopPartyName);
      assert(found, `Desktop-created party ${desktopPartyName} not visible on Web!`);
      assert(found.city === 'Mumbai', `Party city mismatch: ${found.city}`);
    });

    await test('Versioning & Conflict Protection: Newer local edit is not blindly overwritten by older pull', async () => {
      // Modify webCreatedItem on desktop with a NEWER local timestamp and new salesRate
      const newerDate = new Date(Date.now() + 60000); // 1 minute in the future
      await withClient(env.localUri, async (db) => {
        await db.collection('items').updateOne(
          { name: webItemName },
          { $set: { salesRate: 999, updatedAt: newerDate } }
        );
      });

      // Central sends an older revision of the item
      const olderDoc = {
        _id: webCreatedItem._id,
        name: webItemName,
        salesRate: 100, // older lower rate
        updatedAt: new Date(Date.now() - 60000).toISOString(),
        companyId: fixtures.companyId,
      };

      // Directly apply pulled change using applyPulledChanges on desktop local
      const syncPullService = require('../../../../services/syncPullService');
      await withMongoose(env.localUri, async () => {
        await syncPullService.applyPulledChanges([{
          entityType: 'Item',
          doc: olderDoc,
        }]);
      });

      // Verify that local item was NOT overwritten with older salesRate (100)
      await withClient(env.localUri, async (db) => {
        const item = await db.collection('items').findOne({ name: webItemName });
        assert(item, 'Item not found');
        assert(Number(item.salesRate) === 999, `Conflict protection failed! Overwritten with older data: ${item.salesRate}`);
      });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // GROUP 4: PHASE 3.4 — WEB REGRESSION & ERP INTEGRITY
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[Phase 3.4] Web Regression & ERP Integrity');

    await test('Web login & auth endpoints function correctly', async () => {
      const freshWebAuth = await login(env.centralBase(), fixtures.email, fixtures.password, 'WEB-BROWSER-CHROME-2', false);
      assert(freshWebAuth.token, 'Web login did not return JWT token');
    });

    await test('Web sales listing & reports return 200 OK', async () => {
      const res = await central.get('/sales', { token: webAuth.token });
      assert(res.status === 200, `Sales endpoint returned ${res.status}`);
      const sales = res.body?.data?.sales || res.body?.data || [];
      assert(Array.isArray(sales), 'Sales list must be array');
    });

    await test('Web purchases listing returns 200 OK', async () => {
      const res = await central.get('/purchases', { token: webAuth.token });
      assert(res.status === 200, `Purchases endpoint returned ${res.status}`);
    });

    await test('Web parties and items master listings return 200 OK', async () => {
      const pRes = await central.get('/parties', { token: webAuth.token });
      assert(pRes.status === 200, `Parties endpoint returned ${pRes.status}`);
      const iRes = await central.get('/items', { token: webAuth.token });
      assert(iRes.status === 200, `Items endpoint returned ${iRes.status}`);
    });

    await test('Web accounting and stock balances remain consistent and non-regressive', async () => {
      await withClient(env.centralUri, async (db) => {
        const accountsCount = await db.collection('accountingentries').countDocuments({ companyId: toOid(fixtures.companyId) });
        assert(accountsCount > 0, `Expected accounting entries on central, got ${accountsCount}`);
        const lotsCount = await db.collection('inventorylots').countDocuments({ companyId: toOid(fixtures.companyId) });
        assert(lotsCount > 0, `Expected inventory lots on central, got ${lotsCount}`);
      });
    });

  } finally {
    if (env) {
      await env.shutdown({ keepData: false }).catch(() => {});
    }
  }

  console.log('\n' + '='.repeat(68));
  console.log(`  PHASE 3 CERTIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('='.repeat(68));

  if (failures.length > 0) {
    console.log('\nFAILURES:');
    for (const f of failures) console.log(`  - [${f.label}]: ${f.error}`);
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
