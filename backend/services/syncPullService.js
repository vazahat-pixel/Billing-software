/**
 * Incremental / resumable pull of masters + sales for hybrid desktop.
 */
const Party = require('../models/Party');
const Item = require('../models/Item');
const InventoryLot = require('../models/InventoryLot');
const Sales = require('../models/Sales');
const CompanyModuleConfig = require('../models/CompanyModuleConfig');
const GstConfig = require('../models/GstConfig');
const PermissionMatrix = require('../models/PermissionMatrix');
const SyncDeviceState = require('../models/SyncDeviceState');
const User = require('../models/User');
const AppError = require('../utils/AppError');

const PHASES = [
  'config',
  'users',
  'permissions',
  'parties',
  'items',
  'lots',
  'sales',
  'done',
];

function encodeCursor(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}

function decodeCursor(raw) {
  if (!raw) return { phase: 'config', updatedAfter: null, offset: 0 };
  try {
    return JSON.parse(Buffer.from(String(raw), 'base64url').toString('utf8'));
  } catch {
    return { phase: 'config', updatedAfter: null, offset: 0 };
  }
}

async function getOrCreateDeviceState(companyId, deviceId) {
  let row = await SyncDeviceState.findOne({ companyId, deviceId });
  if (!row) {
    row = await SyncDeviceState.create({
      companyId,
      deviceId,
      checkpoint: { phase: 'config', offset: 0 },
    });
  }
  return row;
}

/**
 * Pull one chunk. Client passes cursor from previous response to resume.
 */
async function pullChanges({
  companyId,
  deviceId,
  cursor: rawCursor,
  limit = 100,
} = {}) {
  if (!deviceId) throw AppError.badRequest('deviceId is required');
  const limitN = Math.max(1, Math.min(500, Number(limit) || 100));
  const cursor = decodeCursor(rawCursor);
  let phase = cursor.phase || 'config';
  let offset = Number(cursor.offset || 0);
  const updatedAfter = cursor.updatedAfter ? new Date(cursor.updatedAfter) : null;

  const serverChanges = [];
  let nextPhase = phase;
  let nextOffset = offset;
  let complete = false;

  const updatedFilter = (extra = {}) => {
    const f = { companyId, ...extra };
    if (updatedAfter) f.updatedAt = { $gt: updatedAfter };
    return f;
  };

  if (phase === 'config') {
    const [moduleConfig, gstConfig] = await Promise.all([
      CompanyModuleConfig.findOne({ companyId }).lean(),
      GstConfig.findOne({ companyId }).lean(),
    ]);
    if (moduleConfig) serverChanges.push({ entityType: 'CompanyModuleConfig', doc: moduleConfig });
    if (gstConfig) serverChanges.push({ entityType: 'GstConfig', doc: gstConfig });
    nextPhase = 'users';
    nextOffset = 0;
  } else if (phase === 'users') {
    const rows = await User.find({ companyId })
      .select('-password -refreshTokenHash -totpSecret')
      .skip(offset)
      .limit(limitN)
      .lean();
    for (const doc of rows) serverChanges.push({ entityType: 'User', doc });
    if (rows.length < limitN) {
      nextPhase = 'permissions';
      nextOffset = 0;
    } else {
      nextOffset = offset + rows.length;
    }
  } else if (phase === 'permissions') {
    const rows = await PermissionMatrix.find({ companyId }).skip(offset).limit(limitN).lean();
    for (const doc of rows) serverChanges.push({ entityType: 'PermissionMatrix', doc });
    if (rows.length < limitN) {
      nextPhase = 'parties';
      nextOffset = 0;
    } else {
      nextOffset = offset + rows.length;
    }
  } else if (phase === 'parties') {
    const rows = await Party.find(updatedFilter())
      .sort({ updatedAt: 1 })
      .skip(offset)
      .limit(limitN)
      .lean();
    for (const doc of rows) serverChanges.push({ entityType: 'Party', doc });
    if (rows.length < limitN) {
      nextPhase = 'items';
      nextOffset = 0;
    } else {
      nextOffset = offset + rows.length;
    }
  } else if (phase === 'items') {
    const rows = await Item.find(updatedFilter())
      .sort({ updatedAt: 1 })
      .skip(offset)
      .limit(limitN)
      .lean();
    for (const doc of rows) serverChanges.push({ entityType: 'Item', doc });
    if (rows.length < limitN) {
      nextPhase = 'lots';
      nextOffset = 0;
    } else {
      nextOffset = offset + rows.length;
    }
  } else if (phase === 'lots') {
    const rows = await InventoryLot.find(updatedFilter())
      .sort({ updatedAt: 1 })
      .skip(offset)
      .limit(limitN)
      .lean();
    for (const doc of rows) serverChanges.push({ entityType: 'InventoryLot', doc });
    if (rows.length < limitN) {
      nextPhase = 'sales';
      nextOffset = 0;
    } else {
      nextOffset = offset + rows.length;
    }
  } else if (phase === 'sales') {
    const rows = await Sales.find(updatedFilter())
      .sort({ updatedAt: 1 })
      .skip(offset)
      .limit(limitN)
      .lean();
    for (const doc of rows) serverChanges.push({ entityType: 'Sales', doc });
    if (rows.length < limitN) {
      nextPhase = 'done';
      nextOffset = 0;
      complete = true;
    } else {
      nextOffset = offset + rows.length;
    }
  } else {
    complete = true;
    nextPhase = 'done';
  }

  const nextCursor = encodeCursor({
    phase: nextPhase,
    offset: nextOffset,
    updatedAfter: updatedAfter ? updatedAfter.toISOString() : null,
  });

  const deviceState = await getOrCreateDeviceState(companyId, deviceId);
  deviceState.pullCursor = nextCursor;
  deviceState.lastPullAt = new Date();
  deviceState.checkpoint = { phase: nextPhase, offset: nextOffset };
  if (complete) deviceState.initialSyncComplete = true;
  deviceState.syncVersion = (deviceState.syncVersion || 0) + 1;
  await deviceState.save();

  return {
    serverChanges,
    nextCursor,
    phase: nextPhase,
    complete,
    syncVersion: deviceState.syncVersion,
    phases: PHASES,
  };
}

/**
 * Apply pulled docs onto local Mongo (upsert by _id). Used by desktop agent.
 */
async function applyPulledChanges(serverChanges = []) {
  const modelMap = {
    Party,
    Item,
    InventoryLot,
    Sales,
    CompanyModuleConfig,
    GstConfig,
    PermissionMatrix,
    User,
  };
  let applied = 0;
  for (const change of serverChanges) {
    const Model = modelMap[change.entityType];
    if (!Model || !change.doc?._id) continue;
    const { _id, __v, ...rest } = change.doc;

    // Sales: prefer merge by operationId to avoid duplicate local+server invoices
    if (change.entityType === 'Sales' && rest.operationId) {
      const existing = await Sales.findOne({
        companyId: rest.companyId,
        operationId: rest.operationId,
      });
      if (existing) {
        await Sales.updateOne(
          { _id: existing._id },
          {
            $set: {
              ...rest,
              syncServerId: _id,
            },
          }
        );
        applied += 1;
        continue;
      }
    }

    await Model.updateOne(
      { _id },
      { $set: { ...rest, _id } },
      { upsert: true }
    );
    applied += 1;
  }
  return { applied };
}

module.exports = {
  pullChanges,
  applyPulledChanges,
  encodeCursor,
  decodeCursor,
  PHASES,
};
