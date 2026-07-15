const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

const SalesSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Party',
    required: true,
    index: true
  },
  invoiceNo: {
    type: String,
    required: true
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
  orderNo: { type: String, default: '' },
  orderDate: { type: Date, default: null },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
  challanNo: { type: String, default: '' },
  chDate: { type: Date, default: null },
  challanId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryChallan', default: null, index: true },
  /** When true, stock already posted at challan — do not deduct again */
  stockFromChallan: { type: Boolean, default: false },
  invoiceType: {
    type: String,
    enum: ['Tax', 'Retail', 'BOS', 'Proforma'],
    default: 'Tax',
  },
  brokerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', default: null },
  haste: { type: String, default: '' },
  type: { type: String, default: '' },
  narration: {
    type: String,
    trim: true
  },
  transport: { type: String, default: '' },
  station: { type: String, default: '' },
  lrNo: { type: String, default: '' },
  lrDate: { type: Date, default: null },
  baleNo: { type: String, default: '' },
  freight: { type: Number, default: 0 },
  weight: { type: Number, default: 0 },
  eway: { type: String, default: '' },
  remarks: { type: String, default: '' },
  items: [{
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true
    },
    lotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryLot',
      default: null
    },
    pcs: { type: Number, default: 0 },
    mts: { type: Number, default: 0 },
    rate: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    desc: { type: String, default: '' },
    fold: { type: Number, default: 0 },
    cut: { type: Number, default: 0 },
    dis1Per: { type: Number, default: 0 },
    dis1Amt: { type: Number, default: 0 }
  }],
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
    required: true,
    min: 0
  },
  netAmount: {
    type: Number,
    required: true,
    min: 0
  },
  dueDays: { type: Number, default: 0 },
  dueDate: { type: Date, default: null },
  foldLess: { type: Number, default: 0 },
  foldLessSign: { type: String, default: '-' },
  rdAmt: { type: Number, default: 0 },
  rdAmtSign: { type: String, default: '-' },
  discountAmt: { type: Number, default: 0 },
  discountSign: { type: String, default: '-' },
  lessAmt: { type: Number, default: 0 },
  lessSign: { type: String, default: '-' },
  addAmt: { type: Number, default: 0 },
  addSign: { type: String, default: '+' },
  tcs: { type: Number, default: 0 },
  tcsPer: { type: Number, default: 0 },
  tcsAmount: { type: Number, default: 0 },
  roundOff: { type: Number, default: 0 },
  totalAdd: { type: Number, default: 0 },
  totalLess: { type: Number, default: 0 },
  // Tracks how much has been received against this invoice (for partial payment)
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
  }
}, {
  timestamps: true
});

// Per-company unique invoice number — fixes cross-tenant collision bug
SalesSchema.index({ invoiceNo: 1, companyId: 1 }, { unique: true });
SalesSchema.index({ companyId: 1, date: -1, status: 1 });

SalesSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('Sales', SalesSchema);

