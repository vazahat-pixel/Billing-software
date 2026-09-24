/**
 * Per-device sync cursor / state on central (and mirrored locally).
 */
const mongoose = require('mongoose');

const SyncDeviceStateSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    deviceId: { type: String, required: true },
    installationId: { type: String, default: '' },
    pullCursor: { type: String, default: '' },
    lastPullAt: { type: Date, default: null },
    lastPushAt: { type: Date, default: null },
    syncVersion: { type: Number, default: 0 },
    initialSyncComplete: { type: Boolean, default: false },
    checkpoint: {
      phase: { type: String, default: '' },
      offset: { type: Number, default: 0 },
      meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    lastError: { type: String, default: '' },
  },
  { timestamps: true, collection: 'sync_device_state' }
);

SyncDeviceStateSchema.index({ companyId: 1, deviceId: 1 }, { unique: true });

module.exports = mongoose.model('SyncDeviceState', SyncDeviceStateSchema);
