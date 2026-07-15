const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

const WorkflowDefinitionSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  code: { type: String, required: true, trim: true },
  name: { type: String, required: true },
  module: {
    type: String,
    enum: ['sales', 'purchase', 'stock', 'discount', 'credit_limit', 'general'],
    required: true,
    index: true,
  },
  enabled: { type: Boolean, default: true },
  minAmount: { type: Number, default: 0 },
  steps: [{
    sequence: { type: Number, required: true },
    name: { type: String, required: true },
    role: { type: String, default: 'admin' }, // owner | admin | manager | accountant
    escalateAfterHours: { type: Number, default: 24 },
  }],
}, { timestamps: true });

WorkflowDefinitionSchema.index({ companyId: 1, code: 1 }, { unique: true });
WorkflowDefinitionSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('WorkflowDefinition', WorkflowDefinitionSchema);
