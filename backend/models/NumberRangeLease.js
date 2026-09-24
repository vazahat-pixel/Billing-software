/**
 * Central number-range leases for offline invoice numbering.
 */
const mongoose = require('mongoose');

const NumberRangeLeaseSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    deviceId: { type: String, required: true, index: true },
    module: { type: String, required: true, default: 'sales' },
    leaseId: { type: String, required: true },
    prefix: { type: String, required: true },
    financialYearCode: { type: String, default: '' },
    padLength: { type: Number, default: 4 },
    startSeq: { type: Number, required: true },
    endSeq: { type: Number, required: true },
    nextSeq: { type: Number, required: true },
    /** Sequences confirmed consumed on central after successful push */
    consumedThrough: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ['active', 'exhausted', 'expired', 'revoked'],
      default: 'active',
      index: true,
    },
  },
  { timestamps: true, collection: 'number_range_leases' }
);

NumberRangeLeaseSchema.index({ companyId: 1, deviceId: 1, module: 1, status: 1 });
NumberRangeLeaseSchema.index({ leaseId: 1 }, { unique: true });

module.exports = mongoose.model('NumberRangeLease', NumberRangeLeaseSchema);
