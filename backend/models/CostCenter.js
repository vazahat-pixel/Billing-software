const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/**
 * Cost Center / Department / Project — Sprint 3.9
 * Textile process costing attaches cost centers to journal lines & jobs.
 */
const CostCenterSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  },
  code: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  type: {
    type: String,
    enum: ['CostCenter', 'Department', 'Project', 'Process', 'Job'],
    default: 'CostCenter',
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CostCenter',
    default: null,
  },
  /** Textile process stage when type=Process */
  processStage: {
    type: String,
    enum: [
      '', 'Grey', 'Printing', 'Dyeing', 'Embroidery', 'Stitching',
      'Packing', 'Finishing', 'Overhead', 'Other',
    ],
    default: '',
  },
  isActive: { type: Boolean, default: true },
  budgetAmount: { type: Number, default: 0 },
  description: { type: String, default: '' },
}, { timestamps: true });

CostCenterSchema.index({ companyId: 1, code: 1 }, { unique: true });
CostCenterSchema.index({ companyId: 1, type: 1, isActive: 1 });

CostCenterSchema.plugin(enterpriseIntegrityPlugin, { softDelete: true, versionField: true });

module.exports = mongoose.model('CostCenter', CostCenterSchema);
