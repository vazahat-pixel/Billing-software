const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

const DeliveryChallanSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  challanNo: { type: String, required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
  date: { type: Date, default: Date.now },
  transport: { type: String, default: '' },
  station: { type: String, default: '' },
  lrNo: { type: String, default: '' },
  lrDate: { type: Date, default: null },
  eway: { type: String, default: '' },
  remarks: { type: String, default: '' },
  items: [{
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    lotId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLot', required: true },
    pcs: { type: Number, default: 0 },
    mts: { type: Number, required: true, min: 0.0001 },
    rate: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    reservationId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockReservation', default: null },
  }],
  /** Stock deducted at challan post — invoice must not deduct again */
  stockDeducted: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['Draft', 'Dispatched', 'Invoiced', 'Cancelled'],
    default: 'Draft',
    index: true,
  },
  salesId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sales', default: null },
  invoiceNo: { type: String, default: '' },
}, { timestamps: true });

DeliveryChallanSchema.index({ companyId: 1, challanNo: 1 }, { unique: true });
DeliveryChallanSchema.index({ companyId: 1, orderId: 1, status: 1 });
DeliveryChallanSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('DeliveryChallan', DeliveryChallanSchema);
