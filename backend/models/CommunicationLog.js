const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/**
 * Stage 6.6 — Communication Hub delivery log (WhatsApp / Email / SMS / future APIs).
 */
const CommunicationLogSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  channel: {
    type: String,
    enum: ['whatsapp', 'email', 'sms', 'api'],
    required: true,
  },
  action: {
    type: String,
    enum: [
      'send_invoice',
      'send_purchase_order',
      'send_statement',
      'send_outstanding',
      'send_gst_report',
      'send_payment_reminder',
      'custom',
    ],
    required: true,
  },
  templateCode: { type: String, default: '' },
  recipient: { type: String, default: '' },
  partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', default: null },
  referenceType: { type: String, default: '' },
  referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  status: {
    type: String,
    enum: ['queued', 'sent', 'failed', 'stub'],
    default: 'stub',
  },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  error: { type: String, default: '' },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

CommunicationLogSchema.index({ companyId: 1, createdAt: -1 });
CommunicationLogSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('CommunicationLog', CommunicationLogSchema);
