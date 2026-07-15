const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/**
 * Configurable document numbering series (prefixes) per module / FY.
 * Actual sequence remains Counter; series defines prefix and pad policy.
 */
const VoucherSeriesSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  },
  module: {
    type: String,
    enum: ['sales', 'purchase', 'payment', 'receipt', 'journal', 'job', 'return', 'note', 'grn', 'challan'],
    required: true,
  },
  name: { type: String, required: true, trim: true },
  prefix: { type: String, required: true, trim: true, uppercase: true },
  padLength: { type: Number, default: 4, min: 1, max: 10 },
  financialYearCode: { type: String, default: '' },
  isDefault: { type: Boolean, default: false },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
}, { timestamps: true });

VoucherSeriesSchema.index({ companyId: 1, module: 1, prefix: 1, financialYearCode: 1 }, { unique: true });
VoucherSeriesSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('VoucherSeries', VoucherSeriesSchema);
