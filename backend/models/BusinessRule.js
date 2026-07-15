const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/**
 * Configurable business rules — Sprint 2.6 automation.
 * Evaluated by businessAutomationService (approval thresholds, duplicate soft-warn, etc.).
 */
const BusinessRuleSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  ruleKey: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  category: {
    type: String,
    enum: [
      'approval',
      'duplicate',
      'notification',
      'numbering',
      'costing',
      'stock',
      'credit',
      'general',
    ],
    default: 'general',
    index: true,
  },
  enabled: { type: Boolean, default: true },
  /** When true, failing eval blocks the action; false = warn/notify only */
  blocking: { type: Boolean, default: false },
  conditions: {
    module: { type: String, default: '' }, // sales | purchase | job | inventory
    minAmount: { type: Number, default: null },
    maxAmount: { type: Number, default: null },
    requireApproval: { type: Boolean, default: false },
    duplicateWindowHours: { type: Number, default: 24 },
    duplicateCheckFields: [{ type: String }], // partyId, netAmount, invoiceNo
    lowStockThreshold: { type: Number, default: null },
    notifyOn: [{ type: String }],
  },
  actions: {
    notify: { type: Boolean, default: true },
    requireApproval: { type: Boolean, default: false },
    autoReserve: { type: Boolean, default: false },
    refreshOutstanding: { type: Boolean, default: true },
  },
  notes: { type: String, default: '' },
}, { timestamps: true });

BusinessRuleSchema.index({ companyId: 1, ruleKey: 1 }, { unique: true });
BusinessRuleSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('BusinessRule', BusinessRuleSchema);
