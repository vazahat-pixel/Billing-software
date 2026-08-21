const mongoose = require('mongoose');
const ReturnInvoice = require('../models/ReturnInvoice');
const AccountingEntry = require('../models/AccountingEntry');
const InventoryLot = require('../models/InventoryLot');
const StockMovement = require('../models/StockMovement');
const Counter = require('../models/Counter');
const accountingService = require('../services/accountingService');
const auditService = require('../services/auditService');
const { recalcReturnTotals } = require('../utils/returnTotals');

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
    const {
      returnType, invoiceNo, originalInvoiceNo, originalSaleId, originalPurchaseId, partyId, brokerId,
      date, items, taxableAmount: clientTaxable, gstAmount: clientGstAmount, netAmount: clientNetAmount,
      gstType, gstRate, transport, city, lrNo, lrDate, freight, weight, remarks, tcs, roundOff
    } = req.body;

    if (!returnType || !partyId || !items || items.length === 0 || !clientTaxable || !clientNetAmount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Type, party, items, and amounts are required' });
    }

    // Check GST period is not locked/filed
    const gstConfigService = require('../services/gstConfigService');
    await gstConfigService.assertPeriodOpen(companyId, date || new Date());

    const finalInvoiceNo = invoiceNo || await generateReturnNo(companyId, returnType, session);

    // =====================================================================
    // Stage 4: Server-side GST recomputation (hardened)
    // Never trust client-supplied GST amounts. Recompute from items + rate.
    // =====================================================================
    let companyGstin = '';
    let companyStateCode = '';
    try {
      const cfg = await gstConfigService.getOrCreate(companyId);
      companyGstin = cfg.gstin;
      companyStateCode = cfg.stateCode;
    } catch (_) { /* optional */ }

    const computedTotals = recalcReturnTotals(items || [], {
      gstType: gstType || 'CGST+SGST',
      gstRate: Number(gstRate || 5),
      extras: {},
      companyGstin,
      companyStateCode,
      partyGstin: req.body.partyGstin || '',
      partyStateCode: req.body.partyStateCode || '',
    });

    // Merge computed item totals with extended textile properties (fold, cut, dis1Per, etc.)
    const enrichedItems = (computedTotals.items || []).map((cItem, idx) => {
      const origItem = items[idx] || {};
      return {
        ...cItem,
        unit: origItem.unit || 'MTRS',
        fold: Number(origItem.fold || 0),
        cut: Number(origItem.cut || 0),
        dis1Per: Number(origItem.dis1Per || 0),
        dis1Amt: Number(origItem.dis1Amt || 0),
        addAmt: Number(origItem.addAmt || 0),
        gstPer: Number(origItem.gstPer || origItem.gstRate || 0),
        gstAmt: Number(origItem.gstAmt || 0),
        desc: origItem.desc || ''
      };
    });

    // Use server-computed totals, not client values
    const returnInvoice = await ReturnInvoice.create([{
      companyId,
      returnType,
      invoiceNo: finalInvoiceNo,
      originalInvoiceNo,
      originalSaleId: originalSaleId || null,
      originalPurchaseId: originalPurchaseId || null,
      partyId,
      brokerId: brokerId || null,
      date: date || new Date(),
      transport: transport || '',
      city: city || '',
      lrNo: lrNo || '',
      lrDate: lrDate ? new Date(lrDate) : null,
      freight: Number(freight || 0),
      weight: Number(weight || 0),
      remarks: remarks || '',
      items: enrichedItems,
      taxableAmount: computedTotals.taxableAmount,
      gstAmount: computedTotals.gstAmount,
      netAmount: computedTotals.netAmount,
      gstType: computedTotals.gstType,
      cgst: computedTotals.cgst,
      sgst: computedTotals.sgst,
      igst: computedTotals.igst,
      cess: computedTotals.cess,
      tcs: Number(tcs || 0),
      roundOff: Number(roundOff || 0),
      gstRate: computedTotals.gstRate,
    }], { session });

    const rInvoice = returnInvoice[0];

    // =====================================================================
    // FIXED: Sales Return now restores inventory stock
    // For SALES RETURN: Returned goods come back into stock — restore inventory
    // For PURCHASE RETURN: Goods are being returned to supplier — reduce stock
    // =====================================================================
    if (returnType === 'Sales') {
      // Restore stock for each returned item — prefer original lot if lotId sent
      for (const item of items) {
        if (!item.itemId || !item.mts) continue;
        const qtyMtrs = parseFloat(item.mts || 0);
        const qtyPcs = parseFloat(item.pcs || 0);

        if (item.lotId) {
          const lot = await InventoryLot.findOne({ _id: item.lotId, companyId }).session(session);
          if (!lot) throw new Error(`Sales return lot not found: ${item.lotId}`);
          if (lot.status === 'Closed') lot.status = 'Available';
          lot.remainingMtrs = parseFloat(((lot.remainingMtrs || 0) + qtyMtrs).toFixed(3));
          lot.remainingPcs = (lot.remainingPcs || 0) + qtyPcs;
          await lot.save({ session });
          await StockMovement.create([{
            lotId: lot._id,
            type: 'RETURN',
            qtyPcs,
            qtyMtrs,
            balanceMtrs: lot.remainingMtrs,
            referenceId: rInvoice._id,
            remarks: `Sales Return: ${finalInvoiceNo} → lot ${lot.lotId}`,
            companyId,
          }], { session });
          continue;
        }

        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 9000) + 1000;
        const newLotId = `RET-${timestamp}-${random}`;

        const newLot = new InventoryLot({
          lotId: newLotId,
          itemId: item.itemId,
          purchaseId: null,
          source: 'return',
          totalPcs: qtyPcs,
          remainingPcs: qtyPcs,
          totalMtrs: qtyMtrs,
          remainingMtrs: qtyMtrs,
          status: 'Available',
          companyId
        });
        await newLot.save({ session });

        await StockMovement.create([{
          lotId: newLot._id,
          type: 'RETURN',
          qtyPcs,
          qtyMtrs,
          balanceMtrs: qtyMtrs,
          referenceId: rInvoice._id,
          remarks: `Sales Return: ${finalInvoiceNo} (Orig: ${originalInvoiceNo || 'N/A'})`,
          companyId
        }], { session });
      }
    } else if (returnType === 'Purchase') {
      for (const item of items) {
        if (!item.itemId || !item.mts) continue;
        if (!item.lotId) {
          throw new Error('Purchase Return requires Stock Lot on every line (select the purchase lot to reduce).');
        }
        const lot = await InventoryLot.findOne({ _id: item.lotId, companyId }).session(session);
        if (!lot) throw new Error(`Purchase return lot not found: ${item.lotId}`);

        const qtyToReturn = parseFloat(item.mts || 0);
        if (qtyToReturn > Number(lot.remainingMtrs || 0) + 0.001) {
          throw new Error(`Return qty ${qtyToReturn} exceeds remaining ${lot.remainingMtrs} on lot ${lot.lotId}`);
        }
        lot.remainingMtrs = Math.max(0, lot.remainingMtrs - qtyToReturn);
        lot.remainingPcs = Math.max(0, (lot.remainingPcs || 0) - (item.pcs || 0));
        lot.status = lot.remainingMtrs <= 0 ? 'Closed' : 'Partially Used';
        await lot.save({ session });

        await StockMovement.create([{
          lotId: lot._id,
          type: 'RETURN',
          qtyPcs: -(item.pcs || 0),
          qtyMtrs: -qtyToReturn,
          balanceMtrs: lot.remainingMtrs,
          referenceId: rInvoice._id,
          remarks: `Purchase Return: ${finalInvoiceNo}`,
          companyId
        }], { session });
      }
    }

    // =====================================================================
    // Post accounting entries using server-computed GST amounts
    // Use computedTotals, NOT client-supplied values
    // =====================================================================
    const entryNo = await accountingService.generateEntryNo(companyId, 'JNL', session);
    const partyLedger = await accountingService.getOrCreatePartyLedger(companyId, partyId, session);
    const gstAmt = computedTotals.gstAmount;
    const taxableAmt = computedTotals.taxableAmount;
    const netAmt = computedTotals.netAmount;

    const lines = [];

    if (returnType === 'Sales') {
      const salesReturnLedger = await accountingService.getSystemLedger(companyId, 'Sales Return A/c', session);
      const cgstLedger = await accountingService.getSystemLedger(companyId, 'CGST Output', session);
      const sgstLedger = await accountingService.getSystemLedger(companyId, 'SGST Output', session);
      const igstLedger = await accountingService.getSystemLedger(companyId, 'IGST Output', session);

      // Contra-income: Dr Sales Return (not Sales A/c) so gross sales stay intact
      lines.push({ ledgerId: salesReturnLedger._id, ledgerName: salesReturnLedger.name, type: 'Dr', amount: taxableAmt, narration: `Sales Return #${finalInvoiceNo}` });

      // Use server-computed GST amounts only
      if (computedTotals.igst > 0 || (gstAmt > 0 && computedTotals.gstType === 'IGST')) {
        lines.push({ ledgerId: igstLedger._id, ledgerName: igstLedger.name, type: 'Dr', amount: computedTotals.igst, narration: 'IGST Output reversal on Sales Return' });
      } else if (gstAmt > 0) {
        if (computedTotals.cgst > 0) lines.push({ ledgerId: cgstLedger._id, ledgerName: cgstLedger.name, type: 'Dr', amount: computedTotals.cgst, narration: 'CGST Output reversal on Sales Return' });
        if (computedTotals.sgst > 0) lines.push({ ledgerId: sgstLedger._id, ledgerName: sgstLedger.name, type: 'Dr', amount: computedTotals.sgst, narration: 'SGST Output reversal on Sales Return' });
      }

      lines.push({ ledgerId: partyLedger._id, ledgerName: partyLedger.name, type: 'Cr', amount: netAmt, narration: `Credit to Customer for Return #${finalInvoiceNo}` });
    } else {
      const purchaseReturnLedger = await accountingService.getSystemLedger(companyId, 'Purchase Return A/c', session);
      const cgstLedger = await accountingService.getSystemLedger(companyId, 'CGST Input', session);
      const sgstLedger = await accountingService.getSystemLedger(companyId, 'SGST Input', session);
      const igstLedger = await accountingService.getSystemLedger(companyId, 'IGST Input', session);

      lines.push({ ledgerId: partyLedger._id, ledgerName: partyLedger.name, type: 'Dr', amount: netAmt, narration: `Debit to Supplier for Return #${finalInvoiceNo}` });
      lines.push({ ledgerId: purchaseReturnLedger._id, ledgerName: purchaseReturnLedger.name, type: 'Cr', amount: taxableAmt, narration: `Purchase Return #${finalInvoiceNo}` });

      // Use server-computed GST amounts only
      if (computedTotals.igst > 0 || (gstAmt > 0 && computedTotals.gstType === 'IGST')) {
        lines.push({ ledgerId: igstLedger._id, ledgerName: igstLedger.name, type: 'Cr', amount: computedTotals.igst, narration: 'IGST Input reversal on Purchase Return' });
      } else if (gstAmt > 0) {
        if (computedTotals.cgst > 0) lines.push({ ledgerId: cgstLedger._id, ledgerName: cgstLedger.name, type: 'Cr', amount: computedTotals.cgst, narration: 'CGST Input reversal on Purchase Return' });
        if (computedTotals.sgst > 0) lines.push({ ledgerId: sgstLedger._id, ledgerName: sgstLedger.name, type: 'Cr', amount: computedTotals.sgst, narration: 'SGST Input reversal on Purchase Return' });
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

    // Audit log
    await auditService.log(req, `CREATE_${returnType.toUpperCase()}_RETURN`, 'ReturnInvoice', rInvoice._id, null, {
      invoiceNo: rInvoice.invoiceNo,
      returnType,
      amount: rInvoice.netAmount
    });

    res.status(201).json({ success: true, data: rInvoice });
  } catch (error) {
    await session.abortTransaction();
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'A return with this number already exists' });
    }
    const status = error.message.includes('locked') || error.message.includes('Locked') || error.message.includes('Filed') ? 400 : 500;
    res.status(status).json({ success: false, message: error.message });
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
      .populate('partyId', 'name gstin state city')
      .populate('brokerId', 'name')
      .populate('items.itemId', 'name hsnCode gstRate unit')
      .populate('items.lotId', 'lotId remainingMtrs remainingPcs')
      .sort({ date: -1 });
    res.status(200).json({ success: true, data: list });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Fetch original sales or purchase bills for a party to auto-populate items in Return modal
 */
exports.getOriginalBills = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { partyId, type } = req.query;
    if (!partyId || !type) {
      return res.status(400).json({ success: false, message: 'partyId and type are required' });
    }

    if (type === 'Sales') {
      const Sales = require('../models/Sales');
      const salesList = await Sales.find({ companyId, customerId: partyId, status: { $ne: 'cancelled' } })
        .select('invoiceNo date customerId brokerId transport station lrNo lrDate freight weight remarks items taxableAmount gstAmount netAmount gstType gstRate cgst sgst igst')
        .populate('customerId', 'name gstin state city')
        .populate('brokerId', 'name')
        .populate('items.itemId', 'name hsnCode gstRate unit')
        .populate('items.lotId', 'lotId remainingMtrs remainingPcs')
        .sort({ date: -1 })
        .limit(100);
      return res.status(200).json({ success: true, data: salesList });
    } else {
      const Purchase = require('../models/Purchase');
      const purchaseList = await Purchase.find({ companyId, supplierId: partyId, status: { $ne: 'cancelled' } })
        .select('invoiceNo supplierInvoiceNo date supplierId brokerId transport lrNo challanNo items taxableAmount gstAmount netAmount gstType gstRate cgst sgst igst')
        .populate('supplierId', 'name gstin state city')
        .populate('brokerId', 'name')
        .populate('items.itemId', 'name hsnCode gstRate unit')
        .sort({ date: -1 })
        .limit(100);
      return res.status(200).json({ success: true, data: purchaseList });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
