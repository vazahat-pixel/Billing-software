const mongoose = require('mongoose');
const configMetaSchema = require('./mixins/configMetaSchema');

const NotificationConfigSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  ruleKey: { type: String, required: true },
  name: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  event: {
    type: String,
    enum: [
      'invoice_created', 'payment_received', 'payment_made',
      'low_stock', 'overdue_invoice', 'subscription_expiry',
      'company_locked', 'job_completed'
    ],
    required: true
  },
  channels: {
    email: { type: Boolean, default: false },
    sms: { type: Boolean, default: false },
    inApp: { type: Boolean, default: true },
    whatsapp: { type: Boolean, default: false }
  },
  recipients: {
    roles: [String],
    emails: [String]
  },
  template: { type: String, default: '' },
  throttleMinutes: { type: Number, default: 0 },
  ...configMetaSchema
}, { timestamps: true });

NotificationConfigSchema.index({ companyId: 1, ruleKey: 1 }, { unique: true });

module.exports = mongoose.model('NotificationConfig', NotificationConfigSchema);
