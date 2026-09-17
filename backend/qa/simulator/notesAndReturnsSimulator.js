/**
 * Seed purchase returns + debit/credit notes for demo / QA coverage.
 */
const mongoose = require('mongoose');
const Purchase = require('../../models/Purchase');
const Sales = require('../../models/Sales');
const InventoryLot = require('../../models/InventoryLot');
const Party = require('../../models/Party');
const { createNoteInternal } = require('../../controllers/noteController');
const { randomDateInFY, randFloat } = require('../utils/faker');
const logger = require('../utils/logger');

function invokeCreateReturn(companyId, userId, body) {
  const returnController = require('../../controllers/returnController');
  return new Promise((resolve, reject) => {
    const req = {
      companyId,
      userId,
      user: { _id: userId },
      body,
    };
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        if (this.statusCode >= 400 || payload?.success === false) {
          reject(new Error(payload?.message || `return failed (${this.statusCode})`));
        } else {
          resolve(payload);
        }
        return this;
      },
    };
    Promise.resolve(returnController.createReturn(req, res)).catch(reject);
  });
}

async function createPostedNote(companyId, body) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const result = await createNoteInternal(companyId, { ...body, status: 'Posted' }, session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

async function simulatePurchaseReturns(ctx, target = 8) {
  const companyId = ctx.companyId;
  const purchases = await Purchase.find({
    companyId,
    status: { $ne: 'cancelled' },
    isDeleted: { $ne: true },
  })
    .sort({ createdAt: -1 })
    .limit(40)
    .lean();

  let created = 0;
  const errors = [];

  for (const purchase of purchases) {
    if (created >= target) break;
    const line = (purchase.items || []).find((i) => i.itemId && i.lotId);
    if (!line) continue;

    let lot = null;
    try {
      const lotKey = line.lotId;
      if (mongoose.Types.ObjectId.isValid(String(lotKey)) && String(lotKey).length === 24) {
        lot = await InventoryLot.findOne({ _id: lotKey, companyId, remainingMtrs: { $gt: 15 } }).lean();
      }
      if (!lot) {
        lot = await InventoryLot.findOne({
          companyId,
          remainingMtrs: { $gt: 15 },
          $or: [{ lotId: String(lotKey) }, { purchaseId: purchase._id }],
        })
          .sort({ remainingMtrs: -1 })
          .lean();
      }
      if (!lot && line.itemId) {
        lot = await InventoryLot.findOne({
          companyId,
          itemId: line.itemId,
          remainingMtrs: { $gt: 15 },
          source: 'purchase',
        })
          .sort({ remainingMtrs: -1 })
          .lean();
      }
    } catch (err) {
      errors.push({ invoiceNo: purchase.invoiceNo, error: err.message });
      continue;
    }
    if (!lot) continue;

    const returnMts = Math.min(12, Number((lot.remainingMtrs * 0.15).toFixed(2)), lot.remainingMtrs - 1);
    if (returnMts < 2) continue;

    const rate = Number(line.rate || 50);
    const amount = Number((returnMts * rate).toFixed(2));
    const gstRate = Number(line.gstRate || purchase.gstRate || 5);
    const gstAmount = Number(((amount * gstRate) / 100).toFixed(2));
    const taxableAmount = amount;
    const netAmount = Number((taxableAmount + gstAmount).toFixed(2));

    try {
      await invokeCreateReturn(companyId, ctx.userId, {
        returnType: 'Purchase',
        partyId: purchase.supplierId,
        originalPurchaseId: purchase._id,
        originalInvoiceNo: purchase.invoiceNo,
        date: randomDateInFY(),
        gstType: purchase.gstType || 'CGST+SGST',
        gstRate,
        partyGstin: '',
        partyStateCode: '',
        items: [
          {
            itemId: line.itemId,
            lotId: lot._id,
            mts: returnMts,
            pcs: Math.min(2, line.pcs || 1),
            rate,
            amount,
            gstRate,
            gstPer: gstRate,
          },
        ],
        taxableAmount,
        gstAmount,
        netAmount,
        remarks: 'Demo purchase return',
      });
      created += 1;
    } catch (err) {
      errors.push({ invoiceNo: purchase.invoiceNo, error: err.message });
    }
  }

  return { created, failed: errors.length, errors: errors.slice(0, 10) };
}

async function simulateDebitCreditNotes(ctx) {
  const companyId = ctx.companyId;
  const [sales, purchases, customers, suppliers] = await Promise.all([
    Sales.find({ companyId, status: { $ne: 'cancelled' } }).sort({ createdAt: -1 }).limit(12).lean(),
    Purchase.find({ companyId, status: { $ne: 'cancelled' } }).sort({ createdAt: -1 }).limit(12).lean(),
    Party.find({ companyId, type: { $in: ['Customer', 'Both'] } }).limit(8).lean(),
    Party.find({ companyId, type: { $in: ['Supplier', 'Both'] } }).limit(8).lean(),
  ]);

  const specs = [];
  for (let i = 0; i < 4 && i < sales.length; i += 1) {
    const sale = sales[i];
    const customer =
      customers.find((c) => String(c._id) === String(sale.customerId)) ||
      (await Party.findById(sale.customerId).lean());
    if (!customer) continue;
    const amount = Number(randFloat(800, 3500, 2));
    specs.push({
      noteType: 'Credit',
      noteSide: 'Sales',
      partyId: customer._id,
      reason: i % 2 === 0 ? 'Rate Difference' : 'Quality Claim',
      amount,
      amountMode: 'Exclusive',
      gstRate: 5,
      gstType: sale.gstType || 'CGST+SGST',
      againstInvoiceId: sale._id,
      againstInvoiceNo: sale.invoiceNo,
      date: randomDateInFY(),
      narration: `Demo sales credit note vs ${sale.invoiceNo}`,
      idempotencyKey: `demo-scn-${companyId}-${sale._id}`,
    });
  }

  for (let i = 0; i < 4 && i < purchases.length; i += 1) {
    const purchase = purchases[i];
    const supplier =
      suppliers.find((s) => String(s._id) === String(purchase.supplierId)) ||
      (await Party.findById(purchase.supplierId).lean());
    if (!supplier) continue;
    const amount = Number(randFloat(600, 2800, 2));
    specs.push({
      noteType: 'Debit',
      noteSide: 'Purchase',
      partyId: supplier._id,
      reason: i % 2 === 0 ? 'Rate Difference' : 'Short Supply',
      amount,
      amountMode: 'Exclusive',
      gstRate: 5,
      gstType: purchase.gstType || 'CGST+SGST',
      againstInvoiceId: purchase._id,
      againstInvoiceNo: purchase.invoiceNo,
      date: randomDateInFY(),
      narration: `Demo purchase debit note vs ${purchase.invoiceNo}`,
      idempotencyKey: `demo-pdn-${companyId}-${purchase._id}`,
    });
  }

  // One of each remaining combo for GSTR coverage
  if (sales[0]) {
    const saleParty =
      customers.find((c) => String(c._id) === String(sales[0].customerId)) ||
      (await Party.findById(sales[0].customerId).lean());
    if (saleParty) {
      specs.push({
        noteType: 'Debit',
        noteSide: 'Sales',
        partyId: saleParty._id,
        reason: 'Additional Charges',
        amount: 1500,
        amountMode: 'Exclusive',
        gstRate: 5,
        gstType: sales[0].gstType || 'CGST+SGST',
        againstInvoiceId: sales[0]._id,
        againstInvoiceNo: sales[0].invoiceNo,
        date: randomDateInFY(),
        narration: 'Demo sales debit note',
        idempotencyKey: `demo-sdn-${companyId}-${sales[0]._id}`,
      });
    }
  }
  if (purchases[0]) {
    const purchaseParty =
      suppliers.find((s) => String(s._id) === String(purchases[0].supplierId)) ||
      (await Party.findById(purchases[0].supplierId).lean());
    if (purchaseParty) {
      specs.push({
        noteType: 'Credit',
        noteSide: 'Purchase',
        partyId: purchaseParty._id,
        reason: 'Discount Received',
        amount: 1200,
        amountMode: 'Exclusive',
        gstRate: 5,
        gstType: purchases[0].gstType || 'CGST+SGST',
        againstInvoiceId: purchases[0]._id,
        againstInvoiceNo: purchases[0].invoiceNo,
        date: randomDateInFY(),
        narration: 'Demo purchase credit note',
        idempotencyKey: `demo-pcn-${companyId}-${purchases[0]._id}`,
      });
    }
  }

  let created = 0;
  const errors = [];
  for (const body of specs) {
    try {
      const result = await createPostedNote(companyId, body);
      if (result.created) created += 1;
    } catch (err) {
      errors.push({ noteType: body.noteType, noteSide: body.noteSide, error: err.message });
    }
  }

  return { created, failed: errors.length, errors: errors.slice(0, 12) };
}

async function simulateNotesAndReturns(ctx) {
  logger.info('Notes & returns simulator starting');
  const purchaseReturns = await simulatePurchaseReturns(ctx, 8);
  const notes = await simulateDebitCreditNotes(ctx);
  logger.info('Notes & returns simulator done', {
    purchaseReturns: purchaseReturns.created,
    notes: notes.created,
    prErrors: purchaseReturns.failed,
    noteErrors: notes.failed,
  });
  return {
    created: purchaseReturns.created + notes.created,
    purchaseReturns: purchaseReturns.created,
    notes: notes.created,
    failed: purchaseReturns.failed + notes.failed,
    errors: [...purchaseReturns.errors, ...notes.errors].slice(0, 20),
  };
}

module.exports = {
  simulateNotesAndReturns,
  simulatePurchaseReturns,
  simulateDebitCreditNotes,
};
