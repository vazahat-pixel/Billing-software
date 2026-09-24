const crypto = require('crypto');
const SyncOutbox = require('../models/SyncOutbox');
const SyncState = require('../models/SyncState');

async function nextSequence(companyId, deviceId) {
  const key = `seq:${companyId}:${deviceId || 'default'}`;
  const doc = await SyncState.findOneAndUpdate(
    { key },
    { $inc: { 'value.n': 1 }, $set: { companyId } },
    { upsert: true, new: true }
  );
  return Number(doc?.value?.n || 1);
}

/**
 * Enqueue a durable outbox row after a successful local write.
 */
async function enqueue({
  operationId,
  companyId,
  userId = null,
  deviceId = '',
  installationId = '',
  entityType,
  entityId,
  operationType,
  payload = {},
  session = null,
}) {
  const opId = String(operationId || crypto.randomUUID()).trim();
  const sequenceNumber = await nextSequence(companyId, deviceId);
  const doc = {
    operationId: opId,
    companyId,
    userId,
    deviceId: String(deviceId || ''),
    installationId: String(installationId || ''),
    entityType,
    entityId,
    operationType,
    payload,
    sequenceNumber,
    status: 'PENDING',
  };
  if (session) {
    await SyncOutbox.create([doc], { session });
  } else {
    try {
      await SyncOutbox.create(doc);
    } catch (err) {
      if (err?.code === 11000) {
        return SyncOutbox.findOne({ companyId, operationId: opId });
      }
      throw err;
    }
  }
  return SyncOutbox.findOne({ companyId, operationId: opId });
}

async function listPending({ companyId, limit = 25 } = {}) {
  const filter = {
    status: { $in: ['PENDING', 'RETRY', 'FAILED'] },
  };
  if (companyId) filter.companyId = companyId;
  return SyncOutbox.find(filter).sort({ sequenceNumber: 1 }).limit(limit);
}

async function markSyncing(operationId, companyId) {
  return SyncOutbox.findOneAndUpdate(
    { operationId, companyId, status: { $in: ['PENDING', 'RETRY', 'FAILED'] } },
    { $set: { status: 'SYNCING', lastAttemptAt: new Date() }, $inc: { retryCount: 1 } },
    { new: true }
  );
}

async function markSynced(operationId, companyId, { serverEntityId, serverInvoiceNo } = {}) {
  return SyncOutbox.findOneAndUpdate(
    { operationId, companyId },
    {
      $set: {
        status: 'SYNCED',
        syncedAt: new Date(),
        serverEntityId: serverEntityId ? String(serverEntityId) : '',
        serverInvoiceNo: serverInvoiceNo || '',
        errorCode: '',
        errorMessage: '',
      },
    },
    { new: true }
  );
}

async function markFailed(operationId, companyId, { errorCode, errorMessage, conflict = false } = {}) {
  return SyncOutbox.findOneAndUpdate(
    { operationId, companyId },
    {
      $set: {
        status: conflict ? 'CONFLICT' : 'RETRY',
        lastAttemptAt: new Date(),
        errorCode: errorCode || '',
        errorMessage: String(errorMessage || '').slice(0, 2000),
      },
    },
    { new: true }
  );
}

async function pendingCount(companyId) {
  const filter = {
    status: { $in: ['PENDING', 'SYNCING', 'RETRY', 'FAILED', 'CONFLICT'] },
  };
  if (companyId) filter.companyId = companyId;
  return SyncOutbox.countDocuments(filter);
}

module.exports = {
  enqueue,
  listPending,
  markSyncing,
  markSynced,
  markFailed,
  pendingCount,
  nextSequence,
};
