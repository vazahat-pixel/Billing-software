const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/**
 * Stage 6 — per-company enterprise productivity toggles.
 * All features default on for Pro-class tenants; Admin can disable individually.
 */
const EnterpriseConfigSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    unique: true,
    index: true,
  },
  features: {
    globalSearch: { type: Boolean, default: true },
    commandPalette: { type: Boolean, default: true },
    notificationCenter: { type: Boolean, default: true },
    workflowAutomation: { type: Boolean, default: true },
    approvalEngine: { type: Boolean, default: true },
    offlineMode: { type: Boolean, default: true },
    communicationHub: { type: Boolean, default: true },
    documentEngine: { type: Boolean, default: true },
    biDashboards: { type: Boolean, default: true },
    productivityTools: { type: Boolean, default: true },
  },
  channels: {
    inApp: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
    sms: { type: Boolean, default: false },
    whatsapp: { type: Boolean, default: false },
    push: { type: Boolean, default: false },
    desktop: { type: Boolean, default: true },
  },
  shortcuts: {
    commandPalette: { type: String, default: 'Ctrl+K' },
    alternate: { type: String, default: 'Ctrl+Space' },
  },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

EnterpriseConfigSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('EnterpriseConfig', EnterpriseConfigSchema);
