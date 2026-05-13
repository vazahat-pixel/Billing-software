const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
  jobCardNo: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  lotId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryLot',
    required: true,
    index: true
  },
  workerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Party',
    required: true
  },
  processType: {
    type: String,
    required: true
  },
  issuePcs: {
    type: Number,
    default: 0
  },
  issueQty: {
    type: Number,
    required: true
  },
  receivedPcs: {
    type: Number,
    default: 0
  },
  receivedQty: {
    type: Number,
    default: 0
  },
  wastage: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Issued', 'In-Process', 'Received', 'Cancelled'],
    default: 'Issued'
  },
  issueDate: {
    type: Date,
    default: Date.now
  },
  receiveDate: Date,
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Job', JobSchema);
