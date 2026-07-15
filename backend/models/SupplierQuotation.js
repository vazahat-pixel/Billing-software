const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

const quoteLineSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  pcs: { type: Number, default: 0 },
  mts: { type: Number, default: 0 },
  rate: { type: Number, required: true, min: 0 },
  amount: { type: Number, default: 0 },
  leadDays: { type: Number, default: 0 },
}, { _id: false });

/**
 * Supplier quotation against an indent (or standalone RFQ).
 */
const SupplierQuotationSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  quoteNo: { type: String, required: true },
  indentId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseIndent', default: null },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
  date: { type: Date, default: Date.now },
  validUntil: { type: Date, default: null },
  items: { type: [quoteLineSchema], default: [] },
  totalAmount: { type: Number, default: 0 },
  remarks: { type: String, default: '' },
  status: {
    type: String,
    enum: ['Received', 'Selected', 'Rejected', 'Expired'],
    default: 'Received',
    index: true,
  },
}, { timestamps: true });

SupplierQuotationSchema.index({ companyId: 1, quoteNo: 1 }, { unique: true });
SupplierQuotationSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('SupplierQuotation', SupplierQuotationSchema);
