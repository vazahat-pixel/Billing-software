const mongoose = require('mongoose');
const LedgerMaster = require('../../models/LedgerMaster');
const AccountingEntry = require('../../models/AccountingEntry');
const PaymentVoucher = require('../../models/PaymentVoucher');
const Sales = require('../../models/Sales');
const Purchase = require('../../models/Purchase');
const Company = require('../../models/Company');
const Counter = require('../../models/Counter');
const accountingService = require('../../services/accountingService');

async function checkPeriodLocked(companyId, dateVal) {
  const company = await Company.findById(companyId);
  if (company?.settings?.lockedUntilDate) {
    const lockDate = new Date(company.settings.lockedUntilDate);
    const voucherDate = new Date(dateVal);
    if (voucherDate <= lockDate) {
      throw new Error(`Accounting period is locked until ${lockDate.toLocaleDateString()}`);
    }
  }
}

function normalizePaymentDetails(body) {
  const amount = parseFloat(body.amount);
  if (!amount || amount <= 0) throw new Error('Voucher amount must be greater than zero');

  let splits = Array.isArray(body.paymentSplits)
    ? body.paymentSplits
        .map((s) => ({
          mode: s.mode,
          amount: parseFloat(s.amount || 0),
          reference: s.reference || undefined,
        }))
        .filter((s) => s.mode && s.amount > 0)
    : [];

  if (!splits.length) {
    const mode = body.paymentMode || 'Cash';
    splits = [{ mode, amount, reference: body.utrNo || body.chequeNo || undefined }];
  }

  const paymentMode = splits.length === 1 ? splits[0].mode : 'Mixed';
  const primary = splits[0];
  return {
    paymentMode,
    paymentSplits: splits,
    chequeNo: body.chequeNo,
    utrNo: body.utrNo,
    paymentNarration: `${primary.mode} ₹${amount.toFixed(2)}`,
  };
}

async function generateVoucherNo(companyId, type, session = null) {
  const prefix = type === 'Payment' ? 'PV' : 'RV';
  const currentYear = new Date().getFullYear().toString().substring(2);
  const nextYear = (new Date().getFullYear() + 1).toString().substring(2);
  const fy = `${currentYear}-${nextYear}`;
  const counterId = `${prefix}-${fy}-${companyId}`;
  const seq = await Counter.nextSeq(counterId, session);
  return `${prefix}-${fy}-${seq.toString().padStart(4, '0')}`;
}

async function createPostedVoucher(companyId, voucherType, body) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { date, partyLedgerId, amount, bankLedgerId, againstInvoices, narration, status = 'Posted' } = body;
    await checkPeriodLocked(companyId, date);

    const paymentDetails = normalizePaymentDetails(body);
    const { paymentMode, paymentSplits, chequeNo, utrNo, paymentNarration } = paymentDetails;

    let partyLedger = await LedgerMaster.findById(partyLedgerId).session(session);
    if (!partyLedger) {
      partyLedger = await accountingService.getOrCreatePartyLedger(companyId, partyLedgerId);
    }
    const bankLedger = await LedgerMaster.findById(bankLedgerId).session(session);
    if (!partyLedger || !bankLedger) throw new Error('Invalid party or bank ledger selection');

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
      bankLedgerId,
      chequeNo,
      utrNo,
      narration,
      againstInvoices,
      status,
    });

    if (status === 'Posted') {
      const entryNo = await accountingService.generateEntryNo(companyId, 'JNL', session);
      const isPayment = voucherType === 'Payment';
      const lines = isPayment
        ? [
            { ledgerId: partyLedger._id, ledgerName: partyLedger.name, type: 'Dr', amount: parseFloat(amount), narration: `Payment #${voucherNo}` },
            { ledgerId: bankLedgerId, ledgerName: bankLedger.name, type: 'Cr', amount: parseFloat(amount), narration: paymentNarration },
          ]
        : [
            { ledgerId: bankLedgerId, ledgerName: bankLedger.name, type: 'Dr', amount: parseFloat(amount), narration: paymentNarration },
            { ledgerId: partyLedger._id, ledgerName: partyLedger.name, type: 'Cr', amount: parseFloat(amount), narration: `Receipt #${voucherNo}` },
          ];

      const [accountingEntry] = await AccountingEntry.create(
        [{
          companyId,
          entryNo,
          entryDate: date,
          voucherType,
          refType: voucherType,
          refId: voucher._id,
          lines,
          narration: narration || `${voucherType} to ${partyLedger.name}`,
        }],
        { session }
      );
      voucher.accountingEntryId = accountingEntry._id;

      if (againstInvoices?.length) {
        for (const item of againstInvoices) {
          const paidNow = parseFloat(item.amount || 0);
          const saleDoc = await Sales.findOne({ _id: item.invoiceId, companyId }).session(session);
          if (saleDoc) {
            saleDoc.paidAmount = parseFloat(((saleDoc.paidAmount || 0) + paidNow).toFixed(2));
            saleDoc.status = saleDoc.paidAmount >= saleDoc.netAmount ? 'paid' : 'partial';
            await saleDoc.save({ session });
            continue;
          }
          const purchaseDoc = await Purchase.findOne({ _id: item.invoiceId, companyId }).session(session);
          if (purchaseDoc) {
            purchaseDoc.paidAmount = parseFloat(((purchaseDoc.paidAmount || 0) + paidNow).toFixed(2));
            purchaseDoc.status = purchaseDoc.paidAmount >= purchaseDoc.netAmount ? 'paid' : 'partial';
            await purchaseDoc.save({ session });
          }
        }
      }
    }

    await voucher.save({ session });
    await session.commitTransaction();
    return voucher;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

async function createPaymentVoucher(companyId, body) {
  return createPostedVoucher(companyId, 'Payment', body);
}

async function createReceiptVoucher(companyId, body) {
  return createPostedVoucher(companyId, 'Receipt', body);
}

async function findCashBankLedgers(companyId) {
  const ledgers = await LedgerMaster.find({ companyId, isActive: { $ne: false } }).lean();
  const cash = ledgers.find((l) => /cash/i.test(l.name) && !/bank/i.test(l.name));
  const bank = ledgers.find((l) => /bank/i.test(l.name));
  return { cash: cash?._id, bank: bank?._id || cash?._id };
}

module.exports = {
  createPaymentVoucher,
  createReceiptVoucher,
  findCashBankLedgers,
};
