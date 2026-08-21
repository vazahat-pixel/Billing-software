const mongoose = require('mongoose');

const ReturnInvoiceSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  returnType: {
    type: String,
    enum: ['Sales', 'Purchase'],
    required: true,
    index: true
  },
  invoiceNo: {
    type: String,
    required: true
  },
  originalInvoiceNo: {
    type: String
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
  originalSaleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sales',
    default: null,
    index: true,
  },
  originalPurchaseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Purchase',
    default: null,
    index: true,
  },
  brokerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Party',
    default: null,
  },
  transport: { type: String, default: '' },
  city: { type: String, default: '' },
  lrNo: { type: String, default: '' },
  lrDate: { type: Date, default: null },
  freight: { type: Number, default: 0 },
  weight: { type: Number, default: 0 },
  remarks: { type: String, default: '' },
  items: [{
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true
    },
    /** Prefer restore to original sold lot (Sprint 2.5) */
    lotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryLot',
      default: null,
    },
    pcs: { type: Number, default: 0 },
    mts: { type: Number, default: 0 },
    rate: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    unit: { type: String, default: 'MTRS' },
    fold: { type: Number, default: 0 },
    cut: { type: Number, default: 0 },
    dis1Per: { type: Number, default: 0 },
    dis1Amt: { type: Number, default: 0 },
    addAmt: { type: Number, default: 0 },
    gstPer: { type: Number, default: 0 },
    gstAmt: { type: Number, default: 0 },
    desc: { type: String, default: '' }
  }],
  taxableAmount: {
    type: Number,
    required: true,
    min: 0
  },
  gstType: {
    type: String,
    enum: ['CGST+SGST', 'IGST', 'Exempt', 'NilRated', 'ZeroRated'],
    default: 'CGST+SGST'
  },
  gstRate: { type: Number, default: 0 },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  cess: { type: Number, default: 0 },
  tcs: { type: Number, default: 0 },
  roundOff: { type: Number, default: 0 },
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
  /** restore_lot = put qty back on original lot; new_lot = create RET- lot */
  restoreMode: {
    type: String,
    enum: ['restore_lot', 'new_lot'],
    default: 'restore_lot',
  },
}, {
  timestamps: true
});

ReturnInvoiceSchema.index({ companyId: 1, returnType: 1, invoiceNo: 1 }, { unique: true });

const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');
ReturnInvoiceSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('ReturnInvoice', ReturnInvoiceSchema);
