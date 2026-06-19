const mongoose = require('mongoose');
const configMetaSchema = require('./mixins/configMetaSchema');

const FeatureFlagSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  flagKey: { type: String, required: true },
  label: { type: String, default: '' },
  description: { type: String, default: '' },
  enabled: { type: Boolean, default: true },
  module: { type: String, default: '' },
  scope: {
    type: String,
    enum: ['global', 'module', 'form'],
    default: 'module'
  },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  ...configMetaSchema
}, { timestamps: true });

FeatureFlagSchema.index({ companyId: 1, flagKey: 1 }, { unique: true });

module.exports = mongoose.model('FeatureFlag', FeatureFlagSchema);
