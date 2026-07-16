const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/**
 * E-Way Bill — Sprint 4.6 (NIC-ready).
 */
const EWayBillSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  },
  refType: {
    type: String,
    enum: ['SalesInvoice', 'DeliveryChallan', 'PurchaseBill', 'GRN', 'Other'],
    default: 'SalesInvoice',
  },
  refId: { type: mongoose.Schema.Types.ObjectId },
  docNo: { type: String, default: '' },
  docDate: { type: Date },
  status: {
    type: String,
    enum: ['Draft', 'Ready', 'Generated', 'Updated', 'Cancelled', 'Expired', 'Failed'],
    default: 'Draft',
    index: true,
  },
  ewbNo: { type: String, default: '' },
  ewbDate: { type: Date },
  validUpto: { type: Date },
  // Part A
  fromGstin: { type: String, default: '' },
  toGstin: { type: String, default: '' },
  fromPlace: { type: String, default: '' },
  toPlace: { type: String, default: '' },
  fromStateCode: { type: String, default: '' },
  toStateCode: { type: String, default: '' },
  supplyType: { type: String, enum: ['O', 'I'], default: 'O' }, // Outward/Inward
  subSupplyType: { type: String, default: '1' },
  documentType: { type: String, default: 'INV' },
  transactionType: { type: Number, default: 1 },
  totalValue: { type: Number, default: 0 },
  cgstValue: { type: Number, default: 0 },
  sgstValue: { type: Number, default: 0 },
  igstValue: { type: Number, default: 0 },
  cessValue: { type: Number, default: 0 },
  // Part B
  transporterId: { type: String, default: '' },
  transporterName: { type: String, default: '' },
  transportMode: { type: String, enum: ['1', '2', '3', '4', ''], default: '1' }, // Road/Rail/Air/Ship
  vehicleNo: { type: String, default: '' },
  vehicleType: { type: String, enum: ['R', 'O', ''], default: 'R' },
  lrNo: { type: String, default: '' },
  lrDate: { type: Date },
  distance: { type: Number, default: 0 },
  requestPayload: { type: mongoose.Schema.Types.Mixed },
  responsePayload: { type: mongoose.Schema.Types.Mixed },
  provider: { type: String, enum: ['Mock', 'NIC', 'GSP'], default: 'Mock' },
  errorMessage: { type: String, default: '' },
}, { timestamps: true });

EWayBillSchema.index({ companyId: 1, ewbNo: 1 }, { sparse: true });
EWayBillSchema.plugin(enterpriseIntegrityPlugin, { softDelete: true, versionField: true });

module.exports = mongoose.model('EWayBill', EWayBillSchema);
