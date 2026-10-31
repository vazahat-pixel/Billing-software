'use strict';

/**
 * Database side of the local -> central id map (see syncIdMapCore for the rewriting rules).
 * Local database only; the cloud has no use for it.
 */
const SyncIdMap = require('../models/SyncIdMap');
const SyncOutbox = require('../models/SyncOutbox');

/** Remember that a document this device created lives under `serverId` on the cloud. */
async function recordMapping(companyId, entityType, localId, serverId) {
  if (!companyId || !localId || !serverId) return null;
  const local = String(localId);
  const server = String(serverId);
  if (local === server) return null; // cloud kept our id — nothing to rewrite
  try {
    return await SyncIdMap.findOneAndUpdate(
      { companyId, localId: local },
      { $set: { serverId: server, entityType: String(entityType || '') } },
      { upsert: true, new: true }
    );
  } catch (err) {
    if (err?.code === 11000) return SyncIdMap.findOne({ companyId, localId: local });
    throw err;
  }
}

/** The whole map for a company as local -> server. */
async function loadMap(companyId) {
  const rows = await SyncIdMap.find({ companyId }).select('localId serverId').lean();
  return new Map(rows.map((r) => [r.localId, r.serverId]));
}

/**
 * Local ids that this device created but has not yet got a cloud id for, so anything pointing at
 * them must wait. Derived from the outbox rather than stored separately, so it cannot drift.
 */
async function unsyncedLocalIds(companyId) {
  const rows = await SyncOutbox.find({
    companyId,
    status: { $in: ['PENDING', 'SYNCING', 'RETRY', 'FAILED', 'CONFLICT'] },
  }).select('entityId').lean();
  return new Set(rows.map((r) => String(r.entityId)).filter(Boolean));
}

module.exports = { recordMapping, loadMap, unsyncedLocalIds };
