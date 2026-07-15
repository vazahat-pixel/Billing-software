const mongoose = require('mongoose');
const Counter = require('../models/Counter');
const Party = require('../models/Party');
const Item = require('../models/Item');
const Order = require('../models/Order');
const SalesQuotation = require('../models/SalesQuotation');
const DeliveryChallan = require('../models/DeliveryChallan');
const StockReservation = require('../models/StockReservation');
const InventoryLot = require('../models/InventoryLot');
const Sales = require('../models/Sales');
const ReturnInvoice = require('../models/ReturnInvoice');
const AppError = require('../utils/AppError');
const { assertRefs } = require('../utils/refIntegrity');
const { recalcSalesTotals } = require('../utils/salesTotals');
const {
  availableMtrs,
  applyLotMovement,
  loadLotForUpdate,
} = require('../utils/inventoryStockHelper');
const salesService = require('./salesService');
const eventBus = require('../events/eventBus');

async function nextNo(companyId, prefix, session = null) {
  const fy = `${new Date().getFullYear().toString().slice(2)}`;
  const seq = await Counter.nextSeq(`${prefix}-${fy}-${companyId}`, session);
  return `${prefix}-${fy}-${String(seq).padStart(4, '0')}`;
}

async function reserveOnLot(session, companyId, { lotId, reservedMts, reservedPcs = 0, referenceId, remarks }) {
  const lot = await loadLotForUpdate(session, lotId, companyId);
  if (availableMtrs(lot) < reservedMts) {
    throw AppError.badRequest(
      `Cannot reserve ${reservedMts} mtrs — only ${availableMtrs(lot)} available on lot ${lot.lotId}`
    );
  }
  const reservationNo = await nextNo(companyId, 'RSV', session);
  const [reservation] = await StockReservation.create(
    [
      {
        companyId,
        reservationNo,
        lotId: lot._id,
        itemId: lot.itemId,
        reservedMts: Number(reservedMts),
        reservedPcs: Number(reservedPcs || 0),
        referenceType: 'SalesOrder',
        referenceId: referenceId || null,
        status: 'Active',
        remarks: remarks || '',
      },
    ],
    { session }
  );
  lot.reservedMtrs = Number(((lot.reservedMtrs || 0) + reservedMts).toFixed(4));
  lot.reservedPcs = (lot.reservedPcs || 0) + Number(reservedPcs || 0);
  await lot.save({ session });
  return reservation;
}

/**
 * Release reservation qty then deduct physical stock (challan dispatch).
 * Fixes reserved→available handoff before SALE movement.
 */
async function consumeReservationForChallan(session, companyId, reservationId, qtyMts, qtyPcs, challanId, challanNo) {
  const reservation = await StockReservation.findOne({
    _id: reservationId,
    companyId,
    status: 'Active',
  }).session(session);
  if (!reservation) throw AppError.badRequest('Active reservation not found for challan line');

  const consumeMts = Math.min(Number(qtyMts), reservation.reservedMts);
  const lot = await loadLotForUpdate(session, reservation.lotId, companyId);

  lot.reservedMtrs = Math.max(0, Number(((lot.reservedMtrs || 0) - consumeMts).toFixed(4)));
  lot.reservedPcs = Math.max(0, (lot.reservedPcs || 0) - Number(qtyPcs || 0));
  await lot.save({ session });

  await applyLotMovement({
    session,
    lot,
    companyId,
    deltaMts: -consumeMts,
    deltaPcs: -(qtyPcs || 0),
    type: 'SALE',
    referenceId: challanId,
    idempotencyKey: `CHALLAN:${challanId}:${lot._id}`,
    remarks: `Delivery Challan ${challanNo}`,
  });

  if (Math.abs(consumeMts - reservation.reservedMts) < 0.0001) {
    reservation.status = 'Consumed';
  } else {
    reservation.reservedMts = Number((reservation.reservedMts - consumeMts).toFixed(4));
  }
  await reservation.save({ session });
  return { lot, consumeMts };
}

class SalesEngineService {
  async pipeline(companyId) {
    const [quotes, orders, challans, invoices] = await Promise.all([
      SalesQuotation.countDocuments({ companyId, status: { $in: ['Draft', 'Sent', 'Accepted'] } }),
      Order.countDocuments({ companyId, orderType: 'Sales', status: { $in: ['Approved', 'Open', 'Partial'] } }),
      DeliveryChallan.countDocuments({ companyId, status: 'Dispatched' }),
      Sales.countDocuments({ companyId, status: { $in: ['active', 'partial'] } }),
    ]);
    return { openQuotes: quotes, openOrders: orders, pendingChallans: challans, openInvoices: invoices };
  }

  // ─── Quotation ─────────────────────────────────────────────
  async listQuotations(companyId, { status } = {}) {
    const filter = { companyId };
    if (status) filter.status = status;
    return SalesQuotation.find(filter)
      .populate('customerId', 'name gstin')
      .populate('items.itemId', 'name')
      .sort({ date: -1 });
  }

  async createQuotation(companyId, data) {
    const items = (data.items || []).map((l) => ({
      itemId: l.itemId,
      lotId: l.lotId || null,
      pcs: Number(l.pcs || 0),
      mts: Number(l.mts || 0),
      rate: Number(l.rate || 0),
      amount: Number(l.amount || (l.mts || 0) * (l.rate || 0)),
    }));
    if (!items.length) throw AppError.badRequest('Quote items required');
    await assertRefs(companyId, [
      { Model: Party, id: data.customerId, label: 'Customer' },
      ...items.map((i) => ({ Model: Item, id: i.itemId, label: 'Item' })),
    ]);

    const quoteNo = data.quoteNo || (await nextNo(companyId, 'SQ'));
    return SalesQuotation.create({
      companyId,
      quoteNo,
      customerId: data.customerId,
      date: data.date || new Date(),
      validUntil: data.validUntil || null,
      remarks: data.remarks || '',
      items,
      totalAmount: items.reduce((s, i) => s + i.amount, 0),
      status: data.send ? 'Sent' : 'Draft',
    });
  }

  async acceptQuotation(companyId, id, accept = true) {
    const quote = await SalesQuotation.findOne({
      _id: id,
      companyId,
      status: { $in: ['Draft', 'Sent'] },
    });
    if (!quote) throw AppError.badRequest('Quotation not found or not acceptable');
    quote.status = accept ? 'Accepted' : 'Rejected';
    await quote.save();
    return quote;
  }

  async convertQuotationToOrder(companyId, quoteId, userId, extras = {}) {
    const quote = await SalesQuotation.findOne({
      _id: quoteId,
      companyId,
      status: { $in: ['Accepted', 'Sent'] },
    });
    if (!quote) throw AppError.badRequest('Quotation not found or not convertible');

    const order = await this.createSalesOrder(companyId, {
      partyId: quote.customerId,
      salesQuotationId: quote._id,
      items: quote.items.map((i) => ({
        itemId: i.itemId,
        lotId: i.lotId,
        pcs: i.pcs,
        mts: i.mts,
        rate: i.rate,
        amount: i.amount,
      })),
      remarks: extras.remarks || quote.remarks,
      approve: extras.approve !== false,
    }, userId);

    quote.status = 'Converted';
    quote.convertedOrderId = order._id;
    await quote.save();
    return order;
  }

  // ─── Sales Order ───────────────────────────────────────────
  async listSalesOrders(companyId, { status } = {}) {
    const filter = { companyId, orderType: 'Sales' };
    if (status) filter.status = status;
    return Order.find(filter)
      .populate('partyId', 'name gstin')
      .populate('items.itemId', 'name')
      .populate('items.lotId', 'lotId remainingMtrs')
      .sort({ date: -1 });
  }

  async createSalesOrder(companyId, data, userId) {
    const items = (data.items || []).map((l) => ({
      itemId: l.itemId,
      lotId: l.lotId || null,
      pcs: Number(l.pcs || 0),
      mts: Number(l.mts || 0),
      rate: Number(l.rate || 0),
      amount: Number(l.amount || (l.mts || 0) * (l.rate || 0)),
      shippedMts: 0,
      shippedPcs: 0,
      invoicedMts: 0,
      invoicedPcs: 0,
    }));
    if (!items.length) throw AppError.badRequest('Order items required');
    await assertRefs(companyId, [
      { Model: Party, id: data.partyId, label: 'Customer' },
      ...items.map((i) => ({ Model: Item, id: i.itemId, label: 'Item' })),
    ]);

    const orderNo = data.orderNo || (await nextNo(companyId, 'SO'));
    const approve = data.approve !== false;
    const status = approve ? 'Approved' : 'PendingApproval';

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const [order] = await Order.create(
        [
          {
            companyId,
            orderType: 'Sales',
            orderNo,
            partyId: data.partyId,
            date: data.date || new Date(),
            expectedDate: data.expectedDate || null,
            salesQuotationId: data.salesQuotationId || null,
            warehouseId: data.warehouseId || null,
            paymentTerms: data.paymentTerms || '',
            creditDays: data.creditDays || 0,
            transport: data.transport || '',
            remarks: data.remarks || '',
            items,
            totalAmount: items.reduce((s, i) => s + i.amount, 0),
            status,
            packingStatus: 'Pending',
            approvedBy: approve ? userId || null : null,
            approvedAt: approve ? new Date() : null,
          },
        ],
        { session }
      );

      if (approve) {
        for (const line of order.items) {
          if (!line.lotId || !line.mts) continue;
          const reservation = await reserveOnLot(session, companyId, {
            lotId: line.lotId,
            reservedMts: line.mts,
            reservedPcs: line.pcs || 0,
            referenceId: order._id,
            remarks: `SO ${order.orderNo}`,
          });
          line.reservationId = reservation._id;
        }
        await order.save({ session });
      }

      await session.commitTransaction();
      try {
        eventBus.emitSafe('sales.order.created', { companyId, orderId: order._id, orderNo: order.orderNo });
      } catch {
        /* optional */
      }
      return order;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  async approveSalesOrder(companyId, orderId, userId, approve = true) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const order = await Order.findOne({
        _id: orderId,
        companyId,
        orderType: 'Sales',
        status: { $in: ['Draft', 'PendingApproval'] },
      }).session(session);
      if (!order) throw AppError.badRequest('Order not found or not pending approval');

      if (!approve) {
        order.status = 'Rejected';
        await order.save({ session });
        await session.commitTransaction();
        return order;
      }

      for (const line of order.items) {
        if (!line.lotId || !line.mts || line.reservationId) continue;
        const reservation = await reserveOnLot(session, companyId, {
          lotId: line.lotId,
          reservedMts: line.mts,
          reservedPcs: line.pcs || 0,
          referenceId: order._id,
          remarks: `SO ${order.orderNo}`,
        });
        line.reservationId = reservation._id;
      }

      order.status = 'Approved';
      order.approvedBy = userId || null;
      order.approvedAt = new Date();
      order.packingStatus = 'Picking';
      await order.save({ session });
      await session.commitTransaction();
      return order;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  async updatePacking(companyId, orderId, packingStatus) {
    const allowed = ['Pending', 'Picking', 'Packed', 'Dispatched'];
    if (!allowed.includes(packingStatus)) throw AppError.badRequest('Invalid packing status');
    const order = await Order.findOneAndUpdate(
      { _id: orderId, companyId, orderType: 'Sales' },
      { packingStatus },
      { new: true }
    );
    if (!order) throw AppError.notFound('Sales order not found');
    return order;
  }

  // ─── Delivery Challan ──────────────────────────────────────
  async listChallans(companyId, { status, orderId } = {}) {
    const filter = { companyId };
    if (status) filter.status = status;
    if (orderId) filter.orderId = orderId;
    return DeliveryChallan.find(filter)
      .populate('customerId', 'name')
      .populate('orderId', 'orderNo')
      .populate('items.itemId', 'name')
      .populate('items.lotId', 'lotId')
      .sort({ date: -1 });
  }

  async createChallanFromOrder(companyId, data) {
    const { orderId, transport, station, lrNo, lrDate, eway, remarks } = data;
    if (!orderId) throw AppError.badRequest('orderId required');

    const order = await Order.findOne({
      _id: orderId,
      companyId,
      orderType: 'Sales',
      status: { $in: ['Approved', 'Open', 'Partial'] },
    });
    if (!order) throw AppError.badRequest('Approved sales order not found');

    const shipLines =
      data.items?.length
        ? data.items
        : order.items
            .filter((ol) => (ol.mts || 0) - (ol.shippedMts || 0) > 0.0001)
            .map((ol) => ({
              orderLineId: ol._id,
              itemId: ol.itemId,
              lotId: ol.lotId,
              mts: Number(((ol.mts || 0) - (ol.shippedMts || 0)).toFixed(4)),
              pcs: Math.max(0, (ol.pcs || 0) - (ol.shippedPcs || 0)),
              rate: ol.rate,
            }));

    const lines = shipLines.map((l) => {
      const orderLine = order.items.id(l.orderLineId) || order.items.find(
        (ol) => String(ol.itemId) === String(l.itemId) && (!l.lotId || String(ol.lotId) === String(l.lotId))
      );
      const lotId = l.lotId || orderLine?.lotId;
      const mts = Number(l.mts || 0);
      if (!lotId || mts <= 0) throw AppError.badRequest('Each challan line needs lotId and mts');

      const ordered = orderLine?.mts || mts;
      const shipped = orderLine?.shippedMts || 0;
      const remaining = ordered - shipped;
      if (mts - remaining > 0.0001) {
        throw AppError.badRequest(`Cannot ship ${mts} — only ${remaining.toFixed(2)} remaining on order line`);
      }

      return {
        itemId: l.itemId || orderLine.itemId,
        lotId,
        pcs: Number(l.pcs || 0),
        mts,
        rate: Number(l.rate ?? orderLine?.rate ?? 0),
        amount: Number(l.amount || mts * (l.rate ?? orderLine?.rate ?? 0)),
        reservationId: orderLine?.reservationId || null,
        _orderLine: orderLine,
      };
    });

    if (!lines.length) throw AppError.badRequest('Challan items required');

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const challanNo = data.challanNo || (await nextNo(companyId, 'DC', session));
      const [challan] = await DeliveryChallan.create(
        [
          {
            companyId,
            challanNo,
            customerId: order.partyId,
            orderId: order._id,
            date: data.date || new Date(),
            transport: transport || order.transport || '',
            station: station || '',
            lrNo: lrNo || '',
            lrDate: lrDate || null,
            eway: eway || '',
            remarks: remarks || '',
            items: lines.map(({ _orderLine, ...rest }) => rest),
            status: 'Dispatched',
            stockDeducted: false,
          },
        ],
        { session }
      );

      // Deduct stock once at challan (consume reservation → SALE movement)
      for (const line of challan.items) {
        if (line.reservationId) {
          await consumeReservationForChallan(
            session,
            companyId,
            line.reservationId,
            line.mts,
            line.pcs,
            challan._id,
            challan.challanNo
          );
        } else {
          const lot = await loadLotForUpdate(session, line.lotId, companyId);
          await applyLotMovement({
            session,
            lot,
            companyId,
            deltaMts: -line.mts,
            deltaPcs: -(line.pcs || 0),
            type: 'SALE',
            referenceId: challan._id,
            idempotencyKey: `CHALLAN:${challan._id}:${lot._id}`,
            remarks: `Delivery Challan ${challan.challanNo}`,
          });
        }
      }

      challan.stockDeducted = true;
      await challan.save({ session });

      for (const line of lines) {
        if (line._orderLine) {
          line._orderLine.shippedMts = Number(((line._orderLine.shippedMts || 0) + line.mts).toFixed(4));
          line._orderLine.shippedPcs = (line._orderLine.shippedPcs || 0) + (line.pcs || 0);
        }
      }
      const allShipped = order.items.every((ol) => (ol.shippedMts || 0) + 0.0001 >= (ol.mts || 0));
      order.status = allShipped ? 'Closed' : 'Partial';
      order.packingStatus = 'Dispatched';
      await order.save({ session });

      await session.commitTransaction();
      return challan;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  // ─── Invoice from Challan (no double stock) ────────────────
  async convertChallanToInvoice(companyId, challanId, extras = {}) {
    const challan = await DeliveryChallan.findOne({
      _id: challanId,
      companyId,
      status: 'Dispatched',
    });
    if (!challan) throw AppError.badRequest('Dispatched challan not found');
    if (challan.salesId) throw AppError.badRequest('Challan already invoiced');

    let defaultGstRate = 5;
    const firstItem = await Item.findOne({ _id: challan.items[0]?.itemId, companyId }).select('gstRate');
    if (firstItem?.gstRate != null) defaultGstRate = firstItem.gstRate;

    const gstType = extras.gstType || 'CGST+SGST';
    const totals = recalcSalesTotals(
      challan.items.map((i) => ({
        itemId: i.itemId,
        lotId: i.lotId,
        pcs: i.pcs,
        mts: i.mts,
        rate: i.rate,
        discount: 0,
      })),
      { gstType, gstRate: extras.gstRate ?? defaultGstRate, extras }
    );

    const salesData = {
      companyId,
      customerId: challan.customerId,
      date: extras.date || new Date(),
      orderId: challan.orderId,
      orderNo: extras.orderNo || '',
      challanId: challan._id,
      challanNo: challan.challanNo,
      chDate: challan.date,
      stockFromChallan: true,
      invoiceType: extras.invoiceType || 'Tax',
      transport: challan.transport,
      station: challan.station,
      lrNo: challan.lrNo,
      lrDate: challan.lrDate,
      eway: challan.eway || extras.eway || '',
      remarks: extras.remarks || challan.remarks,
      items: totals.items,
      taxableAmount: totals.taxableAmount,
      gstType: totals.gstType,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      gstAmount: totals.gstAmount,
      netAmount: totals.netAmount,
      status: 'active',
    };

    if (challan.orderId) {
      const order = await Order.findById(challan.orderId);
      if (order) {
        salesData.orderNo = order.orderNo;
        salesData.orderDate = order.date;
      }
    }

    // Kernel: create invoice WITHOUT stock deduction (already at challan)
    const sales = await salesService.createInvoice(salesData, { skipStock: true });

    challan.status = 'Invoiced';
    challan.salesId = sales._id;
    challan.invoiceNo = sales.invoiceNo;
    await challan.save();

    if (challan.orderId) {
      const order = await Order.findOne({ _id: challan.orderId, companyId });
      if (order) {
        for (const cl of challan.items) {
          const ol = order.items.find(
            (x) => String(x.itemId) === String(cl.itemId) && String(x.lotId || '') === String(cl.lotId || '')
          );
          if (ol) {
            ol.invoicedMts = Number(((ol.invoicedMts || 0) + cl.mts).toFixed(4));
            ol.invoicedPcs = (ol.invoicedPcs || 0) + (cl.pcs || 0);
          }
        }
        await order.save();
      }
    }

    return { sales, challan };
  }

  // ─── Direct invoice with server totals (legacy path) ───────
  async createDirectInvoice(companyId, body) {
    const gstType = body.gstType || 'CGST+SGST';
    let gstRate = body.gstRate;
    if (gstRate == null && body.items?.[0]?.itemId) {
      const it = await Item.findOne({ _id: body.items[0].itemId, companyId }).select('gstRate');
      gstRate = it?.gstRate ?? 5;
    }
    const totals = recalcSalesTotals(body.items || [], { gstType, gstRate: gstRate ?? 5, extras: body });
    return salesService.createInvoice({
      ...body,
      companyId,
      items: totals.items,
      taxableAmount: totals.taxableAmount,
      gstType: totals.gstType,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      gstAmount: totals.gstAmount,
      netAmount: totals.netAmount,
      stockFromChallan: false,
    });
  }

  // ─── Sales return restore original lot ─────────────────────
  async createSalesReturn(companyId, data) {
    const { partyId, items, originalSaleId, originalInvoiceNo, restoreMode = 'restore_lot' } = data;
    if (!partyId || !items?.length) throw AppError.badRequest('partyId and items required');

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const invoiceNo = data.invoiceNo || (await nextNo(companyId, 'SR', session));
      const taxableAmount = items.reduce((s, i) => s + Number(i.amount || (i.mts || 0) * (i.rate || 0)), 0);
      const gstAmount = Number(data.gstAmount ?? taxableAmount * 0.05);
      const netAmount = Number(data.netAmount ?? taxableAmount + gstAmount);

      const [ret] = await ReturnInvoice.create(
        [
          {
            companyId,
            returnType: 'Sales',
            invoiceNo,
            originalInvoiceNo: originalInvoiceNo || '',
            originalSaleId: originalSaleId || null,
            partyId,
            date: data.date || new Date(),
            items: items.map((i) => ({
              itemId: i.itemId,
              lotId: i.lotId || null,
              pcs: i.pcs || 0,
              mts: i.mts || 0,
              rate: i.rate || 0,
              amount: i.amount || (i.mts || 0) * (i.rate || 0),
            })),
            taxableAmount,
            gstAmount,
            netAmount,
            restoreMode,
          },
        ],
        { session }
      );

      for (const item of items) {
        if (!item.mts) continue;
        if (restoreMode === 'restore_lot' && item.lotId) {
          const lot = await loadLotForUpdate(session, item.lotId, companyId);
          await applyLotMovement({
            session,
            lot,
            companyId,
            deltaMts: Number(item.mts),
            deltaPcs: Number(item.pcs || 0),
            type: 'RETURN',
            referenceId: ret._id,
            idempotencyKey: `SALE-RET:${ret._id}:${lot._id}`,
            remarks: `Sales Return ${invoiceNo}`,
          });
          // bump totalMtrs if restored beyond original total window
          if (lot.remainingMtrs > lot.totalMtrs) {
            lot.totalMtrs = lot.remainingMtrs;
            await lot.save({ session });
          }
        } else if (item.itemId) {
          const [newLot] = await InventoryLot.create(
            [
              {
                lotId: `RET-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`,
                itemId: item.itemId,
                source: 'return',
                totalPcs: item.pcs || 0,
                remainingPcs: 0,
                totalMtrs: item.mts,
                remainingMtrs: 0,
                status: 'Available',
                companyId,
              },
            ],
            { session }
          );
          await applyLotMovement({
            session,
            lot: newLot,
            companyId,
            deltaMts: Number(item.mts),
            deltaPcs: Number(item.pcs || 0),
            type: 'RETURN',
            referenceId: ret._id,
            idempotencyKey: `SALE-RET-NEW:${ret._id}:${newLot._id}`,
            remarks: `Sales Return ${invoiceNo}`,
          });
        }
      }

      const accountingService = require('./accountingService');
      const entryNo = await accountingService.generateEntryNo(companyId, 'JNL', session);
      const partyLedger = await accountingService.getOrCreatePartyLedger(companyId, partyId);
      const salesLedger = await accountingService.getSystemLedger(companyId, 'Sales A/c');
      const cgstLedger = await accountingService.getSystemLedger(companyId, 'CGST Output');
      const sgstLedger = await accountingService.getSystemLedger(companyId, 'SGST Output');
      const halfGst = parseFloat((gstAmount / 2).toFixed(2));
      const otherHalf = parseFloat((gstAmount - halfGst).toFixed(2));

      const AccountingEntry = require('../models/AccountingEntry');
      await AccountingEntry.create(
        [
          {
            companyId,
            entryNo,
            entryDate: data.date || new Date(),
            voucherType: 'ReturnAuto',
            refType: 'SalesReturn',
            refId: ret._id,
            lines: [
              { ledgerId: salesLedger._id, ledgerName: salesLedger.name, type: 'Dr', amount: taxableAmount, narration: `Sales Return #${invoiceNo}` },
              ...(gstAmount > 0
                ? [
                    { ledgerId: cgstLedger._id, ledgerName: cgstLedger.name, type: 'Dr', amount: halfGst, narration: 'CGST Output reverse' },
                    { ledgerId: sgstLedger._id, ledgerName: sgstLedger.name, type: 'Dr', amount: otherHalf, narration: 'SGST Output reverse' },
                  ]
                : []),
              { ledgerId: partyLedger._id, ledgerName: partyLedger.name, type: 'Cr', amount: netAmount, narration: `Credit customer #${invoiceNo}` },
            ],
            narration: `Auto posted Sales Return #${invoiceNo}`,
          },
        ],
        { session }
      );

      await session.commitTransaction();
      return ret;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }
}

module.exports = new SalesEngineService();
