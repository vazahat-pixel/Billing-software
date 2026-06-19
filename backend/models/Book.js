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

module.exports = mongoose.model('Book', BookSchema);
