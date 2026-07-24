const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/**
 * Stage 6.3 — Configurable automation: Trigger → Condition → Action → Delay/Schedule.
 * Orchestrates existing services; does not duplicate business logic.
 */
const AutomationRuleSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  code: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  enabled: { type: Boolean, default: true },
  trigger: {
    event: {
      type: String,
      required: true,
      enum: [
        'purchase.saved',
        'sales.saved',
        'payment.saved',
        'journal.saved',
        'stock.adjusted',
        'job.completed',
        'gst.due',
        'subscription.expiring',
        'manual',
        'schedule',
      ],
    },
    scheduleCron: { type: String, default: '' },
  },
  conditions: [{
    field: { type: String, default: '' },
    op: { type: String, enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'always'], default: 'always' },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
  }],
  actions: [{
    type: {
      type: String,
      enum: [
        'create_inventory',
        'post_accounting',
        'generate_gst',
        'notify',
        'start_approval',
        'send_document',
        'refresh_outstanding',
        'log',
      ],
      required: true,
    },
    channel: { type: String, default: 'inApp' },
    role: { type: String, default: '' },
    template: { type: String, default: '' },
    delayMinutes: { type: Number, default: 0 },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  }],
  retry: {
    maxAttempts: { type: Number, default: 3 },
    backoffMinutes: { type: Number, default: 5 },
  },
  stats: {
    runs: { type: Number, default: 0 },
    successes: { type: Number, default: 0 },
    failures: { type: Number, default: 0 },
    lastRunAt: { type: Date, default: null },
    lastError: { type: String, default: '' },
  },
  notes: { type: String, default: '' },
}, { timestamps: true });

AutomationRuleSchema.index({ companyId: 1, code: 1 }, { unique: true });
AutomationRuleSchema.index({ companyId: 1, 'trigger.event': 1, enabled: 1 });
AutomationRuleSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('AutomationRule', AutomationRuleSchema);
