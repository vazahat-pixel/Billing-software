const mongoose = require('mongoose');
const LedgerMaster = require('../models/LedgerMaster');
const AccountingEntry = require('../models/AccountingEntry');
const PaymentVoucher = require('../models/PaymentVoucher');
const Company = require('../models/Company');
const Party = require('../models/Party');
const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');
const Counter = require('../models/Counter');
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
    if (['NEFT', 'RTGS', 'UPI'].includes(split.mode) && !split.reference && !body.utrNo) {
      throw new Error(`Reference/UTR is required for ${split.mode} payments`);
    }
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
async function generateVoucherNo(companyId, type) {
  const prefix = type === 'Payment' ? 'PV' : 'RV';
  const currentYear = new Date().getFullYear().toString().substring(2);
  const nextYear = (new Date().getFullYear() + 1).toString().substring(2);
  const fy = `${currentYear}-${nextYear}`;
  const counterId = `${prefix}-${fy}-${companyId}`;
  const seq = await Counter.nextSeq(counterId);
  return `${prefix}-${fy}-${seq.toString().padStart(4, '0')}`;
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
    
    const ledger = await LedgerMaster.findById(id);
    if (!ledger) {
      return res.status(404).json({ success: false, message: 'Ledger not found' });
    }

    const companyId = req.companyId || ledger.companyId;
    if (ledger.companyId.toString() !== companyId.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to this ledger' });
    }

    // Filter by dates
    const entryFilter = {
      companyId,
      isReversed: false,
      'lines.ledgerId': ledger._id
    };

    if (from || to) {
      entryFilter.entryDate = {};
      if (from) entryFilter.entryDate.$gte = new Date(from);
      if (to) entryFilter.entryDate.$lte = new Date(to);
    }

    // Fetch matching journal entries
    const entries = await AccountingEntry.find(entryFilter).sort({ entryDate: 1, createdAt: 1 });

    // Compute Running Balance starting from Opening Balance
    let currentBalance = 0;
    if (ledger.openingBalanceType === 'Dr') {
      currentBalance = ledger.openingBalance || 0;
    } else {
      currentBalance = -(ledger.openingBalance || 0);
    }

    const statementLines = entries.map(entry => {
      const activeLine = entry.lines.find(l => l.ledgerId.toString() === ledger._id.toString());
      
      if (activeLine.type === 'Dr') {
        currentBalance += activeLine.amount;
      } else {
        currentBalance -= activeLine.amount;
      }

      return {
        _id: entry._id,
        date: entry.entryDate,
        voucherNo: entry.entryNo,
        voucherType: entry.voucherType,
        narration: activeLine.narration || entry.narration,
        debit: activeLine.type === 'Dr' ? activeLine.amount : 0,
        credit: activeLine.type === 'Cr' ? activeLine.amount : 0,
        runningBalance: Math.abs(currentBalance),
        balanceType: currentBalance >= 0 ? 'Dr' : 'Cr'
      };
    });

    res.status(200).json({
      success: true,
      data: {
        ledger,
        openingBalance: ledger.openingBalance,
        openingBalanceType: ledger.openingBalanceType,
        closingBalance: Math.abs(currentBalance),
        closingBalanceType: currentBalance >= 0 ? 'Dr' : 'Cr',
        statement: statementLines
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Create Payment Voucher (Posted = automatic Ledger entries)
exports.createPaymentVoucher = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const companyId = req.companyId || req.body.companyId;
    const { 
      date, partyLedgerId, amount, 
      bankLedgerId, chequeDate, status, againstInvoices, narration
    } = req.body;

    await checkPeriodLocked(companyId, date);

    const paymentDetails = normalizePaymentDetails(req.body);
    const { paymentMode, paymentSplits, chequeNo, utrNo, paymentNarration } = paymentDetails;

    let partyLedger = await LedgerMaster.findById(partyLedgerId);
    if (!partyLedger) {
      try {
        partyLedger = await accountingService.getOrCreatePartyLedger(companyId, partyLedgerId);
      } catch (err) {
        // ignore and let next block throw if not found
      }
    }
    const bankLedger = await LedgerMaster.findById(bankLedgerId);

    if (!partyLedger || !bankLedger) {
      throw new Error('Invalid party or bank ledger selection');
    }

    const voucherNo = await generateVoucherNo(companyId, 'Payment');

    const voucher = new PaymentVoucher({
      companyId,
      voucherNo,
      date,
      voucherType: 'Payment',
      partyLedgerId: partyLedger._id,
      partyName: partyLedger.name,
      amount,
      paymentMode,
      paymentSplits,
      bankLedgerId,
      chequeNo,
      chequeDate,
      utrNo,
      narration,
      againstInvoices,
      status: status || 'Draft'
    });

    if (status === 'Posted') {
      // Create double-entry journal lines
      const entryNo = await accountingService.generateEntryNo(companyId, 'JNL');
      const accountingEntry = await AccountingEntry.create([{
        companyId,
        entryNo,
        entryDate: date,
        voucherType: 'Payment',
        refType: 'Payment',
        refId: voucher._id,
        lines: [
          {
            ledgerId: partyLedger._id,
            ledgerName: partyLedger.name,
            type: 'Dr',
            amount: parseFloat(amount),
            narration: `Payment Voucher #${voucherNo}`
          },
          {
            ledgerId: bankLedgerId,
            ledgerName: bankLedger.name,
            type: 'Cr',
            amount: parseFloat(amount),
            narration: `Paid via ${paymentNarration}`
          }
        ],
        narration: narration || `Paid to ${partyLedger.name} — ${paymentNarration}`
      }], { session });

      voucher.accountingEntryId = accountingEntry[0]._id;

      // FIXED: Update invoice paidAmount for partial payment tracking
      // Old code blindly set both Sales and Purchase to 'Paid' for every invoiceId — wrong!
      if (againstInvoices && againstInvoices.length > 0) {
        for (const item of againstInvoices) {
          const paidNow = parseFloat(item.amount || 0);

          // Try Sales first
          const saleDoc = await Sales.findOne({ _id: item.invoiceId, companyId }).session(session);
          if (saleDoc) {
            saleDoc.paidAmount = parseFloat(((saleDoc.paidAmount || 0) + paidNow).toFixed(2));
            if (saleDoc.paidAmount >= saleDoc.netAmount) {
              saleDoc.status = 'paid';
            } else if (saleDoc.paidAmount > 0) {
              saleDoc.status = 'partial';
            }
            await saleDoc.save({ session });
            continue; // found in Sales, skip Purchase check
          }

          // Try Purchase
          const purchaseDoc = await Purchase.findOne({ _id: item.invoiceId, companyId }).session(session);
          if (purchaseDoc) {
            purchaseDoc.paidAmount = parseFloat(((purchaseDoc.paidAmount || 0) + paidNow).toFixed(2));
            if (purchaseDoc.paidAmount >= purchaseDoc.netAmount) {
              purchaseDoc.status = 'paid';
            } else if (purchaseDoc.paidAmount > 0) {
              purchaseDoc.status = 'partial';
            }
            await purchaseDoc.save({ session });
          }
        }
      }
    }

    await voucher.save({ session });
    await session.commitTransaction();
    res.status(201).json({ success: true, data: voucher });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

// 5. Create Receipt Voucher
exports.createReceiptVoucher = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const companyId = req.companyId || req.body.companyId;
    const { 
      date, partyLedgerId, amount, 
      bankLedgerId, chequeDate, status, againstInvoices, narration
    } = req.body;

    await checkPeriodLocked(companyId, date);

    const paymentDetails = normalizePaymentDetails(req.body);
    const { paymentMode, paymentSplits, chequeNo, utrNo, paymentNarration } = paymentDetails;

    let partyLedger = await LedgerMaster.findById(partyLedgerId);
    if (!partyLedger) {
      try {
        partyLedger = await accountingService.getOrCreatePartyLedger(companyId, partyLedgerId);
      } catch (err) {
        // ignore and let next block throw if not found
      }
    }
    const bankLedger = await LedgerMaster.findById(bankLedgerId);

    if (!partyLedger || !bankLedger) {
      throw new Error('Invalid party or bank ledger selection');
    }

    const voucherNo = await generateVoucherNo(companyId, 'Receipt');

    const voucher = new PaymentVoucher({
      companyId,
      voucherNo,
      date,
      voucherType: 'Receipt',
      partyLedgerId: partyLedger._id,
      partyName: partyLedger.name,
      amount,
      paymentMode,
      paymentSplits,
      bankLedgerId,
      chequeNo,
      chequeDate,
      utrNo,
      narration,
      againstInvoices,
      status: status || 'Draft'
    });

    if (status === 'Posted') {
      const entryNo = await accountingService.generateEntryNo(companyId, 'JNL');
      const accountingEntry = await AccountingEntry.create([{
        companyId,
        entryNo,
        entryDate: date,
        voucherType: 'Receipt',
        refType: 'Receipt',
        refId: voucher._id,
        lines: [
          {
            ledgerId: bankLedgerId,
            ledgerName: bankLedger.name,
            type: 'Dr',
            amount: parseFloat(amount),
            narration: `Received via ${paymentNarration}`
          },
          {
            ledgerId: partyLedger._id,
            ledgerName: partyLedger.name,
            type: 'Cr',
            amount: parseFloat(amount),
            narration: `Receipt Voucher #${voucherNo}`
          }
        ],
        narration: narration || `Received from ${partyLedger.name} — ${paymentNarration}`
      }], { session });

      voucher.accountingEntryId = accountingEntry[0]._id;

      if (againstInvoices && againstInvoices.length > 0) {
        for (const item of againstInvoices) {
          const paidNow = parseFloat(item.amount || 0);

          // Try Sales first
          const saleDoc = await Sales.findOne({ _id: item.invoiceId, companyId }).session(session);
          if (saleDoc) {
            saleDoc.paidAmount = parseFloat(((saleDoc.paidAmount || 0) + paidNow).toFixed(2));
            if (saleDoc.paidAmount >= saleDoc.netAmount) {
              saleDoc.status = 'paid';
            } else if (saleDoc.paidAmount > 0) {
              saleDoc.status = 'partial';
            }
            await saleDoc.save({ session });
            continue; // found in Sales, skip Purchase check
          }

          // Try Purchase
          const purchaseDoc = await Purchase.findOne({ _id: item.invoiceId, companyId }).session(session);
          if (purchaseDoc) {
            purchaseDoc.paidAmount = parseFloat(((purchaseDoc.paidAmount || 0) + paidNow).toFixed(2));
            if (purchaseDoc.paidAmount >= purchaseDoc.netAmount) {
              purchaseDoc.status = 'paid';
            } else if (purchaseDoc.paidAmount > 0) {
              purchaseDoc.status = 'partial';
            }
            await purchaseDoc.save({ session });
          }
        }
      }
    }

    await voucher.save({ session });
    await session.commitTransaction();
    res.status(201).json({ success: true, data: voucher });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

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

// 7. Manual Journal Entry Creation
exports.createJournalEntry = async (req, res) => {
  try {
    const companyId = req.companyId || req.body.companyId;
    const { entryDate, lines, narration } = req.body;
    await checkPeriodLocked(companyId, entryDate);

    const entryNo = await accountingService.generateEntryNo(companyId, 'JNL');

    const entry = await AccountingEntry.create({
      companyId,
      entryNo,
      entryDate,
      voucherType: 'Journal',
      refType: 'Journal',
      lines,
      narration
    });

    res.status(201).json({ success: true, data: entry });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
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
    const companyId = req.companyId;
    const { asOn } = req.query;
    const balances = await computeRunningBalances(companyId, asOn);
    res.status(200).json({ success: true, data: balances });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 9. Profit & Loss Report (Income vs Expense ledgers)
// FIXED: Now correctly applies `from` date to exclude prior-year balances
exports.getProfitLoss = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { from, to } = req.query;
    // Pass BOTH from and to so P&L only covers the requested period
    const balances = await computeRunningBalances(companyId, to, from);

    const incomeLedgers = balances.filter(b => b.ledger.group === 'Income');
    const expenseLedgers = balances.filter(b => b.ledger.group === 'Expenses');

    const totalIncome = incomeLedgers.reduce((sum, b) => sum + b.balance, 0);
    const totalExpenses = expenseLedgers.reduce((sum, b) => sum + b.balance, 0);

    res.status(200).json({
      success: true,
      data: {
        period: { from: from || 'all', to: to || 'all' },
        income: incomeLedgers,
        expenses: expenseLedgers,
        totalIncome: parseFloat(totalIncome.toFixed(2)),
        totalExpenses: parseFloat(totalExpenses.toFixed(2)),
        netProfit: parseFloat((totalIncome - totalExpenses).toFixed(2))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 10. Balance Sheet Report (Assets vs Liabilities + Capital)
exports.getBalanceSheet = async (req, res) => {
  try {
    const companyId = req.companyId || req.query.companyId;
    const { asOn } = req.query;
    const balances = await computeRunningBalances(companyId, asOn);

    const assets = balances.filter(b => b.ledger.group === 'Assets');
    const liabilities = balances.filter(b => b.ledger.group === 'Liabilities');
    const capital = balances.filter(b => b.ledger.group === 'Capital');

    const totalAssets = assets.reduce((sum, b) => sum + b.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, b) => sum + b.balance, 0);
    const totalCapital = capital.reduce((sum, b) => sum + b.balance, 0);

    res.status(200).json({
      success: true,
      data: {
        assets,
        liabilities,
        capital,
        totalAssets,
        totalLiabilities,
        totalCapital,
        equity: totalCapital,
        isBalanced: Math.abs(totalAssets - (totalLiabilities + totalCapital)) < 0.01
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 11. Party-wise Outstanding with Aging Reports (receivable/payable)
exports.getOutstandingReport = async (req, res) => {
  try {
    const companyId = req.companyId || req.query.companyId;
    const { type, asOn } = req.query;
    const isReceivable = type === 'receivable';

    // Fetch matching customers or suppliers
    const partyGroup = isReceivable ? 'Customer' : 'Supplier';
    const parties = await Party.find({ companyId, type: { $in: [partyGroup, 'Both'] } });

    const outstandingLines = [];
    const asOnDate = asOn ? new Date(asOn) : new Date();

    for (const party of parties) {
      // Find invoices/bills
      let documents = [];
      if (isReceivable) {
        documents = await Sales.find({ companyId, customerId: party._id });
      } else {
        documents = await Purchase.find({ companyId, supplierId: party._id });
      }

      let partyTotalOutstanding = 0;
      const aging = {
        bucket30: 0,
        bucket60: 0,
        bucket90: 0,
        bucket90Plus: 0
      };

      for (const doc of documents) {
        // Calculate paid amount from vouchers
        const vouchers = await PaymentVoucher.find({
          companyId,
          status: 'Posted',
          'againstInvoices.invoiceId': doc._id
        });

        const paid = vouchers.reduce((sum, v) => {
          const invMatch = v.againstInvoices.find(item => item.invoiceId.toString() === doc._id.toString());
          return sum + (invMatch ? invMatch.amount : 0);
        }, 0);

        const docTotal = parseFloat(doc.totals?.total || doc.totalAmount || doc.netAmount || 0);
        const outstanding = docTotal - paid;

        if (outstanding > 0.01) {
          partyTotalOutstanding += outstanding;
          
          // Calculate aging days
          const docDate = new Date(doc.date);
          const ageInDays = Math.floor((asOnDate - docDate) / (1000 * 60 * 60 * 24));

          if (ageInDays <= 30) {
            aging.bucket30 += outstanding;
          } else if (ageInDays <= 60) {
            aging.bucket60 += outstanding;
          } else if (ageInDays <= 90) {
            aging.bucket90 += outstanding;
          } else {
            aging.bucket90Plus += outstanding;
          }
        }
      }

      if (partyTotalOutstanding > 0.01) {
        outstandingLines.push({
          partyId: party._id,
          partyName: party.name,
          phone: party.phone,
          totalOutstanding: partyTotalOutstanding,
          aging
        });
      }
    }

    res.status(200).json({ success: true, data: outstandingLines });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
