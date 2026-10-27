const mongoose = require('mongoose');

/**
 * One write request identified by its Idempotency-Key (per company). The first request runs and its
 * successful reply is stored; a repeat of the same key (offline sync retry after a lost reply) gets
 * the stored reply instead of creating the entry a second time. Expires after 7 days.
 */
const IdempotencyRecordSchema = new mongoose.Schema({
  companyId: { type: String, required: true },
  key: { type: String, required: true },
  method: { type: String, required: true },
  path: { type: String, required: true },
  state: { type: String, enum: ['pending', 'done'], default: 'pending' },
  status: { type: Number, default: null },
  body: { type: mongoose.Schema.Types.Mixed, default: null },
  createdAt: { type: Date, default: Date.now, expires: 7 * 24 * 60 * 60 },
}, { minimize: false });

IdempotencyRecordSchema.index({ companyId: 1, key: 1 }, { unique: true });

module.exports = mongoose.models.IdempotencyRecord || mongoose.model('IdempotencyRecord', IdempotencyRecordSchema);
