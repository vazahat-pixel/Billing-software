const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

const PurchaseSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Party',
    required: true,
    index: true
  },
  invoiceNo: {
    type: String,
    required: true
  },
  supplierInvoiceNo: {
    type: String,
    default: ''
  },
  date: {
    type: Date,
    default: Date.now,
    index: true
  },
  bookId: {
    type: String,
    default: null
  },
  reverseCharge: { type: String, default: 'No' },
  challanNo: { type: String, default: '' },
  challanDate: { type: Date, default: null },
  brokerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', default: null },
  type: { type: String, default: '' },
  narration: {
    type: String,
    trim: true
  },
  items: [{
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true
    },
    pcs: { type: Number, default: 0 },
    cut: { type: Number, default: 0 },
    mts: { type: Number, default: 0 },
    rate: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    fold: { type: Number, default: 0 },
    dis1Per: { type: Number, default: 0 },
    dis1Amt: { type: Number, default: 0 },
    dis2Per: { type: Number, default: 0 },
    dis2Amt: { type: Number, default: 0 },
    gstPer: { type: Number, default: 0 },
    gstAmt: { type: Number, default: 0 },
    lotId: String // Generated on save — string lotId for InventoryLot.lotId field
  }],
  // Standardized to match Sales model — previously was `totalAmount` (confusing)
  taxableAmount: {
    type: Number,
    required: true,
    min: 0
  },
  gstType: {
    type: String,
    enum: ['CGST+SGST', 'IGST'],
    default: 'CGST+SGST'
  },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  gstAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  netAmount: {
    type: Number,
    required: true,
    min: 0
  },
  discountAmt: { type: Number, default: 0 },
  lessAmt: { type: Number, default: 0 },
  addAmt: { type: Number, default: 0 },
  octroi: { type: Number, default: 0 },
  itcEligibility: { type: String, default: 'Inputs' },
  roundOff: { type: Number, default: 0 },
  rcmCharge: { type: Number, default: 0 },
  // Tracks how much has been paid against this bill (for partial payment tracking)
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'paid', 'partial'],
    default: 'active'
  },
  accountingEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AccountingEntry',
    default: null
  },
  /** Purchase Engine linkage (Sprint 2.2) */
  purchaseOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null,
    index: true,
  },
  grnId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Grn',
    default: null,
    index: true,
  },
  freightAmount: { type: Number, default: 0, min: 0 },
  otherCharges: { type: Number, default: 0, min: 0 },
  tdsAmount: { type: Number, default: 0, min: 0 },
  vehicleNo: { type: String, default: '' },
  lrNo: { type: String, default: '' },
  transport: { type: String, default: '' },
  ewayBillNo: { type: String, default: '' },
  /** Godown where purchase lots are received */
  warehouseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    default: null,
    index: true,
  },
  /** Optional metadata from Auto Bill Fill (supplier PDF/photo scan) */
  billAttachment: {
    fileName: { type: String, default: '' },
    mimeType: { type: String, default: '' },
    extractedAt: { type: Date, default: null },
  },
}, {
  timestamps: true
});

// Per-company unique invoice number
PurchaseSchema.index({ invoiceNo: 1, companyId: 1 }, { unique: true });
PurchaseSchema.index(
  { companyId: 1, supplierId: 1, supplierInvoiceNo: 1 },
  {
    unique: true,
    name: 'uniq_supplier_invoice',
    partialFilterExpression: { supplierInvoiceNo: { $type: 'string', $gt: '' } },
  }
);
PurchaseSchema.index({ companyId: 1, date: -1, status: 1 });

PurchaseSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('Purchase', PurchaseSchema);

