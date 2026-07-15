const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

const grnLineSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  orderItemIndex: { type: Number, default: 0 },
  orderedMts: { type: Number, default: 0 },
  orderedPcs: { type: Number, default: 0 },
  receivedMts: { type: Number, default: 0 },
  receivedPcs: { type: Number, default: 0 },
  acceptedMts: { type: Number, default: 0 },
  acceptedPcs: { type: Number, default: 0 },
  rejectedMts: { type: Number, default: 0 },
  rejectedPcs: { type: Number, default: 0 },
  rate: { type: Number, default: 0 },
  qcStatus: {
    type: String,
    enum: ['Pending', 'Passed', 'Failed', 'Partial'],
    default: 'Pending',
  },
  qcRemarks: { type: String, default: '' },
}, { _id: false });

/**
 * Goods Receipt Note — stock is NOT posted here.
 * Stock posts only when GRN (QC passed) converts to Purchase Invoice.
 */
const GrnSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  grnNo: { type: String, required: true },
  purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
  date: { type: Date, default: Date.now, index: true },
  challanNo: { type: String, default: '' },
  vehicleNo: { type: String, default: '' },
  lrNo: { type: String, default: '' },
  transport: { type: String, default: '' },
  ewayBillNo: { type: String, default: '' },
  items: { type: [grnLineSchema], default: [] },
  status: {
    type: String,
    enum: ['Draft', 'Received', 'QC_Pending', 'QC_Passed', 'QC_Failed', 'Invoiced', 'Cancelled'],
    default: 'Draft',
    index: true,
  },
  qcBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  qcAt: { type: Date, default: null },
  purchaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase', default: null },
  remarks: { type: String, default: '' },
  allowOverReceive: { type: Boolean, default: false },
}, { timestamps: true });

GrnSchema.index({ companyId: 1, grnNo: 1 }, { unique: true });
GrnSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('Grn', GrnSchema);
