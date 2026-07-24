const mongoose = require('mongoose');

const PartySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['Customer', 'Supplier', 'Both', 'Broker', 'Job Worker', 'Transport', 'Employee', 'Salesman', 'Agent'],
    required: true
  },
  gstin: {
    type: String,
    uppercase: true,
    trim: true
  },
  pan: {
    type: String,
    uppercase: true,
    trim: true
  },
  mobile: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    lowercase: true,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  state: {
    type: String,
    trim: true
  },
  creditLimit: {
    type: Number,
    default: 0
  },
  /** Cached outstanding — refreshed by Sprint 2.6 automation */
  outstandingReceivable: { type: Number, default: 0 },
  outstandingPayable: { type: Number, default: 0 },
  outstandingRefreshedAt: { type: Date, default: null },
  openingBalance: {
    type: Number,
    default: 0
  },
  openingBalanceType: {
    type: String,
    enum: ['Dr', 'Cr'],
    default: 'Dr'
  },
  accd: {
    type: Number,
    default: null
  },
  mainGroup: {
    type: Boolean,
    default: false
  },
  mainGroupId: {
    type: String,
    default: ''
  },
  phoneO: {
    type: String,
    default: ''
  },
  phoneR: {
    type: String,
    default: ''
  },
  contactPerson: {
    type: String,
    default: ''
  },
  tinCstNo: {
    type: String,
    default: ''
  },
  tinGstNo: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  updateInAllFirm: {
    type: String,
    default: 'Y'
  },
  updateInAllYear: {
    type: String,
    default: 'N'
  },
  aadharNo: {
    type: String,
    default: ''
  },
  stateCode: {
    type: String,
    default: '24'
  },
  stateName: {
    type: String,
    default: 'Gujarat'
  },
  gstType: {
    type: String,
    default: 'INVOICE (IN STATE)'
  },
  udyamAadhar: {
    type: String,
    default: ''
  },
  msmeType: {
    type: String,
    enum: ['None', 'Micro', 'Small', 'Medium'],
    default: 'None'
  },
  dueDays: {
    type: Number,
    default: 0
  },
  rdRate: {
    type: Number,
    default: 0
  },
  disc1: {
    type: Number,
    default: 0
  },
  disc2: {
    type: Number,
    default: 0
  },
  addPer: {
    type: Number,
    default: 0
  },
  intPer: {
    type: Number,
    default: 0
  },
  commi: {
    type: Number,
    default: 0
  },
  maxLevel: {
    type: Number,
    default: 0
  },
  minLevel: {
    type: Number,
    default: 0
  },
  tdsPer: {
    type: Number,
    default: 0
  },
  tcsPer: {
    type: Number,
    default: 0
  },
  paymentTermsId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubMaster',
    default: null
  },
  isFavorite: {
    type: Boolean,
    default: false,
    index: true
  },
  lastUsedAt: {
    type: Date,
    default: null
  },
  /** Party bank accounts for Cash/Bank Book P.Bank lookup */
  banks: [{
    name: { type: String, trim: true, default: '' },
    accountNo: { type: String, trim: true, default: '' },
    ifsc: { type: String, trim: true, uppercase: true, default: '' }
  }],
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Duplicate prevention per company
PartySchema.index({ name: 1, companyId: 1 }, { unique: true });
PartySchema.index(
  { accd: 1, companyId: 1 },
  {
    unique: true,
    name: 'uniq_party_accd',
    partialFilterExpression: { accd: { $type: 'number', $gt: 0 } },
  }
);
PartySchema.index(
  { companyId: 1, gstin: 1 },
  {
    unique: true,
    name: 'uniq_company_gstin',
    partialFilterExpression: { gstin: { $type: 'string', $gt: '' } },
  }
);

const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');
PartySchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('Party', PartySchema);
