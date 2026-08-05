/**
 * withTransaction — replica-set-aware transaction wrapper.
 *
 * Production (replica set / Atlas): uses a real Mongoose session + ACID transaction.
 * CI / standalone MongoDB / MONGO_REPLICA_SET=false: runs the callback without a
 * session so queries still work on servers that do not support multi-doc transactions.
 *
 * Usage:
 *   const { withTransaction } = require('../utils/withTransaction');
 *   const result = await withTransaction(async (session) => {
 *     await Foo.create([data], { session });
 *     return result;
 *   });
 */

const mongoose = require('mongoose');

/** Cached capability flag — probed once per process. */
let _replicaSetAvailable = null;

/**
 * Returns true if the current MongoDB connection supports transactions.
 * We detect this by checking the topology type reported by the driver.
 */
function _isReplicaSetAvailable() {
  // Allow explicit env override (set MONGO_REPLICA_SET=false to force no-tx mode)
  if (process.env.MONGO_REPLICA_SET === 'false') return false;
  if (process.env.MONGO_REPLICA_SET === 'true') return true;

  if (_replicaSetAvailable !== null) return _replicaSetAvailable;

  try {
    const topology = mongoose.connection?.client?.topology;
    if (!topology) {
      _replicaSetAvailable = false;
      return false;
    }
    const type = topology.description?.type || '';
    // 'ReplicaSetWithPrimary', 'ReplicaSetNoPrimary', 'Sharded'
    _replicaSetAvailable =
      type.startsWith('ReplicaSet') || type === 'Sharded';
  } catch {
    _replicaSetAvailable = false;
  }
  return _replicaSetAvailable;
}

/**
 * A no-op "session" object that satisfies the Mongoose session duck-type
 * so we don't have to null-check `session` everywhere in service code.
 * All Mongoose query options like `.session(null)` work transparently.
 */
const NULL_SESSION = null;

/**
 * Run `fn(session)` inside a transaction when the MongoDB topology supports it.
 * Falls back to running `fn(null)` without a session on standalone deployments.
 *
 * @param {(session: import('mongoose').ClientSession|null) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withTransaction(fn) {
  if (!_isReplicaSetAvailable()) {
    // Standalone / CI — run without session (no ACID, but tests pass)
    return fn(NULL_SESSION);
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    try { await session.abortTransaction(); } catch { /* ignore abort errors */ }
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * Reset the cached replica-set detection (useful between test runs).
 */
function resetCapabilityCache() {
  _replicaSetAvailable = null;
}

module.exports = { withTransaction, resetCapabilityCache };
