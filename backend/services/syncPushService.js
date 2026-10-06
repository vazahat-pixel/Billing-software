/**
 * Central sync push — applies desktop outbox ops through existing business services.
 * Never writes Sales/stock/ledger collections directly.
 */
const ProcessedOperation = require('../models/ProcessedOperation');
const SyncDeviceState = require('../models/SyncDeviceState');
const salesService = require('./salesService');
const numberLeaseService = require('./numberLeaseService');
const AppError = require('../utils/AppError');

function hybridSyncEnabled() {
  return String(process.env.HYBRID_SYNC_ENABLED || '').toLowerCase() === 'true';
}

async function getOrCreateDeviceState(companyId, deviceId) {
  let row = await SyncDeviceState.findOne({ companyId, deviceId });
  if (!row) {
    row = await SyncDeviceState.create({ companyId, deviceId, syncVersion: 0 });
  }
  return row;
}

/**
 * Idempotency helper: check + record in ProcessedOperation.
 * Returns existing record (duplicate) or null (first time).
 */
async function checkProcessed(companyId, operationId) {
  return ProcessedOperation.findOne({ companyId, operationId }).lean();
}

async function recordProcessed({ companyId, operationId, deviceId, entityType, operationType, entityId, result = null, invoiceNo = null }) {
  try {
    await ProcessedOperation.create({ companyId, operationId, deviceId, entityType, operationType, entityId, invoiceNo, result });
  } catch (err) {
    if (err?.code === 11000) {
      // Race: already written — return what's there
      return ProcessedOperation.findOne({ companyId, operationId }).lean();
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

async function processSalesCreate(op, { companyId, userId, deviceId }) {
  const operationId = String(op.operationId || '').trim();
  if (!operationId) throw AppError.badRequest('operationId is required');

  const existing = await checkProcessed(companyId, operationId);
  if (existing) {
    return {
      operationId,
      status: 'accepted',
      duplicate: true,
      entityId: existing.entityId,
      invoiceNo: existing.invoiceNo,
      result: existing.result,
    };
  }

  const payload = { ...(op.payload || {}) };
  delete payload._id;
  delete payload.id;
  delete payload.localId;
  delete payload.accountingEntryId;
  delete payload.companyId;

  const invoiceNo = payload.invoiceNo;
  if (!invoiceNo || invoiceNo === 'AUTO') {
    throw AppError.badRequest('Synced sales create must include a leased invoiceNo');
  }

  await numberLeaseService.assertAndConsumeLeaseNumber(companyId, deviceId, invoiceNo, 'sales');

  const sales = await salesService.createInvoice(
    {
      ...payload,
      companyId,
      invoiceNo,
      operationId,
      createdBy: userId || payload.createdBy,
    },
    {
      operationId,
      enqueueOutbox: false,
      fromSync: true,
      skipLeaseAllocation: true,
    }
  );

  const resultSummary = {
    _id: sales._id,
    invoiceNo: sales.invoiceNo,
    netAmount: sales.netAmount,
    taxableAmount: sales.taxableAmount,
    gstAmount: sales.gstAmount,
  };

  await recordProcessed({
    companyId, operationId, deviceId, entityType: 'sales',
    operationType: 'create', entityId: sales._id,
    invoiceNo: sales.invoiceNo, result: resultSummary,
  });

  return { operationId, status: 'accepted', duplicate: false, entityId: sales._id, invoiceNo: sales.invoiceNo, result: resultSummary };
}

// ---------------------------------------------------------------------------
// Purchase
// ---------------------------------------------------------------------------

async function processPurchaseCreate(op, { companyId, userId, deviceId }) {
  const operationId = String(op.operationId || '').trim();
  if (!operationId) throw AppError.badRequest('operationId is required');

  const existing = await checkProcessed(companyId, operationId);
  if (existing) {
    return { operationId, status: 'accepted', duplicate: true, entityId: existing.entityId, result: existing.result };
  }

  const payload = { ...(op.payload || {}) };
  delete payload._id;
  delete payload.id;
  delete payload.localId;
  delete payload.accountingEntryId;
  delete payload.companyId;

  const purchaseService = require('./purchaseService');
  const purchase = await purchaseService.createPurchase(
    { ...payload, companyId, operationId, createdBy: userId || payload.createdBy },
    { operationId, enqueueOutbox: false, fromSync: true }
  );

  const resultSummary = {
    _id: purchase._id,
    invoiceNo: purchase.invoiceNo,
    netAmount: purchase.netAmount,
    taxableAmount: purchase.taxableAmount,
    gstAmount: purchase.gstAmount,
  };

  await recordProcessed({
    companyId, operationId, deviceId, entityType: 'purchase',
    operationType: 'create', entityId: purchase._id,
    invoiceNo: purchase.invoiceNo, result: resultSummary,
  });

  return { operationId, status: 'accepted', duplicate: false, entityId: purchase._id, invoiceNo: purchase.invoiceNo, result: resultSummary };
}

// ---------------------------------------------------------------------------
// Job Issue
// ---------------------------------------------------------------------------

async function processJobIssue(op, { companyId, userId, deviceId }) {
  const operationId = String(op.operationId || '').trim();
  if (!operationId) throw AppError.badRequest('operationId is required');

  const existing = await checkProcessed(companyId, operationId);
  if (existing) {
    return { operationId, status: 'accepted', duplicate: true, entityId: existing.entityId, result: existing.result };
  }

  const payload = { ...(op.payload || {}) };
  delete payload._id;
  delete payload.id;
  delete payload.localId;
  delete payload.companyId;

  const jobService = require('./jobService');
  const job = await jobService.issueToJob(
    { ...payload, companyId, operationId, createdBy: userId || payload.createdBy },
    { operationId, enqueueOutbox: false, fromSync: true }
  );

  const resultSummary = { _id: job._id, jobCardNo: job.jobCardNo, issueQty: job.issueQty, status: job.status };

  await recordProcessed({
    companyId, operationId, deviceId, entityType: 'job_issue',
    operationType: 'create', entityId: job._id, result: resultSummary,
  });

  return { operationId, status: 'accepted', duplicate: false, entityId: job._id, result: resultSummary };
}

// ---------------------------------------------------------------------------
// Job Receive
// ---------------------------------------------------------------------------

async function processJobReceive(op, { companyId, userId, deviceId }) {
  const operationId = String(op.operationId || '').trim();
  if (!operationId) throw AppError.badRequest('operationId is required');

  const existing = await checkProcessed(companyId, operationId);
  if (existing) {
    return { operationId, status: 'accepted', duplicate: true, entityId: existing.entityId, result: existing.result };
  }

  const payload = { ...(op.payload || {}) };
  delete payload._id;
  delete payload.id;
  delete payload.companyId;

  const Job = require('../models/Job');
  let targetJob = await Job.findOne({ _id: payload.jobId, companyId });
  if (!targetJob && payload.jobCardNo) {
    targetJob = await Job.findOne({ jobCardNo: payload.jobCardNo, companyId });
  }
  if (!targetJob && payload.challanNo) {
    targetJob = await Job.findOne({ challanNo: payload.challanNo, companyId });
  }
  if (targetJob) {
    payload.jobId = targetJob._id;
  }

  const jobService = require('./jobService');
  const receiveResult = await jobService.receiveFromJob(
    { ...payload, companyId, operationId, createdBy: userId || payload.createdBy },
    { operationId, enqueueOutbox: false, fromSync: true }
  );

  const { job } = receiveResult;
  const resultSummary = { _id: job._id, jobCardNo: job.jobCardNo, receivedQty: job.receivedQty, status: job.status };

  await recordProcessed({
    companyId, operationId, deviceId, entityType: 'job_receive',
    operationType: 'create', entityId: job._id, result: resultSummary,
  });

  return { operationId, status: 'accepted', duplicate: receiveResult.duplicate || false, entityId: job._id, result: resultSummary };
}

// ---------------------------------------------------------------------------
// Party Sync (Customer / Supplier / Job Worker)
// ---------------------------------------------------------------------------

async function processPartySync(op, { companyId, userId, deviceId }) {
  const operationId = String(op.operationId || '').trim();
  if (!operationId) throw AppError.badRequest('operationId is required');

  const existing = await checkProcessed(companyId, operationId);
  if (existing) {
    return { operationId, status: 'accepted', duplicate: true, entityId: existing.entityId, result: existing.result };
  }

  const payload = { ...(op.payload || {}) };
  delete payload._id;
  delete payload.id;
  delete payload.companyId;

  const Party = require('../models/Party');
  let target = null;
  if (op.entityId) {
    target = await Party.findOne({ _id: op.entityId, companyId });
  }
  if (!target && payload.name) {
    target = await Party.findOne({ name: payload.name, companyId });
  }

  const partyService = require('./partyService');
  if (target) {
    if (target.updatedAt && payload.updatedAt && new Date(target.updatedAt) > new Date(payload.updatedAt)) {
      const summary = { _id: target._id, name: target.name, skipped: 'cloud_newer' };
      await recordProcessed({
        companyId, operationId, deviceId, entityType: 'party',
        operationType: op.operationType, entityId: target._id, result: summary,
      });
      return { operationId, status: 'accepted', duplicate: false, entityId: target._id, result: summary };
    }
    const updated = await partyService.updateParty(target._id, companyId, { ...payload, companyId }, {
      fromSync: true, enqueueOutbox: false,
    });
    const summary = { _id: updated._id, name: updated.name };
    await recordProcessed({
      companyId, operationId, deviceId, entityType: 'party',
      operationType: op.operationType, entityId: updated._id, result: summary,
    });
    return { operationId, status: 'accepted', duplicate: false, entityId: updated._id, result: summary };
  } else {
    const created = await partyService.createParty({ ...payload, companyId }, {
      fromSync: true, enqueueOutbox: false,
    });
    const summary = { _id: created._id, name: created.name };
    await recordProcessed({
      companyId, operationId, deviceId, entityType: 'party',
      operationType: 'create', entityId: created._id, result: summary,
    });
    return { operationId, status: 'accepted', duplicate: false, entityId: created._id, result: summary };
  }
}

// ---------------------------------------------------------------------------
// Item Sync
// ---------------------------------------------------------------------------

async function processItemSync(op, { companyId, userId, deviceId }) {
  const operationId = String(op.operationId || '').trim();
  if (!operationId) throw AppError.badRequest('operationId is required');

  const existing = await checkProcessed(companyId, operationId);
  if (existing) {
    return { operationId, status: 'accepted', duplicate: true, entityId: existing.entityId, result: existing.result };
  }

  const payload = { ...(op.payload || {}) };
  delete payload._id;
  delete payload.id;
  delete payload.companyId;

  const Item = require('../models/Item');
  let target = null;
  if (op.entityId) {
    target = await Item.findOne({ _id: op.entityId, companyId });
  }
  if (!target && payload.name) {
    target = await Item.findOne({ name: payload.name, companyId });
  }

  const itemService = require('./itemService');
  if (target) {
    if (target.updatedAt && payload.updatedAt && new Date(target.updatedAt) > new Date(payload.updatedAt)) {
      const summary = { _id: target._id, name: target.name, skipped: 'cloud_newer' };
      await recordProcessed({
        companyId, operationId, deviceId, entityType: 'item',
        operationType: op.operationType, entityId: target._id, result: summary,
      });
      return { operationId, status: 'accepted', duplicate: false, entityId: target._id, result: summary };
    }
    const updated = await itemService.updateItem(target._id, companyId, { ...payload, companyId });
    const summary = { _id: updated._id, name: updated.name };
    await recordProcessed({
      companyId, operationId, deviceId, entityType: 'item',
      operationType: op.operationType, entityId: updated._id, result: summary,
    });
    return { operationId, status: 'accepted', duplicate: false, entityId: updated._id, result: summary };
  } else {
    const created = await itemService.createItem({ ...payload, companyId });
    const summary = { _id: created._id, name: created.name };
    await recordProcessed({
      companyId, operationId, deviceId, entityType: 'item',
      operationType: 'create', entityId: created._id, result: summary,
    });
    return { operationId, status: 'accepted', duplicate: false, entityId: created._id, result: summary };
  }
}

// ---------------------------------------------------------------------------
// Warehouse Sync
// ---------------------------------------------------------------------------

async function processWarehouseSync(op, { companyId, userId, deviceId }) {
  const operationId = String(op.operationId || '').trim();
  if (!operationId) throw AppError.badRequest('operationId is required');

  const existing = await checkProcessed(companyId, operationId);
  if (existing) {
    return { operationId, status: 'accepted', duplicate: true, entityId: existing.entityId, result: existing.result };
  }

  const payload = { ...(op.payload || {}) };
  delete payload._id;
  delete payload.id;
  delete payload.companyId;

  const Warehouse = require('../models/Warehouse');
  let target = null;
  if (op.entityId) {
    target = await Warehouse.findOne({ _id: op.entityId, companyId });
  }
  if (!target && payload.code) {
    target = await Warehouse.findOne({ code: String(payload.code).toUpperCase(), companyId });
  }

  const warehouseService = require('./warehouseService');
  if (target) {
    if (target.updatedAt && payload.updatedAt && new Date(target.updatedAt) > new Date(payload.updatedAt)) {
      const summary = { _id: target._id, code: target.code, skipped: 'cloud_newer' };
      await recordProcessed({
        companyId, operationId, deviceId, entityType: 'warehouse',
        operationType: op.operationType, entityId: target._id, result: summary,
      });
      return { operationId, status: 'accepted', duplicate: false, entityId: target._id, result: summary };
    }
    const updated = await warehouseService.update(target._id, companyId, payload);
    const summary = { _id: updated._id, code: updated.code };
    await recordProcessed({
      companyId, operationId, deviceId, entityType: 'warehouse',
      operationType: op.operationType, entityId: updated._id, result: summary,
    });
    return { operationId, status: 'accepted', duplicate: false, entityId: updated._id, result: summary };
  } else {
    const created = await warehouseService.create(companyId, payload);
    const summary = { _id: created._id, code: created.code };
    await recordProcessed({
      companyId, operationId, deviceId, entityType: 'warehouse',
      operationType: 'create', entityId: created._id, result: summary,
    });
    return { operationId, status: 'accepted', duplicate: false, entityId: created._id, result: summary };
  }
}

// ---------------------------------------------------------------------------
// SubMaster Sync
// ---------------------------------------------------------------------------

async function processSubMasterSync(op, { companyId, userId, deviceId }) {
  const operationId = String(op.operationId || '').trim();
  if (!operationId) throw AppError.badRequest('operationId is required');

  const existing = await checkProcessed(companyId, operationId);
  if (existing) {
    return { operationId, status: 'accepted', duplicate: true, entityId: existing.entityId, result: existing.result };
  }

  const payload = { ...(op.payload || {}) };
  delete payload._id;
  delete payload.id;
  delete payload.companyId;

  const SubMaster = require('../models/SubMaster');
  let target = null;
  if (op.entityId) {
    target = await SubMaster.findOne({ _id: op.entityId, companyId });
  }
  if (!target && payload.type && payload.name) {
    target = await SubMaster.findOne({ type: payload.type, name: payload.name, companyId });
  }

  if (target) {
    if (target.updatedAt && payload.updatedAt && new Date(target.updatedAt) > new Date(payload.updatedAt)) {
      const summary = { _id: target._id, name: target.name, skipped: 'cloud_newer' };
      await recordProcessed({
        companyId, operationId, deviceId, entityType: 'submaster',
        operationType: op.operationType, entityId: target._id, result: summary,
      });
      return { operationId, status: 'accepted', duplicate: false, entityId: target._id, result: summary };
    }
    Object.assign(target, payload);
    await target.save();
    const summary = { _id: target._id, name: target.name };
    await recordProcessed({
      companyId, operationId, deviceId, entityType: 'submaster',
      operationType: op.operationType, entityId: target._id, result: summary,
    });
    return { operationId, status: 'accepted', duplicate: false, entityId: target._id, result: summary };
  } else {
    const created = await SubMaster.create({ ...payload, companyId });
    const summary = { _id: created._id, name: created.name };
    await recordProcessed({
      companyId, operationId, deviceId, entityType: 'submaster',
      operationType: 'create', entityId: created._id, result: summary,
    });
    return { operationId, status: 'accepted', duplicate: false, entityId: created._id, result: summary };
  }
}

// ---------------------------------------------------------------------------
// Push operations dispatcher
// ---------------------------------------------------------------------------

/**
 * @param {{ companyId, userId, deviceId, operations: array }}
 */
async function pushOperations({ companyId, userId, deviceId, operations = [] }) {
  if (!hybridSyncEnabled() && String(process.env.DESKTOP_LOCAL || '') !== 'true') {
    // Allow push on central whenever HYBRID_SYNC_ENABLED; also allow in tests
    if (process.env.NODE_ENV === 'production' && !hybridSyncEnabled()) {
      throw AppError.forbidden('Hybrid sync is not enabled on this server');
    }
  }

  if (!deviceId) throw AppError.badRequest('deviceId is required');
  const acceptedOperations = [];
  const failedOperations = [];
  const conflicts = [];

  for (const op of operations) {
    try {
      const rawEntity = String(op.entityType || '').toLowerCase();
      const rawOp = String(op.operationType || '').toLowerCase();
      let entity = rawEntity;
      let action = rawOp;
      if (rawOp.includes('/')) {
        const parts = rawOp.split('/');
        entity = parts[0] || entity;
        action = parts[1] || action;
      }
      const key = `${entity}/${action}`;
      if (key === 'sales/create') {
        result = await processSalesCreate(op, { companyId, userId, deviceId });
      } else if (key === 'purchase/create') {
        result = await processPurchaseCreate(op, { companyId, userId, deviceId });
      } else if (key === 'job_issue/create') {
        result = await processJobIssue(op, { companyId, userId, deviceId });
      } else if (key === 'job_receive/create') {
        result = await processJobReceive(op, { companyId, userId, deviceId });
      } else if (key === 'party/create' || key === 'party/update') {
        result = await processPartySync(op, { companyId, userId, deviceId });
      } else if (key === 'item/create' || key === 'item/update') {
        result = await processItemSync(op, { companyId, userId, deviceId });
      } else if (key === 'warehouse/create' || key === 'warehouse/update') {
        result = await processWarehouseSync(op, { companyId, userId, deviceId });
      } else if (key === 'submaster/create' || key === 'submaster/update') {
        result = await processSubMasterSync(op, { companyId, userId, deviceId });
      } else {
        failedOperations.push({
          operationId: op.operationId,
          errorCode: 'UNSUPPORTED',
          errorMessage: `Unsupported op ${op.entityType}/${op.operationType}`,
        });
        continue;
      }
      acceptedOperations.push(result);
    } catch (err) {
      const status = err.statusCode || err.status || 500;
      const entry = {
        operationId: op.operationId,
        errorCode: err.code || String(status),
        errorMessage: err.message || 'push failed',
      };
      if (status === 409) conflicts.push(entry);
      else failedOperations.push(entry);
    }
  }

  const deviceState = await getOrCreateDeviceState(companyId, deviceId);
  deviceState.lastPushAt = new Date();
  deviceState.syncVersion = (deviceState.syncVersion || 0) + 1;
  await deviceState.save();

  return {
    acceptedOperations,
    failedOperations,
    conflicts,
    syncVersion: deviceState.syncVersion,
  };
}

module.exports = {
  pushOperations,
  processSalesCreate,
  processPurchaseCreate,
  processJobIssue,
  processJobReceive,
  hybridSyncEnabled,
};
