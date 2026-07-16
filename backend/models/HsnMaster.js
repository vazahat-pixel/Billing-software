const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/**
 * HSN / SAC master — Sprint 4.4
 */
const HsnMasterSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  },
  code: { type: String, required: true, trim: true },
  type: { type: String, enum: ['HSN', 'SAC'], default: 'HSN' },
  description: { type: String, default: '' },
  gstRate: { type: Number, default: 5, min: 0, max: 40 },
  cessRate: { type: Number, default: 0 },
  unit: { type: String, default: 'MTR' },
  taxCategory: {
    type: String,
    enum: ['Taxable', 'Exempt', 'NilRated', 'ZeroRated', 'NonGST'],
    default: 'Taxable',
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

HsnMasterSchema.index({ companyId: 1, code: 1, type: 1 }, { unique: true });
HsnMasterSchema.plugin(enterpriseIntegrityPlugin, { softDelete: true, versionField: true });

module.exports = mongoose.model('HsnMaster', HsnMasterSchema);
