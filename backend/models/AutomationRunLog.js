const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

const AutomationRunLogSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'AutomationRule', required: true, index: true },
  triggerEvent: { type: String, required: true },
  status: { type: String, enum: ['success', 'partial', 'failed', 'skipped'], default: 'success' },
  actionsExecuted: [{ type: String }],
  error: { type: String, default: '' },
  context: { type: mongoose.Schema.Types.Mixed, default: {} },
  durationMs: { type: Number, default: 0 },
  attempt: { type: Number, default: 1 },
}, { timestamps: true });

AutomationRunLogSchema.index({ companyId: 1, createdAt: -1 });
AutomationRunLogSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('AutomationRunLog', AutomationRunLogSchema);
