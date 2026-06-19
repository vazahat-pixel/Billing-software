const mongoose = require('mongoose');
const configMetaSchema = require('./mixins/configMetaSchema');

const PricingRuleSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  ruleKey: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  enabled: { type: Boolean, default: true },
  priority: { type: Number, default: 100 },
  appliesTo: {
    type: String,
    enum: ['sales', 'purchase', 'both'],
    default: 'both'
  },
  conditions: {
    partyGroup: [String],
    itemGroup: [String],
    minQty: Number,
    maxQty: Number,
    city: [String]
  },
  action: {
    type: { type: String, enum: ['fixedRate', 'discountPercent', 'markupPercent'], default: 'fixedRate' },
    value: { type: Number, default: 0 },
    field: { type: String, default: 'rate' }
  },
  ...configMetaSchema
}, { timestamps: true });

PricingRuleSchema.index({ companyId: 1, ruleKey: 1 }, { unique: true });
PricingRuleSchema.index({ companyId: 1, enabled: 1, priority: 1 });

module.exports = mongoose.model('PricingRuleConfig', PricingRuleSchema);
