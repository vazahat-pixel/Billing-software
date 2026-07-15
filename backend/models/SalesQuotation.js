const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

const SalesQuotationSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  quoteNo: { type: String, required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
  date: { type: Date, default: Date.now },
  validUntil: { type: Date, default: null },
  remarks: { type: String, default: '' },
  items: [{
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    lotId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLot', default: null },
    pcs: { type: Number, default: 0 },
    mts: { type: Number, default: 0 },
    rate: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
  }],
  totalAmount: { type: Number, default: 0, min: 0 },
  status: {
    type: String,
    enum: ['Draft', 'Sent', 'Accepted', 'Rejected', 'Converted', 'Expired'],
    default: 'Draft',
    index: true,
  },
  convertedOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
}, { timestamps: true });

SalesQuotationSchema.index({ companyId: 1, quoteNo: 1 }, { unique: true });
SalesQuotationSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('SalesQuotation', SalesQuotationSchema);
