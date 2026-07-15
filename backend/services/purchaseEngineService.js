const mongoose = require('mongoose');
const Counter = require('../models/Counter');
const PurchaseIndent = require('../models/PurchaseIndent');
const SupplierQuotation = require('../models/SupplierQuotation');
const Order = require('../models/Order');
const Grn = require('../models/Grn');
const Party = require('../models/Party');
const Item = require('../models/Item');
const AppError = require('../utils/AppError');
const { assertRefs } = require('../utils/refIntegrity');
const purchaseService = require('./purchaseService');
const auditService = require('./auditService');
const eventBus = require('../events/eventBus');

async function nextNo(companyId, prefix, session = null) {
  const fy = `${new Date().getFullYear().toString().slice(2)}`;
  const seq = await Counter.nextSeq(`${prefix}-${fy}-${companyId}`, session);
  return `${prefix}-${fy}-${String(seq).padStart(4, '0')}`;
}

class PurchaseEngineService {
  // ─── Indent ───────────────────────────────────────────────
  async listIndents(companyId, { status } = {}) {
    const filter = { companyId };
    if (status) filter.status = status;
    return PurchaseIndent.find(filter).populate('items.itemId', 'name unit').sort({ date: -1 });
  }

  async createIndent(companyId, data, userId) {
    const items = (data.items || []).map((l) => ({
      itemId: l.itemId,
      pcs: Number(l.pcs || 0),
      mts: Number(l.mts || 0),
      rate: Number(l.rate || 0),
      amount: Number(l.amount || (l.mts || 0) * (l.rate || 0)),
      remarks: l.remarks || '',
    }));
    if (!items.length) throw AppError.badRequest('Indent items required');
    await assertRefs(companyId, items.map((i) => ({ Model: Item, id: i.itemId, label: 'Item' })));

    const indentNo = data.indentNo || (await nextNo(companyId, 'IND'));
    return PurchaseIndent.create({
      companyId,
      indentNo,
      date: data.date || new Date(),
      requestedBy: userId || null,
      department: data.department || '',
      remarks: data.remarks || '',
      items,
      status: data.submit ? 'Submitted' : 'Draft',
    });
  }

  async submitIndent(id, companyId) {
    const indent = await PurchaseIndent.findOneAndUpdate(
      { _id: id, companyId, status: { $in: ['Draft', 'Rejected'] } },
      { status: 'Submitted' },
      { new: true }
    );
    if (!indent) throw AppError.badRequest('Indent not found or not submittable');
    return indent;
  }

  async approveIndent(id, companyId, userId, approve = true) {
    const indent = await PurchaseIndent.findOne({ _id: id, companyId, status: 'Submitted' });
    if (!indent) throw AppError.badRequest('Indent not found or not pending approval');
    indent.status = approve ? 'Approved' : 'Rejected';
    indent.approvedBy = userId || null;
    indent.approvedAt = new Date();
    await indent.save();
    return indent;
  }

  // ─── Quotation ────────────────────────────────────────────
  async listQuotations(companyId, { indentId, supplierId } = {}) {
    const filter = { companyId };
    if (indentId) filter.indentId = indentId;
    if (supplierId) filter.supplierId = supplierId;
    return SupplierQuotation.find(filter)
      .populate('supplierId', 'name')
      .populate('items.itemId', 'name')
      .sort({ date: -1 });
  }

  async createQuotation(companyId, data) {
    await assertRefs(companyId, [
      { Model: Party, id: data.supplierId, label: 'Supplier' },
      ...((data.items || []).map((i) => ({ Model: Item, id: i.itemId, label: 'Item' }))),
    ]);
    const items = (data.items || []).map((l) => ({
      itemId: l.itemId,
      pcs: Number(l.pcs || 0),
      mts: Number(l.mts || 0),
      rate: Number(l.rate || 0),
      amount: Number(l.amount || (l.mts || 0) * (l.rate || 0)),
      leadDays: Number(l.leadDays || 0),
    }));
    const totalAmount = items.reduce((s, i) => s + (i.amount || 0), 0);
    const quoteNo = data.quoteNo || (await nextNo(companyId, 'SQ'));
    return SupplierQuotation.create({
      companyId,
      quoteNo,
      indentId: data.indentId || null,
      supplierId: data.supplierId,
      date: data.date || new Date(),
      validUntil: data.validUntil || null,
      items,
      totalAmount,
      remarks: data.remarks || '',
    });
  }

  async compareQuotations(companyId, indentId) {
    const quotes = await this.listQuotations(companyId, { indentId });
    const byItem = {};
    for (const q of quotes) {
      for (const line of q.items || []) {
        const key = String(line.itemId?._id || line.itemId);
        if (!byItem[key]) byItem[key] = [];
        byItem[key].push({
          quoteId: q._id,
          quoteNo: q.quoteNo,
          supplierId: q.supplierId,
          rate: line.rate,
          amount: line.amount,
          mts: line.mts,
          leadDays: line.leadDays,
          status: q.status,
        });
      }
    }
    Object.values(byItem).forEach((rows) => rows.sort((a, b) => a.rate - b.rate));
    return { indentId, quotes, comparison: byItem };
  }

  async selectQuotation(companyId, quoteId) {
    const quote = await SupplierQuotation.findOne({ _id: quoteId, companyId });
    if (!quote) throw AppError.notFound('Quotation not found');
    if (quote.indentId) {
      await SupplierQuotation.updateMany(
        { companyId, indentId: quote.indentId, _id: { $ne: quoteId } },
        { status: 'Rejected' }
      );
    }
    quote.status = 'Selected';
    await quote.save();
    return quote;
  }

  // ─── Purchase Order (extends Order) ───────────────────────
  async createPurchaseOrder(companyId, data, userId) {
    await assertRefs(companyId, [
      { Model: Party, id: data.partyId || data.supplierId, label: 'Supplier' },
      ...((data.items || []).map((i) => ({ Model: Item, id: i.itemId, label: 'Item' }))),
    ]);

    const items = (data.items || []).map((l) => ({
      itemId: l.itemId,
      pcs: Number(l.pcs || 0),
      mts: Number(l.mts || 0),
      rate: Number(l.rate || 0),
      amount: Number(l.amount || (l.mts || 0) * (l.rate || 0)),
      receivedMts: 0,
      receivedPcs: 0,
    }));
    if (!items.length) throw AppError.badRequest('PO items required');
    const totalAmount = items.reduce((s, i) => s + (i.amount || 0), 0);
    const orderNo = data.orderNo || (await nextNo(companyId, 'PO'));
    const needsApproval = data.requireApproval !== false;

    const order = await Order.create({
      companyId,
      orderType: 'Purchase',
      orderNo,
      partyId: data.partyId || data.supplierId,
      date: data.date || new Date(),
      expectedDate: data.expectedDate || null,
      indentId: data.indentId || null,
      quotationId: data.quotationId || null,
      warehouseId: data.warehouseId || null,
      paymentTerms: data.paymentTerms || '',
      creditDays: Number(data.creditDays || 0),
      transport: data.transport || '',
      remarks: data.remarks || '',
      items,
      totalAmount: data.totalAmount || totalAmount,
      status: needsApproval ? 'PendingApproval' : 'Approved',
      approvedBy: needsApproval ? null : userId || null,
      approvedAt: needsApproval ? null : new Date(),
    });

    if (data.indentId) {
      await PurchaseIndent.findOneAndUpdate(
        { _id: data.indentId, companyId },
        { status: 'Converted', purchaseOrderId: order._id }
      );
    }
    if (data.quotationId) {
      await SupplierQuotation.findOneAndUpdate(
        { _id: data.quotationId, companyId },
        { status: 'Selected' }
      );
    }

    eventBus.emitSafe('purchase.order.created', {
      companyId: String(companyId),
      orderId: order._id?.toString?.(),
      orderNo: order.orderNo,
    });
    return order;
  }

  async approvePurchaseOrder(id, companyId, userId, approve = true) {
    const order = await Order.findOne({
      _id: id,
      companyId,
      orderType: 'Purchase',
      status: 'PendingApproval',
    });
    if (!order) throw AppError.badRequest('PO not pending approval');
    order.status = approve ? 'Approved' : 'Rejected';
    order.approvedBy = userId || null;
    order.approvedAt = new Date();
    await order.save();
    return order;
  }

  async listPurchaseOrders(companyId, { status } = {}) {
    const filter = { companyId, orderType: 'Purchase' };
    if (status) filter.status = status;
    return Order.find(filter)
      .populate('partyId', 'name gstin')
      .populate('items.itemId', 'name unit')
      .sort({ date: -1 });
  }

  // ─── GRN ──────────────────────────────────────────────────
  async listGrns(companyId, { purchaseOrderId, status } = {}) {
    const filter = { companyId };
    if (purchaseOrderId) filter.purchaseOrderId = purchaseOrderId;
    if (status) filter.status = status;
    return Grn.find(filter)
      .populate('supplierId', 'name')
      .populate('purchaseOrderId', 'orderNo')
      .populate('items.itemId', 'name')
      .sort({ date: -1 });
  }

  async createGrnFromPo(companyId, data) {
    const order = await Order.findOne({
      _id: data.purchaseOrderId,
      companyId,
      orderType: 'Purchase',
    });
    if (!order) throw AppError.notFound('Purchase order not found');
    if (!['Approved', 'Open', 'Partial'].includes(order.status)) {
      throw AppError.badRequest(`PO status ${order.status} cannot receive goods`);
    }

    const lines = (data.items || []).map((l, idx) => {
      const poLine = order.items[l.orderItemIndex ?? idx] || order.items.find(
        (x) => String(x.itemId) === String(l.itemId)
      );
      if (!poLine) throw AppError.badRequest(`PO line not found for item ${l.itemId}`);
      const receivedMts = Number(l.receivedMts ?? l.mts ?? 0);
      const receivedPcs = Number(l.receivedPcs ?? l.pcs ?? 0);
      const remainingMts = Math.max(0, (poLine.mts || 0) - (poLine.receivedMts || 0));
      if (!data.allowOverReceive && receivedMts - remainingMts > 0.01) {
        throw AppError.badRequest(
          `Over-receive blocked for item: received ${receivedMts} > remaining ${remainingMts.toFixed(2)}`
        );
      }
      return {
        itemId: poLine.itemId,
        orderItemIndex: l.orderItemIndex ?? idx,
        orderedMts: poLine.mts || 0,
        orderedPcs: poLine.pcs || 0,
        receivedMts,
        receivedPcs,
        acceptedMts: 0,
        acceptedPcs: 0,
        rejectedMts: 0,
        rejectedPcs: 0,
        rate: Number(l.rate ?? poLine.rate ?? 0),
        qcStatus: 'Pending',
      };
    });

    if (!lines.length) throw AppError.badRequest('GRN items required');
    const grnNo = data.grnNo || (await nextNo(companyId, 'GRN'));

    const grn = await Grn.create({
      companyId,
      grnNo,
      purchaseOrderId: order._id,
      supplierId: order.partyId,
      warehouseId: data.warehouseId || order.warehouseId || null,
      date: data.date || new Date(),
      challanNo: data.challanNo || '',
      vehicleNo: data.vehicleNo || '',
      lrNo: data.lrNo || '',
      transport: data.transport || order.transport || '',
      ewayBillNo: data.ewayBillNo || '',
      items: lines,
      status: 'QC_Pending',
      remarks: data.remarks || '',
      allowOverReceive: !!data.allowOverReceive,
    });

    if (order.status === 'Approved') {
      order.status = 'Open';
      await order.save();
    }

    eventBus.emitSafe('purchase.grn.created', {
      companyId: String(companyId),
      grnId: grn._id?.toString?.(),
      grnNo: grn.grnNo,
    });
    return grn;
  }

  async performQc(companyId, grnId, { items, userId }) {
    const grn = await Grn.findOne({ _id: grnId, companyId });
    if (!grn) throw AppError.notFound('GRN not found');
    if (!['QC_Pending', 'Received', 'Draft'].includes(grn.status)) {
      throw AppError.badRequest(`GRN status ${grn.status} not open for QC`);
    }

    let allPassed = true;
    let anyAccepted = false;

    grn.items = grn.items.map((line, idx) => {
      const patch = (items || []).find((i) => i.orderItemIndex === idx || String(i.itemId) === String(line.itemId)) || {};
      const acceptedMts = Number(
        patch.acceptedMts != null ? patch.acceptedMts : line.receivedMts
      );
      const acceptedPcs = Number(
        patch.acceptedPcs != null ? patch.acceptedPcs : line.receivedPcs
      );
      const rejectedMts = Math.max(0, (line.receivedMts || 0) - acceptedMts);
      const rejectedPcs = Math.max(0, (line.receivedPcs || 0) - acceptedPcs);
      let qcStatus = 'Passed';
      if (acceptedMts <= 0 && (line.receivedMts || 0) > 0) qcStatus = 'Failed';
      else if (rejectedMts > 0.001) qcStatus = 'Partial';
      if (qcStatus === 'Failed') allPassed = false;
      if (acceptedMts > 0) anyAccepted = true;
      return {
        ...line.toObject?.() || line,
        acceptedMts,
        acceptedPcs,
        rejectedMts,
        rejectedPcs,
        qcStatus,
        qcRemarks: patch.qcRemarks || line.qcRemarks || '',
      };
    });

    if (!anyAccepted) {
      grn.status = 'QC_Failed';
    } else if (allPassed && grn.items.every((l) => l.qcStatus === 'Passed')) {
      grn.status = 'QC_Passed';
    } else {
      grn.status = 'QC_Passed'; // partial accept still billable on accepted qty
    }
    grn.qcBy = userId || null;
    grn.qcAt = new Date();
    await grn.save();
    return grn;
  }

  /**
   * Convert QC-passed GRN → Purchase Invoice via purchaseService kernel.
   * Enforces accepted qty caps vs remaining PO.
   */
  async convertGrnToInvoice(companyId, grnId, invoiceExtras = {}, userId) {
    const grn = await Grn.findOne({ _id: grnId, companyId });
    if (!grn) throw AppError.notFound('GRN not found');
    if (grn.status === 'Invoiced') throw AppError.conflict('GRN already invoiced');
    if (grn.status !== 'QC_Passed') {
      throw AppError.badRequest('GRN must be QC_Passed before invoicing');
    }

    const order = await Order.findOne({ _id: grn.purchaseOrderId, companyId });
    if (!order) throw AppError.notFound('Linked PO not found');

    const billItems = [];
    for (let idx = 0; idx < grn.items.length; idx++) {
      const line = grn.items[idx];
      const acceptedMts = Number(line.acceptedMts || 0);
      const acceptedPcs = Number(line.acceptedPcs || 0);
      if (acceptedMts <= 0 && acceptedPcs <= 0) continue;

      const poLine = order.items[line.orderItemIndex] || order.items[idx];
      if (!poLine) throw AppError.badRequest('PO line mismatch on convert');

      const remainingMts = (poLine.mts || 0) - (poLine.receivedMts || 0);
      if (!invoiceExtras.allowOverInvoice && acceptedMts - remainingMts > 0.01) {
        throw AppError.badRequest(
          `Invoice qty ${acceptedMts} exceeds PO remaining ${remainingMts.toFixed(2)}`
        );
      }

      const rate = Number(line.rate || poLine.rate || 0);
      const amount = Number((acceptedMts * rate).toFixed(2));
      const gstPer = Number(invoiceExtras.gstPer ?? 5);
      const gstAmt = Number(((amount * gstPer) / 100).toFixed(2));

      billItems.push({
        itemId: line.itemId,
        pcs: acceptedPcs,
        mts: acceptedMts,
        rate,
        amount,
        gstPer,
        gstAmt,
        discount: 0,
      });
    }

    if (!billItems.length) throw AppError.badRequest('No accepted qty to invoice');

    const taxableAmount = billItems.reduce((s, i) => s + (i.amount || 0), 0);
    const gstAmount = billItems.reduce((s, i) => s + (i.gstAmt || 0), 0);
    const freight = Number(invoiceExtras.freightAmount || 0);
    const other = Number(invoiceExtras.otherCharges || 0);
    const netAmount = Number(
      (taxableAmount + gstAmount + freight + other - Number(invoiceExtras.tdsAmount || 0)).toFixed(2)
    );

    const halfGst = Number((gstAmount / 2).toFixed(2));
    const gstType = invoiceExtras.gstType || 'CGST+SGST';

    const purchasePayload = {
      companyId,
      supplierId: grn.supplierId,
      invoiceNo: invoiceExtras.invoiceNo || 'AUTO',
      supplierInvoiceNo: invoiceExtras.supplierInvoiceNo || '',
      date: invoiceExtras.date || new Date(),
      bookId: invoiceExtras.bookId || null,
      challanNo: grn.challanNo || '',
      narration: invoiceExtras.narration || `From GRN ${grn.grnNo} / PO ${order.orderNo}`,
      items: billItems,
      taxableAmount,
      gstType,
      cgst: gstType === 'IGST' ? 0 : halfGst,
      sgst: gstType === 'IGST' ? 0 : Number((gstAmount - halfGst).toFixed(2)),
      igst: gstType === 'IGST' ? gstAmount : 0,
      gstAmount,
      netAmount,
      freightAmount: freight,
      otherCharges: other,
      tdsAmount: Number(invoiceExtras.tdsAmount || 0),
      vehicleNo: grn.vehicleNo || '',
      lrNo: grn.lrNo || '',
      transport: grn.transport || '',
      ewayBillNo: grn.ewayBillNo || '',
      purchaseOrderId: order._id,
      grnId: grn._id,
      status: 'active',
    };

    const purchase = await purchaseService.createPurchase(purchasePayload);

    // Update PO received qty + GRN status
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      for (let idx = 0; idx < grn.items.length; idx++) {
        const line = grn.items[idx];
        const acceptedMts = Number(line.acceptedMts || 0);
        const acceptedPcs = Number(line.acceptedPcs || 0);
        if (acceptedMts <= 0 && acceptedPcs <= 0) continue;
        const poIdx = line.orderItemIndex ?? idx;
        if (order.items[poIdx]) {
          order.items[poIdx].receivedMts = Number(
            ((order.items[poIdx].receivedMts || 0) + acceptedMts).toFixed(4)
          );
          order.items[poIdx].receivedPcs = (order.items[poIdx].receivedPcs || 0) + acceptedPcs;
        }
      }
      const fullyReceived = order.items.every(
        (l) => (l.receivedMts || 0) + 0.01 >= (l.mts || 0)
      );
      order.status = fullyReceived ? 'Closed' : 'Partial';
      await order.save({ session });

      grn.status = 'Invoiced';
      grn.purchaseId = purchase._id;
      await grn.save({ session });
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    await auditService.logSystem({
      companyId,
      userId,
      action: 'CONVERT',
      module: 'PurchaseEngine',
      referenceId: purchase._id,
      before: { grnId: grn._id, grnNo: grn.grnNo, orderNo: order.orderNo },
      after: { purchaseId: purchase._id, invoiceNo: purchase.invoiceNo },
      reason: 'GRN to Purchase Invoice',
    });

    eventBus.emitSafe('purchase.invoice.from_grn', {
      companyId: String(companyId),
      purchaseId: purchase._id?.toString?.(),
      grnId: String(grn._id),
    });

    return { purchase, grn, order };
  }

  /** Pipeline board for a company */
  async pipeline(companyId) {
    const [indents, pos, grns, quotes] = await Promise.all([
      PurchaseIndent.countDocuments({ companyId, status: { $in: ['Submitted', 'Approved'] } }),
      Order.countDocuments({
        companyId,
        orderType: 'Purchase',
        status: { $in: ['PendingApproval', 'Approved', 'Open', 'Partial'] },
      }),
      Grn.countDocuments({ companyId, status: { $in: ['QC_Pending', 'QC_Passed'] } }),
      SupplierQuotation.countDocuments({ companyId, status: 'Received' }),
    ]);
    return { pendingIndents: indents, openPOs: pos, pendingGrns: grns, openQuotes: quotes };
  }
}

module.exports = new PurchaseEngineService();
