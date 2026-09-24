/**
 * Central idempotency store — one row per successfully processed sync operation.
 */
const mongoose = require('mongoose');

const ProcessedOperationSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    operationId: { type: String, required: true, trim: true },
    deviceId: { type: String, default: '' },
    entityType: { type: String, required: true },
    operationType: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.Mixed, default: null },
    invoiceNo: { type: String, default: '' },
    result: { type: mongoose.Schema.Types.Mixed, default: {} },
    processedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'processed_operations' }
);

ProcessedOperationSchema.index({ companyId: 1, operationId: 1 }, { unique: true });

module.exports = mongoose.model('ProcessedOperation', ProcessedOperationSchema);
