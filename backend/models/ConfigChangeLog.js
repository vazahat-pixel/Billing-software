const mongoose = require('mongoose');

const ConfigChangeLogSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  configType: {
    type: String,
    required: true,
    enum: [
      'module', 'form', 'column', 'bill', 'featureFlag',
      'company', 'pricingRule', 'notification', 'report', 'permission'
    ]
  },
  configKey: { type: String, required: true },
  configId: { type: mongoose.Schema.Types.ObjectId },
  version: { type: Number, required: true },
  action: {
    type: String,
    enum: ['create', 'update', 'publish', 'delete', 'seed'],
    default: 'update'
  },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  before: { type: mongoose.Schema.Types.Mixed },
  after: { type: mongoose.Schema.Types.Mixed },
  ip: String,
  userAgent: String
}, { timestamps: true });

ConfigChangeLogSchema.index({ companyId: 1, createdAt: -1 });
ConfigChangeLogSchema.index({ companyId: 1, configType: 1, configKey: 1 });

module.exports = mongoose.model('ConfigChangeLog', ConfigChangeLogSchema);
