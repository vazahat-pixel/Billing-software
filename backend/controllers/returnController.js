const mongoose = require('mongoose');
const ReturnInvoice = require('../models/ReturnInvoice');
const AccountingEntry = require('../models/AccountingEntry');
const InventoryLot = require('../models/InventoryLot');
const StockMovement = require('../models/StockMovement');
const Counter = require('../models/Counter');
const accountingService = require('../services/accountingService');

async function generateReturnNo(companyId, type, session = null) {
  const prefix = type === 'Sales' ? 'SR' : 'PR';
  const currentYear = new Date().getFullYear().toString().substring(2);
  const fy = `${currentYear}-${(parseInt(currentYear) + 1)}`;
  const counterId = `${prefix}-${fy}-${companyId}`;
  const seq = await Counter.nextSeq(counterId, session);
  return `${prefix}-${fy}-${seq.toString().padStart(4, '0')}`;
}

exports.createReturn = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const companyId = req.companyId;
    const { returnType, invoiceNo, originalInvoiceNo, partyId, date, items, taxableAmount, gstAmount, netAmount } = req.body;

    if (!returnType || !partyId || !items || items.length === 0 || !taxableAmount || !netAmount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Type, party, items, and amounts are required' });
    }

    const finalInvoiceNo = invoiceNo || await generateReturnNo(companyId, returnType, session);

    const returnInvoice = await ReturnInvoice.create([{
      companyId,
      returnType,
      invoiceNo: finalInvoiceNo,
      originalInvoiceNo,
      partyId,
      date: date || new Date(),
      items,
      taxableAmount: parseFloat(taxableAmount),
      gstAmount: parseFloat(gstAmount || 0),
      netAmount: parseFloat(netAmount)
    }], { session });

    const rInvoice = returnInvoice[0];

    // =====================================================================
    // FIXED: Sales Return now restores inventory stock
    // For SALES RETURN: Returned goods come back into stock — restore inventory
    // For PURCHASE RETURN: Goods are being returned to supplier — reduce stock
    // =====================================================================
    if (returnType === 'Sales') {
      // Restore stock for each returned item
      for (const item of items) {
        if (!item.itemId || !item.mts) continue;

        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 9000) + 1000;
        const newLotId = `RET-${timestamp}-${random}`;

        // Create a new inventory lot for returned goods
        const newLot = new InventoryLot({
          lotId: newLotId,
          itemId: item.itemId,
          purchaseId: null,
          source: 'return',
          totalPcs: item.pcs || 0,
          remainingPcs: item.pcs || 0,
          totalMtrs: item.mts || 0,
          remainingMtrs: item.mts || 0,
          status: 'Available',
          companyId
        });
        await newLot.save({ session });

        // Record stock movement for return receipt
        const movement = new StockMovement({
          lotId: newLot._id,
          type: 'RETURN',
          qtyPcs: item.pcs || 0,
          qtyMtrs: item.mts || 0,
          balanceMtrs: item.mts || 0,
          referenceId: rInvoice._id,
          remarks: `Sales Return: ${finalInvoiceNo} (Orig: ${originalInvoiceNo || 'N/A'})`,
          companyId
        });
        await movement.save({ session });
      }
    } else if (returnType === 'Purchase') {
      // Purchase Return: Reduce the original lot stock if lotId is provided
      for (const item of items) {
        if (!item.lotId || !item.mts) continue;
        const lot = await InventoryLot.findOne({ _id: item.lotId, companyId }).session(session);
        if (!lot) continue;

        const qtyToReturn = parseFloat(item.mts || 0);
        lot.remainingMtrs = Math.max(0, lot.remainingMtrs - qtyToReturn);
        lot.remainingPcs = Math.max(0, (lot.remainingPcs || 0) - (item.pcs || 0));
        lot.status = lot.remainingMtrs <= 0 ? 'Closed' : 'Partially Used';
        await lot.save({ session });

        const movement = new StockMovement({
          lotId: lot._id,
          type: 'RETURN',
          qtyPcs: -(item.pcs || 0),
          qtyMtrs: -qtyToReturn,
          balanceMtrs: lot.remainingMtrs,
          referenceId: rInvoice._id,
          remarks: `Purchase Return: ${finalInvoiceNo}`,
          companyId
        });
        await movement.save({ session });
      }
    }

    // =====================================================================
    // Post accounting entries (fixed refType to use 'SalesReturn'/'PurchaseReturn')
    // =====================================================================
    const entryNo = await accountingService.generateEntryNo(companyId, 'JNL', session);
    const partyLedger = await accountingService.getOrCreatePartyLedger(companyId, partyId);
    const gstAmt = parseFloat(gstAmount || 0);
    const taxableAmt = parseFloat(taxableAmount);
    const netAmt = parseFloat(netAmount);

    const lines = [];

    if (returnType === 'Sales') {
      const salesLedger = await accountingService.getSystemLedger(companyId, 'Sales A/c');
      const cgstLedger = await accountingService.getSystemLedger(companyId, 'CGST Output');
      const sgstLedger = await accountingService.getSystemLedger(companyId, 'SGST Output');

      lines.push({ ledgerId: salesLedger._id, ledgerName: salesLedger.name, type: 'Dr', amount: taxableAmt, narration: `Sales Return #${finalInvoiceNo}` });

      if (gstAmt > 0) {
        const halfGst = parseFloat((gstAmt / 2).toFixed(2));
        const otherHalf = parseFloat((gstAmt - halfGst).toFixed(2));
        lines.push({ ledgerId: cgstLedger._id, ledgerName: cgstLedger.name, type: 'Dr', amount: halfGst, narration: 'CGST Output reversal on Sales Return' });
        lines.push({ ledgerId: sgstLedger._id, ledgerName: sgstLedger.name, type: 'Dr', amount: otherHalf, narration: 'SGST Output reversal on Sales Return' });
      }

      lines.push({ ledgerId: partyLedger._id, ledgerName: partyLedger.name, type: 'Cr', amount: netAmt, narration: `Credit to Customer for Return #${finalInvoiceNo}` });
    } else {
      const purchaseLedger = await accountingService.getSystemLedger(companyId, 'Purchase A/c');
      const cgstLedger = await accountingService.getSystemLedger(companyId, 'CGST Input');
      const sgstLedger = await accountingService.getSystemLedger(companyId, 'SGST Input');

      lines.push({ ledgerId: partyLedger._id, ledgerName: partyLedger.name, type: 'Dr', amount: netAmt, narration: `Debit to Supplier for Return #${finalInvoiceNo}` });
      lines.push({ ledgerId: purchaseLedger._id, ledgerName: purchaseLedger.name, type: 'Cr', amount: taxableAmt, narration: `Purchase Return #${finalInvoiceNo}` });

      if (gstAmt > 0) {
        const halfGst = parseFloat((gstAmt / 2).toFixed(2));
        const otherHalf = parseFloat((gstAmt - halfGst).toFixed(2));
        lines.push({ ledgerId: cgstLedger._id, ledgerName: cgstLedger.name, type: 'Cr', amount: halfGst, narration: 'CGST Input reversal on Purchase Return' });
        lines.push({ ledgerId: sgstLedger._id, ledgerName: sgstLedger.name, type: 'Cr', amount: otherHalf, narration: 'SGST Input reversal on Purchase Return' });
      }
    }

    await AccountingEntry.create([{
      companyId,
      entryNo,
      entryDate: date || new Date(),
      voucherType: returnType === 'Sales' ? 'ReturnAuto' : 'ReturnAuto',
      refType: returnType === 'Sales' ? 'SalesReturn' : 'PurchaseReturn',
      refId: rInvoice._id,
      lines,
      narration: `Auto posted ${returnType} Return #${finalInvoiceNo}`
    }], { session });

    await session.commitTransaction();
    res.status(201).json({ success: true, data: rInvoice });
  } catch (error) {
    await session.abortTransaction();
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'A return with this number already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

exports.getReturns = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { returnType } = req.query;

    const filter = { companyId };
    if (returnType) filter.returnType = returnType;

    const list = await ReturnInvoice.find(filter)
      .populate('partyId', 'name gstin')
      .populate('items.itemId', 'name hsnCode')
      .sort({ date: -1 });
    res.status(200).json({ success: true, data: list });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
