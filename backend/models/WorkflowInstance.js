const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

const WorkflowInstanceSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  definitionId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowDefinition', default: null },
  module: { type: String, required: true, index: true },
  referenceType: { type: String, required: true },
  referenceId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  referenceNo: { type: String, default: '' },
  amount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['Pending', 'InProgress', 'Approved', 'Rejected', 'Escalated', 'Cancelled'],
    default: 'Pending',
    index: true,
  },
  currentStepIndex: { type: Number, default: 0 },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  timeline: [{
    at: { type: Date, default: Date.now },
    action: { type: String, required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    note: { type: String, default: '' },
  }],
  comments: [{
    text: { type: String, required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    at: { type: Date, default: Date.now },
  }],
  attachments: [{
    name: { type: String, default: '' },
    url: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  }],
  escalatedAt: { type: Date, default: null },
  dueAt: { type: Date, default: null },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  decidedAt: { type: Date, default: null },
}, { timestamps: true });

WorkflowInstanceSchema.index({ companyId: 1, status: 1, createdAt: -1 });
WorkflowInstanceSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('WorkflowInstance', WorkflowInstanceSchema);
