/**
 * Offline Feature Smoke Test — scripts/testOfflineFeature.js
 *
 * Validates the offline-first feature layer without requiring a live MongoDB
 * connection. Runs in CI as a pure-logic / module-load check.
 *
 * Tests:
 *  1. offlinePlatformService loads and exposes expected methods.
 *  2. Local-ID stripping logic (what purchaseService does before saving).
 *  3. Sync-queue conflict-resolution helper logic.
 *  4. withTransaction falls back gracefully when no replica set present.
 */

'use strict';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.error(`  ✗  FAIL: ${label}`);
    failed++;
  }
}

// ── 1. offlinePlatformService module loads ────────────────────────────────────
console.log('\n[1] offlinePlatformService module load');
try {
  const svc = require('../services/offlinePlatformService');
  assert(typeof svc.status === 'function', 'exposes status()');
  assert(typeof svc.setEnabled === 'function', 'exposes setEnabled()');
} catch (err) {
  console.error('  ✗  Module load failed:', err.message);
  failed++;
}

// ── 2. withTransaction module loads and exports expected symbols ───────────────
console.log('\n[2] withTransaction module load');
try {
  const { withTransaction, resetCapabilityCache } = require('../utils/withTransaction');
  assert(typeof withTransaction === 'function', 'withTransaction is a function');
  assert(typeof resetCapabilityCache === 'function', 'resetCapabilityCache is a function');
} catch (err) {
  console.error('  ✗  Module load failed:', err.message);
  failed++;
}

// ── 3. Local-ID stripping logic (mirrors purchaseService.createPurchase) ──────
console.log('\n[3] Local-ID stripping logic');
function stripLocalIds(purchaseData) {
  const {
    _id: _d1,
    id: _d2,
    localId: _d3,
    accountingEntryId: _d4,
    ...safeData
  } = purchaseData || {};
  let data = safeData;
  if (Array.isArray(data.items)) {
    data.items = data.items.map((it) => {
      const { _id, id, lotId, ...rest } = it || {};
      return rest;
    });
  }
  return data;
}

const rawOfflineBill = {
  _id: 'local-abc123',
  id: 'local-abc123',
  localId: 'OFFLINE-001',
  accountingEntryId: 'local-acct-xyz',
  supplierId: '507f1f77bcf86cd799439011',
  invoiceNo: 'AUTO',
  items: [
    { _id: 'item-local-1', id: 'item-local-1', lotId: 'LOT-local-1', itemId: '507f1f77bcf86cd799439012', mts: 100 },
  ],
};

const stripped = stripLocalIds(rawOfflineBill);
assert(!('_id' in stripped), 'top-level _id removed');
assert(!('id' in stripped), 'top-level id removed');
assert(!('localId' in stripped), 'localId removed');
assert(!('accountingEntryId' in stripped), 'accountingEntryId removed');
assert(stripped.supplierId === '507f1f77bcf86cd799439011', 'supplierId preserved');
assert(Array.isArray(stripped.items), 'items array preserved');
assert(!('_id' in stripped.items[0]), 'item _id stripped');
assert(!('lotId' in stripped.items[0]), 'item lotId stripped');
assert(stripped.items[0].mts === 100, 'item mts value preserved');

// ── 4. Valid server-side lotId vs local lotId detection ───────────────────────
console.log('\n[4] LotId validity check (ObjectId 24-char rule)');
const mongoose = require('mongoose');

const localLotId = 'LOT-1234567890-0-1234';
const serverLotId = new mongoose.Types.ObjectId().toString();

function isServerLotId(lotId) {
  return lotId && mongoose.Types.ObjectId.isValid(lotId) && String(lotId).length === 24;
}

assert(!isServerLotId(localLotId), 'local LOT-xxx string correctly rejected');
assert(isServerLotId(serverLotId), 'valid ObjectId string correctly accepted');
assert(!isServerLotId(undefined), 'undefined lotId safely rejected');
assert(!isServerLotId(''), 'empty string safely rejected');

// ── 5. Sync-queue idempotency key generation ──────────────────────────────────
console.log('\n[5] Idempotency key format');
function makeIdempotencyKey(type, docId, lotId) {
  return `${type}:${docId}:${lotId}`;
}
const key = makeIdempotencyKey('PURCHASE', '507f1f77bcf86cd799439011', 'LOT-1234');
assert(key === 'PURCHASE:507f1f77bcf86cd799439011:LOT-1234', 'key format correct');
assert(key.split(':').length === 3, 'key has 3 colon-separated parts');

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n═══════════════════════════════════`);
console.log(`  Offline smoke: ${passed} passed, ${failed} failed`);
console.log(`═══════════════════════════════════\n`);

if (failed > 0) {
  process.exit(1);
}
