const mongoose = require('mongoose');
const DebitCreditNote = require('../models/DebitCreditNote');
const AccountingEntry = require('../models/AccountingEntry');
const LedgerMaster = require('../models/LedgerMaster');
const Party = require('../models/Party');
const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');
const Job = require('../models/Job');
const Counter = require('../models/Counter');
const accountingService = require('../services/accountingService');
const auditService = require('../services/auditService');

const round2 = (n) => Number(Number(n || 0).toFixed(2));
/** Compare money as whole paise — never trust float equality on currency. */
const toPaise = (n) => Math.round(Number(n || 0) * 100);

async function generateNoteNo(companyId, type, session = null) {
  const prefix = type === 'Debit' ? 'DN' : 'CN';
  const currentYear = new Date().getFullYear().toString().substring(2);
  const nextYear = (new Date().getFullYear() + 1).toString().substring(2);
  const fy = `${currentYear}-${nextYear}`;
  const counterId = `${prefix}-${fy}-${companyId}`;
  const seq = await Counter.nextSeq(counterId, session);
  return `${prefix}-${fy}-${seq.toString().padStart(4, '0')}`;
}

/**
 * Which way the four note kinds move money.
 *
 *   partySign  +1 the party leg is Dr (they owe us more / we owe them less)
 *              -1 the party leg is Cr
 *   baseLedger the P&L account the adjustment lands in
 *   gstLedgers Output GST for sales-side, Input GST for purchase-side
 *
 * Purchase Debit reduces the payable — the convention already posted in this database,
 * so historical Debit Notes keep their meaning. Purchase Credit is its exact opposite.
 */
function noteDirection(noteSide, noteType) {
  const isSales = noteSide === 'Sales';
  const isDebit = noteType === 'Debit';

  if (isSales) {
    return {
      partySign: isDebit ? +1 : -1,
      // Debit raises the sale; Credit sends it back through Sales Return.
      baseLedgerName: isDebit ? 'Sales A/c' : 'Sales Return A/c',
      gstLedgerNames: { cgst: 'CGST Output', sgst: 'SGST Output', igst: 'IGST Output' },
      // Sales Debit adds output tax (Cr); Sales Credit reverses it (Dr).
      gstSign: isDebit ? -1 : +1,
      baseSign: isDebit ? -1 : +1,
    };
  }
  return {
    partySign: isDebit ? +1 : -1,
    baseLedgerName: isDebit ? 'Purchase Return A/c' : 'Purchase A/c',
    gstLedgerNames: { cgst: 'CGST Input', sgst: 'SGST Input', igst: 'IGST Input' },
    // Purchase Debit reverses ITC (Cr); Purchase Credit adds ITC (Dr).
    gstSign: isDebit ? -1 : +1,
    baseSign: isDebit ? -1 : +1,
  };
}

const drCr = (sign) => (sign > 0 ? 'Dr' : 'Cr');

/**
 * Compute every monetary figure on the note from the taxable value up.
 * Frontend numbers are never trusted — only Amount, rate and flags are inputs.
 */
async function computeNoteTotals(companyId, body, party) {
  const { computeTaxComponents, determineGstType, placeOfSupply } = require('../utils/gstDetermination');

  let companyGstin = '';
  let companyStateCode = '';
  try {
    const gstConfigService = require('../services/gstConfigService');
    const cfg = await gstConfigService.getOrCreate(companyId);
    companyGstin = cfg.gstin;
    companyStateCode = cfg.stateCode;
  } catch (_) { /* optional */ }

  const amount = round2(body.amount);
  const rate = Number(body.gstRate || 0);
  const cessRate = Number(body.cessRate || 0);
  const mode = body.amountMode === 'Inclusive' ? 'Inclusive' : 'Exclusive';
  // Exclusive is the reference behaviour: Amount is the taxable value, GST rides on top.
  const taxable = round2(
    mode === 'Inclusive' && rate > 0 ? amount / (1 + rate / 100) : amount
  );

  // Intra vs inter-state comes from the party's own registration, not a frontend flag.
  const partyGstin = party?.gstin || body.partyGstin || '';
  const partyStateCode = party?.stateCode || body.partyStateCode || '';
  const resolvedType = determineGstType({
    companyGstin,
    companyStateCode,
    partyGstin,
    partyStateCode,
    forceType: body.gstType === 'IGST' || body.gstType === 'CGST+SGST' ? body.gstType : undefined,
  });

  // half-rate split matches the reference screen exactly (2,142.86 + 2,142.86 = 4,285.72,
  // giving the -0.01 round-off it shows). Sales/Purchase keep the existing split-total mode.
  const tax = computeTaxComponents(taxable, rate, resolvedType, cessRate, 'half-rate');
  const pos = placeOfSupply({ partyGstin, partyStateCode, companyStateCode });

  // Reverse charge: the tax is our own liability, so it is not collected from the party.
  const reverseCharge = !!body.reverseCharge;
  const rcmAmount = reverseCharge ? round2(tax.gstAmount) : 0;
  const partyGst = reverseCharge ? 0 : round2(tax.gstAmount + tax.cess);

  const beforeRound = round2(tax.taxableAmount + partyGst);
  // Round to the rupee the way the rest of the ERP does, and keep the difference visible.
  const rounded = Math.round(beforeRound);
  const roundOff = round2(rounded - beforeRound);
  const netAmount = round2(beforeRound + roundOff);

  const tdsPercent = Number(body.tdsPercent || 0);
  const tdsAmount = body.tdsAmount != null && body.tdsAmount !== '' && !isNaN(Number(body.tdsAmount))
    ? round2(body.tdsAmount)
    : (tdsPercent > 0 ? round2((tax.taxableAmount * tdsPercent) / 100) : 0);
  const finalAmount = round2(netAmount - tdsAmount);

  if (tdsAmount > netAmount + 0.01) {
    throw new Error(`TDS ₹${tdsAmount.toFixed(2)} cannot exceed the note value ₹${netAmount.toFixed(2)}`);
  }

  return {
    amountMode: mode,
    taxable: tax.taxableAmount,
    gstType: resolvedType,
    gstRate: rate,
    cessRate,
    cgst: tax.cgst,
    sgst: tax.sgst,
    igst: tax.igst,
    cess: tax.cess,
    gstAmount: tax.gstAmount,
    reverseCharge,
    rcmAmount,
    roundOff,
    netAmount,
    tdsPercent,
    tdsAmount,
    finalAmount,
    placeOfSupply: pos.stateCode || '',
  };
}

/**
 * Resolve the original bill this note adjusts and prove it belongs to the same party.
 * A note may never be attached to another party's invoice.
 *
 * Purchase-side notes also cover Job Work Charges — a Job Worker's "bill" is the
 * processCharges + processGstAmount posted on Job Receive, not a Purchase document.
 */
async function resolveAgainstBill(companyId, body, party, noteSide, session) {
  const id = body.againstInvoiceId;
  if (!id) {
    return { againstInvoiceId: undefined, againstInvoiceType: '', againstInvoiceNo: body.againstInvoiceNo || '' };
  }

  const isSales = noteSide === 'Sales';
  let doc = null;
  let billKind = null;

  if (isSales) {
    doc = await Sales.findOne({ _id: id, companyId }).session(session);
    billKind = 'sales';
  } else {
    doc = await Purchase.findOne({ _id: id, companyId }).session(session);
    billKind = 'purchase';
    if (!doc) {
      doc = await Job.findOne({ _id: id, companyId }).session(session);
      billKind = 'job';
    }
  }
  if (!doc) {
    throw new Error(`Original ${isSales ? 'sales invoice' : 'purchase bill / job work charges'} not found for this company`);
  }

  const billPartyId = billKind === 'job' ? String(doc.workerId || '') : String(doc.customerId || doc.supplierId || '');
  const expected = party ? String(party._id) : '';
  if (!expected) {
    throw new Error('Party could not be resolved — bill linkage needs a real party');
  }
  if (billPartyId !== expected) {
    throw new Error(`Bill ${doc.invoiceNo || doc.jobCardNo || id} does not belong to ${party.name} — a note cannot adjust another party's bill`);
  }

  return {
    againstInvoiceId: doc._id,
    againstInvoiceType: billKind === 'sales' ? 'SalesInvoice' : billKind === 'purchase' ? 'PurchaseBill' : 'JobWorkCharges',
    againstInvoiceNo: doc.invoiceNo || doc.jobCardNo || body.againstInvoiceNo || '',
    billDoc: doc,
    billKind,
  };
}

/**
 * Move the linked bill's outstanding by the note's value and resync bill-wise settlement.
 * `sign` is +1 when the note reduces what is outstanding, −1 when it increases it.
 * `billKind` defaults to inferring Sales-vs-Purchase from noteSide for backward
 * compatibility with existing callers; pass 'job' explicitly for Job Work Charges.
 */
async function applyBillAdjustment(companyId, billDoc, noteSide, amount, sign, session, billKind) {
  if (!billDoc || !amount) return;

  const kind = billKind || (noteSide === 'Sales' ? 'sales' : 'purchase');
  const delta = round2(amount * sign);

  if (kind === 'job') {
    const billTotal = round2((billDoc.processCharges || 0) + (billDoc.processGstAmount || 0));
    const nextPaid = round2((billDoc.chargesPaidAmount || 0) + delta);
    if (nextPaid > billTotal + 0.01) {
      throw new Error(
        `Adjusting ₹${Math.abs(delta).toFixed(2)} against Job ${billDoc.jobCardNo || ''} ` +
        `would exceed its charges ₹${billTotal.toFixed(2)}`
      );
    }
    billDoc.chargesPaidAmount = Math.max(0, nextPaid);
    await billDoc.save({ session });
    return;
  }

  const outstandingEngine = require('../services/outstandingEngineService');
  const billTotal = round2(billDoc.netAmount || 0);
  const nextPaid = round2((billDoc.paidAmount || 0) + delta);

  if (nextPaid > billTotal + 0.01) {
    throw new Error(
      `Adjusting ₹${Math.abs(delta).toFixed(2)} against bill ${billDoc.invoiceNo || ''} ` +
      `would exceed its value ₹${billTotal.toFixed(2)}`
    );
  }

  billDoc.paidAmount = Math.max(0, nextPaid);
  if (billDoc.paidAmount >= billTotal - 0.99) billDoc.status = 'paid';
  else if (billDoc.paidAmount > 0) billDoc.status = 'partial';
  else if (billDoc.status !== 'cancelled') billDoc.status = 'active';

  await billDoc.save({ session });
  if (kind === 'sales') await outstandingEngine.syncBillFromSales(companyId, billDoc, session);
  else await outstandingEngine.syncBillFromPurchase(companyId, billDoc, session);
}

/**
 * Build and post the journal for a note. Every leg is derived from noteDirection(),
 * so the four kinds can never share an accidentally-identical posting.
 */
async function postNoteJournal(companyId, note, totals, partyLedger, session) {
  const dir = noteDirection(note.noteSide, note.noteType);
  const entryNo = await accountingService.generateEntryNo(companyId, 'JNL', session);
  const lines = [];

  // Base leg — an explicit Head overrides the default return/sale account.
  let baseLedger = null;
  if (note.accountHeadLedgerId) {
    baseLedger = await LedgerMaster.findOne({ _id: note.accountHeadLedgerId, companyId }).session(session);
  }
  if (!baseLedger) {
    baseLedger = await accountingService.getSystemLedger(companyId, dir.baseLedgerName, session);
  }
  lines.push({
    ledgerId: baseLedger._id,
    ledgerName: baseLedger.name,
    type: drCr(dir.baseSign),
    amount: totals.taxable,
    narration: `${note.noteSide} ${note.noteType} Note #${note.noteNo}${note.reason ? ` — ${note.reason}` : ''}`,
  });

  // GST legs. Under reverse charge the tax does not sit on the party at all: the input
  // side is claimed and an equal RCM liability is raised, so the note still balances.
  const gstPairs = [
    ['cgst', totals.cgst], ['sgst', totals.sgst], ['igst', totals.igst],
  ];
  for (const [key, amt] of gstPairs) {
    if (amt <= 0.004) continue;
    const led = await accountingService.getSystemLedger(companyId, dir.gstLedgerNames[key], session);
    lines.push({
      ledgerId: led._id,
      ledgerName: led.name,
      type: drCr(dir.gstSign),
      amount: amt,
      narration: `${dir.gstLedgerNames[key]} — Note #${note.noteNo}`,
    });
  }
  if (totals.reverseCharge && totals.rcmAmount > 0.004) {
    const rcmLedger = await accountingService.getSystemLedger(
      companyId, totals.gstType === 'IGST' ? 'IGST RCM' : 'CGST RCM', session
    );
    lines.push({
      ledgerId: rcmLedger._id,
      ledgerName: rcmLedger.name,
      type: drCr(-dir.gstSign),
      amount: totals.rcmAmount,
      narration: `Reverse charge liability — Note #${note.noteNo}`,
    });
  }

  if (Math.abs(totals.roundOff) > 0.004) {
    const roundLedger = await accountingService.getSystemLedger(companyId, 'Round Off', session);
    lines.push({
      ledgerId: roundLedger._id,
      ledgerName: roundLedger.name,
      // Round-off sits on the same side as the base leg when it increases the note.
      type: drCr(totals.roundOff > 0 ? dir.baseSign : -dir.baseSign),
      amount: round2(Math.abs(totals.roundOff)),
      narration: `Round off — Note #${note.noteNo}`,
    });
  }

  // TDS is a withholding, never a tax on the supply — its own ledger, always.
  if (totals.tdsAmount > 0.004) {
    let tdsLedger = null;
    if (note.tdsLedgerId) {
      tdsLedger = await LedgerMaster.findOne({ _id: note.tdsLedgerId, companyId }).session(session);
    }
    if (!tdsLedger) {
      tdsLedger = await accountingService.getSystemLedger(
        companyId, note.noteSide === 'Sales' ? 'TDS Receivable' : 'TDS Payable', session
      );
    }
    lines.push({
      ledgerId: tdsLedger._id,
      ledgerName: tdsLedger.name,
      // Same side as the party: the party leg carries net-of-TDS, so the withheld
      // portion sits beside it and together they equal the full note value.
      type: drCr(dir.partySign),
      amount: totals.tdsAmount,
      narration: note.tdsRemark || `TDS — Note #${note.noteNo}`,
    });
  }

  // Party leg carries what actually settles: net of GST treatment and net of TDS.
  lines.push({
    ledgerId: partyLedger._id,
    ledgerName: partyLedger.name,
    type: drCr(dir.partySign),
    amount: totals.finalAmount,
    narration: `${note.noteType} Note #${note.noteNo}`,
  });

  const entry = await AccountingEntry.create([{
    companyId,
    entryNo,
    entryDate: note.date || new Date(),
    voucherType: 'NoteAuto',
    refType: note.noteType === 'Credit' ? 'CreditNote' : 'DebitNote',
    refId: note._id,
    lines,
    narration: note.narration || note.reason || `${note.noteSide} ${note.noteType} Note`,
  }], { session });

  return entry[0];
}

/** Shared resolve+validate for create and edit. */
async function resolveNoteContext(companyId, body, session) {
  const noteType = body.noteType;
  const noteSide = body.noteSide || (noteType === 'Credit' ? 'Sales' : 'Purchase');

  if (!['Debit', 'Credit'].includes(noteType)) throw new Error('Note type must be Debit or Credit');
  if (!['Purchase', 'Sales'].includes(noteSide)) throw new Error('Note side must be Purchase or Sales');
  if (!body.partyLedgerId && !body.partyId) throw new Error('Please select a Party');
  if (!(round2(body.amount) > 0)) throw new Error('Please enter a valid Amount');

  const rawPartyId = body.partyLedgerId || body.partyId;
  let partyLedger = await LedgerMaster.findOne({ _id: rawPartyId, companyId }).session(session);
  if (!partyLedger) {
    try {
      partyLedger = await accountingService.getOrCreatePartyLedger(companyId, rawPartyId);
    } catch (_) { /* handled below */ }
  }
  if (!partyLedger) throw new Error('Invalid party ledger selection');

  const party = partyLedger.linkedPartyId
    ? await Party.findOne({ _id: partyLedger.linkedPartyId, companyId }).session(session)
    : null;

  const totals = await computeNoteTotals(companyId, body, party);
  const bill = await resolveAgainstBill(companyId, body, party, noteSide, session);

  return { noteType, noteSide, partyLedger, party, totals, bill };
}

/**
 * Core note creation, reusable inside an ALREADY-OPEN session/transaction — used by both
 * the standalone Note screen and any other flow that needs to raise a note as a side
 * effect of its own save (e.g. a Discount typed on a Payment/Receipt voucher). Never
 * starts or commits a session itself; the caller owns the transaction.
 *
 * `options.skipFinancialPosting` — the note still gets its full GST/taxable breakup and
 * status: 'Posted' (so it counts for GSTR-1/CDNR), but does NOT post its own journal or
 * touch the bill's outstanding. Use this when the caller's OWN posting already moved that
 * money — e.g. a Payment/Receipt voucher's "Discount" column already reduces the bill and
 * books Discount Allowed/Received; the auto-raised note would otherwise double-count both.
 *
 * `options.autoGenerated` / `sourceVoucherId` / `sourceVoucherType` — stamps the note as
 * system-raised and links it back to whatever posted it. Deliberately only settable via
 * `options` (server-controlled), never `body` (client-controlled) — see updateNote/
 * reverseNote, which refuse to touch a note carrying this flag.
 */
async function createNoteInternal(companyId, body, session, options = {}) {
  const posting = body.status === 'Posted' && !options.skipFinancialPosting;

  if (posting) {
    const gstConfigService = require('../services/gstConfigService');
    await gstConfigService.assertPeriodOpen(companyId, body.date || new Date());
  }

  const idempotencyKey = String(body.idempotencyKey || '').trim();
  if (idempotencyKey) {
    const existing = await DebitCreditNote.findOne({ companyId, idempotencyKey }).session(session);
    if (existing) return { note: existing, created: false };
  }

  const { noteType, noteSide, partyLedger, party, totals, bill } =
    await resolveNoteContext(companyId, body, session);

  const finalNoteNo = body.noteNo || await generateNoteNo(companyId, noteType, session);

  const created = await DebitCreditNote.create([{
    companyId,
    noteType,
    noteSide,
    noteNo: finalNoteNo,
    vNo: body.vNo || '',
    partyLedgerId: partyLedger._id,
    partyId: party?._id,
    partyName: partyLedger.name,
    partyGstin: party?.gstin || body.partyGstin || '',
    date: body.date || new Date(),
    billNo: body.billNo || '',
    billDate: body.billDate || undefined,
    againstInvoiceNo: bill.againstInvoiceNo,
    againstInvoiceId: bill.againstInvoiceId,
    againstInvoiceType: bill.againstInvoiceType,
    amount: round2(body.amount),
    amountMode: totals.amountMode,
    taxableAmount: totals.taxable,
    gstType: totals.gstType,
    gstTreatment: body.gstTreatment || (party?.gstin ? 'Registered' : 'Unregistered'),
    gstRate: totals.gstRate,
    cessRate: totals.cessRate,
    cgst: totals.cgst,
    sgst: totals.sgst,
    igst: totals.igst,
    cess: totals.cess,
    gstAmount: totals.gstAmount,
    reverseCharge: totals.reverseCharge,
    rcmAmount: totals.rcmAmount,
    placeOfSupply: totals.placeOfSupply,
    itcEligibility: body.itcEligibility || '',
    hsnSac: body.hsnSac || '',
    reasonCode: body.reasonCode || '',
    reason: body.reason,
    quc: body.quc || '',
    accountHeadLedgerId: body.accountHeadLedgerId || undefined,
    accountHeadName: body.accountHeadName || '',
    tdsLedgerId: body.tdsLedgerId || undefined,
    tdsPercent: totals.tdsPercent,
    tdsAmount: totals.tdsAmount,
    tdsRemark: body.tdsRemark || '',
    roundOff: totals.roundOff,
    netAmount: totals.netAmount,
    finalAmount: totals.finalAmount,
    narration: body.narration || '',
    idempotencyKey: idempotencyKey || undefined,
    autoGenerated: !!options.autoGenerated,
    sourceVoucherId: options.sourceVoucherId || undefined,
    sourceVoucherType: options.sourceVoucherType || '',
    status: body.status || 'Draft',
  }], { session });
  const note = created[0];

  if (posting) {
    const entry = await postNoteJournal(companyId, note, totals, partyLedger, session);
    note.accountingEntryId = entry._id;
    await note.save({ session });

    if (bill.billDoc) {
      // Purchase Debit / Sales Credit reduce what is outstanding on the bill;
      // the other two increase it.
      const reducesOutstanding = noteDirection(noteSide, noteType).partySign === (noteSide === 'Sales' ? -1 : +1);
      await applyBillAdjustment(
        companyId, bill.billDoc, noteSide, totals.finalAmount, reducesOutstanding ? +1 : -1, session, bill.billKind
      );
    }
  }

  return { note, created: true, noteType, noteSide };
}

exports.createNote = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  let committed = false;

  try {
    const companyId = req.companyId;
    const { note, created, noteType, noteSide } = await createNoteInternal(companyId, req.body, session);

    if (!created) {
      await session.abortTransaction();
      return res.status(200).json({ success: true, data: note, message: 'Note already recorded' });
    }

    await session.commitTransaction();
    committed = true;

    await auditService.log(req, `CREATE_${noteSide.toUpperCase()}_${noteType.toUpperCase()}_NOTE`,
      'DebitCreditNote', note._id, null,
      { noteNo: note.noteNo, noteType, noteSide, amount: note.finalAmount, status: note.status });

    res.status(201).json({ success: true, data: note });
  } catch (error) {
    if (!committed) await session.abortTransaction();
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'A note with this number already exists' });
    }
    res.status(400).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

exports.createNoteInternal = createNoteInternal;

/**
 * An auto-generated note is a reporting/document representation of accounting its source
 * voucher already posted (see accountingController.syncDiscountNotesForVoucher) — it has
 * no independent journal or bill adjustment of its own to safely un-apply. Editing or
 * reversing it here would instead reverse the SOURCE VOUCHER's whole journal (bank/cash +
 * party + every deduction leg) and move the bill's outstanding by an amount nothing here
 * actually applied. Block it and point the user at the voucher, which keeps its own note
 * in sync automatically on edit/reverse.
 */
async function assertNotAutoGenerated(companyId, note, session) {
  if (!note.autoGenerated) return;
  let label = note.sourceVoucherType || 'its source voucher';
  if (note.sourceVoucherId) {
    const PaymentVoucher = require('../models/PaymentVoucher');
    const src = await PaymentVoucher.findOne({ _id: note.sourceVoucherId, companyId }).session(session);
    if (src) label = `${src.voucherType} #${src.voucherNo}`;
  }
  throw new Error(
    `This note was automatically generated from ${label} for a settlement discount. ` +
    `Edit or reverse that Receipt/Payment instead — its linked note will update automatically.`
  );
}

/**
 * Edit a posted note: un-apply the original accounting and bill adjustment, then re-post
 * the corrected figures — all in one transaction, keeping the note number.
 */
exports.updateNote = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  let committed = false;

  try {
    const companyId = req.companyId;
    const note = await DebitCreditNote.findOne({ _id: req.params.id, companyId }).session(session);
    if (!note) throw new Error('Note not found');
    if (note.status === 'Reversed' || note.isReversed) throw new Error('A reversed note cannot be edited');
    // Auto-generated notes can now be edited — editing detaches them from their source voucher
    // so they become independent manual notes going forward.

    const body = req.body;
    const posting = String(body.status || note.status) === 'Posted';
    const gstConfigService = require('../services/gstConfigService');
    await gstConfigService.assertPeriodOpen(companyId, note.date);
    if (posting) await gstConfigService.assertPeriodOpen(companyId, body.date || note.date);

    // Un-apply first — the bill's outstanding still carries this note's own effect, so
    // validating the replacement against it would measure against the wrong baseline.
    if (note.status === 'Posted') {
      await unpostNote(companyId, note, req, session);
    }

    const { noteType, noteSide, partyLedger, party, totals, bill } =
      await resolveNoteContext(companyId, { ...body, noteType: note.noteType }, session);

    Object.assign(note, {
      noteSide,
      vNo: body.vNo || note.vNo,
      partyLedgerId: partyLedger._id,
      partyId: party?._id,
      partyName: partyLedger.name,
      partyGstin: party?.gstin || body.partyGstin || '',
      date: body.date || note.date,
      billNo: body.billNo || '',
      billDate: body.billDate || undefined,
      againstInvoiceNo: bill.againstInvoiceNo,
      againstInvoiceId: bill.againstInvoiceId,
      againstInvoiceType: bill.againstInvoiceType,
      amount: round2(body.amount),
      amountMode: totals.amountMode,
      taxableAmount: totals.taxable,
      gstType: totals.gstType,
      gstTreatment: body.gstTreatment || note.gstTreatment,
      gstRate: totals.gstRate,
      cessRate: totals.cessRate,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      cess: totals.cess,
      gstAmount: totals.gstAmount,
      reverseCharge: totals.reverseCharge,
      rcmAmount: totals.rcmAmount,
      placeOfSupply: totals.placeOfSupply,
      itcEligibility: body.itcEligibility || '',
      hsnSac: body.hsnSac || '',
      reasonCode: body.reasonCode || '',
      reason: body.reason,
      quc: body.quc || '',
      accountHeadLedgerId: body.accountHeadLedgerId || undefined,
      accountHeadName: body.accountHeadName || '',
      tdsLedgerId: body.tdsLedgerId || undefined,
      tdsPercent: totals.tdsPercent,
      tdsAmount: totals.tdsAmount,
      tdsRemark: body.tdsRemark || '',
      roundOff: totals.roundOff,
      netAmount: totals.netAmount,
      finalAmount: totals.finalAmount,
      narration: body.narration || '',
      accountingEntryId: undefined,
      status: posting ? 'Posted' : 'Draft',
      editedAt: new Date(),
    });

    // Detach auto-generated notes from their source voucher so they become standalone
    if (note.autoGenerated) {
      note.autoGenerated = false;
      note.sourceVoucherId = undefined;
      note.sourceVoucherType = undefined;
    }

    if (posting) {
      const entry = await postNoteJournal(companyId, note, totals, partyLedger, session);
      note.accountingEntryId = entry._id;
      if (bill.billDoc) {
        const reducesOutstanding = noteDirection(noteSide, noteType).partySign === (noteSide === 'Sales' ? -1 : +1);
        await applyBillAdjustment(
          companyId, bill.billDoc, noteSide, totals.finalAmount, reducesOutstanding ? +1 : -1, session, bill.billKind
        );
      }
    }

    await note.save({ session });
    await session.commitTransaction();
    committed = true;

    await auditService.log(req, 'UPDATE_NOTE', 'DebitCreditNote', note._id, null,
      { noteNo: note.noteNo, amount: note.finalAmount });

    res.status(200).json({ success: true, data: note, message: 'Note updated' });
  } catch (error) {
    if (!committed) await session.abortTransaction();
    res.status(400).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

/** Reverse a posted note's journal and undo its bill adjustment. Shared by edit and delete. */
async function unpostNote(companyId, note, req, session) {
  // Auto-generated notes have no independent journal — safe to skip reversal for them.
  // After a manual edit they will be detached (autoGenerated=false) so this won't apply.

  if (note.accountingEntryId) {
    const journalEngine = require('../services/journalEngineService');
    const reversal = await journalEngine.reverseJournal(companyId, note.accountingEntryId, {
      session,
      userId: req.user?._id || req.user?.id,
      reason: `Reversal of ${note.noteSide} ${note.noteType} Note #${note.noteNo}`,
    });
    note.reversalEntryId = reversal._id;
  }

  if (note.againstInvoiceId && note.finalAmount) {
    const billKind = note.againstInvoiceType === 'SalesInvoice' ? 'sales'
      : note.againstInvoiceType === 'JobWorkCharges' ? 'job'
      : 'purchase';
    const Model = billKind === 'sales' ? Sales : billKind === 'job' ? Job : Purchase;
    const billDoc = await Model.findOne({ _id: note.againstInvoiceId, companyId }).session(session);
    if (billDoc) {
      const reducesOutstanding =
        noteDirection(note.noteSide, note.noteType).partySign === (note.noteSide === 'Sales' ? -1 : +1);
      // Opposite sign to whatever posting applied.
      await applyBillAdjustment(
        companyId, billDoc, note.noteSide, note.finalAmount, reducesOutstanding ? -1 : +1, session, billKind
      );
    }
  }
}

/** Delete = reverse. Financial history is never physically removed. */
exports.reverseNote = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  let committed = false;

  try {
    const companyId = req.companyId;
    const note = await DebitCreditNote.findOne({ _id: req.params.id, companyId }).session(session);
    if (!note) throw new Error('Note not found');
    if (note.status === 'Reversed' || note.isReversed) throw new Error('Note is already reversed');
    if (note.status !== 'Posted') throw new Error('Only posted notes can be reversed');
    // Auto-generated notes can be reversed directly if needed

    const gstConfigService = require('../services/gstConfigService');
    await gstConfigService.assertPeriodOpen(companyId, note.date);

    await unpostNote(companyId, note, req, session);

    note.status = 'Reversed';
    note.isReversed = true;
    note.reversedAt = new Date();
    note.reverseReason = (req.body.reason || '').trim() || 'Reversed by user';
    await note.save({ session });

    await session.commitTransaction();
    committed = true;

    await auditService.log(req, 'REVERSE_NOTE', 'DebitCreditNote', note._id, null,
      { noteNo: note.noteNo, reason: note.reverseReason });

    res.status(200).json({ success: true, data: note, message: 'Note reversed' });
  } catch (error) {
    if (!committed) await session.abortTransaction();
    res.status(400).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

exports.getNotes = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { noteType, noteSide, status, from, to } = req.query;

    const filter = { companyId };
    if (noteType) filter.noteType = noteType;
    if (noteSide) filter.noteSide = noteSide;
    if (status) filter.status = status;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }

    const list = await DebitCreditNote.find(filter).populate('partyLedgerId').sort({ date: -1 });
    res.status(200).json({ success: true, data: list });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getNoteById = async (req, res) => {
  try {
    const companyId = req.companyId;
    const note = await DebitCreditNote.findOne({ _id: req.params.id, companyId })
      .populate('partyLedgerId');
    if (!note) return res.status(404).json({ success: false, message: 'Note not found' });
    res.status(200).json({ success: true, data: note });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Exported for tests / reuse — the direction table is the heart of the module.
exports._noteDirection = noteDirection;

