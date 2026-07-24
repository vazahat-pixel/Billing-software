const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/**
 * Stage 8.8 — Customer onboarding progress (welcome wizard).
 */
const OnboardingProgressSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    unique: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'skipped'],
    default: 'pending',
    index: true,
  },
  currentStep: { type: Number, default: 0 },
  steps: {
    companyProfile: { type: Boolean, default: false },
    financialYear: { type: Boolean, default: false },
    gstConfig: { type: Boolean, default: false },
    chartOfAccounts: { type: Boolean, default: false },
    mastersSeed: { type: Boolean, default: false },
    invoiceSeries: { type: Boolean, default: false },
    roles: { type: Boolean, default: false },
    backupSchedule: { type: Boolean, default: false },
    welcomeComplete: { type: Boolean, default: false },
  },
  completedAt: { type: Date, default: null },
  startedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

OnboardingProgressSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('OnboardingProgress', OnboardingProgressSchema);
