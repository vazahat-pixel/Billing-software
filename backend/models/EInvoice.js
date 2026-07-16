const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/**
 * E-Invoice document — Sprint 4.6 (NIC/IRP-ready architecture).
 */
const EInvoiceSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  },
  salesId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sales', required: true, index: true },
  invoiceNo: { type: String, required: true },
  invoiceDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ['Draft', 'Ready', 'Generated', 'Cancelled', 'Failed'],
    default: 'Draft',
    index: true,
  },
  irn: { type: String, default: '' },
  ackNo: { type: String, default: '' },
  ackDate: { type: Date },
  qrCodeData: { type: String, default: '' },
  signedInvoice: { type: String, default: '' },
  cancelReason: { type: String, default: '' },
  cancelDate: { type: Date },
  /** NIC/IRP request payload (schema-ready) */
  requestPayload: { type: mongoose.Schema.Types.Mixed },
  /** NIC/IRP response */
  responsePayload: { type: mongoose.Schema.Types.Mixed },
  errorMessage: { type: String, default: '' },
  provider: { type: String, enum: ['Mock', 'NIC', 'GSP'], default: 'Mock' },
}, { timestamps: true });

EInvoiceSchema.index({ companyId: 1, invoiceNo: 1 });
EInvoiceSchema.index({ companyId: 1, irn: 1 }, { sparse: true });
EInvoiceSchema.plugin(enterpriseIntegrityPlugin, { softDelete: true, versionField: true });

module.exports = mongoose.model('EInvoice', EInvoiceSchema);
