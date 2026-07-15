const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

const DocumentTemplateSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  docType: {
    type: String,
    enum: ['sales_invoice', 'purchase_bill', 'delivery_challan', 'purchase_order', 'grn', 'job_card', 'credit_note', 'label'],
    required: true,
  },
  name: { type: String, required: true },
  format: {
    type: String,
    enum: ['A4', 'Thermal', 'DotMatrix'],
    default: 'A4',
  },
  locale: { type: String, default: 'en-IN' },
  branding: {
    showLogo: { type: Boolean, default: true },
    showBank: { type: Boolean, default: true },
    footerNote: { type: String, default: '' },
    signatureLabel: { type: String, default: 'Authorised Signatory' },
  },
  channels: {
    print: { type: Boolean, default: true },
    pdf: { type: Boolean, default: true },
    email: { type: Boolean, default: true },
    whatsapp: { type: Boolean, default: true },
    excel: { type: Boolean, default: false },
  },
  isDefault: { type: Boolean, default: false },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
}, { timestamps: true });

DocumentTemplateSchema.index({ companyId: 1, docType: 1, name: 1 }, { unique: true });
DocumentTemplateSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('DocumentTemplate', DocumentTemplateSchema);
