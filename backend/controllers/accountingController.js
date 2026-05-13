const mongoose = require('mongoose');
const LedgerMaster = require('../models/LedgerMaster');
const AccountingEntry = require('../models/AccountingEntry');
const PaymentVoucher = require('../models/PaymentVoucher');
const Company = require('../models/Company');
const Party = require('../models/Party');
const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');
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

// Helper to generate voucher numbers
async function generateVoucherNo(companyId, type) {
  const prefix = type === 'Payment' ? 'PV' : 'RV';
  const currentYear = new Date().getFullYear().toString().substring(2);
  const nextYear = (new Date().getFullYear() + 1).toString().substring(2);
  const fy = `${currentYear}-${nextYear}`;
  
  const count = await PaymentVoucher.countDocuments({ companyId, voucherType: type });
  const padded = (count + 1).toString().padStart(4, '0');
  return `${prefix}-${fy}-${padded}`;
}

// 1. Create Ledger Account
exports.createLedger = async (req, res) => {
  try {
    const { companyId } = req.body;
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
    const { companyId, group, search, partyId } = req.query;
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

    const companyId = ledger.companyId;

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
    const { 
      companyId, date, partyLedgerId, amount, 
      paymentMode, bankLedgerId, chequeNo, utrNo, status, againstInvoices, narration
    } = req.body;

    await checkPeriodLocked(companyId, date);

    // Validations
    if (paymentMode === 'Cheque' && !chequeNo) {
      throw new Error('Cheque number is required when payment mode is Cheque');
    }
    if (['NEFT', 'RTGS', 'UPI'].includes(paymentMode) && !utrNo) {
      throw new Error(`UTR/Reference number is required when payment mode is ${paymentMode}`);
    }

    const partyLedger = await LedgerMaster.findById(partyLedgerId);
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
      partyLedgerId,
      partyName: partyLedger.name,
      amount,
      paymentMode,
      bankLedgerId,
      chequeNo,
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
            ledgerId: partyLedgerId,
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
            narration: `Paid via ${paymentMode}`
          }
        ],
        narration: narration || `Paid to ${partyLedger.name}`
      }], { session });

      voucher.accountingEntryId = accountingEntry[0]._id;

      // Update invoice statuses marked in againstInvoices
      if (againstInvoices && againstInvoices.length > 0) {
        for (const item of againstInvoices) {
          // If invoiceId belongs to Sales/Purchases, update it
          await Sales.findByIdAndUpdate(item.invoiceId, { status: 'Paid' }, { session });
          await Purchase.findByIdAndUpdate(item.invoiceId, { status: 'Paid' }, { session });
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
    const { 
      companyId, date, partyLedgerId, amount, 
      paymentMode, bankLedgerId, chequeNo, utrNo, status, againstInvoices, narration
    } = req.body;

    await checkPeriodLocked(companyId, date);

    if (paymentMode === 'Cheque' && !chequeNo) {
      throw new Error('Cheque number is required when payment mode is Cheque');
    }
    if (['NEFT', 'RTGS', 'UPI'].includes(paymentMode) && !utrNo) {
      throw new Error(`UTR/Reference number is required when payment mode is ${paymentMode}`);
    }

    const partyLedger = await LedgerMaster.findById(partyLedgerId);
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
      partyLedgerId,
      partyName: partyLedger.name,
      amount,
      paymentMode,
      bankLedgerId,
      chequeNo,
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
            narration: `Received via ${paymentMode}`
          },
          {
            ledgerId: partyLedgerId,
            ledgerName: partyLedger.name,
            type: 'Cr',
            amount: parseFloat(amount),
            narration: `Receipt Voucher #${voucherNo}`
          }
        ],
        narration: narration || `Received from ${partyLedger.name}`
      }], { session });

      voucher.accountingEntryId = accountingEntry[0]._id;

      if (againstInvoices && againstInvoices.length > 0) {
        for (const item of againstInvoices) {
          await Sales.findByIdAndUpdate(item.invoiceId, { status: 'Paid' }, { session });
          await Purchase.findByIdAndUpdate(item.invoiceId, { status: 'Paid' }, { session });
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
    const { companyId, from, to, partyId, type } = req.query;
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
    const { companyId, entryDate, lines, narration } = req.body;
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

// Helper helper to get running balances of all ledgers
async function computeRunningBalances(companyId, asOnDate) {
  const ledgers = await LedgerMaster.find({ companyId });
  const result = [];

  for (const ledger of ledgers) {
    const filter = {
      companyId,
      isReversed: false,
      'lines.ledgerId': ledger._id
    };
    if (asOnDate) {
      filter.entryDate = { $lte: new Date(asOnDate) };
    }

    const entries = await AccountingEntry.find(filter);
    
    let balance = 0;
    if (ledger.openingBalanceType === 'Dr') {
      balance = ledger.openingBalance || 0;
    } else {
      balance = -(ledger.openingBalance || 0);
    }

    for (const entry of entries) {
      const activeLine = entry.lines.find(l => l.ledgerId.toString() === ledger._id.toString());
      if (activeLine) {
        if (activeLine.type === 'Dr') {
          balance += activeLine.amount;
        } else {
          balance -= activeLine.amount;
        }
      }
    }

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
    const { companyId, asOn } = req.query;
    const balances = await computeRunningBalances(companyId, asOn);
    res.status(200).json({ success: true, data: balances });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 9. Profit & Loss Report (Income vs Expense ledgers)
exports.getProfitLoss = async (req, res) => {
  try {
    const { companyId, from, to } = req.query;
    const balances = await computeRunningBalances(companyId, to);

    // Filter incomes and expenses within range
    const incomeLedgers = balances.filter(b => b.ledger.group === 'Income');
    const expenseLedgers = balances.filter(b => b.ledger.group === 'Expenses');

    const totalIncome = incomeLedgers.reduce((sum, b) => sum + b.balance, 0);
    const totalExpenses = expenseLedgers.reduce((sum, b) => sum + b.balance, 0);

    res.status(200).json({
      success: true,
      data: {
        income: incomeLedgers,
        expenses: expenseLedgers,
        totalIncome,
        totalExpenses,
        netProfit: totalIncome - totalExpenses
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 10. Balance Sheet Report (Assets vs Liabilities + Capital)
exports.getBalanceSheet = async (req, res) => {
  try {
    const { companyId, asOn } = req.query;
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
    const { companyId, type, asOn } = req.query;
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
