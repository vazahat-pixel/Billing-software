const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

const StockReservationSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  reservationNo: { type: String, required: true },
  lotId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLot', required: true, index: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
  reservedMts: { type: Number, required: true, min: 0 },
  reservedPcs: { type: Number, default: 0, min: 0 },
  referenceType: {
    type: String,
    enum: ['SalesOrder', 'Manual', 'Transfer', 'Other'],
    default: 'Manual',
  },
  referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  status: {
    type: String,
    enum: ['Active', 'Consumed', 'Released', 'Expired'],
    default: 'Active',
    index: true,
  },
  expiresAt: { type: Date, default: null },
  remarks: { type: String, default: '' },
}, { timestamps: true });

StockReservationSchema.index({ companyId: 1, reservationNo: 1 }, { unique: true });
StockReservationSchema.index({ companyId: 1, lotId: 1, status: 1 });
StockReservationSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('StockReservation', StockReservationSchema);
