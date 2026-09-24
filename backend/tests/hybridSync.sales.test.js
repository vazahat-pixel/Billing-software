/**
 * Hybrid sync — Sales certification / regression tests.
 * Covers: leases, outbox, operationId idempotency, push duplicate prevention.
 *
 * Run: node backend/tests/hybridSync.sales.test.js
 * (uses mongodb-memory-server when available)
 */
const assert = require('assert');

process.env.NODE_ENV = 'test';
process.env.HYBRID_SYNC_ENABLED = 'true';
process.env.DESKTOP_LOCAL = 'true';
process.env.DESKTOP_HYBRID = 'true';
process.env.MONGO_REPLICA_SET = 'false';
process.env.JWT_SECRET = 'test-jwt-secret-minimum-32-characters!!';
process.env.MODULE_GATE_ENFORCE = 'false';
process.env.DEVICE_BINDING_ENFORCE = 'false';

async function main() {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const Plan = require('../models/Plan');
  const mongoose = require('mongoose');

  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri('hybrid_sync_test');
  await mongoose.connect(uri);

  const Company = require('../models/Company');
  const User = require('../models/User');
  const Party = require('../models/Party');
  const Item = require('../models/Item');
  const InventoryLot = require('../models/InventoryLot');
  const Sales = require('../models/Sales');
  const SyncOutbox = require('../models/SyncOutbox');
  const ProcessedOperation = require('../models/ProcessedOperation');
  const numberLeaseService = require('../services/numberLeaseService');
  const salesService = require('../services/salesService');
  const syncPushService = require('../services/syncPushService');
  const offlineSession = require('../services/offlineSessionService');
  const configService = require('../services/configService');

  const ownerId = new mongoose.Types.ObjectId();
  const plan = await Plan.create({
    name: 'Hybrid Pilot',
    slug: `hybrid-pilot-${Date.now()}`,
    priceMonthly: 0,
    priceYearly: 0,
    features: { modules: { sales: true, inventory: true, accounting: true, gst: true, masters: true } },
  });

  const company = await Company.create({
    name: 'Hybrid Test Co',
    status: 'active',
    isActive: true,
    ownerId,
    planId: plan._id,
  });
  await configService.seedCompanyDefaults(company._id);

  const user = await User.create({
    name: 'Owner',
    email: `hybrid-${Date.now()}@test.local`,
    password: 'TestPass123!',
    role: 'user',
    companyRole: 'owner',
    companyId: company._id,
    isActive: true,
  });
  await Company.updateOne({ _id: company._id }, { $set: { ownerId: user._id } });

  const party = await Party.create({
    companyId: company._id,
    name: 'Customer A',
    type: 'Customer',
  });
  const item = await Item.create({
    companyId: company._id,
    name: 'Fabric',
    unit: 'MTRS',
    category: 'Grey',
    gstRate: 5,
  });
  await InventoryLot.create({
    companyId: company._id,
    itemId: item._id,
    lotId: 'L1',
    totalMtrs: 1000,
    remainingMtrs: 1000,
    totalPcs: 100,
    remainingPcs: 100,
    source: 'opening',
    status: 'Available',
  });

  // --- Offline session: no plaintext ---
  await offlineSession.storeLocalSession({
    companyId: company._id,
    userId: user._id,
    email: user.email,
    password: 'TestPass123!',
    deviceId: 'device-1',
  });
  const SyncState = require('../models/SyncState');
  const sess = await SyncState.findOne({ key: 'offline:session' }).lean();
  assert.ok(sess.value.passwordHash);
  assert.ok(!JSON.stringify(sess.value).includes('TestPass123!'));
  const verifyOk = await offlineSession.verifyLocalSession({
    email: user.email,
    password: 'TestPass123!',
    deviceId: 'device-1',
  });
  assert.strictEqual(verifyOk.ok, true);
  console.log('OK offline session hash');

  // --- Lease allocate + local consume ---
  const lease = await numberLeaseService.allocateInvoiceLease(company._id, 'device-1', { size: 5 });
  assert.ok(lease.leaseId);
  await numberLeaseService.cacheLeaseLocally(company._id, lease);
  const n1 = await numberLeaseService.consumeLocalLease(company._id, 'sales');
  assert.ok(n1.number.startsWith(lease.prefix));
  console.log('OK lease allocate/consume', n1.number);

  // --- Local hybrid create → outbox ---
  const opId = `op-sales-${Date.now()}`;
  const sale = await salesService.createInvoice(
    {
      companyId: company._id,
      customerId: party._id,
      invoiceNo: 'AUTO',
      items: [{ itemId: item._id, mts: 10, pcs: 0, rate: 100, amount: 1000 }],
      gstType: 'CGST+SGST',
      gstRate: 5,
      operationId: opId,
      deviceId: 'device-1',
    },
    { operationId: opId, deviceId: 'device-1' }
  );
  assert.ok(sale._id);
  assert.strictEqual(sale.operationId, opId);
  assert.ok(sale.invoiceNo);
  assert.ok(sale.netAmount > 0);

  const outbox = await SyncOutbox.findOne({ companyId: company._id, operationId: opId });
  assert.ok(outbox, 'outbox row missing');
  assert.strictEqual(outbox.status, 'PENDING');
  console.log('OK sales create + outbox', sale.invoiceNo, sale.netAmount);

  // --- Idempotent local retry ---
  const sale2 = await salesService.createInvoice(
    {
      companyId: company._id,
      customerId: party._id,
      invoiceNo: 'AUTO',
      items: [{ itemId: item._id, mts: 10, pcs: 0, rate: 100, amount: 1000 }],
      operationId: opId,
    },
    { operationId: opId, enqueueOutbox: false }
  );
  assert.strictEqual(String(sale2._id), String(sale._id));
  const salesCount = await Sales.countDocuments({ companyId: company._id, operationId: opId });
  assert.strictEqual(salesCount, 1);
  console.log('OK local operationId idempotency');

  // --- Central push (same DB simulating central) with leased invoice ---
  // Mark a second lease number for push path: use sale.invoiceNo already leased
  process.env.DESKTOP_HYBRID = 'false'; // push path uses central create without local outbox
  process.env.DESKTOP_LOCAL = 'false';

  const pushOpId = `op-push-${Date.now()}`;
  const lease2 = await numberLeaseService.allocateInvoiceLease(company._id, 'device-1', { size: 3 });
  const pushInvoiceNo = numberLeaseService.formatNumber(
    lease2.prefix,
    lease2.financialYearCode,
    lease2.startSeq,
    lease2.padLength
  );

  // Ensure stock for second invoice
  await InventoryLot.updateOne(
    { companyId: company._id, itemId: item._id },
    { $inc: { remainingMtrs: 50, totalMtrs: 50 } }
  );

  const push1 = await syncPushService.pushOperations({
    companyId: company._id,
    userId: user._id,
    deviceId: 'device-1',
    operations: [
      {
        operationId: pushOpId,
        entityType: 'sales',
        operationType: 'create',
        payload: {
          customerId: party._id,
          invoiceNo: pushInvoiceNo,
          items: [{ itemId: item._id, mts: 5, pcs: 0, rate: 100, amount: 500 }],
          gstType: 'CGST+SGST',
          gstRate: 5,
        },
      },
    ],
  });
  assert.strictEqual(push1.acceptedOperations.length, 1);
  assert.strictEqual(push1.acceptedOperations[0].duplicate, false);

  const push2 = await syncPushService.pushOperations({
    companyId: company._id,
    userId: user._id,
    deviceId: 'device-1',
    operations: [
      {
        operationId: pushOpId,
        entityType: 'sales',
        operationType: 'create',
        payload: {
          customerId: party._id,
          invoiceNo: pushInvoiceNo,
          items: [{ itemId: item._id, mts: 5, pcs: 0, rate: 100, amount: 500 }],
          gstType: 'CGST+SGST',
          gstRate: 5,
        },
      },
    ],
  });
  assert.strictEqual(push2.acceptedOperations.length, 1);
  assert.strictEqual(push2.acceptedOperations[0].duplicate, true);
  const processed = await ProcessedOperation.countDocuments({
    companyId: company._id,
    operationId: pushOpId,
  });
  assert.strictEqual(processed, 1);
  const salesForPush = await Sales.countDocuments({
    companyId: company._id,
    operationId: pushOpId,
  });
  assert.strictEqual(salesForPush, 1);
  console.log('OK central push idempotency');

  // --- Lease exhaustion ---
  process.env.DESKTOP_HYBRID = 'true';
  process.env.DESKTOP_LOCAL = 'true';
  await numberLeaseService.cacheLeaseLocally(company._id, {
    ...lease2,
    nextSeq: lease2.endSeq + 1,
    startSeq: lease2.startSeq,
    endSeq: lease2.endSeq,
  });
  let exhausted = false;
  try {
    await numberLeaseService.consumeLocalLease(company._id, 'sales');
  } catch (err) {
    exhausted = /exhausted|renew/i.test(err.message);
  }
  assert.ok(exhausted, 'expected lease exhaustion error');
  console.log('OK lease exhaustion blocks AUTO');

  await mongoose.disconnect();
  await mongod.stop();
  console.log('\nAll hybrid Sales sync tests passed.');
}

main().catch((err) => {
  console.error('FAIL', err);
  process.exit(1);
});
