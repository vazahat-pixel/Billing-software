const mongoose = require('mongoose');

const PartySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['Customer', 'Supplier', 'Both', 'Broker', 'Job Worker'],
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
  openingBalance: {
    type: Number,
    default: 0
  },
  openingBalanceType: {
    type: String,
    enum: ['Dr', 'Cr'],
    default: 'Dr'
  },
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

module.exports = mongoose.model('Party', PartySchema);
