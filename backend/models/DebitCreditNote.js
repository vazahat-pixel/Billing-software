const mongoose = require('mongoose');

/**
 * Debit / Credit Note — Journal Entry With GST + TDS.
 *
 * A note is identified by TWO axes, not one:
 *   noteSide  Purchase | Sales   — which book it adjusts, and which GST return it feeds
 *   noteType  Debit    | Credit  — which direction it moves the party balance
 *
 * The four combinations are genuinely different transactions:
 *   Purchase + Debit   supplier payable DOWN, input GST (ITC) reversed
 *   Purchase + Credit  supplier payable UP,   input GST (ITC) increased
 *   Sales    + Debit   customer receivable UP,   output GST increased
 *   Sales    + Credit  customer receivable DOWN, output GST reversed
 *
 * Only Sales-side notes belong in GSTR-1 (CDNR/CDNUR). Purchase-side notes affect the
 * inward/ITC side and must never be filed as outward supplies.
 */
const DebitCreditNoteSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  noteType: {
    type: String,
    enum: ['Debit', 'Credit'],
    required: true,
    index: true
  },
  /**
   * Which book the note adjusts. Legacy rows predate this field: the old controller
   * hardwired Credit to the sales side and Debit to the purchase side, so that mapping
   * is the default and historical notes keep exactly the meaning they were posted with.
   */
  noteSide: {
    type: String,
    enum: ['Purchase', 'Sales'],
    required: true,
    index: true,
    default: function defaultSide() {
      return this.noteType === 'Credit' ? 'Sales' : 'Purchase';
    },
  },
  noteNo: {
    type: String,
    required: true
  },
  /** Operator-facing voucher number from the reference screen (V.NO). */
  vNo: { type: String, default: '' },
  partyLedgerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LedgerMaster',
    required: true
  },
  partyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Party',
    index: true,
  },
  partyName: { type: String, default: '' },
  partyGstin: { type: String, default: '' },
  date: {
    type: Date,
    default: Date.now
  },

  /** Original document this note adjusts. */
  billNo: { type: String, default: '' },
  billDate: { type: Date },
  againstInvoiceNo: { type: String },
  /** Real reference, not free text — set when picked through Adjust Against Bill. */
  againstInvoiceId: { type: mongoose.Schema.Types.ObjectId, index: true },
  againstInvoiceType: {
    type: String,
    enum: ['SalesInvoice', 'PurchaseBill', 'JobWorkCharges', ''],
    default: '',
  },

  amount: {
    type: Number,
    required: true,
    min: 0.01
  },
  /**
   * Exclusive: Amount IS the taxable value and GST is added on top (reference behaviour —
   * 85,714.29 + 5% = 90,000). Inclusive: Amount is gross and taxable is back-calculated,
   * which is what the original controller did, kept so existing callers do not shift.
   */
  amountMode: {
    type: String,
    enum: ['Exclusive', 'Inclusive'],
    default: 'Exclusive',
  },

  taxableAmount: { type: Number, default: 0 },
  /** Tax split actually applied: CGST+SGST (intra-state) or IGST (inter-state). */
  gstType: { type: String, default: 'CGST+SGST' },
  /** Registration/supply treatment driving return classification. */
  gstTreatment: {
    type: String,
    enum: ['Registered', 'Unregistered', 'Export', 'SEZ', 'DeemedExport', 'Composition'],
    default: 'Registered',
  },
  gstRate: { type: Number, default: 0 },
  cessRate: { type: Number, default: 0 },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  cess: { type: Number, default: 0 },
  gstAmount: { type: Number, default: 0 },

  /** Reverse charge — tax borne by us rather than collected by the supplier. */
  reverseCharge: { type: Boolean, default: false },
  rcmAmount: { type: Number, default: 0 },

  placeOfSupply: { type: String, default: '' },
  itcEligibility: {
    type: String,
    enum: ['', 'Inputs', 'Capital goods', 'Input services', 'Ineligible', 'Ineligible (Others)'],
    default: '',
  },
  hsnSac: { type: String, default: '' },
  /** GSTN reason-for-issue code, e.g. '03' — Deficiency in services. */
  reasonCode: { type: String, default: '' },
  reason: { type: String },
  /** Quantity/UQC code carried into GST reporting, e.g. OTH-OTHERS. */
  quc: { type: String, default: '' },

  /** Accounting head the adjustment posts against, when not the default return ledger. */
  accountHeadLedgerId: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerMaster' },
  accountHeadName: { type: String, default: '' },

  tdsLedgerId: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerMaster' },
  tdsPercent: { type: Number, default: 0 },
  tdsAmount: { type: Number, default: 0 },
  tdsRemark: { type: String, default: '' },

  roundOff: { type: Number, default: 0 },
  /** taxable + GST + round-off */
  netAmount: { type: Number, default: 0 },
  /** netAmount − TDS — what actually settles against the party */
  finalAmount: { type: Number, default: 0 },

  narration: { type: String, default: '' },

  accountingEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountingEntry' },
  reversalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountingEntry' },
  isReversed: { type: Boolean, default: false, index: true },
  reversedAt: { type: Date },
  reverseReason: { type: String },
  editedAt: { type: Date },

  /**
   * True only for a Note the system raised itself (e.g. a settlement discount on a
   * Receipt/Payment) — never client-settable, see noteController.createNoteInternal.
   * Such a note is a document/reporting representation of accounting the source
   * voucher already posted; it must never be edited or reversed on its own, only as
   * a side effect of editing/reversing that voucher (see accountingController).
   */
  autoGenerated: { type: Boolean, default: false, index: true },
  /** The voucher that generated this note, when autoGenerated is true. */
  sourceVoucherId: { type: mongoose.Schema.Types.ObjectId, index: true },
  sourceVoucherType: { type: String, default: '' },
  /** Client-supplied per-form token — a retried submit returns the original note. */
  idempotencyKey: { type: String },

  status: {
    type: String,
    enum: ['Draft', 'Posted', 'Reversed'],
    default: 'Draft'
  }
}, {
  timestamps: true
});

DebitCreditNoteSchema.index({ companyId: 1, noteType: 1, noteNo: 1 }, { unique: true });
DebitCreditNoteSchema.index({ companyId: 1, noteSide: 1, status: 1, date: 1 });
DebitCreditNoteSchema.index(
  { companyId: 1, idempotencyKey: 1 },
  {
    unique: true,
    name: 'uniq_note_idempotency',
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  }
);

module.exports = mongoose.model('DebitCreditNote', DebitCreditNoteSchema);
