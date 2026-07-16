const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/**
 * Imported GSTR-2B rows for reconciliation (Sprint 4.8).
 */
const Gstr2bImportSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  },
  period: { type: String, required: true, index: true },
  source: { type: String, enum: ['Manual', 'JSON', 'CSV', 'API'], default: 'JSON' },
  importedAt: { type: Date, default: Date.now },
  importedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rows: [{
    ctin: String,
    tradeName: String,
    inum: String,
    idt: String,
    val: Number,
    txval: Number,
    igst: Number,
    cgst: Number,
    sgst: Number,
    cess: Number,
    invTyp: { type: String, default: 'R' },
    matchStatus: {
      type: String,
      enum: ['Unmatched', 'Matched', 'Partial', 'MissingInERP', 'MissingIn2B', 'Mismatch'],
      default: 'Unmatched',
    },
    matchedPurchaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase' },
    difference: { type: Number, default: 0 },
    remarks: String,
  }],
  summary: {
    totalRows: { type: Number, default: 0 },
    matched: { type: Number, default: 0 },
    mismatched: { type: Number, default: 0 },
    missingInErp: { type: Number, default: 0 },
    missingIn2b: { type: Number, default: 0 },
  },
}, { timestamps: true });

Gstr2bImportSchema.index({ companyId: 1, period: 1 });
Gstr2bImportSchema.plugin(enterpriseIntegrityPlugin, { softDelete: true, versionField: true });

module.exports = mongoose.model('Gstr2bImport', Gstr2bImportSchema);
