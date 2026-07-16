const Purchase = require('../../models/Purchase');
const Sales = require('../../models/Sales');
const Party = require('../../models/Party');
const accountingService = require('../../services/accountingService');
const outstandingEngineService = require('../../services/outstandingEngineService');
const { createPaymentVoucher, createReceiptVoucher, findCashBankLedgers } = require('../utils/voucherHelper');
const { randFloat } = require('../utils/faker');
const logger = require('../utils/logger');

async function partyLedgerId(companyId, partyId) {
  const ledger = await accountingService.getOrCreatePartyLedger(companyId, partyId);
  return ledger._id;
}

async function simulatePayments(ctx) {
  const companyId = ctx.companyId;
  const target = ctx.profile.paymentsReceipts;
  const settlementPct = ctx.profile.settlementPct;

  await outstandingEngineService.rebuildSettlements(companyId);
  const { bank } = await findCashBankLedgers(companyId);
  if (!bank) throw new Error('Cash/Bank ledger required — seed company defaults first');

  const [purchases, sales] = await Promise.all([
    Purchase.find({ companyId, status: { $in: ['active', 'partial'] } }).limit(target).lean(),
    Sales.find({ companyId, status: { $in: ['active', 'partial'] } }).limit(target).lean(),
  ]);

  let payments = 0;
  let receipts = 0;
  const errors = [];

  const payCount = Math.min(Math.floor(target / 2), purchases.length);
  for (let i = 0; i < payCount; i += 1) {
    const bill = purchases[i];
    try {
      const supplier = await Party.findById(bill.supplierId).lean();
      const outstanding = Math.max(0, (bill.netAmount || 0) - (bill.paidAmount || 0));
      if (outstanding < 1) continue;
      const amount = Number((outstanding * randFloat(settlementPct * 0.8, settlementPct, 2)).toFixed(2));
      const partyLedger = await partyLedgerId(companyId, supplier._id);
      const paymentVoucher = await createPaymentVoucher(companyId, {
        date: bill.date || new Date(),
        partyLedgerId: partyLedger,
        bankLedgerId: bank,
        amount,
        paymentMode: 'NEFT',
        utrNo: `QA-PAY-${i}`,
        status: 'Posted',
        againstInvoices: [{ invoiceId: bill._id, amount }],
        narration: `QA payment against ${bill.invoiceNo}`,
      });
      await outstandingEngineService.recordSettlement(
        companyId,
        {
          billType: 'PurchaseBill',
          billId: bill._id,
          amount,
          date: bill.date || new Date(),
          mode: 'NEFT',
          paymentVoucherId: paymentVoucher._id,
          accountingEntryId: paymentVoucher.accountingEntryId,
          narration: `QA payment against ${bill.invoiceNo}`,
        },
        ctx.userId
      );
      payments += 1;
    } catch (err) {
      errors.push({ type: 'payment', error: err.message, bill: bill.invoiceNo });
    }
  }

  const receiptCount = Math.min(target - payCount, sales.length);
  for (let i = 0; i < receiptCount; i += 1) {
    const inv = sales[i];
    try {
      const customer = await Party.findById(inv.customerId).lean();
      const outstanding = Math.max(0, (inv.netAmount || 0) - (inv.paidAmount || 0));
      if (outstanding < 1) continue;
      const amount = Number((outstanding * randFloat(settlementPct * 0.8, settlementPct, 2)).toFixed(2));
      const partyLedger = await partyLedgerId(companyId, customer._id);
      const receiptVoucher = await createReceiptVoucher(companyId, {
        date: inv.date || new Date(),
        partyLedgerId: partyLedger,
        bankLedgerId: bank,
        amount,
        paymentMode: 'UPI',
        utrNo: `QA-RCPT-${i}`,
        status: 'Posted',
        againstInvoices: [{ invoiceId: inv._id, amount }],
        narration: `QA receipt against ${inv.invoiceNo}`,
      });
      await outstandingEngineService.recordSettlement(
        companyId,
        {
          billType: 'SalesInvoice',
          billId: inv._id,
          amount,
          date: inv.date || new Date(),
          mode: 'UPI',
          paymentVoucherId: receiptVoucher._id,
          accountingEntryId: receiptVoucher.accountingEntryId,
          narration: `QA receipt against ${inv.invoiceNo}`,
        },
        ctx.userId
      );
      receipts += 1;
    } catch (err) {
      errors.push({ type: 'receipt', error: err.message, invoice: inv.invoiceNo });
    }
  }

  await outstandingEngineService.rebuildSettlements(companyId);
  logger.info('Payment simulator done', { payments, receipts, errors: errors.length });
  return { payments, receipts, failed: errors.length, errors: errors.slice(0, 20) };
}

module.exports = { simulatePayments };
