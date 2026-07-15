const mongoose = require('mongoose');

const ReconciliationRunSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    runType: {
      type: String,
      enum: ['full', 'inventory', 'accounting', 'gst', 'outstanding', 'data_quality'],
      default: 'full',
    },
    status: {
      type: String,
      enum: ['clean', 'warnings', 'failures'],
      required: true,
    },
    summary: {
      checks: { type: Number, default: 0 },
      mismatches: { type: Number, default: 0 },
      warnings: { type: Number, default: 0 },
    },
    findings: [
      {
        code: String,
        severity: { type: String, enum: ['info', 'warning', 'error'], default: 'warning' },
        module: String,
        message: String,
        meta: mongoose.Schema.Types.Mixed,
      },
    ],
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date, default: null },
    triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

ReconciliationRunSchema.index({ companyId: 1, createdAt: -1 });

module.exports = mongoose.model('ReconciliationRun', ReconciliationRunSchema);
