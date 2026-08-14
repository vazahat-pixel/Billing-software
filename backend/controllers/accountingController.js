const mongoose = require('mongoose');
const LedgerMaster = require('../models/LedgerMaster');
const AccountingEntry = require('../models/AccountingEntry');
const PaymentVoucher = require('../models/PaymentVoucher');
const Company = require('../models/Company');
const Party = require('../models/Party');
const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');
const Job = require('../models/Job');
const Counter = require('../models/Counter');
const DebitCreditNote = require('../models/DebitCreditNote');
const accountingService = require('../services/accountingService');

// Helper to check if date falls in a locked period
async function checkPeriodLocked(companyId, dateVal) {
  const company = await Company.findById(companyId);
  if (company && company.settings && company.settings.lockedUntilDate) {
    const lockDate = new Date(company.settings.lockedUntilDate);
    const voucherDate = new Date(dateVal);
    if (voucherDate <= lockDate) {
      throw new Error(`Accounting period is locked until ${lockDate.toLocaleDateString()}`);
    }
  }
}

function normalizePaymentDetails(body) {
  const amount = parseFloat(body.amount);
  if (!amount || amount <= 0) {
    throw new Error('Voucher amount must be greater than zero');
  }

  let splits = Array.isArray(body.paymentSplits)
    ? body.paymentSplits
        .map(s => ({
          mode: s.mode,
          amount: parseFloat(s.amount || 0),
          reference: s.reference || undefined
        }))
        .filter(s => s.mode && s.amount > 0)
    : [];

  if (splits.length === 0) {
    const mode = body.paymentMode;
    if (!mode) throw new Error('Payment mode is required');
    splits = [{
      mode,
      amount,
      reference: body.utrNo || body.chequeNo || undefined
    }];
  }

  const splitTotal = splits.reduce((sum, s) => sum + s.amount, 0);
  if (Math.abs(splitTotal - amount) > 0.01) {
    throw new Error(`Split payment total (₹${splitTotal.toFixed(2)}) must equal voucher amount (₹${amount.toFixed(2)})`);
  }

  for (const split of splits) {
    if (split.mode === 'Cheque' && !split.reference && !body.chequeNo) {
      throw new Error('Cheque number is required for cheque payments');
    }
    // NEFT/RTGS/UPI reference stays optional: a bank receipt is normally entered from the
    // pay-in slip on the day the money lands, before the UTR is known. It is recorded
    // whenever supplied, but demanding it here made cheque-less bank receipts unsaveable.
  }

  const paymentMode = splits.length === 1 ? splits[0].mode : 'Mixed';
  const primarySplit = splits[0];
  const chequeSplit = splits.find(s => s.mode === 'Cheque');
  const digitalSplit = splits.find(s => ['NEFT', 'RTGS', 'UPI'].includes(s.mode));

  return {
    paymentMode,
    paymentSplits: splits,
    chequeNo: body.chequeNo || chequeSplit?.reference,
    utrNo: body.utrNo || digitalSplit?.reference,
    paymentNarration: splits
      .map(s => `${s.mode} ₹${s.amount.toFixed(2)}${s.reference ? ` (${s.reference})` : ''}`)
      .join(' + ')
  };
}

// Helper to generate voucher numbers — FIXED: uses atomic Counter to prevent race conditions
async function generateVoucherNo(companyId, type, session = null) {
  const prefix = type === 'Payment' ? 'PV' : 'RV';
  const currentYear = new Date().getFullYear().toString().substring(2);
  const nextYear = (new Date().getFullYear() + 1).toString().substring(2);
  const fy = `${currentYear}-${nextYear}`;
  const counterId = `${prefix}-${fy}-${companyId}`;
  const seq = await Counter.nextSeq(counterId, session);
  return `${prefix}-${fy}-${seq.toString().padStart(4, '0')}`;
}

// Cash & Bank Book bill-adjustment columns (Tds/Discount/Rg/Claim/RD/Interest/Oth1/Oth2)
// reduce a bill's outstanding without any cash moving — each needs its own ledger line
// or the party ledger silently drifts from what the bills actually show as outstanding.
function itemDeductionTotal(item) {
  return (
    Number(item.discount || 0) +
    Number(item.tds || 0) +
    Number(item.rg || 0) +
    Number(item.claim || 0) +
    Number(item.rd || 0) +
    Number(item.interest || 0) +
    Number(item.oth1 || 0) +
    Number(item.oth2 || 0)
  );
}

function sumAcrossInvoices(againstInvoices, key) {
  return (againstInvoices || []).reduce((s, item) => s + Number(item[key] || 0), 0);
}

const round2 = (n) => Number(Number(n || 0).toFixed(2));

/** Compare money as whole paise — 0.1 + 0.2 style drift must never pass as "equal". */
const toPaise = (n) => Math.round(Number(n || 0) * 100);

/**
 * Cash & Bank Book vouchers must land in a ledger the corresponding book can see —
 * cashBook()/bankBook() select purely on accountType, so a receipt posted to a
 * General ledger would silently vanish from the book it belongs in.
 */
function assertBookLedgerType(ledger, bookKind) {
  const kind = String(bookKind || '').toLowerCase();
  const expected = kind === 'cash' ? 'Cash' : kind === 'bank' ? 'Bank' : null;

  if (!expected) {
    if (!['Cash', 'Bank'].includes(ledger.accountType)) {
      throw new Error(
        `"${ledger.name}" is a ${ledger.accountType} ledger — a receipt/payment must post to a Cash or Bank ledger`
      );
    }
    return;
  }
  if (ledger.accountType !== expected) {
    throw new Error(
      `"${ledger.name}" is a ${ledger.accountType} ledger — a ${expected} Book voucher must post to a ${expected} ` +
      `ledger, otherwise it will never appear in the ${expected} Book`
    );
  }
}

/**
 * Resolve every against-invoice row to its real Sales/Purchase document and prove the
 * allocation is legal BEFORE anything is written. Guards party ownership, duplicate
 * rows, negative figures, per-bill overpayment and total over-allocation.
 * Returns the loaded docs so the caller applies them without a second lookup.
 */
async function buildAllocationPlan(companyId, { partyLedger, accBill, againstInvoices, amount }, session) {
  const rows = Array.isArray(againstInvoices) ? againstInvoices : [];

  // Acc/Bill = "A" is an on-account receipt: it sits against the party, never a bill.
  if (String(accBill || 'B').toUpperCase() === 'A') {
    const carriesAllocation = rows.some(
      (r) => Number(r.amount || 0) > 0 || itemDeductionTotal(r) > 0
    );
    if (carriesAllocation) {
      throw new Error('Acc/Bill is "A" (on-account) — clear the bill rows or switch Acc/Bill to "B"');
    }
    return { plan: [], allocatedTotal: 0 };
  }

  // Acc/Bill = "B" means bill-against: the money must land on real bills.
  if (!rows.some((r) => Number(r.amount || 0) > 0 || itemDeductionTotal(r) > 0)) {
    throw new Error('Please select at least one Bill (Acc/Bill is "B" — switch to "A" for an on-account voucher)');
  }

  const expectedPartyId = partyLedger.linkedPartyId ? String(partyLedger.linkedPartyId) : null;
  const seen = new Set();
  const plan = [];
  let allocatedTotal = 0;

  for (const item of rows) {
    const alloc = round2(item.amount);
    const deductions = round2(itemDeductionTotal(item));
    if (alloc < 0 || deductions < 0) {
      throw new Error(`Bill ${item.invoiceNo || '(blank)'}: negative amounts are not allowed`);
    }
    const paidNow = round2(alloc + deductions);
    if (paidNow <= 0) continue;

    if (!item.invoiceId) {
      throw new Error(
        `Bill "${item.invoiceNo || '(blank)'}" is not linked to an invoice — pick it from the BillNo lookup`
      );
    }
    const key = String(item.invoiceId);
    if (seen.has(key)) {
      throw new Error(`Bill ${item.invoiceNo || key} is allocated more than once in this voucher`);
    }
    seen.add(key);

    let doc = await Sales.findOne({ _id: item.invoiceId, companyId }).session(session);
    let kind = 'sales';
    if (!doc) {
      doc = await Purchase.findOne({ _id: item.invoiceId, companyId }).session(session);
      kind = 'purchase';
    }
    if (!doc) {
      // Job Work Charges — a Job Worker's "bill" isn't a Sales/Purchase doc, it's the
      // charges posted on Job Receive (job.processCharges + processGstAmount).
      doc = await Job.findOne({ _id: item.invoiceId, companyId }).session(session);
      kind = 'job';
    }
    if (!doc) {
      throw new Error(`Bill ${item.invoiceNo || key} was not found for this company`);
    }

    // A voucher may only settle bills belonging to the party it is drawn on.
    if (!expectedPartyId) {
      throw new Error(
        `Ledger "${partyLedger.name}" is not linked to a party — bill-wise allocation needs a party ledger`
      );
    }
    const billPartyId = kind === 'job'
      ? String(doc.workerId || '')
      : String(doc.customerId || doc.supplierId || '');
    if (billPartyId !== expectedPartyId) {
      throw new Error(
        `Bill ${doc.invoiceNo || doc.jobCardNo || key} does not belong to ${partyLedger.name} — ` +
        `a voucher cannot settle another party's bill`
      );
    }

    const billAmount = kind === 'job'
      ? round2((doc.processCharges || 0) + (doc.processGstAmount || 0))
      : round2(doc.netAmount || 0);
    const paidSoFar = kind === 'job' ? round2(doc.chargesPaidAmount || 0) : round2(doc.paidAmount || 0);
    const outstanding = round2(billAmount - paidSoFar);
    if (paidNow > outstanding + 0.01) {
      throw new Error(
        `Bill ${doc.invoiceNo || doc.jobCardNo || key}: allocating ₹${paidNow.toFixed(2)} exceeds its outstanding ₹${outstanding.toFixed(2)}`
      );
    }

    allocatedTotal = round2(allocatedTotal + alloc);
    plan.push({ doc, kind, paidNow });
  }

  // Bill-against vouchers must tie out to the paise, both ways — the reference ERP
  // refuses ₹3 short just as firmly as ₹5 over ("Check Amount").
  //
  // Only Adjust counts here. Discount/TDS/RG/Claim/RD/Interest/Oth reduce the bill's
  // outstanding without cash moving, so they are settled through their own ledger legs
  // and must stay out of this comparison.
  //
  const received = round2(amount);
  if (toPaise(allocatedTotal) !== toPaise(received)) {
    throw new Error(
      `Check Amount: Total Bill Adjustment must exactly equal Receipt Amount ` +
      `(adjusted ₹${allocatedTotal.toFixed(2)} vs amount ₹${received.toFixed(2)})`
    );
  }

  return { plan, allocatedTotal };
}

/**
 * Undo a voucher's bill impact: drop paidAmount back, restore status and resync
 * bill-wise outstanding. Shared by reverse and by edit (which un-applies the old
 * allocation before re-applying the corrected one).
 */
async function rollbackAllocations(companyId, againstInvoices, session) {
  if (!Array.isArray(againstInvoices) || againstInvoices.length === 0) return;
  const outstandingEngine = require('../services/outstandingEngineService');

  for (const item of againstInvoices) {
    if (!item.invoiceId) continue;
    const paidNow = round2(Number(item.amount || 0) + itemDeductionTotal(item));
    if (paidNow <= 0) continue;

    const saleDoc = await Sales.findOne({ _id: item.invoiceId, companyId }).session(session);
    if (saleDoc) {
      saleDoc.paidAmount = round2(Math.max(0, (saleDoc.paidAmount || 0) - paidNow));
      if (saleDoc.paidAmount <= 0.009) {
        saleDoc.paidAmount = 0;
        saleDoc.status = saleDoc.status === 'cancelled' ? saleDoc.status : 'active';
      } else if (saleDoc.paidAmount < saleDoc.netAmount) {
        saleDoc.status = 'partial';
      }
      await saleDoc.save({ session });
      await outstandingEngine.syncBillFromSales(companyId, saleDoc, session);
      continue;
    }

    const purchaseDoc = await Purchase.findOne({ _id: item.invoiceId, companyId }).session(session);
    if (purchaseDoc) {
      purchaseDoc.paidAmount = round2(Math.max(0, (purchaseDoc.paidAmount || 0) - paidNow));
      if (purchaseDoc.paidAmount <= 0.009) {
        purchaseDoc.paidAmount = 0;
        purchaseDoc.status = purchaseDoc.status === 'cancelled' ? purchaseDoc.status : 'active';
      } else if (purchaseDoc.paidAmount < purchaseDoc.netAmount) {
        purchaseDoc.status = 'partial';
      }
      await purchaseDoc.save({ session });
      await outstandingEngine.syncBillFromPurchase(companyId, purchaseDoc, session);
      continue;
    }

    const jobDoc = await Job.findOne({ _id: item.invoiceId, companyId }).session(session);
    if (jobDoc) {
      jobDoc.chargesPaidAmount = round2(Math.max(0, (jobDoc.chargesPaidAmount || 0) - paidNow));
      await jobDoc.save({ session });
    }
  }
}

/** Apply a validated plan: bump paidAmount/status and resync bill-wise outstanding. */
async function applyAllocationPlan(companyId, plan, session) {
  const outstandingEngine = require('../services/outstandingEngineService');
  for (const { doc, kind, paidNow } of plan) {
    if (kind === 'job') {
      doc.chargesPaidAmount = round2((doc.chargesPaidAmount || 0) + paidNow);
      await doc.save({ session });
      continue;
    }
    doc.paidAmount = round2((doc.paidAmount || 0) + paidNow);
    if (doc.paidAmount >= round2(doc.netAmount || 0) - 0.99) doc.status = 'paid';
    else if (doc.paidAmount > 0) doc.status = 'partial';
    await doc.save({ session });
    if (kind === 'sales') await outstandingEngine.syncBillFromSales(companyId, doc, session);
    else await outstandingEngine.syncBillFromPurchase(companyId, doc, session);
  }
}

/**
 * Post the double-entry journal for a Payment/Receipt and apply its bill allocation.
 * Shared by create and edit so the two can never drift into different accounting.
 *
 * Direction is the whole difference between the two voucher types:
 *   Receipt — money in : Dr Bank/Cash , Cr Party
 *   Payment — money out: Dr Party     , Cr Bank/Cash
 */
async function postVoucherAccounting(companyId, voucher, ctx, session) {
  const { partyLedger, bankLedger, amount, againstInvoices, narration, paymentNarration, date, plan } = ctx;
  const isReceipt = voucher.voucherType === 'Receipt';
  const voucherNo = voucher.voucherNo;

  const entryNo = await accountingService.generateEntryNo(companyId, 'JNL', session);

  const totalTds = sumAcrossInvoices(againstInvoices, 'tds');
  const totalDiscount = sumAcrossInvoices(againstInvoices, 'discount');
  const totalOther =
    sumAcrossInvoices(againstInvoices, 'rg') +
    sumAcrossInvoices(againstInvoices, 'claim') +
    sumAcrossInvoices(againstInvoices, 'rd') +
    sumAcrossInvoices(againstInvoices, 'interest') +
    sumAcrossInvoices(againstInvoices, 'oth1') +
    sumAcrossInvoices(againstInvoices, 'oth2');
  // The party leg carries the cash plus every non-cash deduction that reduced the bill.
  // Adjust alone is the cash; Discount/TDS/RG/Claim/RD/Interest/Oth get their own legs.
  const partyTotal = parseFloat(amount) + totalTds + totalDiscount + totalOther;

  const bankLine = {
    ledgerId: bankLedger._id,
    ledgerName: bankLedger.name,
    type: isReceipt ? 'Dr' : 'Cr',
    amount: parseFloat(amount),
    narration: isReceipt ? `Received via ${paymentNarration}` : `Paid via ${paymentNarration}`
  };
  const partyLine = {
    ledgerId: partyLedger._id,
    ledgerName: partyLedger.name,
    type: isReceipt ? 'Cr' : 'Dr',
    amount: partyTotal,
    narration: `${voucher.voucherType} Voucher #${voucherNo}`
  };
  const lines = isReceipt ? [bankLine, partyLine] : [partyLine, bankLine];

  // Deduction legs balance the party leg; they sit opposite the party on both voucher types.
  const sideType = isReceipt ? 'Dr' : 'Cr';
  if (totalTds > 0.004) {
    const tdsLedger = await accountingService.getSystemLedger(
      companyId, isReceipt ? 'TDS Receivable' : 'TDS Payable', session
    );
    lines.push({
      ledgerId: tdsLedger._id, ledgerName: tdsLedger.name, type: sideType, amount: totalTds,
      narration: isReceipt
        ? `TDS deducted by party — Voucher #${voucherNo}`
        : `TDS withheld — Voucher #${voucherNo}`
    });
  }
  if (totalDiscount > 0.004) {
    const discLedger = await accountingService.getSystemLedger(
      companyId, isReceipt ? 'Discount Allowed' : 'Discount Received', session
    );
    lines.push({
      ledgerId: discLedger._id, ledgerName: discLedger.name, type: sideType, amount: totalDiscount,
      narration: isReceipt
        ? `Discount allowed — Voucher #${voucherNo}`
        : `Discount received — Voucher #${voucherNo}`
    });
  }
  if (totalOther > 0.004) {
    const otherLedger = await accountingService.getSystemLedger(companyId, 'Other Adjustments A/c', session);
    lines.push({
      ledgerId: otherLedger._id, ledgerName: otherLedger.name, type: sideType, amount: totalOther,
      narration: `Rg/Claim/RD/Interest/Other — Voucher #${voucherNo}`
    });
  }

  const accountingEntry = await AccountingEntry.create([{
    companyId,
    entryNo,
    entryDate: date,
    voucherType: voucher.voucherType,
    refType: voucher.voucherType,
    refId: voucher._id,
    lines,
    narration: narration || (isReceipt
      ? `Received from ${partyLedger.name} — ${paymentNarration}`
      : `Paid to ${partyLedger.name} — ${paymentNarration}`)
  }], { session });

  voucher.accountingEntryId = accountingEntry[0]._id;

  // Update invoice paidAmount + sync BillSettlement (Outstanding)
  await applyAllocationPlan(companyId, plan, session);

  return accountingEntry[0];
}

/**
 * Resolve + validate the party ledger, the Cash/Bank ledger and the bill allocation for a
 * voucher payload. Everything a Payment/Receipt needs proven before a write, in one place
 * so create and edit enforce an identical rule set.
 */
async function resolveVoucherContext(companyId, body, { posting }, session) {
  const { partyLedgerId, amount, bankLedgerId, againstInvoices } = body;

  const resolvedPartyLedgerId = partyLedgerId || body.partyId;
  let partyLedger = await LedgerMaster.findOne({ _id: resolvedPartyLedgerId, companyId });
  if (!partyLedger && resolvedPartyLedgerId) {
    try {
      partyLedger = await accountingService.getOrCreatePartyLedger(companyId, resolvedPartyLedgerId);
    } catch (err) {
      // ignore and let the next block throw if not found
    }
  }

  let resolvedBankLedgerId = bankLedgerId;
  if (!resolvedBankLedgerId) {
    const fallbackName = String(body.bookKind || '').toLowerCase() === 'cash' ? 'Cash A/c' : 'Bank A/c';
    const defaultLedger = await LedgerMaster.findOne({ companyId, name: fallbackName });
    if (defaultLedger) resolvedBankLedgerId = defaultLedger._id;
  }
  const bankLedger = await LedgerMaster.findOne({ _id: resolvedBankLedgerId, companyId });

  if (!partyLedger || !bankLedger) {
    throw new Error('Invalid party or bank ledger selection');
  }
  assertBookLedgerType(bankLedger, body.bookKind);

  const { plan } = posting
    ? await buildAllocationPlan(
        companyId,
        { partyLedger, accBill: body.accBill, againstInvoices, amount },
        session
      )
    : { plan: [] };

  return { partyLedger, bankLedger, plan };
}

// 1. Create Ledger Account
exports.createLedger = async (req, res) => {
  try {
    // SECURITY FIX: Always use server-side companyId from JWT, never trust req.body
    const companyId = req.companyId;
    req.body.companyId = companyId;
    await checkPeriodLocked(companyId, new Date());
    
    const ledger = await LedgerMaster.create(req.body);
    res.status(201).json({ success: true, data: ledger });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// 2. List Ledgers
exports.listLedgers = async (req, res) => {
  try {
    // SECURITY FIX: Always use server-side companyId from JWT
    const companyId = req.companyId;
    const { group, search, partyId } = req.query;

    // Auto-seed system ledgers (Cash, Bank, Sales, Purchase, Taxes) if count is 0
    const count = await LedgerMaster.countDocuments({ companyId });
    if (count === 0) {
      await accountingService.seedSystemLedgers(companyId);
    }

    const filter = { companyId: new mongoose.Types.ObjectId(companyId) };

    if (group) {
      filter.group = group;
    }
    if (partyId) {
      filter.linkedPartyId = new mongoose.Types.ObjectId(partyId);
    }
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    const ledgers = await LedgerMaster.find(filter).sort({ name: 1 });
    res.status(200).json({ success: true, data: ledgers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Ledger Statement with Running Balance
exports.getLedgerStatement = async (req, res) => {
  try {
    const { id } = req.params;
    const { from, to } = req.query;
    const companyId = req.companyId;
    const ledgerEngine = require('../services/ledgerEngineService');
    const data = await ledgerEngine.getStatement(companyId, id, { from, to });
    res.status(200).json({ success: true, data });
  } catch (error) {
    const status = error.message === 'Ledger not found' ? 404 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
};

// 4-5. Create Payment / Receipt Voucher (Posted = automatic Ledger entries)
//
// Payment and Receipt are the same voucher with the party/bank legs swapped and a
// different side-ledger set, so they share one implementation — that way a validation
// added for one can never go missing on the other.
async function createCashBankVoucher(req, res, voucherType) {
  const session = await mongoose.startSession();
  session.startTransaction();
  let committed = false;
  try {
    const companyId = req.companyId || req.body.companyId;
    const { date, amount, chequeDate, status, againstInvoices, narration } = req.body;

    await checkPeriodLocked(companyId, date);

    const paymentDetails = normalizePaymentDetails(req.body);
    const { paymentMode, paymentSplits, chequeNo, utrNo, paymentNarration } = paymentDetails;

    const posting = String(status || 'Draft') === 'Posted';

    // Replaying the same submission (double-click, retried request) returns the original
    // voucher instead of moving the money a second time.
    const idempotencyKey = String(req.body.idempotencyKey || '').trim();
    if (idempotencyKey) {
      // Matches uniq_voucher_idempotency exactly, so a replay takes this path rather
      // than surfacing as a raw duplicate-key error.
      const existing = await PaymentVoucher.findOne({ companyId, idempotencyKey });
      if (existing) {
        await session.abortTransaction();
        return res.status(200).json({
          success: true, data: existing, message: 'Voucher already recorded',
        });
      }
    }

    // Everything is proven before a single write happens.
    const { partyLedger, bankLedger, plan } = await resolveVoucherContext(
      companyId, req.body, { posting }, session
    );

    const voucherNo = await generateVoucherNo(companyId, voucherType, session);

    const voucher = new PaymentVoucher({
      companyId,
      voucherNo,
      date,
      voucherType,
      partyLedgerId: partyLedger._id,
      partyName: partyLedger.name,
      amount,
      paymentMode,
      paymentSplits,
      bankLedgerId: bankLedger._id,
      chequeNo,
      chequeDate,
      clearDate: req.body.clearDate || undefined,
      utrNo,
      slipNo: req.body.slipNo || '',
      intBillNo: req.body.intBillNo || '',
      intBillFlag: req.body.intBillFlag || 'N',
      partyBank: req.body.partyBank || '',
      accBill: req.body.accBill || 'B',
      finance: Number(req.body.finance || 0),
      financeFlag: !!req.body.financeFlag,
      remark2: req.body.remark2 || '',
      bookId: req.body.bookId || undefined,
      bookName: req.body.bookName || '',
      bookKind: req.body.bookKind || '',
      idempotencyKey: idempotencyKey || undefined,
      narration,
      againstInvoices,
      status: status || 'Draft'
    });

    if (posting) {
      await postVoucherAccounting(companyId, voucher, {
        partyLedger, bankLedger, amount, againstInvoices, narration, paymentNarration, date, plan,
      }, session);
      // Section 34 CGST Act: a discount that reduces taxable value needs a formal
      // Credit/Debit Note, not just a P&L journal line — raise one per discounted bill.
      await syncDiscountNotesForVoucher(companyId, voucher, plan, session);
    }

    await voucher.save({ session });
    await session.commitTransaction();
    committed = true;
    // Fetch auto-generated discount notes to send back so frontend can show toast
    const discountNotes = await DebitCreditNote.find({
      companyId, sourceVoucherId: voucher._id, autoGenerated: true, status: 'Posted',
    }).lean();
    res.status(201).json({ success: true, data: voucher, discountNotes });
  } catch (error) {
    if (!committed) await session.abortTransaction();
    res.status(400).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
}

const round2ForNotes = (n) => Number(Number(n || 0).toFixed(2));

/**
 * Retire every still-Posted auto-generated note tied to this voucher (or, if
 * `keepInvoiceIds` is given, every one whose bill is NOT in that set). This is a status
 * flip only — never journalEngine.reverseJournal and never applyBillAdjustment — because
 * an auto note (skipFinancialPosting: true) never independently posted either of those in
 * the first place; the voucher's own journal/allocation is what actually moved money, and
 * that is un-done separately by rollbackAllocations + the voucher's own journal reversal.
 * Retiring just takes the note out of Posted status so GSTR-1/CDNR (which filters by
 * status) stops counting it.
 */
async function retireDiscountNotesForVoucher(companyId, voucherId, reason, session, keepInvoiceIds = null) {
  const notes = await DebitCreditNote.find({
    companyId, sourceVoucherId: voucherId, autoGenerated: true, status: 'Posted',
  }).session(session);

  const retired = [];
  for (const note of notes) {
    if (keepInvoiceIds && keepInvoiceIds.has(String(note.againstInvoiceId))) continue;
    note.status = 'Reversed';
    note.isReversed = true;
    note.reversedAt = new Date();
    note.reverseReason = reason;
    await note.save({ session });
    retired.push(note);
  }
  return retired;
}

/**
 * Keep this voucher's auto-generated Credit/Debit Notes in sync with its CURRENT
 * against-invoice discount rows — used on both create and edit, so it must be safe to
 * call repeatedly for the same voucher without drifting:
 *
 *   - a bill row with a discount but no existing note yet         -> create one
 *   - a bill row whose discount is unchanged from the existing note -> leave it untouched
 *     (this is also what makes a retried/duplicate call a no-op, together with the
 *     deterministic idempotencyKey passed into createNoteInternal below)
 *   - a bill row whose discount changed from the existing note     -> retire the old note,
 *     raise a fresh one for the new amount (GST law treats an issued Credit/Debit Note as
 *     something you supersede, not silently rewrite)
 *   - a bill that no longer has a discount on this voucher         -> retire its note
 *
 * Each note is GST-inclusive against the original bill's rate, mirrors the noteSide/
 * noteType mapping Section 34 CGST Act requires (Sales -> Credit, Purchase/Job -> Debit),
 * and is created with skipFinancialPosting: true — the voucher's own Discount leg (see
 * postVoucherAccounting) already booked the money; the note is its GST/CDNR paper trail,
 * never a second posting of the same discount.
 */
async function syncDiscountNotesForVoucher(companyId, voucher, plan, session) {
  const noteController = require('./noteController');
  const rows = (voucher.againstInvoices || []).filter((r) => Number(r.discount || 0) > 0.004);
  const keepInvoiceIds = new Set(rows.map((r) => String(r.invoiceId)));

  // Bills that had an auto-note before but are no longer discounted on this voucher.
  await retireDiscountNotesForVoucher(
    companyId, voucher._id,
    `Discount removed on edit of ${voucher.voucherType} #${voucher.voucherNo}`,
    session, keepInvoiceIds
  );

  const notes = [];
  for (const row of rows) {
    const planEntry = (plan || []).find((p) => String(p.doc._id) === String(row.invoiceId));
    if (!planEntry) continue; // invoiceId was already proven valid by buildAllocationPlan
    const { doc, kind } = planEntry;
    const newAmount = round2ForNotes(row.discount);

    const existing = await DebitCreditNote.findOne({
      companyId, sourceVoucherId: voucher._id, againstInvoiceId: doc._id,
      autoGenerated: true, status: 'Posted',
    }).session(session);

    if (existing && Math.abs(Number(existing.amount || 0) - newAmount) < 0.005) {
      // Unchanged — idempotent no-op, but keep it pointed at the current journal entry
      // (createCashBankVoucher/updateVoucher always posts a fresh AccountingEntry).
      if (voucher.accountingEntryId && String(existing.accountingEntryId) !== String(voucher.accountingEntryId)) {
        existing.accountingEntryId = voucher.accountingEntryId;
        await existing.save({ session });
      }
      notes.push(existing);
      continue;
    }

    if (existing) {
      existing.status = 'Reversed';
      existing.isReversed = true;
      existing.reversedAt = new Date();
      existing.reverseReason = `Discount changed on edit of ${voucher.voucherType} #${voucher.voucherNo}`;
      await existing.save({ session });
    }

    const noteSide = kind === 'sales' ? 'Sales' : 'Purchase';
    const noteType = noteSide === 'Sales' ? 'Credit' : 'Debit';

    let gstRate = 0;
    let gstType;
    if (kind === 'job') {
      const charges = Number(doc.processCharges || 0);
      gstRate = charges > 0 ? round2ForNotes((Number(doc.processGstAmount || 0) / charges) * 100) : 0;
    } else {
      // doc.gstRate is a convenience field that isn't reliably maintained on every
      // invoice (e.g. multi-rate line items, older records) — the taxable/GST amounts
      // are the ones the bill was actually posted with, so back-calculate the true
      // EFFECTIVE rate from those instead of trusting gstRate blindly. Without this, an
      // invoice whose doc.gstRate came through as 0 silently produced a 0%, ₹0-tax note
      // even though the bill itself carried real GST.
      const taxableAmt = Number(doc.taxableAmount || 0);
      const gstAmt = Number(doc.gstAmount || 0);
      gstRate = taxableAmt > 0.004
        ? round2ForNotes((gstAmt / taxableAmt) * 100)
        : Number(doc.gstRate || 0);
      gstType = doc.gstType;
    }

    const billRef = doc.invoiceNo || doc.jobCardNo || row.invoiceNo || '';
    // Stable on first creation; suffixed on a post-edit replacement so it can never collide
    // with the (now Reversed) note's own key under DebitCreditNote's unique idempotency index.
    const idempotencyKey = existing
      ? `discount-${voucher._id}-${row.invoiceId}-${(voucher.editedAt || new Date()).getTime()}`
      : `discount-${voucher._id}-${row.invoiceId}`;

    const { note } = await noteController.createNoteInternal(companyId, {
      noteType,
      noteSide,
      partyLedgerId: voucher.partyLedgerId,
      date: voucher.date,
      amount: newAmount,
      amountMode: 'Inclusive',
      gstRate,
      gstType,
      againstInvoiceId: doc._id,
      billNo: billRef,
      billDate: doc.date || voucher.date,
      reason: `Discount on ${voucher.voucherType} #${voucher.voucherNo}`,
      narration: `Auto-raised from ${voucher.voucherType} #${voucher.voucherNo} — Discount adjusted against bill ${billRef}`,
      status: 'Posted',
      idempotencyKey,
    }, session, {
      skipFinancialPosting: true,
      autoGenerated: true,
      sourceVoucherId: voucher._id,
      sourceVoucherType: 'PaymentVoucher',
    });

    // Cross-reference the voucher's own journal — that entry already carries this
    // discount's Dr/Cr legs, so point the note at it instead of leaving it unlinked.
    if (voucher.accountingEntryId) {
      note.accountingEntryId = voucher.accountingEntryId;
      await note.save({ session });
    }
    notes.push(note);
  }

  return notes;
}

/**
 * Edit a Posted Payment/Receipt in place.
 *
 * A posted voucher's accounting cannot simply be overwritten, so this un-does the old
 * impact and re-posts the corrected one inside a single transaction:
 *   1. reverse the original journal (both entries stay as an audit trail)
 *   2. roll the old bill allocation back off the invoices
 *   3. re-validate the new payload from scratch
 *   4. post a fresh journal and apply the new allocation
 * The voucher number is preserved — this is the same voucher corrected, not a new one.
 * Either every step lands or none does.
 */
exports.updateVoucher = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  let committed = false;
  try {
    const companyId = req.companyId || req.body.companyId;
    const voucherId = req.params.id;

    const voucher = await PaymentVoucher.findOne({ _id: voucherId, companyId }).session(session);
    if (!voucher) throw new Error('Voucher not found');
    if (voucher.status === 'Reversed' || voucher.isReversed) {
      throw new Error('A reversed voucher cannot be edited');
    }

    const { date, amount, chequeDate, againstInvoices, narration } = req.body;
    // Both the period it is leaving and the period it is moving into must be open.
    await checkPeriodLocked(companyId, voucher.date);
    await checkPeriodLocked(companyId, date);

    const paymentDetails = normalizePaymentDetails(req.body);
    const { paymentMode, paymentSplits, chequeNo, utrNo, paymentNarration } = paymentDetails;

    const wasPosted = voucher.status === 'Posted';
    const posting = String(req.body.status || voucher.status) === 'Posted';

    // Un-apply the original FIRST. The new allocation is validated against each bill's
    // outstanding, and that outstanding still carries this voucher's own old payment —
    // so a bill this voucher had fully settled would otherwise look like it has ₹0 left
    // and reject any edit. Everything here shares one transaction, so a later validation
    // failure rolls the un-apply back too.
    if (wasPosted) {
      if (voucher.accountingEntryId) {
        const journalEngine = require('../services/journalEngineService');
        const reversal = await journalEngine.reverseJournal(companyId, voucher.accountingEntryId, {
          session,
          userId: req.user?._id || req.user?.id,
          reason: `Edit of ${voucher.voucherType} #${voucher.voucherNo}`,
        });
        voucher.reversalEntryId = reversal._id;
      }
      await rollbackAllocations(companyId, voucher.againstInvoices, session);
    }

    // Now validate the replacement against the restored outstanding figures.
    const { partyLedger, bankLedger, plan } = await resolveVoucherContext(
      companyId, req.body, { posting }, session
    );

    voucher.date = date || voucher.date;
    voucher.partyLedgerId = partyLedger._id;
    voucher.partyName = partyLedger.name;
    voucher.amount = amount;
    voucher.paymentMode = paymentMode;
    voucher.paymentSplits = paymentSplits;
    voucher.bankLedgerId = bankLedger._id;
    voucher.chequeNo = chequeNo;
    voucher.chequeDate = chequeDate;
    voucher.clearDate = req.body.clearDate || undefined;
    voucher.utrNo = utrNo;
    voucher.slipNo = req.body.slipNo || '';
    voucher.intBillNo = req.body.intBillNo || '';
    voucher.intBillFlag = req.body.intBillFlag || 'N';
    voucher.partyBank = req.body.partyBank || '';
    voucher.accBill = req.body.accBill || 'B';
    voucher.finance = Number(req.body.finance || 0);
    voucher.financeFlag = !!req.body.financeFlag;
    voucher.remark2 = req.body.remark2 || '';
    voucher.bookId = req.body.bookId || voucher.bookId;
    voucher.bookName = req.body.bookName || voucher.bookName;
    voucher.bookKind = req.body.bookKind || voucher.bookKind;
    voucher.narration = narration;
    voucher.againstInvoices = againstInvoices;
    voucher.status = posting ? 'Posted' : 'Draft';
    voucher.accountingEntryId = undefined;
    voucher.editedAt = new Date();

    if (posting) {
      await postVoucherAccounting(companyId, voucher, {
        partyLedger, bankLedger, amount, againstInvoices, narration, paymentNarration,
        date: voucher.date, plan,
      }, session);
      // Keep this voucher's auto-generated discount Notes in sync with the corrected
      // figures — must run on edit too, not only on create, or a changed/removed discount
      // leaves a stale or orphaned Note behind.
      await syncDiscountNotesForVoucher(companyId, voucher, plan, session);
    } else if (wasPosted) {
      // Voucher demoted back to Draft — nothing on it is "Posted" any more, so any
      // linked auto-notes must be retired too.
      await retireDiscountNotesForVoucher(
        companyId, voucher._id,
        `${voucher.voucherType} #${voucher.voucherNo} moved back to Draft`,
        session
      );
    }

    await voucher.save({ session });
    await session.commitTransaction();
    committed = true;
    // Fetch auto-generated discount notes to send back so frontend can show toast
    const discountNotes = await DebitCreditNote.find({
      companyId, sourceVoucherId: voucher._id, autoGenerated: true, status: 'Posted',
    }).lean();
    res.status(200).json({ success: true, data: voucher, discountNotes, message: 'Voucher updated' });
  } catch (error) {
    if (!committed) await session.abortTransaction();
    res.status(400).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

exports.createPaymentVoucher = (req, res) => createCashBankVoucher(req, res, 'Payment');

exports.createReceiptVoucher = (req, res) => createCashBankVoucher(req, res, 'Receipt');
// 6. List Payment / Receipt Vouchers
exports.listVouchers = async (req, res) => {
  try {
    const companyId = req.companyId || req.query.companyId;
    const { from, to, partyId, type } = req.query;
    const filter = { companyId };

    if (type) {
      filter.voucherType = type;
    }
    if (partyId) {
      filter.partyLedgerId = partyId;
    }
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }

    const vouchers = await PaymentVoucher.find(filter).sort({ date: -1, createdAt: -1 });
    res.status(200).json({ success: true, data: vouchers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Reverse a Posted Payment/Receipt voucher:
 * - flips the accounting journal
 * - rolls back against-invoice paidAmount / status
 * - marks voucher Reversed (immutable history kept)
 */
exports.reverseVoucher = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const companyId = req.companyId || req.body.companyId;
    const voucherId = req.params.id;
    const reason = (req.body.reason || '').trim() || 'User reverse from Cash/Bank Book';

    const voucher = await PaymentVoucher.findOne({ _id: voucherId, companyId }).session(session);
    if (!voucher) throw new Error('Voucher not found');
    if (voucher.status === 'Reversed' || voucher.isReversed) {
      throw new Error('Voucher is already reversed');
    }
    if (voucher.status !== 'Posted') {
      throw new Error('Only Posted vouchers can be reversed');
    }

    await checkPeriodLocked(companyId, new Date());

    if (voucher.accountingEntryId) {
      const journalEngine = require('../services/journalEngineService');
      const reversal = await journalEngine.reverseJournal(companyId, voucher.accountingEntryId, {
        session,
        userId: req.user?._id || req.user?.id,
        reason: `${reason} (${voucher.voucherType} #${voucher.voucherNo})`,
      });
      voucher.reversalEntryId = reversal._id;
    }

    await rollbackAllocations(companyId, voucher.againstInvoices, session);

    // A reversed voucher can't leave its auto-generated discount Note(s) sitting Posted —
    // otherwise GSTR-1/CDNR keeps counting a discount whose voucher no longer exists.
    await retireDiscountNotesForVoucher(
      companyId, voucher._id,
      `${reason} (${voucher.voucherType} #${voucher.voucherNo} reversed)`,
      session
    );

    voucher.status = 'Reversed';
    voucher.isReversed = true;
    voucher.reversedAt = new Date();
    voucher.reverseReason = reason;
    await voucher.save({ session });

    await session.commitTransaction();
    res.status(200).json({ success: true, data: voucher, message: 'Voucher reversed' });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

// 7. Manual Journal Entry Creation
exports.createJournalEntry = async (req, res) => {
  try {
    const companyId = req.companyId || req.body.companyId;
    const { entryDate, lines, narration, voucherType } = req.body;
    const journalEngine = require('../services/journalEngineService');
    const entry = await journalEngine.postJournal(companyId, {
      entryDate,
      lines,
      narration,
      voucherType: voucherType || 'Journal',
      refType: 'Journal',
    }, { userId: req.user?._id || req.user?.id });

    res.status(201).json({ success: true, data: entry });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/** List accounting journal entries (manifest: GET /api/accounting/entries). */
exports.listEntries = async (req, res) => {
  try {
    const companyId = req.companyId || req.query.companyId;
    const journalEngine = require('../services/journalEngineService');
    const entries = await journalEngine.listJournals(companyId, req.query);
    res.status(200).json({ success: true, data: entries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * FIXED: Uses MongoDB aggregation (single query) instead of N+1 per-ledger queries.
 * Supports optional date range (from/to) for period-specific P&L.
 */
async function computeRunningBalances(companyId, asOnDate, fromDate = null) {
  const matchStage = {
    companyId: new mongoose.Types.ObjectId(companyId),
    isReversed: false
  };
  if (asOnDate || fromDate) {
    matchStage.entryDate = {};
    if (fromDate) matchStage.entryDate.$gte = new Date(fromDate);
    if (asOnDate) matchStage.entryDate.$lte = new Date(asOnDate);
  }

  // Aggregate all lines across all entries in one DB query
  const agg = await AccountingEntry.aggregate([
    { $match: matchStage },
    { $unwind: '$lines' },
    {
      $group: {
        _id: '$lines.ledgerId',
        totalDr: { $sum: { $cond: [{ $eq: ['$lines.type', 'Dr'] }, '$lines.amount', 0] } },
        totalCr: { $sum: { $cond: [{ $eq: ['$lines.type', 'Cr'] }, '$lines.amount', 0] } }
      }
    }
  ]);

  // Build a quick lookup map
  const aggMap = {};
  agg.forEach(row => { aggMap[row._id.toString()] = row; });

  const ledgers = await LedgerMaster.find({ companyId });
  const result = [];

  for (const ledger of ledgers) {
    const ledgerIdStr = ledger._id.toString();
    const row = aggMap[ledgerIdStr] || { totalDr: 0, totalCr: 0 };

    let balance = 0;
    // Start from opening balance
    if (ledger.openingBalanceType === 'Dr') {
      balance = ledger.openingBalance || 0;
    } else {
      balance = -(ledger.openingBalance || 0);
    }
    balance += (row.totalDr - row.totalCr);

    result.push({
      ledger,
      balance: Math.abs(balance),
      type: balance >= 0 ? 'Dr' : 'Cr'
    });
  }

  return result;
}

// 8. Trial Balance
exports.getTrialBalance = async (req, res) => {
  try {
    const financialReports = require('../services/financialReportsService');
    const data = await financialReports.trialBalance(req.companyId, { asOn: req.query.asOn });
    res.status(200).json({ success: true, data: data.lines, meta: { isBalanced: data.isBalanced, totalDebit: data.totalDebit, totalCredit: data.totalCredit } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 8b. Trial Balance — grouped by category (Z Trial), with per-group subtotals + Gross Profit
exports.getGroupedTrialBalance = async (req, res) => {
  try {
    const financialReports = require('../services/financialReportsService');
    const data = await financialReports.groupedTrialBalance(req.companyId, {
      asOn: req.query.to || req.query.asOn,
      withZeroBalance: req.query.withZeroBalance === 'true',
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 9. Profit & Loss Report (Income vs Expense ledgers)
exports.getProfitLoss = async (req, res) => {
  try {
    const financialReports = require('../services/financialReportsService');
    const data = await financialReports.profitAndLoss(req.companyId, { from: req.query.from, to: req.query.to });
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 10. Balance Sheet Report (Assets vs Liabilities + Capital + P&L plug)
exports.getBalanceSheet = async (req, res) => {
  try {
    const financialReports = require('../services/financialReportsService');
    const data = await financialReports.balanceSheet(req.companyId, {
      asOn: req.query.asOn,
      from: req.query.from,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 11. Party-wise Outstanding with Aging Reports (receivable/payable)
exports.getOutstandingReport = async (req, res) => {
  try {
    const outstandingEngine = require('../services/outstandingEngineService');
    const data = await outstandingEngine.outstandingReport(req.companyId, {
      type: req.query.type || 'receivable',
      asOn: req.query.asOn,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
