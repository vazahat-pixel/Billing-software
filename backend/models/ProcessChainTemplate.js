const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

const ProcessChainTemplateSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  isDefault: { type: Boolean, default: false },
  processSteps: [{
    sequence: { type: Number, required: true },
    processId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubMaster', default: null },
    processName: { type: String, required: true, trim: true },
    defaultTolerancePct: { type: Number, default: 3, min: 0 },
  }],
}, { timestamps: true });

ProcessChainTemplateSchema.index({ companyId: 1, code: 1 }, { unique: true });
ProcessChainTemplateSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('ProcessChainTemplate', ProcessChainTemplateSchema);
