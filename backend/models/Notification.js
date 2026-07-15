const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/** In-app notification inbox — Sprint 2.6 */
const NotificationSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  event: { type: String, required: true, index: true },
  title: { type: String, required: true },
  body: { type: String, default: '' },
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    default: 'info',
  },
  channel: {
    type: String,
    enum: ['inApp', 'email', 'sms', 'whatsapp'],
    default: 'inApp',
  },
  status: {
    type: String,
    enum: ['Unread', 'Read', 'Archived'],
    default: 'Unread',
    index: true,
  },
  referenceType: { type: String, default: '' },
  referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  readAt: { type: Date, default: null },
}, { timestamps: true });

NotificationSchema.index({ companyId: 1, status: 1, createdAt: -1 });
NotificationSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('Notification', NotificationSchema);
