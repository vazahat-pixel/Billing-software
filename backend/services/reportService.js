const InventoryLot = require('../models/InventoryLot');
const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');
const Party = require('../models/Party');
const Item = require('../models/Item');
const Job = require('../models/Job');
const PaymentVoucher = require('../models/PaymentVoucher');
const Book = require('../models/Book');

const buildDateQuery = (startDate, endDate, field = 'date') => {
  if (!startDate && !endDate) return {};
  const q = { [field]: {} };
  if (startDate) q[field].$gte = new Date(startDate);
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    q[field].$lte = end;
  }
  return q;
};

const paidAgainstDoc = async (companyId, docId) => {
  const vouchers = await PaymentVoucher.find({
    companyId,
    status: 'Posted',
    'againstInvoices.invoiceId': docId
  }).lean();
  return vouchers.reduce((sum, v) => {
    const match = (v.againstInvoices || []).find(
      (i) => String(i.invoiceId) === String(docId)
    );
    return sum + (match ? match.amount : 0);
  }, 0);
};

class ReportService {
  async getSalesRegister(companyId, startDate, endDate) {
    const sales = await Sales.find({
      companyId,
      status: { $ne: 'cancelled' },
      ...buildDateQuery(startDate, endDate)
    })
      .populate('customerId', 'name gstin mobile station')
      .populate('brokerId', 'name')
      .sort({ date: -1 })
      .lean();

    const rows = [];
    for (const s of sales) {
      const total = s.netAmount || s.totals?.total || 0;
      const paid = await paidAgainstDoc(companyId, s._id);
      rows.push({
        _id: s._id,
        invoiceNo: s.invoiceNo,
        date: s.date,
        partyName: s.customerId?.name || '—',
        gstin: s.customerId?.gstin || '',
        city: s.customerId?.station || s.station || '',
        broker: s.brokerId?.name || '',
        taxable: s.taxableAmount || 0,
        cgst: s.cgst || 0,
        sgst: s.sgst || 0,
        igst: s.igst || 0,
        gstAmount: s.gstAmount || 0,
        netAmount: total,
        paidAmount: paid,
        balance: Math.max(0, total - paid),
        status: s.status || 'active',
        itemCount: (s.items || []).length
      });
    }
    return rows;
  }

  async getPurchaseRegister(companyId, startDate, endDate) {
    const purchases = await Purchase.find({
      companyId,
      status: { $ne: 'cancelled' },
      ...buildDateQuery(startDate, endDate)
    })
      .populate('supplierId', 'name gstin mobile station')
      .populate('brokerId', 'name')
      .sort({ date: -1 })
      .lean();

    const rows = [];
    for (const p of purchases) {
      const total = p.netAmount || p.totals?.total || p.totalAmount || 0;
      const paid = await paidAgainstDoc(companyId, p._id);
      rows.push({
        _id: p._id,
        billNo: p.invoiceNo || p.billNo,
        suppBill: p.supplierInvoiceNo || '',
        date: p.date,
        partyName: p.supplierId?.name || '—',
        gstin: p.supplierId?.gstin || '',
        city: p.supplierId?.station || '',
        broker: p.brokerId?.name || '',
        taxable: p.taxableAmount || 0,
        cgst: p.cgst || 0,
        sgst: p.sgst || 0,
        igst: p.igst || 0,
        gstAmount: p.gstAmount || 0,
        netAmount: total,
        paidAmount: paid,
        balance: Math.max(0, total - paid),
        status: p.status || 'active',
        itemCount: (p.items || []).length
      });
    }
    return rows;
  }

  async getStockReport(companyId) {
    const lots = await InventoryLot.find({ companyId })
      .populate('itemId', 'itemName name group unit hsnCode')
      .sort({ lotId: 1 })
      .lean();

    return lots.map((l) => ({
      _id: l._id,
      lotId: l.lotId,
      itemName: (l.itemId?.itemName || l.itemId?.name || '—').toUpperCase(),
      group: l.itemId?.group || '',
      unit: l.itemId?.unit || 'MTRS',
      hsnCode: l.itemId?.hsnCode || '',
      totalPcs: l.totalPcs || 0,
      remainingPcs: l.remainingPcs || 0,
      totalMtrs: l.totalMtrs || 0,
      remainingMtrs: l.remainingMtrs || 0,
      usedMtrs: (l.totalMtrs || 0) - (l.remainingMtrs || 0),
      status: l.status,
      source: l.source || 'purchase',
      rate: l.rate || 0,
      value: (l.remainingMtrs || 0) * (l.rate || 0)
    }));
  }

  async getStockByItem(companyId) {
    const lots = await this.getStockReport(companyId);
    const map = {};
    lots.forEach((l) => {
      const key = l.itemName;
      if (!map[key]) {
        map[key] = {
          itemName: key,
          group: l.group,
          unit: l.unit,
          hsnCode: l.hsnCode,
          lotCount: 0,
          totalPcs: 0,
          totalMtrs: 0,
          usedMtrs: 0,
          remainingMtrs: 0,
          stockValue: 0
        };
      }
      map[key].lotCount += 1;
      map[key].totalPcs += l.remainingPcs || 0;
      map[key].totalMtrs += l.totalMtrs || 0;
      map[key].usedMtrs += l.usedMtrs || 0;
      map[key].remainingMtrs += l.remainingMtrs || 0;
      map[key].stockValue += l.value || 0;
    });
    return Object.values(map).sort((a, b) => a.itemName.localeCompare(b.itemName));
  }

  async getJobWorkReport(companyId, startDate, endDate) {
    const jobs = await Job.find({
      companyId,
      ...buildDateQuery(startDate, endDate, 'issueDate')
    })
      .populate('workerId', 'name mobile')
      .populate('lotId', 'lotId itemId')
      .sort({ issueDate: -1 })
      .lean();

    return jobs.map((j) => ({
      _id: j._id,
      jobCardNo: j.jobCardNo,
      issueDate: j.issueDate,
      receiveDate: j.receiveDate,
      workerName: j.workerId?.name || '—',
      processType: j.processType,
      lotId: j.lotId?.lotId || '—',
      issuePcs: j.issuePcs || 0,
      issueQty: j.issueQty || 0,
      receivedPcs: j.receivedPcs || 0,
      receivedQty: j.receivedQty || 0,
      wastage: j.wastage || 0,
      wastagePct: j.issueQty ? ((j.wastage || 0) / j.issueQty * 100).toFixed(1) : 0,
      status: j.status
    }));
  }

  async getOutstanding(companyId, type = 'receivable', asOn) {
    const isReceivable = type === 'receivable';
    const partyGroup = isReceivable ? 'Customer' : 'Supplier';
    const parties = await Party.find({ companyId, type: { $in: [partyGroup, 'Both'] } }).lean();
    const asOnDate = asOn ? new Date(asOn) : new Date();
    const lines = [];

    for (const party of parties) {
      const documents = isReceivable
        ? await Sales.find({ companyId, customerId: party._id, status: { $ne: 'cancelled' } }).lean()
        : await Purchase.find({ companyId, supplierId: party._id, status: { $ne: 'cancelled' } }).lean();

      let partyTotal = 0;
      const aging = { bucket30: 0, bucket60: 0, bucket90: 0, bucket90Plus: 0 };
      const invoices = [];

      for (const doc of documents) {
        const total = parseFloat(doc.netAmount || doc.totals?.total || doc.totalAmount || 0);
        const paid = await paidAgainstDoc(companyId, doc._id);
        const outstanding = total - paid;
        if (outstanding <= 0.01) continue;

        partyTotal += outstanding;
        const ageInDays = Math.floor((asOnDate - new Date(doc.date)) / 86400000);
        if (ageInDays <= 30) aging.bucket30 += outstanding;
        else if (ageInDays <= 60) aging.bucket60 += outstanding;
        else if (ageInDays <= 90) aging.bucket90 += outstanding;
        else aging.bucket90Plus += outstanding;

        invoices.push({
          docNo: doc.invoiceNo || doc.billNo,
          date: doc.date,
          total,
          paid,
          outstanding,
          ageDays: ageInDays
        });
      }

      if (partyTotal > 0.01) {
        lines.push({
          partyId: party._id,
          partyName: party.name,
          phone: party.mobile || party.phone,
          city: party.station || '',
          gstin: party.gstin || '',
          totalOutstanding: parseFloat(partyTotal.toFixed(2)),
          aging,
          invoices
        });
      }
    }
    return lines.sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  }

  async getProfitLoss(companyId, startDate, endDate) {
    const dateQ = buildDateQuery(startDate, endDate);
    const [sales, purchases] = await Promise.all([
      Sales.find({ companyId, status: { $ne: 'cancelled' }, ...dateQ }).lean(),
      Purchase.find({ companyId, status: { $ne: 'cancelled' }, ...dateQ }).lean()
    ]);

    const revenue = sales.reduce((a, s) => a + (s.taxableAmount || 0), 0);
    const salesGst = sales.reduce((a, s) => a + (s.gstAmount || 0), 0);
    const salesNet = sales.reduce((a, s) => a + (s.netAmount || 0), 0);
    const cogs = purchases.reduce((a, p) => a + (p.taxableAmount || 0), 0);
    const purchaseGst = purchases.reduce((a, p) => a + (p.gstAmount || 0), 0);
    const purchaseNet = purchases.reduce((a, p) => a + (p.netAmount || 0), 0);

    return {
      period: { startDate, endDate },
      salesCount: sales.length,
      purchaseCount: purchases.length,
      revenue: parseFloat(revenue.toFixed(2)),
      salesGst: parseFloat(salesGst.toFixed(2)),
      salesNet: parseFloat(salesNet.toFixed(2)),
      cogs: parseFloat(cogs.toFixed(2)),
      purchaseGst: parseFloat(purchaseGst.toFixed(2)),
      purchaseNet: parseFloat(purchaseNet.toFixed(2)),
      grossProfit: parseFloat((revenue - cogs).toFixed(2)),
      netProfit: parseFloat((salesNet - purchaseNet).toFixed(2))
    };
  }

  async getDailyTransactions(companyId, startDate, endDate) {
    const dateQ = buildDateQuery(startDate, endDate);
    const [sales, purchases, vouchers] = await Promise.all([
      Sales.find({ companyId, ...dateQ }).populate('customerId', 'name').lean(),
      Purchase.find({ companyId, ...dateQ }).populate('supplierId', 'name').lean(),
      PaymentVoucher.find({ companyId, status: 'Posted', ...buildDateQuery(startDate, endDate, 'date') }).lean()
    ]);

    const rows = [];
    sales.forEach((s) => rows.push({
      date: s.date,
      type: 'Sales',
      docNo: s.invoiceNo,
      party: s.customerId?.name || '—',
      debit: 0,
      credit: s.netAmount || 0,
      amount: s.netAmount || 0
    }));
    purchases.forEach((p) => rows.push({
      date: p.date,
      type: 'Purchase',
      docNo: p.invoiceNo,
      party: p.supplierId?.name || '—',
      debit: p.netAmount || 0,
      credit: 0,
      amount: p.netAmount || 0
    }));
    vouchers.forEach((v) => rows.push({
      date: v.date,
      type: v.voucherType || 'Voucher',
      docNo: v.voucherNo || v._id,
      party: v.partyName || '—',
      debit: v.voucherType === 'Payment' ? v.amount : 0,
      credit: v.voucherType === 'Receipt' ? v.amount : 0,
      amount: v.amount || 0
    }));

    return rows.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  async getMasterSummary(companyId) {
    const [accounts, items, books] = await Promise.all([
      Party.find({ companyId }).select('name type group station mobile gstin').lean(),
      Item.find({ companyId }).select('itemName name group unit hsnCode salesRate purRate').lean(),
      Book.find({ companyId }).select('name module prefix isDefault').lean()
    ]);
    return {
      accounts: accounts.map((a) => ({
        name: a.name,
        type: a.type,
        group: a.group,
        city: a.station,
        mobile: a.mobile,
        gstin: a.gstin || ''
      })),
      items: items.map((i) => ({
        itemName: i.itemName || i.name,
        group: i.group,
        unit: i.unit,
        hsnCode: i.hsnCode,
        salesRate: i.salesRate || 0,
        purRate: i.purRate || i.purchaseRate || 0
      })),
      books: books.map((b) => ({
        name: b.name,
        module: b.module,
        prefix: b.prefix,
        isDefault: b.isDefault
      }))
    };
  }

  async getReportBundle(companyId, startDate, endDate) {
    const [
      salesRegister,
      purchaseRegister,
      stockReport,
      stockByItem,
      jobWorkReport,
      outstandingReceivable,
      outstandingPayable,
      profitLoss,
      dailyTransactions,
      masterSummary
    ] = await Promise.all([
      this.getSalesRegister(companyId, startDate, endDate),
      this.getPurchaseRegister(companyId, startDate, endDate),
      this.getStockReport(companyId),
      this.getStockByItem(companyId),
      this.getJobWorkReport(companyId, startDate, endDate),
      this.getOutstanding(companyId, 'receivable', endDate),
      this.getOutstanding(companyId, 'payable', endDate),
      this.getProfitLoss(companyId, startDate, endDate),
      this.getDailyTransactions(companyId, startDate, endDate),
      this.getMasterSummary(companyId)
    ]);

    const summary = {
      salesCount: salesRegister.length,
      salesTotal: salesRegister.reduce((a, r) => a + r.netAmount, 0),
      salesBalance: salesRegister.reduce((a, r) => a + r.balance, 0),
      purchaseCount: purchaseRegister.length,
      purchaseTotal: purchaseRegister.reduce((a, r) => a + r.netAmount, 0),
      purchaseBalance: purchaseRegister.reduce((a, r) => a + r.balance, 0),
      stockLots: stockReport.filter((l) => l.remainingMtrs > 0).length,
      stockMtrs: stockReport.reduce((a, l) => a + (l.remainingMtrs || 0), 0),
      stockPcs: stockReport.reduce((a, l) => a + (l.remainingPcs || 0), 0),
      stockValue: stockReport.reduce((a, l) => a + (l.value || 0), 0),
      jobIssued: jobWorkReport.filter((j) => j.status === 'Issued' || j.status === 'In-Process').length,
      jobReceived: jobWorkReport.filter((j) => j.status === 'Received').length,
      receivable: outstandingReceivable.reduce((a, r) => a + r.totalOutstanding, 0),
      payable: outstandingPayable.reduce((a, r) => a + r.totalOutstanding, 0),
      accountCount: masterSummary.accounts.length,
      itemCount: masterSummary.items.length
    };

    Object.keys(summary).forEach((k) => {
      if (typeof summary[k] === 'number') summary[k] = parseFloat(summary[k].toFixed(2));
    });

    return {
      generatedAt: new Date().toISOString(),
      period: { startDate, endDate },
      summary,
      salesRegister,
      purchaseRegister,
      stockReport,
      stockByItem,
      jobWorkReport,
      outstandingReceivable,
      outstandingPayable,
      profitLoss,
      dailyTransactions,
      masterSummary
    };
  }
}

module.exports = new ReportService();
