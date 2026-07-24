const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/**
 * Stage 8 — Product release metadata & channel.
 */
const ReleaseRecordSchema = new mongoose.Schema({
  version: { type: String, required: true, unique: true },
  channel: { type: String, enum: ['alpha', 'beta', 'rc', 'stable', 'lts', 'hotfix'], default: 'stable' },
  status: {
    type: String,
    enum: ['draft', 'feature_freeze', 'rc', 'approved', 'released', 'yanked'],
    default: 'draft',
    index: true,
  },
  title: { type: String, default: '' },
  notes: { type: String, default: '' },
  changelog: [{ type: String }],
  breakingChanges: [{ type: String }],
  migrationRequired: { type: Boolean, default: false },
  migrationScript: { type: String, default: '' },
  desktopBuild: { type: String, default: '' },
  installerUrl: { type: String, default: '' },
  rollbackVersion: { type: String, default: '' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  releasedAt: { type: Date, default: null },
  scores: {
    business: { type: Number, default: 0 },
    security: { type: Number, default: 0 },
    performance: { type: Number, default: 0 },
    infrastructure: { type: Number, default: 0 },
    quality: { type: Number, default: 0 },
    commercial: { type: Number, default: 0 },
    production: { type: Number, default: 0 },
    overall: { type: Number, default: 0 },
  },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

ReleaseRecordSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('ReleaseRecord', ReleaseRecordSchema);
