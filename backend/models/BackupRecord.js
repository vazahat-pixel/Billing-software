const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/**
 * Stage 7.7 — Backup & restore metadata.
 */
const BackupRecordSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
  type: {
    type: String,
    enum: ['full', 'incremental', 'manual', 'scheduled', 'files'],
    default: 'manual',
  },
  scope: {
    type: String,
    enum: ['database', 'files', 'company', 'platform'],
    default: 'company',
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed', 'verified', 'restored'],
    default: 'pending',
    index: true,
  },
  storage: {
    type: String,
    enum: ['local', 's3', 'gcs', 'azure', 'stub'],
    default: 'local',
  },
  path: { type: String, default: '' },
  sizeBytes: { type: Number, default: 0 },
  checksum: { type: String, default: '' },
  encrypted: { type: Boolean, default: true },
  collections: [{ type: String }],
  documentCounts: { type: mongoose.Schema.Types.Mixed, default: {} },
  restorePoint: { type: String, default: '' },
  verifiedAt: { type: Date, default: null },
  error: { type: String, default: '' },
  triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  retentionUntil: { type: Date, default: null },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

BackupRecordSchema.index({ companyId: 1, createdAt: -1 });
BackupRecordSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('BackupRecord', BackupRecordSchema);
