/**
 * Durable sync outbox — pending ops survive app/PC restart.
 * Used on desktop-hybrid local Mongo; central may mirror metadata for audit.
 */
const mongoose = require('mongoose');

const STATUSES = ['PENDING', 'SYNCING', 'SYNCED', 'FAILED', 'CONFLICT', 'RETRY'];

const SyncOutboxSchema = new mongoose.Schema(
  {
    operationId: { type: String, required: true, trim: true },
    deviceId: { type: String, default: '', index: true },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    installationId: { type: String, default: '' },
    entityType: { type: String, required: true, index: true },
    entityId: { type: mongoose.Schema.Types.Mixed, default: null },
    operationType: {
      type: String,
      enum: ['create', 'update', 'delete'],
      required: true,
    },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    sequenceNumber: { type: Number, required: true },
    status: {
      type: String,
      enum: STATUSES,
      default: 'PENDING',
      index: true,
    },
    retryCount: { type: Number, default: 0 },
    lastAttemptAt: { type: Date, default: null },
    errorCode: { type: String, default: '' },
    errorMessage: { type: String, default: '' },
    syncedAt: { type: Date, default: null },
    serverEntityId: { type: String, default: '' },
    serverInvoiceNo: { type: String, default: '' },
  },
  { timestamps: true, collection: 'sync_outbox' }
);

SyncOutboxSchema.index({ companyId: 1, operationId: 1 }, { unique: true });
SyncOutboxSchema.index({ companyId: 1, status: 1, sequenceNumber: 1 });
SyncOutboxSchema.index({ deviceId: 1, sequenceNumber: 1 });

module.exports = mongoose.model('SyncOutbox', SyncOutboxSchema);
module.exports.STATUSES = STATUSES;
