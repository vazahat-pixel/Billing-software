/**
 * Local-only sync state (leases cache, session material, agent heartbeats).
 */
const mongoose = require('mongoose');

const SyncStateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
    value: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: 'sync_state' }
);

module.exports = mongoose.model('SyncState', SyncStateSchema);
