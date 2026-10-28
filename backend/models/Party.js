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
  // A/c. Head chosen in Account Master (e.g. EXPENCES, BANK ACCOUNTS). Empty for older parties —
  // the app then shows the head that matches the type.
  group: { type: String, trim: true, uppercase: true, default: '' },
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
  connectedCode: {
    type: String,
    trim: true,
    default: ''
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
  dharaPer: {
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
  tdsSection: {
    type: String,
    trim: true,
    default: ''
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
  // JSM Account Master fields with no business logic attached (display/print only).
  alias: { type: String, trim: true, default: '' },
  address2: { type: String, trim: true, default: '' },
  address3: { type: String, trim: true, default: '' },
  pincode: { type: String, trim: true, default: '' },
  brokerId: { type: String, trim: true, default: '' },
  transport: { type: String, trim: true, default: '' },
  salesMan: { type: String, trim: true, default: '' },
  areaName: { type: String, trim: true, default: '' },
  haste: { type: String, trim: true, default: '' },
  expCity: { type: String, trim: true, default: '' },
  hsnCode: { type: String, trim: true, default: '' },
  dob: { type: String, trim: true, default: '' },
  msmeYear: { type: String, trim: true, default: '' },
  ref1: { type: String, trim: true, default: '' },
  ref2: { type: String, trim: true, default: '' },
  ref3: { type: String, trim: true, default: '' },
  ref4: { type: String, trim: true, default: '' },
  factoryAddress1: { type: String, trim: true, default: '' },
  factoryAddress2: { type: String, trim: true, default: '' },
  factoryCity: { type: String, trim: true, default: '' },
  factoryMobile: { type: String, trim: true, default: '' },
  eCommerce: { type: Boolean, default: false },
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
