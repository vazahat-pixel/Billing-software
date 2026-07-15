const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

const OrderSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  orderType: {
    type: String,
    enum: ['Sales', 'Purchase'],
    required: true,
    index: true
  },
  orderNo: {
    type: String,
    required: true
  },
  partyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Party',
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  expectedDate: { type: Date, default: null },
  indentId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseIndent', default: null },
  quotationId: { type: mongoose.Schema.Types.ObjectId, ref: 'SupplierQuotation', default: null },
  salesQuotationId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesQuotation', default: null },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
  paymentTerms: { type: String, default: '' },
  creditDays: { type: Number, default: 0 },
  transport: { type: String, default: '' },
  remarks: { type: String, default: '' },
  items: [{
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true
    },
    lotId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLot', default: null },
    pcs: { type: Number, default: 0 },
    mts: { type: Number, default: 0 },
    rate: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    /** Cumulative GRN accepted qty against this PO line */
    receivedMts: { type: Number, default: 0 },
    receivedPcs: { type: Number, default: 0 },
    /** Sales allocation — shipped / invoiced against SO line (Sprint 2.5) */
    shippedMts: { type: Number, default: 0 },
    shippedPcs: { type: Number, default: 0 },
    invoicedMts: { type: Number, default: 0 },
    invoicedPcs: { type: Number, default: 0 },
    reservationId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockReservation', default: null },
  }],
  packingStatus: {
    type: String,
    enum: ['Pending', 'Picking', 'Packed', 'Dispatched'],
    default: 'Pending',
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['Draft', 'PendingApproval', 'Approved', 'Open', 'Partial', 'Closed', 'Cancelled', 'Rejected'],
    default: 'Open'
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
}, {
  timestamps: true
});

OrderSchema.index({ companyId: 1, orderType: 1, orderNo: 1 }, { unique: true });
OrderSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('Order', OrderSchema);

