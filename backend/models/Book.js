const mongoose = require('mongoose');

const BookSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  code: {
    type: String,
    required: true
  },
  module: {
    type: String,
    required: true,
    enum: ['sales', 'purchase', 'receipt', 'payment', 'millIssue', 'millRec', 'jobIssue', 'jobRec', 'ledger']
  },
  bookType: {
    type: String,
    default: 'SALES BOOK'
  },
  groupHead: {
    type: String,
    default: ''
  },
  opBalance: {
    type: Number,
    default: 0
  },
  opBalanceType: {
    type: String,
    enum: ['DR', 'CR'],
    default: 'DR'
  },
  accountNo: {
    type: String,
    default: ''
  },
  gstinNo: {
    type: String,
    default: ''
  },
  stateCode: {
    type: String,
    default: '0'
  },
  stateName: {
    type: String,
    default: ''
  },
  gstType: {
    type: String,
    default: ''
  },
  retailTax: {
    type: String,
    default: ''
  },
  detailJobWork: {
    type: String,
    default: 'D'
  },
  rowFinishMaterial: {
    type: String,
    default: 'F'
  },
  incExcVat: {
    type: String,
    default: ''
  },
  effectOnStock: {
    type: String,
    default: 'N'
  },
  address1: {
    type: String,
    default: ''
  },
  address2: {
    type: String,
    default: ''
  },
  dist: {
    type: String,
    default: ''
  },
  state: {
    type: String,
    default: ''
  },
  head1: {
    type: String,
    default: 'Pcs'
  },
  head2: {
    type: String,
    default: 'Qty'
  },
  createDate: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    default: ''
  },
  jobWorkBook: {
    type: Boolean,
    default: false
  },
  tdsHead: {
    type: String,
    default: ''
  },
  tdsCode: {
    type: Number,
    default: 0
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: false,
    index: true
  }
}, {
  timestamps: true
});

BookSchema.index(
  { companyId: 1, code: 1 },
  {
    unique: true,
    name: 'uniq_book_code',
    partialFilterExpression: { companyId: { $type: 'objectId' } },
  }
);

const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');
BookSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('Book', BookSchema);
