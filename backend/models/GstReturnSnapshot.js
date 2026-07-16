const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/**
 * Snapshot of a generated GST return for audit / amendment (Sprint 4.3).
 */
const GstReturnSnapshotSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  },
  period: { type: String, required: true, index: true },
  returnType: {
    type: String,
    enum: ['GSTR1', 'GSTR2B', 'GSTR3B', 'GSTR9', 'GSTR9C', 'HSN'],
    required: true,
  },
  version: { type: Number, default: 1 },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  totals: {
    taxable: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    cess: { type: Number, default: 0 },
    invoiceCount: { type: Number, default: 0 },
  },
  status: {
    type: String,
    enum: ['Draft', 'Final', 'Filed', 'Superseded'],
    default: 'Draft',
  },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  generatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

GstReturnSnapshotSchema.index({ companyId: 1, period: 1, returnType: 1, version: 1 });
GstReturnSnapshotSchema.plugin(enterpriseIntegrityPlugin, { softDelete: true, versionField: true });

module.exports = mongoose.model('GstReturnSnapshot', GstReturnSnapshotSchema);
