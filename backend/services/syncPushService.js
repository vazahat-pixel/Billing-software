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
      let result;
      const key = `${op.entityType}/${op.operationType}`;
      if (key === 'sales/create') {
        result = await processSalesCreate(op, { companyId, userId, deviceId });
      } else if (key === 'purchase/create') {
        result = await processPurchaseCreate(op, { companyId, userId, deviceId });
      } else if (key === 'job_issue/create') {
        result = await processJobIssue(op, { companyId, userId, deviceId });
      } else if (key === 'job_receive/create') {
        result = await processJobReceive(op, { companyId, userId, deviceId });
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
