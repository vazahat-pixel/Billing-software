const mongoose = require('mongoose');
const InventoryLot = require('../models/InventoryLot');
const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');
const Party = require('../models/Party');
const Item = require('../models/Item');
const Job = require('../models/Job');
const PaymentVoucher = require('../models/PaymentVoucher');
const ReturnInvoice = require('../models/ReturnInvoice');
const Book = require('../models/Book');

const round2 = (n) => Number(Number(n || 0).toFixed(2));

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

/** Most recent voucher date that settled any amount against this bill — real "PaidDate" backing. */
const lastPaymentDate = async (companyId, docId) => {
  const vouchers = await PaymentVoucher.find({
    companyId,
    status: 'Posted',
    'againstInvoices.invoiceId': docId,
  }).select('date').sort({ date: -1 }).limit(1).lean();
  return vouchers[0]?.date ? new Date(vouchers[0].date) : null;
};

/**
 * Every settlement fact for a set of bills, in ONE aggregation.
 *
 * Replaces a per-bill lookup that ran inside a per-party loop — on a few hundred parties
 * that was thousands of sequential round-trips for a single report.
 *
 * Splits the two things a voucher does to a bill, because the reference report shows them
 * in separate columns:
 *   paid     the cash actually allocated (Adjust)
 *   addLess  the non-cash deductions that also close the bill — discount, TDS, RG,
 *            claim, RD, interest, oth1/oth2
 * Together they equal what the posting path writes to the bill's own paidAmount.
 */
const settlementsByBill = async (companyId, billIds) => {
  const map = {};
  if (!billIds.length) return map;

  const rows = await PaymentVoucher.aggregate([
    {
      $match: {
        companyId: new mongoose.Types.ObjectId(companyId),
        status: 'Posted',
        isReversed: { $ne: true },
        'againstInvoices.invoiceId': { $in: billIds },
      },
    },
    { $unwind: '$againstInvoices' },
    { $match: { 'againstInvoices.invoiceId': { $in: billIds } } },
    {
      $group: {
        _id: '$againstInvoices.invoiceId',
        paid: { $sum: { $ifNull: ['$againstInvoices.amount', 0] } },
        addLess: {
          $sum: {
            $add: [
              { $ifNull: ['$againstInvoices.discount', 0] },
              { $ifNull: ['$againstInvoices.tds', 0] },
              { $ifNull: ['$againstInvoices.rg', 0] },
              { $ifNull: ['$againstInvoices.claim', 0] },
              { $ifNull: ['$againstInvoices.rd', 0] },
              { $ifNull: ['$againstInvoices.interest', 0] },
              { $ifNull: ['$againstInvoices.oth1', 0] },
              { $ifNull: ['$againstInvoices.oth2', 0] },
            ],
          },
        },
        // RG is also inside addLess; carried separately so "With RG Pending" has real backing.
        rg: { $sum: { $ifNull: ['$againstInvoices.rg', 0] } },
        lastPaidDate: { $max: '$date' },
        firstPaidDate: { $min: '$date' },
        voucherCount: { $sum: 1 },
      },
    },
  ]);

  for (const r of rows) {
    map[String(r._id)] = {
      paid: round2(r.paid),
      addLess: round2(r.addLess),
      rg: round2(r.rg),
      lastPaidDate: r.lastPaidDate || null,
      firstPaidDate: r.firstPaidDate || null,
      voucherCount: r.voucherCount || 0,
    };
  }
  return map;
};

/**
 * Goods returned against a set of bills, keyed by original invoice number.
 * ReturnInvoice links back by invoice NUMBER (originalInvoiceNo), not by id, so the key
 * is party + number to stop one party's return landing on another's identically-numbered bill.
 */
const returnsByBill = async (companyId, returnType, partyIds, invoiceNos) => {
  const map = {};
  if (!invoiceNos.length) return map;

  const rows = await ReturnInvoice.aggregate([
    {
      $match: {
        companyId: new mongoose.Types.ObjectId(companyId),
        returnType,
        status: { $ne: 'cancelled' },
        partyId: { $in: partyIds },
        originalInvoiceNo: { $in: invoiceNos },
      },
    },
    {
      $group: {
        _id: { partyId: '$partyId', no: '$originalInvoiceNo' },
        goodsRtn: { $sum: { $ifNull: ['$netAmount', 0] } },
      },
    },
  ]);

  for (const r of rows) {
    map[`${r._id.partyId}::${r._id.no}`] = round2(r.goodsRtn);
  }
  return map;
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

  /**
   * @param {string|Date|object} asOnOrFilters - back-compat: a plain date value (asOn),
   *   or a filter options object: { asOn, billDateFrom, billDateTo, paidDateFrom, paidDateTo,
   *   partyIds, brokerIds, stations, hastes, bookIds, states, msmeTypes, mainGroups,
   *   remarkSearch, dueDaysMin, onlyFullBill, onlyPartReceived, includeLastYear,
   *   fyStartDate, status ('Pending'|'All') }
   */
  async getOutstanding(companyId, type = 'receivable', asOnOrFilters) {
    const isReceivable = type === 'receivable';
    const filters =
      asOnOrFilters && typeof asOnOrFilters === 'object' && !(asOnOrFilters instanceof Date)
        ? asOnOrFilters
        : { asOn: asOnOrFilters };
    const {
      asOn,
      billDateFrom,
      billDateTo,
      paidDateFrom,
      paidDateTo,
      partyIds = [],
      brokerIds = [],
      stations = [],
      hastes = [],
      bookIds = [],
      states = [],
      msmeTypes = [],
      mainGroups = [],
      remarkSearch = '',
      dueDaysMin,
      onlyFullBill = false,
      onlyPartReceived = false,
      includeLastYear = true,
      fyStartDate,
      status = 'Pending',
      /** Bills carrying an RG (rate-gap) adjustment recorded on a voucher allocation. */
      onlyRgPending = false,
      /**
       * Bills that went from open to fully settled in a SINGLE voucher — no part-payment
       * history. That is what "direct close" means against this data; there is no other
       * stored flag for it.
       */
      onlyDirectBillClose = false,
      /** Attach each party's ledger closing balance for side-by-side reconciliation. */
      withLedgerBalance = false,
    } = filters;

    const partyGroup = isReceivable ? 'Customer' : 'Supplier';
    const partyFilter = { companyId, type: { $in: [partyGroup, 'Both'] } };
    if (partyIds.length) partyFilter._id = { $in: partyIds };
    if (states.length) partyFilter.state = { $in: states };
    if (msmeTypes.length) partyFilter.msmeType = { $in: msmeTypes };
    if (mainGroups.length) partyFilter.mainGroupId = { $in: mainGroups };

    const parties = await Party.find(partyFilter).lean();
    if (!parties.length) return [];
    const asOnDate = asOn ? new Date(asOn) : new Date();
    const selectedPartyIds = parties.map((p) => p._id);

    // Every bill for every selected party in ONE query, instead of one query per party.
    const docFilter = { companyId, status: { $ne: 'cancelled' } };
    docFilter[isReceivable ? 'customerId' : 'supplierId'] = { $in: selectedPartyIds };
    if (brokerIds.length) docFilter.brokerId = { $in: brokerIds };
    if (bookIds.length) docFilter.bookId = { $in: bookIds };
    if (isReceivable && stations.length) docFilter.station = { $in: stations };
    if (isReceivable && hastes.length) docFilter.haste = { $in: hastes };
    if (remarkSearch.trim()) docFilter.remarks = { $regex: remarkSearch.trim(), $options: 'i' };
    if (!includeLastYear && fyStartDate) {
      docFilter.date = { ...(docFilter.date || {}), $gte: new Date(fyStartDate) };
    }
    Object.assign(docFilter, buildDateQuery(billDateFrom, billDateTo));

    const documents = isReceivable
      ? await Sales.find(docFilter).lean()
      : await Purchase.find(docFilter).lean();
    if (!documents.length) return [];

    // Two more batched reads and the whole report has its facts — no per-bill round-trips.
    const billIds = documents.map((d) => d._id);
    const invoiceNos = [...new Set(documents.map((d) => d.invoiceNo || d.billNo).filter(Boolean))];
    const [settlements, returns] = await Promise.all([
      settlementsByBill(companyId, billIds),
      returnsByBill(companyId, isReceivable ? 'Sales' : 'Purchase', selectedPartyIds, invoiceNos),
    ]);

    const byParty = new Map();
    for (const p of parties) byParty.set(String(p._id), { party: p, invoices: [], partyTotal: 0,
      totals: { billAmt: 0, paid: 0, goodsRtn: 0, addLess: 0 },
      aging: { bucket30: 0, bucket60: 0, bucket90: 0, bucket90Plus: 0 } });

    for (const doc of documents) {
      const pid = String(isReceivable ? doc.customerId : doc.supplierId);
      const bucket = byParty.get(pid);
      if (!bucket) continue;

      const total = round2(doc.netAmount || doc.totals?.total || doc.totalAmount || 0);
      const s = settlements[String(doc._id)] || { paid: 0, addLess: 0, lastPaidDate: null, voucherCount: 0 };
      const docNo = doc.invoiceNo || doc.billNo || '';
      const goodsRtn = returns[`${pid}::${docNo}`] || 0;

      // Balance = what was billed, less cash received, less non-cash adjustments,
      // less goods sent back. Every term is a stored figure, none of it inferred.
      const paid = round2(s.paid);
      const addLess = round2(s.addLess);
      const outstanding = round2(total - paid - addLess - goodsRtn);

      if (status === 'Pending' && outstanding <= 0.01) continue;
      // Settled by any means — cash, adjustment or return.
      if (status === 'Paid' && outstanding > 0.01) continue;

      const settledSoFar = round2(paid + addLess + goodsRtn);
      if (onlyFullBill && settledSoFar > 0.01) continue;
      if (onlyPartReceived && (settledSoFar <= 0.01 || outstanding <= 0.01)) continue;
      if (onlyRgPending && round2(s.rg) <= 0.01) continue;
      // Closed outright by one voucher — nothing left open, no part-payment history.
      if (onlyDirectBillClose && !(outstanding <= 0.01 && s.voucherCount === 1)) continue;

      const ageInDays = Math.floor((asOnDate - new Date(doc.date)) / 86400000);
      if (dueDaysMin != null && ageInDays < Number(dueDaysMin)) continue;

      if (paidDateFrom || paidDateTo) {
        const paidOn = s.lastPaidDate ? new Date(s.lastPaidDate) : null;
        if (!paidOn) continue;
        if (paidDateFrom && paidOn < new Date(paidDateFrom)) continue;
        if (paidDateTo) {
          const end = new Date(paidDateTo);
          end.setHours(23, 59, 59, 999);
          if (paidOn > end) continue;
        }
      }

      bucket.partyTotal = round2(bucket.partyTotal + outstanding);
      bucket.totals.billAmt = round2(bucket.totals.billAmt + total);
      bucket.totals.paid = round2(bucket.totals.paid + paid);
      bucket.totals.addLess = round2(bucket.totals.addLess + addLess);
      bucket.totals.goodsRtn = round2(bucket.totals.goodsRtn + goodsRtn);

      if (ageInDays <= 30) bucket.aging.bucket30 = round2(bucket.aging.bucket30 + outstanding);
      else if (ageInDays <= 60) bucket.aging.bucket60 = round2(bucket.aging.bucket60 + outstanding);
      else if (ageInDays <= 90) bucket.aging.bucket90 = round2(bucket.aging.bucket90 + outstanding);
      else bucket.aging.bucket90Plus = round2(bucket.aging.bucket90Plus + outstanding);

      bucket.invoices.push({
        billId: doc._id,
        docNo,
        date: doc.date,
        total,
        paid,
        paidDate: s.lastPaidDate || null,
        firstPaidDate: s.firstPaidDate || null,
        paymentCount: s.voucherCount,
        goodsRtn,
        addLess,
        rg: round2(s.rg),
        outstanding,
        ageDays: ageInDays,
        // The bill's own running figure — shown so a drift between the report and the
        // document itself is visible rather than hidden.
        billPaidAmount: round2(doc.paidAmount || 0),
        broker: doc.brokerId || null,
        station: doc.station || '',
        haste: doc.haste || '',
        bookId: doc.bookId || '',
        remarks: doc.remarks || '',
      });
    }

    // Ledger balances for the whole company in ONE pass, then mapped by linked party —
    // never a statement call per party. Read-only: Outstanding never writes to the ledger.
    let ledgerByParty = null;
    if (withLedgerBalance) {
      const ledgerEngine = require('./ledgerEngineService');
      const balances = await ledgerEngine.computeBalances(companyId, { asOn });
      ledgerByParty = {};
      for (const b of balances) {
        if (!b.ledger?.linkedPartyId) continue;
        ledgerByParty[String(b.ledger.linkedPartyId)] = {
          ledgerBalance: b.balance,
          ledgerBalanceType: b.type,
        };
      }
    }

    const lines = [];
    for (const { party, invoices, partyTotal, totals, aging } of byParty.values()) {
      if (!invoices.length) continue;
      if (status === 'Pending' && partyTotal <= 0.01) continue;
      const led = ledgerByParty ? ledgerByParty[String(party._id)] : null;
      lines.push({
        ...(led ? {
          ledgerBalance: led.ledgerBalance,
          ledgerBalanceType: led.ledgerBalanceType,
          // Non-zero means bill-wise and ledger disagree — surfaced, never auto-corrected.
          ledgerDiff: round2(led.ledgerBalance - partyTotal),
        } : {}),
        partyId: party._id,
        partyName: party.name,
        phone: party.mobile || party.phone,
        address: party.address || '',
        city: party.city || party.station || '',
        state: party.state || '',
        msmeType: party.msmeType || 'None',
        gstin: party.gstin || '',
        mainGroupId: party.mainGroupId || '',
        banks: party.banks || [],
        totalOutstanding: round2(partyTotal),
        // TOTAL-PARTY row of the reference report, summed from the listed bills only.
        partyTotals: totals,
        aging,
        invoices,
      });
    }
    return lines.sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  }

  /** Real, distinct dimension values for the Outstanding report's filter tabs — no fabricated data. */
  async getOutstandingFilterOptions(companyId, type = 'receivable') {
    const isReceivable = type === 'receivable';
    const partyGroup = isReceivable ? 'Customer' : 'Supplier';
    const DocModel = isReceivable ? Sales : Purchase;

    const [parties, brokers, stations, hastes, bookIds, states, mainGroups] = await Promise.all([
      Party.find({ companyId, type: { $in: [partyGroup, 'Both'] } })
        .select('name address city state msmeType')
        .sort({ name: 1 })
        .lean(),
      Party.find({ companyId, type: { $in: ['Broker', 'Both'] } })
        .select('name')
        .sort({ name: 1 })
        .lean(),
      isReceivable ? DocModel.distinct('station', { companyId, station: { $nin: [null, ''] } }) : [],
      isReceivable ? DocModel.distinct('haste', { companyId, haste: { $nin: [null, ''] } }) : [],
      DocModel.distinct('bookId', { companyId, bookId: { $nin: [null, ''] } }),
      Party.distinct('state', { companyId, type: { $in: [partyGroup, 'Both'] }, state: { $nin: [null, ''] } }),
      Party.distinct('mainGroupId', { companyId, type: { $in: [partyGroup, 'Both'] }, mainGroupId: { $nin: [null, ''] } }),
    ]);

    return {
      parties: parties.map((p) => ({ _id: p._id, name: p.name, address: p.address || '', state: p.state || '' })),
      brokers: brokers.map((b) => ({ _id: b._id, name: b.name })),
      stations: stations.sort(),
      hastes: hastes.sort(),
      books: bookIds.sort(),
      states: states.sort(),
      mainGroups: mainGroups.sort(),
      msmeTypes: ['None', 'Micro', 'Small', 'Medium'],
    };
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
