const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

const CertificationRunSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
  score: { type: Number, default: 0 },
  gate: { type: Number, default: 85 },
  passed: { type: Boolean, default: false },
  status: { type: String, enum: ['passed', 'failed', 'partial'], default: 'partial' },
  checklist: [{
    key: { type: String, required: true },
    label: { type: String, required: true },
    weight: { type: Number, default: 10 },
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 10 },
    status: { type: String, enum: ['pass', 'fail', 'warn', 'skip'], default: 'skip' },
    gaps: [{ type: String }],
  }],
  gaps: [{ type: String }],
  reconcileStatus: { type: String, default: '' },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

CertificationRunSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('CertificationRun', CertificationRunSchema);
