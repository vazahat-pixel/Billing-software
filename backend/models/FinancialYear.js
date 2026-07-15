const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

const FinancialYearSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  },
  code: { type: String, required: true, trim: true }, // e.g. 2025-26
  label: { type: String, default: '' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isActive: { type: Boolean, default: false, index: true },
  isLocked: { type: Boolean, default: false },
  lockedUntilDate: { type: Date, default: null },
}, { timestamps: true });

FinancialYearSchema.index({ companyId: 1, code: 1 }, { unique: true });
FinancialYearSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('FinancialYear', FinancialYearSchema);
