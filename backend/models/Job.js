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
  roundOff: { type: Number, default: 0 },
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
  serialNo: { type: String, default: '', index: true },
  purchaseRate: { type: Number, default: 0, min: 0 },
  jobRate: { type: Number, default: 0, min: 0 },
  finish: { type: String, default: '' },
  gstPer: { type: Number, default: 0, min: 0 },
  gstType: { type: String, default: 'CGST+SGST' },
  remark: { type: String, default: '' },
  // Mill Issue header fields as in JSM I_Tran_Inv_Proc_Issue (the screen already sent transport /
  // lrNo / markaNo / hsnCode, but without schema fields they were dropped on save).
  broker: { type: String, trim: true, default: '' },
  issueKgs: { type: Number, default: 0, min: 0 },
  masterName: { type: String, trim: true, default: '' },
  transport: { type: String, trim: true, default: '' },
  lrNo: { type: String, trim: true, default: '' },
  markaNo: { type: String, trim: true, default: '' },
  hsnCode: { type: String, trim: true, default: '' },
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
  /**
   * Grey returned against this challan (JSM Mill Receipt Grey.Mts / G.Pcs). As in JSM, the
   * challan balance and wastage are counted in grey; receivedQty / receivedPcs stay the finished
   * output that goes into stock. null = receipts saved before grey was recorded separately —
   * then grey is taken as equal to finish, exactly as those receipts were calculated.
   */
  receivedGreyQty: { type: Number, default: null },
  receivedGreyPcs: { type: Number, default: null },
  receivedFinalQty: { type: Number, default: 0 }, // Final.Mts (after fold)
  receivedGreyKgs: { type: Number, default: 0 }, // Gry.Kgs
  receivedKgs: { type: Number, default: 0 }, // Rec.Kgs
  // Job amount basis (JSM P/Q/K): Q finish mts, P pcs, K rec kgs, G grey kgs, F final mts.
  // '' on older receipts (screen then reproduces their old amount).
  jobUnit: { type: String, default: '' },
  perKgs: { type: Number, default: 0 },
  receiveDesc1: { type: String, trim: true, default: '' },
  receiveDesc2: { type: String, trim: true, default: '' },
  /** JSM challan lot number (free text) and 'LAST' for a challan carried in from an earlier year. */
  lotNo: { type: String, trim: true, default: '' },
  lastYear: { type: String, trim: true, default: '' },
  /** 'Mill' (Mill Issue) or 'Job' (Job Issue). '' on challans saved before it was kept: counted as mill. */
  workKind: { type: String, enum: ['', 'Mill', 'Job'], default: '' },
  /**
   * Each receipt against this challan as JSM lists it in Process Stock (date, mill bill, grey / finish qty, pcs).
   * Filled by the JSM import; challans without it show their received totals as one line.
   */
  receipts: [{
    _id: false,
    date: Date,
    billNo: { type: String, default: '' },
    serialNo: { type: String, default: '' },
    greyQty: { type: Number, default: 0 },
    finishQty: { type: Number, default: 0 },
    pcs: { type: Number, default: 0 },
    kgs: { type: Number, default: 0 },
    shortQty: { type: Number, default: 0 },
    rate: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
  }],
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
  },
  /**
   * Hybrid sync idempotency key — set by the desktop client before creating offline.
   * Central side uses this to guarantee exactly-once processing via ProcessedOperation.
   * Mirrors Sales.operationId and Purchase.operationId. Additive — null for pre-hybrid records.
   */
  operationId: {
    type: String,
    default: null,
    index: true,
    sparse: true,
  },
  lastReceiveOperationId: {
    type: String,
    default: null,
    index: true,
    sparse: true,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

JobSchema.index({ jobCardNo: 1, companyId: 1 }, { unique: true });
JobSchema.index({ companyId: 1, status: 1, issueDate: -1 });

/** Grey returned so far (falls back to finish for receipts saved before grey was recorded). */
JobSchema.virtual('greyReceivedQty').get(function greyReceivedQty() {
  return Number(this.receivedGreyQty ?? this.receivedQty ?? 0);
});

/** What's left to receive against this job, in grey as in JSM — the Receive screen pre-fills from this. */
JobSchema.virtual('pendingQty').get(function pendingQty() {
  const back = Number(this.receivedGreyQty ?? this.receivedQty ?? 0);
  return Math.max(0, Number((Number(this.issueQty || 0) - back).toFixed(4)));
});
JobSchema.virtual('pendingPcs').get(function pendingPcs() {
  const back = Number(this.receivedGreyPcs ?? this.receivedPcs ?? 0);
  return Math.max(0, Number(this.issuePcs || 0) - back);
});

const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');
JobSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('Job', JobSchema);
