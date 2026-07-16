const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/**
 * GST Return Period — Sprint 4.1 / 4.3
 */
const GstPeriodSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  },
  period: { type: String, required: true }, // YYYY-MM or YYYY-QN
  financialYear: { type: String, default: '' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ['Open', 'Locked', 'Filed', 'Amended'],
    default: 'Open',
    index: true,
  },
  gstr1Status: { type: String, enum: ['Pending', 'Generated', 'Filed', 'Amended'], default: 'Pending' },
  gstr3bStatus: { type: String, enum: ['Pending', 'Generated', 'Filed', 'Amended'], default: 'Pending' },
  gstr2bStatus: { type: String, enum: ['Pending', 'Imported', 'Reconciled'], default: 'Pending' },
  lockedAt: { type: Date },
  lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  filedAt: { type: Date },
  notes: { type: String, default: '' },
}, { timestamps: true });

GstPeriodSchema.index({ companyId: 1, period: 1 }, { unique: true });
GstPeriodSchema.plugin(enterpriseIntegrityPlugin, { softDelete: true, versionField: true });

module.exports = mongoose.model('GstPeriod', GstPeriodSchema);
