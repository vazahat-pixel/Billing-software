const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
  jobCardNo: {
    type: String,
    required: true,
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
  processId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubMaster',
    default: null,
  },
  outputItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    default: null,
  },
  parentJobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    default: null,
  },
  chainTemplateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProcessChainTemplate',
    default: null,
  },
  productionType: {
    type: String,
    enum: ['Internal', 'External'],
    default: 'External',
  },
  currentStepIndex: { type: Number, default: 0, min: 0 },
  toleranceWastagePct: { type: Number, default: 3, min: 0 },
  processCharges: { type: Number, default: 0, min: 0 },
  processGstAmount: { type: Number, default: 0, min: 0 },
  /** Bill-wise settlement of Job Work Charges via Payment voucher (mirrors Purchase.paidAmount). */
  chargesPaidAmount: { type: Number, default: 0, min: 0 },
  finishedLotId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryLot',
    default: null,
  },
  /** Configurable multi-step process chain (Sprint 2.4) */
  steps: [{
    sequence: { type: Number, required: true },
    processId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubMaster', default: null },
    processName: { type: String, required: true },
    status: {
      type: String,
      enum: ['Pending', 'In-Process', 'QC-Pending', 'QC-Pass', 'Completed', 'Skipped'],
      default: 'Pending',
    },
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    issueQty: { type: Number, default: 0 },
    receivedQty: { type: Number, default: 0 },
    wastage: { type: Number, default: 0 },
    charges: { type: Number, default: 0 },
    qcPassed: { type: Boolean, default: null },
    qcNotes: { type: String, default: '' },
  }],
  issuePcs: {
    type: Number,
    default: 0
  },
  issueQty: {
    type: Number,
    required: true
  },
  /** Process-charge / textile challan extras (optional — UI form fields) */
  challanNo: { type: String, default: '' },
  weaver: { type: String, default: '' },
  purchaseBillNo: { type: String, default: '' },
  billGpNo: { type: String, default: '' },
  purchaseRate: { type: Number, default: 0, min: 0 },
  jobRate: { type: Number, default: 0, min: 0 },
  finish: { type: String, default: '' },
  remark: { type: String, default: '' },
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
    /**
     * 'Partial' — some, but not all, of issueQty/issuePcs has come back across one or
     * more receive events; the job stays open for further receives until the full
     * issued quantity is banked, at which point it becomes 'Received'.
     */
    enum: ['Issued', 'In-Process', 'Received', 'Partial', 'Cancelled'],
    default: 'Issued'
  },
  issueDate: {
    type: Date,
    default: Date.now
  },
  receiveDate: Date,
  receiveReversalEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AccountingEntry',
    default: null,
  },
  receiveReversedAt: {
    type: Date,
    default: null,
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

JobSchema.index({ jobCardNo: 1, companyId: 1 }, { unique: true });
JobSchema.index({ companyId: 1, status: 1, issueDate: -1 });

/** What's left to receive against this job — the Receive screen pre-fills from this. */
JobSchema.virtual('pendingQty').get(function pendingQty() {
  return Math.max(0, Number((Number(this.issueQty || 0) - Number(this.receivedQty || 0)).toFixed(4)));
});
JobSchema.virtual('pendingPcs').get(function pendingPcs() {
  return Math.max(0, Number(this.issuePcs || 0) - Number(this.receivedPcs || 0));
});

const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');
JobSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('Job', JobSchema);
