const mongoose = require('mongoose');
const Sales = require('../models/Sales');
const InventoryLot = require('../models/InventoryLot');
const StockMovement = require('../models/StockMovement');
const AccountingEntry = require('../models/AccountingEntry');

class SalesService {
  /**
   * @param {object} salesData
   * @param {{ skipStock?: boolean }} options — skipStock when challan already deducted stock
   */
  async createInvoice(salesData, options = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { companyId, items } = salesData;
      const skipStock = options.skipStock === true || salesData.stockFromChallan === true;

      // Strip offline local-* ids before Mongo create
      const {
        _id: _dropId,
        id: _dropId2,
        localId: _dropLocal,
        accountingEntryId: _dropAcct,
        ...clean
      } = salesData || {};
      salesData = clean;
      const safeItems = Array.isArray(items)
        ? items.map((it) => {
            const { _id, id, ...rest } = it || {};
            if (rest.lotId && String(rest.lotId).startsWith('local-')) delete rest.lotId;
            return rest;
          })
        : items;
      salesData.items = safeItems;

      const Party = require('../models/Party');
      const Item = require('../models/Item');
      const { assertRefs } = require('../utils/refIntegrity');
      const { recalcSalesTotals } = require('../utils/salesTotals');

      await assertRefs(companyId, [
        { Model: Party, id: salesData.customerId, label: 'Customer' },
        ...((safeItems || []).map((it) => ({ Model: Item, id: it.itemId, label: 'Item' }))),
      ]);

      // Sprint 2.9: central business validation (blocking errors)
      if (!options.skipValidation) {
        const { assertBusinessValid } = require('./validateBusinessService');
        await assertBusinessValid({
          module: 'sales',
          action: 'create',
          companyId,
          payload: salesData,
          options: {
            allowCreditOverride: options.allowCreditOverride === true || salesData.allowCreditOverride === true,
            skipDuplicate: !!skipStock, // challan→invoice already unique path
          },
        });
      }

      // Sprint 2.5 / Stage 4: server-validate totals (do not trust client net/gst)
      let gstRate = salesData.gstRate;
      if (gstRate == null && items?.[0]?.itemId) {
        const it = await Item.findOne({ _id: items[0].itemId, companyId }).select('gstRate').session(session);
        gstRate = it?.gstRate ?? 5;
      }
      const customer = await Party.findOne({ _id: salesData.customerId, companyId }).session(session);
      let companyGstin = '';
      let companyStateCode = '';
      try {
        const gstConfigService = require('./gstConfigService');
        const cfg = await gstConfigService.getOrCreate(companyId);
        companyGstin = cfg.gstin;
        companyStateCode = cfg.stateCode;
        await gstConfigService.assertPeriodOpen(companyId, salesData.date || new Date());
      } catch (err) {
        if (err.message && err.message.includes('GST period')) throw err;
      }
      const totals = recalcSalesTotals(items || [], {
        gstType: salesData.gstType || 'CGST+SGST',
        gstRate: gstRate ?? 5,
        extras: salesData,
        companyGstin,
        companyStateCode,
        partyGstin: customer?.gstin,
        partyStateCode: customer?.stateCode,
      });
      salesData.items = totals.items;
      salesData.taxableAmount = totals.taxableAmount;
      salesData.gstType = totals.gstType;
      salesData.cgst = totals.cgst;
      salesData.sgst = totals.sgst;
      salesData.igst = totals.igst;
      salesData.gstAmount = totals.gstAmount;
      salesData.netAmount = totals.netAmount;
      if (totals.cess != null) salesData.cess = totals.cess;

      const Counter = require('../models/Counter');
      if (!salesData.invoiceNo || salesData.invoiceNo === 'AUTO') {
        try {
          const voucherSeriesService = require('./voucherSeriesService');
          const allocated = await voucherSeriesService.allocateNext(companyId, 'sales', { session });
          salesData.invoiceNo = allocated.number;
        } catch {
          const counterId = `INV-${companyId}`;
          const seq = await Counter.nextSeq(counterId, session);
          salesData.invoiceNo = `INV-${seq}`;
        }
      }

      const sales = new Sales(salesData);
      await sales.save({ session });

      // Stock: deduct only if not already posted via delivery challan
      if (!skipStock) {
        const { applyLotMovement, loadLotForUpdate } = require('../utils/inventoryStockHelper');
        for (const item of salesData.items) {
          if (item.lotId) {
            const lot = await loadLotForUpdate(session, item.lotId, companyId);
            await applyLotMovement({
              session,
              lot,
              companyId,
              deltaMts: -(item.mts || 0),
              deltaPcs: -(item.pcs || 0),
              type: 'SALE',
              referenceId: sales._id,
              idempotencyKey: `SALE:${sales._id}:${lot._id}`,
              remarks: `Sales Inv: ${sales.invoiceNo}`,
            });
          }
        }
      }

      const accountingService = require('./accountingService');
      const entry = await accountingService.onSalesInvoicePost(sales, session);

      sales.accountingEntryId = entry?._id;
      await sales.save({ session });

      await session.commitTransaction();
      try {
        const eventBus = require('../events/eventBus');
        eventBus.emitSafe('sales.created', {
          companyId: sales.companyId?.toString?.() || sales.companyId,
          salesId: sales._id?.toString?.(),
          invoiceNo: sales.invoiceNo,
          netAmount: sales.netAmount,
          customerId: sales.customerId?.toString?.() || sales.customerId,
          stockFromChallan: skipStock,
        });
      } catch {
        /* event bus optional */
      }
      return sales;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getSales(companyId, { page = 1, limit = 100, startDate, endDate, status } = {}) {
    const query = { companyId };
    if (status) query.status = status;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [sales, total] = await Promise.all([
      Sales.find(query)
        .populate('customerId', 'name gstin state')
        .populate('items.itemId', 'name hsnCode gstRate')
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Sales.countDocuments(query)
    ]);

    return { sales, total, page: parseInt(page), limit: parseInt(limit) };
  }

  async getSaleById(id, companyId) {
    const sale = await Sales.findOne({ _id: id, companyId })
      .populate('customerId', 'name gstin state city')
      .populate('items.itemId', 'name hsnCode gstRate unit');
    if (!sale) throw new Error('Sale not found');
    return sale;
  }

  async updateSaleStatus(id, companyId, status) {
    const validStatuses = ['active', 'cancelled', 'paid', 'partial'];
    if (!validStatuses.includes(status)) throw new Error(`Invalid status: ${status}`);
    const sale = await Sales.findOneAndUpdate(
      { _id: id, companyId },
      { status },
      { new: true, runValidators: true }
    );
    if (!sale) throw new Error('Sale not found');
    return sale;
  }

  /**
   * FIXED: Cancel now creates a proper accounting reversal entry.
   * The original entry is NOT deleted — a new reversal entry is posted.
   * Inventory stock is NOT restored on cancellation (goods already dispatched).
   * For stock restoration, use Sales Return workflow.
   */
  async deleteSale(id, companyId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const sale = await Sales.findOne({ _id: id, companyId }).session(session);
      if (!sale) throw new Error('Sale not found');

      if (sale.status === 'active' || sale.status === 'partial') {
        // Post reversal accounting entry
        if (sale.accountingEntryId) {
          const originalEntry = await AccountingEntry.findById(sale.accountingEntryId).session(session);
          if (originalEntry && !originalEntry.isReversed) {
            const accountingService = require('./accountingService');
            const entryNo = await accountingService.generateEntryNo(companyId, 'JNL', session);

            // Flip Dr/Cr for reversal
            const reversalLines = originalEntry.lines.map(line => ({
              ledgerId: line.ledgerId,
              ledgerName: line.ledgerName,
              type: line.type === 'Dr' ? 'Cr' : 'Dr',
              amount: line.amount,
              narration: `Reversal: ${line.narration || ''}`
            }));

            const reversalEntry = await AccountingEntry.create([{
              companyId,
              entryNo,
              entryDate: new Date(),
              voucherType: 'SalesAuto',
              refType: 'SalesInvoice',
              refId: sale._id,
              lines: reversalLines,
              narration: `Reversal of Sales Invoice #${sale.invoiceNo}`,
              isReversed: false
            }], { session });

            // Mark original entry as reversed
            await AccountingEntry.findByIdAndUpdate(
              originalEntry._id,
              { isReversed: true, reversalEntryId: reversalEntry[0]._id },
              { session }
            );
          }
        }

        sale.status = 'cancelled';
        await sale.save({ session });
        await session.commitTransaction();
        return sale;
      }

      // Hard delete if already cancelled
      await Sales.findOneAndUpdate(
        { _id: id, companyId },
        { isDeleted: true, deletedAt: new Date() },
        { session }
      );
      await session.commitTransaction();
      return { message: 'Sale deleted' };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}

module.exports = new SalesService();
