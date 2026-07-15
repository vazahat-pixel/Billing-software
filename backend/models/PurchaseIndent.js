const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

const lineSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  pcs: { type: Number, default: 0 },
  mts: { type: Number, default: 0 },
  rate: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  remarks: { type: String, default: '' },
}, { _id: false });

/**
 * Internal purchase request / indent before PO.
 */
const PurchaseIndentSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  indentNo: { type: String, required: true },
  date: { type: Date, default: Date.now, index: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  department: { type: String, default: '' },
  remarks: { type: String, default: '' },
  items: { type: [lineSchema], validate: [(v) => v.length > 0, 'At least one line required'] },
  status: {
    type: String,
    enum: ['Draft', 'Submitted', 'Approved', 'Rejected', 'Converted', 'Cancelled'],
    default: 'Draft',
    index: true,
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
}, { timestamps: true });

PurchaseIndentSchema.index({ companyId: 1, indentNo: 1 }, { unique: true });
PurchaseIndentSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('PurchaseIndent', PurchaseIndentSchema);
