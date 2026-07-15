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
    pcs: Number,
    mts: Number,
    rate: Number,
    amount: Number
  }],
  taxableAmount: {
    type: Number,
    required: true,
    min: 0
  },
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
