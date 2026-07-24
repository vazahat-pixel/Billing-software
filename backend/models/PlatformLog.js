const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/**
 * Stage 7.6 — Structured platform log (complements AuditLog + console logger).
 */
const PlatformLogSchema = new mongoose.Schema({
  category: {
    type: String,
    enum: [
      'application',
      'api',
      'security',
      'authentication',
      'database',
      'business',
      'system',
      'integration',
      'error',
      'activity',
      'audit',
    ],
    required: true,
    index: true,
  },
  level: { type: String, enum: ['debug', 'info', 'warn', 'error'], default: 'info', index: true },
  message: { type: String, required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, default: null },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  module: { type: String, default: '' },
  action: { type: String, default: '' },
  requestId: { type: String, default: '', index: true },
  correlationId: { type: String, default: '', index: true },
  ip: { type: String, default: '' },
  device: { type: String, default: '' },
  durationMs: { type: Number, default: null },
  status: { type: String, default: '' },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

PlatformLogSchema.index({ category: 1, createdAt: -1 });
PlatformLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });
PlatformLogSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('PlatformLog', PlatformLogSchema);
