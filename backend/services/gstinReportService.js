const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');
const ReturnInvoice = require('../models/ReturnInvoice');
const DebitCreditNote = require('../models/DebitCreditNote');
const Job = require('../models/Job');
const AccountingEntry = require('../models/AccountingEntry');
const LedgerMaster = require('../models/LedgerMaster');
const Party = require('../models/Party');
const Item = require('../models/Item');
const InventoryLot = require('../models/InventoryLot');
const Company = require('../models/Company');
const gstConfigService = require('./gstConfigService');
const { stateNameFromCode, stateCodeFromGstin } = require('../utils/gstDetermination');

const round2 = (n) => Number(Number(n || 0).toFixed(2));
const mongoose = require('mongoose');
const toOid = (id) => {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  if (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)) return new mongoose.Types.ObjectId(id);
  return null;
};

/**
 * GSTIN Report Engine
 *
 * Produces GSTIN-wise reports for Sales, Purchase, Process, JobWork, Journal, Expense.
 * Every value derives from actual transaction data — no hardcoded/placeholder values.
 *
 * Each report supports:
 *   - filters: fromDate, toDate, partyId, gstin, bookId, gstRate, state, type
 *   - mode: 'summary' | 'detail'
 *   - groupBy1 / groupBy2: party, gstin, book, gstRate, state, date, item, taxType, month
 */
class GstinReportService {

  // ─────────────────── Shared filter builder ───────────────────
  _dateFilter(fromDate, toDate, dateField = 'date') {
    const f = {};
    if (fromDate) f.$gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      f.$lte = end;
    }
    return Object.keys(f).length ? { [dateField]: f } : {};
  }

  _buildSalesQuery(companyId, filters = {}) {
    const query = {
      companyId: toOid(companyId),
      status: { $ne: 'cancelled' },
      isDeleted: { $ne: true },
      ...this._dateFilter(filters.fromDate, filters.toDate),
    };
    if (filters.bookId) query.bookId = filters.bookId;
    if (filters.gstRate !== undefined && filters.gstRate !== '' && filters.gstRate !== null) {
      query.gstRate = Number(filters.gstRate);
    }
    if (filters.gstType) query.gstType = filters.gstType;
    return query;
  }

  _buildPurchaseQuery(companyId, filters = {}) {
    const query = {
      companyId: toOid(companyId),
      status: { $ne: 'cancelled' },
      isDeleted: { $ne: true },
      ...this._dateFilter(filters.fromDate, filters.toDate),
    };
    if (filters.bookId) query.bookId = filters.bookId;
    if (filters.gstRate !== undefined && filters.gstRate !== '' && filters.gstRate !== null) {
      query.gstRate = Number(filters.gstRate);
    }
    if (filters.gstType) query.gstType = filters.gstType;
    return query;
  }

  /** Post-query filter by party GSTIN / state / partyId */
  _applyPartyFilters(rows, filters) {
    let result = rows;
    if (filters.partyId) {
      const pid = String(filters.partyId);
      result = result.filter((r) => String(r._partyId) === pid);
    }
    if (filters.gstin) {
      const g = filters.gstin.toUpperCase();
      result = result.filter((r) => (r.gstin || '').toUpperCase().includes(g));
    }
    if (filters.state) {
      const s = filters.state.toLowerCase();
      result = result.filter((r) => (r.stateName || '').toLowerCase().includes(s) || (r.stateCode || '') === s);
    }
    return result;
  }

  // ─────────────────── Grouping engine ───────────────────
  _groupRows(rows, groupBy) {
    if (!groupBy) return null;
    const map = {};
    for (const r of rows) {
      const key = this._groupKeyValue(r, groupBy);
      if (!map[key]) {
        map[key] = { groupKey: key, groupBy, rows: [], taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, gstAmount: 0, netAmount: 0, count: 0 };
      }
      map[key].rows.push(r);
      map[key].taxableAmount = round2(map[key].taxableAmount + (r.taxableAmount || 0));
      map[key].cgst = round2(map[key].cgst + (r.cgst || 0));
      map[key].sgst = round2(map[key].sgst + (r.sgst || 0));
      map[key].igst = round2(map[key].igst + (r.igst || 0));
      map[key].cess = round2(map[key].cess + (r.cess || 0));
      map[key].gstAmount = round2(map[key].gstAmount + (r.gstAmount || 0));
      map[key].netAmount = round2(map[key].netAmount + (r.netAmount || 0));
      map[key].count += 1;
    }
    return Object.values(map).sort((a, b) => (a.groupKey || '').localeCompare(b.groupKey || ''));
  }

  _groupKeyValue(row, groupBy) {
    switch (groupBy) {
      case 'party': return row.partyName || 'Unknown';
      case 'gstin': return row.gstin || 'Unregistered';
      case 'book': return row.bookId || 'Default';
      case 'gstRate': return `${row.gstRate || 0}%`;
      case 'state': return row.stateName || row.stateCode || 'Unknown';
      case 'date': return row.date ? new Date(row.date).toISOString().slice(0, 10) : 'Unknown';
      case 'month': return row.date ? new Date(row.date).toISOString().slice(0, 7) : 'Unknown';
      case 'taxType': return row.gstType || 'CGST+SGST';
      case 'item': return row.itemName || 'Mixed';
      case 'transactionType': return row.transactionType || 'Standard';
      default: return row[groupBy] || 'Unknown';
    }
  }

  _computeTotals(rows) {
    return {
      count: rows.length,
      taxableAmount: round2(rows.reduce((s, r) => s + (r.taxableAmount || 0), 0)),
      cgst: round2(rows.reduce((s, r) => s + (r.cgst || 0), 0)),
      sgst: round2(rows.reduce((s, r) => s + (r.sgst || 0), 0)),
      igst: round2(rows.reduce((s, r) => s + (r.igst || 0), 0)),
      cess: round2(rows.reduce((s, r) => s + (r.cess || 0), 0)),
      gstAmount: round2(rows.reduce((s, r) => s + (r.gstAmount || 0), 0)),
      netAmount: round2(rows.reduce((s, r) => s + (r.netAmount || 0), 0)),
    };
  }

  _buildResponse(rows, filters, reportName) {
    const mode = filters.mode || 'detail';
    const totals = this._computeTotals(rows);

    let groups = null;
    if (filters.groupBy1) {
      groups = this._groupRows(rows, filters.groupBy1);
      if (filters.groupBy2 && groups) {
        for (const g of groups) {
          g.subGroups = this._groupRows(g.rows, filters.groupBy2);
          if (mode === 'summary') delete g.rows;
        }
      } else if (mode === 'summary' && groups) {
        for (const g of groups) delete g.rows;
      }
    }

    return {
      reportName,
      mode,
      filters: { ...filters },
      totals,
      groups,
      rows: mode === 'detail' && !groups ? rows : (mode === 'summary' && !groups ? [] : undefined),
      rowCount: rows.length,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  GSTIN — SALES
  // ═══════════════════════════════════════════════════════════════

  async getGstinSalesSummary(companyId, filters = {}) {
    const rows = await this._fetchSalesRows(companyId, filters);
    return this._buildResponse(rows, { ...filters, mode: 'summary', groupBy1: filters.groupBy1 || 'party' }, 'GSTIN Sales Summary');
  }

  async getGstinSalesDetail(companyId, filters = {}) {
    const rows = await this._fetchSalesRows(companyId, filters);
    return this._buildResponse(rows, { ...filters, mode: 'detail' }, 'GSTIN Sales Detail');
  }

  async getGstinSalesReturnSummary(companyId, filters = {}) {
    const rows = await this._fetchReturnRows(companyId, 'Sales', filters);
    return this._buildResponse(rows, { ...filters, mode: 'summary', groupBy1: filters.groupBy1 || 'party' }, 'GSTIN Sales Return Summary');
  }

  async getGstinSalesReturnDetail(companyId, filters = {}) {
    const rows = await this._fetchReturnRows(companyId, 'Sales', filters);
    return this._buildResponse(rows, { ...filters, mode: 'detail' }, 'GSTIN Sales Return Detail');
  }

  async _fetchSalesRows(companyId, filters) {
    const query = this._buildSalesQuery(companyId, filters);
    const sales = await Sales.find(query)
      .populate('customerId', 'name gstin state stateCode gstType')
      .populate('items.itemId', 'name hsnCode gstRate')
      .sort({ date: -1 })
      .lean();

    const cfg = await gstConfigService.getOrCreate(companyId);
    const companyStateCode = cfg.stateCode || stateCodeFromGstin(cfg.gstin) || '';

    const rows = sales.map((s) => {
      const partyGstin = (s.customerId?.gstin || '').toUpperCase();
      const partyState = s.customerId?.state || stateNameFromCode(stateCodeFromGstin(partyGstin)) || '';
      const partyStateCode = s.customerId?.stateCode || stateCodeFromGstin(partyGstin) || companyStateCode;
      const isInterState = partyStateCode !== companyStateCode;
      const hsnCodes = (s.items || []).map((i) => i.itemId?.hsnCode || '').filter(Boolean);

      return {
        _id: s._id,
        _partyId: s.customerId?._id,
        invoiceNo: s.invoiceNo,
        date: s.date,
        partyName: s.customerId?.name || 'Cash Sale',
        gstin: partyGstin,
        stateCode: partyStateCode,
        stateName: partyState,
        isInterState,
        bookId: s.bookId || '',
        gstType: s.gstType || 'CGST+SGST',
        gstRate: s.gstRate || 0,
        taxableAmount: round2(s.taxableAmount),
        cgst: round2(s.cgst),
        sgst: round2(s.sgst),
        igst: round2(s.igst),
        cess: round2(s.cess || 0),
        gstAmount: round2((s.cgst || 0) + (s.sgst || 0) + (s.igst || 0) + (s.cess || 0)),
        netAmount: round2(s.netAmount),
        reverseCharge: s.reverseCharge ? 'Y' : 'N',
        hsnCodes: hsnCodes.join(', '),
        itemCount: (s.items || []).length,
        invoiceType: s.invoiceType || 'Tax',
        transactionType: partyGstin.length === 15 ? 'B2B' : 'B2C',
      };
    });

    return this._applyPartyFilters(rows, filters);
  }

  // ═══════════════════════════════════════════════════════════════
  //  GSTIN — PURCHASE
  // ═══════════════════════════════════════════════════════════════

  async getGstinPurchaseSummary(companyId, filters = {}) {
    const rows = await this._fetchPurchaseRows(companyId, filters);
    return this._buildResponse(rows, { ...filters, mode: 'summary', groupBy1: filters.groupBy1 || 'party' }, 'GSTIN Purchase Summary');
  }

  async getGstinPurchaseDetail(companyId, filters = {}) {
    const rows = await this._fetchPurchaseRows(companyId, filters);
    return this._buildResponse(rows, { ...filters, mode: 'detail' }, 'GSTIN Purchase Detail');
  }

  async getGstinPurchaseReturnSummary(companyId, filters = {}) {
    const rows = await this._fetchReturnRows(companyId, 'Purchase', filters);
    return this._buildResponse(rows, { ...filters, mode: 'summary', groupBy1: filters.groupBy1 || 'party' }, 'GSTIN Purchase Return Summary');
  }

  async getGstinPurchaseReturnDetail(companyId, filters = {}) {
    const rows = await this._fetchReturnRows(companyId, 'Purchase', filters);
    return this._buildResponse(rows, { ...filters, mode: 'detail' }, 'GSTIN Purchase Return Detail');
  }

  async _fetchPurchaseRows(companyId, filters) {
    const query = this._buildPurchaseQuery(companyId, filters);
    const purchases = await Purchase.find(query)
      .populate('supplierId', 'name gstin state stateCode gstType')
      .populate('items.itemId', 'name hsnCode gstRate')
      .sort({ date: -1 })
      .lean();

    const cfg = await gstConfigService.getOrCreate(companyId);
    const companyStateCode = cfg.stateCode || stateCodeFromGstin(cfg.gstin) || '';

    const rows = purchases.map((p) => {
      const partyGstin = (p.supplierId?.gstin || '').toUpperCase();
      const partyState = p.supplierId?.state || stateNameFromCode(stateCodeFromGstin(partyGstin)) || '';
      const partyStateCode = p.supplierId?.stateCode || stateCodeFromGstin(partyGstin) || companyStateCode;
      const isInterState = partyStateCode !== companyStateCode;
      const hsnCodes = (p.items || []).map((i) => i.itemId?.hsnCode || '').filter(Boolean);

      return {
        _id: p._id,
        _partyId: p.supplierId?._id,
        invoiceNo: p.invoiceNo,
        supplierInvoiceNo: p.supplierInvoiceNo || '',
        date: p.date,
        partyName: p.supplierId?.name || 'Unknown Supplier',
        gstin: partyGstin,
        stateCode: partyStateCode,
        stateName: partyState,
        isInterState,
        bookId: p.bookId || '',
        gstType: p.gstType || 'CGST+SGST',
        gstRate: p.gstRate || 0,
        taxableAmount: round2(p.taxableAmount),
        cgst: round2(p.cgst),
        sgst: round2(p.sgst),
        igst: round2(p.igst),
        cess: round2(p.cess || 0),
        gstAmount: round2((p.cgst || 0) + (p.sgst || 0) + (p.igst || 0) + (p.cess || 0)),
        netAmount: round2(p.netAmount),
        reverseCharge: p.reverseCharge === 'Yes' || p.rcmCharge ? 'Y' : 'N',
        itcEligibility: p.itcEligibility || 'Inputs',
        hsnCodes: hsnCodes.join(', '),
        itemCount: (p.items || []).length,
        invoiceType: p.invoiceType || 'INVOICE IN STATE',
        transactionType: partyGstin.length === 15 ? 'Registered' : 'Unregistered',
      };
    });

    return this._applyPartyFilters(rows, filters);
  }

  // ─────────────────── Returns (shared for Sales & Purchase) ───────────────────

  async _fetchReturnRows(companyId, returnType, filters) {
    const query = {
      companyId: toOid(companyId),
      returnType,
      ...this._dateFilter(filters.fromDate, filters.toDate),
    };

    const returns = await ReturnInvoice.find(query)
      .populate('partyId', 'name gstin state stateCode')
      .populate('items.itemId', 'name hsnCode gstRate')
      .sort({ date: -1 })
      .lean();

    const cfg = await gstConfigService.getOrCreate(companyId);
    const companyStateCode = cfg.stateCode || stateCodeFromGstin(cfg.gstin) || '';

    const rows = returns.map((r) => {
      const partyGstin = (r.partyId?.gstin || '').toUpperCase();
      const partyState = r.partyId?.state || stateNameFromCode(stateCodeFromGstin(partyGstin)) || '';
      const partyStateCode = r.partyId?.stateCode || stateCodeFromGstin(partyGstin) || companyStateCode;

      return {
        _id: r._id,
        _partyId: r.partyId?._id,
        invoiceNo: r.invoiceNo,
        originalInvoiceNo: r.originalInvoiceNo || '',
        date: r.date,
        partyName: r.partyId?.name || 'Unknown',
        gstin: partyGstin,
        stateCode: partyStateCode,
        stateName: partyState,
        bookId: '',
        gstType: r.gstType || 'CGST+SGST',
        gstRate: r.gstRate || 0,
        taxableAmount: round2(r.taxableAmount),
        cgst: round2(r.cgst),
        sgst: round2(r.sgst),
        igst: round2(r.igst),
        cess: round2(r.cess || 0),
        gstAmount: round2(r.gstAmount),
        netAmount: round2(r.netAmount),
        returnType,
        transactionType: 'Return',
      };
    });

    return this._applyPartyFilters(rows, filters);
  }

  // ═══════════════════════════════════════════════════════════════
  //  GSTIN — PROCESS
  // ═══════════════════════════════════════════════════════════════

  async getGstinProcessReport(companyId, filters = {}) {
    const rows = await this._fetchProcessRows(companyId, filters);
    return this._buildResponse(rows, { ...filters, mode: filters.mode || 'detail' }, 'GSTIN Process Report');
  }

  async _fetchProcessRows(companyId, filters) {
    // Process transactions = Jobs with processCharges > 0 (external processing)
    const query = {
      companyId: toOid(companyId),
      status: { $ne: 'Cancelled' },
      processCharges: { $gt: 0 },
      ...this._dateFilter(filters.fromDate, filters.toDate, 'issueDate'),
    };

    const jobs = await Job.find(query)
      .populate('workerId', 'name gstin state stateCode')
      .populate('lotId', 'lotId itemId')
      .sort({ issueDate: -1 })
      .lean();

    const cfg = await gstConfigService.getOrCreate(companyId);
    const companyStateCode = cfg.stateCode || stateCodeFromGstin(cfg.gstin) || '';

    const rows = jobs.map((j) => {
      const workerGstin = (j.workerId?.gstin || '').toUpperCase();
      const workerState = j.workerId?.state || '';
      const workerStateCode = j.workerId?.stateCode || stateCodeFromGstin(workerGstin) || companyStateCode;
      const isInterState = workerStateCode !== companyStateCode;
      const gstPer = j.gstPer || 0;
      const charges = round2(j.processCharges || 0);
      const gstAmt = round2(j.processGstAmount || (charges * gstPer / 100));
      const cgst = isInterState ? 0 : round2(gstAmt / 2);
      const sgst = isInterState ? 0 : round2(gstAmt / 2);
      const igst = isInterState ? gstAmt : 0;

      return {
        _id: j._id,
        _partyId: j.workerId?._id,
        jobCardNo: j.jobCardNo,
        date: j.issueDate,
        partyName: j.workerId?.name || 'Unknown Worker',
        gstin: workerGstin,
        stateCode: workerStateCode,
        stateName: workerState,
        isInterState,
        processType: j.processType || '',
        gstType: j.gstType || (isInterState ? 'IGST' : 'CGST+SGST'),
        gstRate: gstPer,
        taxableAmount: charges,
        cgst,
        sgst,
        igst,
        cess: 0,
        gstAmount: gstAmt,
        netAmount: round2(charges + gstAmt),
        issueQty: j.issueQty || 0,
        receivedQty: j.receivedQty || 0,
        status: j.status,
        challanNo: j.challanNo || '',
        transactionType: 'Process',
      };
    });

    return this._applyPartyFilters(rows, filters);
  }

  // ═══════════════════════════════════════════════════════════════
  //  GSTIN — JOBWORK
  // ═══════════════════════════════════════════════════════════════

  async getGstinJobWorkReport(companyId, filters = {}) {
    const rows = await this._fetchJobWorkRows(companyId, filters);
    return this._buildResponse(rows, { ...filters, mode: filters.mode || 'detail' }, 'GSTIN JobWork Report');
  }

  async _fetchJobWorkRows(companyId, filters) {
    // JobWork = all jobs (material movement + charges where applicable)
    const query = {
      companyId: toOid(companyId),
      status: { $ne: 'Cancelled' },
      ...this._dateFilter(filters.fromDate, filters.toDate, 'issueDate'),
    };

    const jobs = await Job.find(query)
      .populate('workerId', 'name gstin state stateCode')
      .populate('lotId', 'lotId')
      .sort({ issueDate: -1 })
      .lean();

    const cfg = await gstConfigService.getOrCreate(companyId);
    const companyStateCode = cfg.stateCode || stateCodeFromGstin(cfg.gstin) || '';

    const rows = jobs.map((j) => {
      const workerGstin = (j.workerId?.gstin || '').toUpperCase();
      const workerState = j.workerId?.state || '';
      const workerStateCode = j.workerId?.stateCode || stateCodeFromGstin(workerGstin) || companyStateCode;
      const isInterState = workerStateCode !== companyStateCode;
      const charges = round2(j.processCharges || 0);
      const gstPer = j.gstPer || 0;
      const gstAmt = round2(j.processGstAmount || (charges * gstPer / 100));

      // Non-taxable material movement — GST is 0 if no charges
      const hasTax = charges > 0 && gstPer > 0;
      const cgst = hasTax && !isInterState ? round2(gstAmt / 2) : 0;
      const sgst = hasTax && !isInterState ? round2(gstAmt / 2) : 0;
      const igst = hasTax && isInterState ? gstAmt : 0;

      return {
        _id: j._id,
        _partyId: j.workerId?._id,
        jobCardNo: j.jobCardNo,
        date: j.issueDate,
        receiveDate: j.receiveDate,
        partyName: j.workerId?.name || 'Unknown Worker',
        gstin: workerGstin,
        stateCode: workerStateCode,
        stateName: workerState,
        processType: j.processType || '',
        productionType: j.productionType || 'External',
        gstType: hasTax ? (isInterState ? 'IGST' : 'CGST+SGST') : 'N/A',
        gstRate: gstPer,
        taxableAmount: charges,
        cgst,
        sgst,
        igst,
        cess: 0,
        gstAmount: hasTax ? gstAmt : 0,
        netAmount: round2(charges + (hasTax ? gstAmt : 0)),
        issuePcs: j.issuePcs || 0,
        issueQty: j.issueQty || 0,
        receivedPcs: j.receivedPcs || 0,
        receivedQty: j.receivedQty || 0,
        wastage: j.wastage || 0,
        status: j.status,
        challanNo: j.challanNo || '',
        transactionType: 'JobWork',
      };
    });

    return this._applyPartyFilters(rows, filters);
  }

  // ═══════════════════════════════════════════════════════════════
  //  GSTIN — JOURNAL REPORT
  // ═══════════════════════════════════════════════════════════════

  async getGstinJournalReport(companyId, filters = {}) {
    const rows = await this._fetchJournalRows(companyId, filters);
    return this._buildResponse(rows, { ...filters, mode: filters.mode || 'detail' }, 'GSTIN Journal Report');
  }

  async _fetchJournalRows(companyId, filters) {
    // Journal entries that touch GST ledgers
    const cfg = await gstConfigService.getOrCreate(companyId);
    const gstLedgerIds = [];
    const lm = cfg.ledgerMap || {};
    for (const key of ['cgstInput', 'sgstInput', 'igstInput', 'cgstOutput', 'sgstOutput', 'igstOutput', 'cessInput', 'cessOutput']) {
      if (lm[key]) gstLedgerIds.push(lm[key]);
    }

    // Also find GST-named ledgers if config map is incomplete
    if (gstLedgerIds.length < 4) {
      const gstLedgers = await LedgerMaster.find({
        companyId: toOid(companyId),
        name: { $regex: /cgst|sgst|igst|cess|gst/i },
      }).select('_id name').lean();
      for (const l of gstLedgers) {
        if (!gstLedgerIds.some((id) => String(id) === String(l._id))) {
          gstLedgerIds.push(l._id);
        }
      }
    }

    const query = {
      companyId: toOid(companyId),
      voucherType: 'Journal',
      status: 'Posted',
      isReversed: { $ne: true },
      isDeleted: { $ne: true },
      'lines.ledgerId': { $in: gstLedgerIds },
      ...this._dateFilter(filters.fromDate, filters.toDate, 'entryDate'),
    };

    const entries = await AccountingEntry.find(query)
      .populate('lines.ledgerId', 'name linkedPartyId')
      .sort({ entryDate: -1 })
      .lean();

    const rows = entries.map((e) => {
      let cgst = 0, sgst = 0, igst = 0, cess = 0;
      let partyName = '';
      let gstin = '';
      const gstLedgerIdStrs = gstLedgerIds.map(String);

      for (const line of e.lines || []) {
        const ledId = String(line.ledgerId?._id || line.ledgerId);
        const name = (line.ledgerName || line.ledgerId?.name || '').toUpperCase();
        const amt = line.type === 'Dr' ? line.amount : -line.amount;

        if (gstLedgerIdStrs.includes(ledId) || /cgst|sgst|igst|cess/i.test(name)) {
          if (/cgst/i.test(name)) cgst = round2(cgst + amt);
          else if (/sgst/i.test(name)) sgst = round2(sgst + amt);
          else if (/igst/i.test(name)) igst = round2(igst + amt);
          else if (/cess/i.test(name)) cess = round2(cess + amt);
        } else if (!partyName) {
          partyName = line.ledgerName || line.ledgerId?.name || '';
        }
      }

      const totalGst = round2(Math.abs(cgst) + Math.abs(sgst) + Math.abs(igst) + Math.abs(cess));
      const taxable = round2(e.totalDebit - totalGst);

      return {
        _id: e._id,
        entryNo: e.entryNo,
        date: e.entryDate,
        partyName,
        gstin,
        voucherType: e.voucherType,
        narration: e.narration || '',
        taxableAmount: Math.abs(taxable),
        cgst: Math.abs(cgst),
        sgst: Math.abs(sgst),
        igst: Math.abs(igst),
        cess: Math.abs(cess),
        gstAmount: totalGst,
        netAmount: round2(e.totalDebit),
        gstRate: taxable > 0 ? round2((totalGst / Math.abs(taxable)) * 100) : 0,
        gstType: igst > 0 ? 'IGST' : 'CGST+SGST',
        transactionType: 'Journal',
      };
    });

    return rows;
  }

  // ═══════════════════════════════════════════════════════════════
  //  GSTIN — EXPENSE REPORT
  // ═══════════════════════════════════════════════════════════════

  async getGstinExpenseReport(companyId, filters = {}) {
    const rows = await this._fetchExpenseRows(companyId, filters);
    return this._buildResponse(rows, { ...filters, mode: filters.mode || 'detail' }, 'GSTIN Expense Report');
  }

  async _fetchExpenseRows(companyId, filters) {
    // Expenses are purchases with certain account-head classifications
    // or direct journal entries tagged as expenses
    // For textile ERP, expenses often flow as Purchase bills with specific types
    const query = {
      companyId: toOid(companyId),
      status: { $ne: 'cancelled' },
      isDeleted: { $ne: true },
      $or: [
        { type: { $regex: /expense|service|rent|electricity|telephone|repair|maintenance|legal|professional|freight|commission/i } },
        { invoiceType: { $regex: /expense|service/i } },
      ],
      ...this._dateFilter(filters.fromDate, filters.toDate),
    };

    const purchases = await Purchase.find(query)
      .populate('supplierId', 'name gstin state stateCode')
      .sort({ date: -1 })
      .lean();

    const cfg = await gstConfigService.getOrCreate(companyId);
    const companyStateCode = cfg.stateCode || stateCodeFromGstin(cfg.gstin) || '';

    const rows = purchases.map((p) => {
      const partyGstin = (p.supplierId?.gstin || '').toUpperCase();
      const partyState = p.supplierId?.state || '';
      const isInterState = (p.supplierId?.stateCode || stateCodeFromGstin(partyGstin) || companyStateCode) !== companyStateCode;

      return {
        _id: p._id,
        _partyId: p.supplierId?._id,
        invoiceNo: p.invoiceNo,
        date: p.date,
        partyName: p.supplierId?.name || 'Unknown',
        gstin: partyGstin,
        stateCode: p.supplierId?.stateCode || '',
        stateName: partyState,
        expenseType: p.type || p.invoiceType || 'Expense',
        gstType: p.gstType || 'CGST+SGST',
        gstRate: p.gstRate || 0,
        taxableAmount: round2(p.taxableAmount),
        cgst: round2(p.cgst),
        sgst: round2(p.sgst),
        igst: round2(p.igst),
        cess: round2(p.cess || 0),
        gstAmount: round2((p.cgst || 0) + (p.sgst || 0) + (p.igst || 0)),
        netAmount: round2(p.netAmount),
        itcEligibility: p.itcEligibility || 'Input services',
        reverseCharge: p.reverseCharge === 'Yes' || p.rcmCharge ? 'Y' : 'N',
        transactionType: 'Expense',
      };
    });

    return this._applyPartyFilters(rows, filters);
  }

  // ═══════════════════════════════════════════════════════════════
  //  GSTR-1 ERROR CHECKING
  // ═══════════════════════════════════════════════════════════════

  async checkGstr1Errors(companyId, fromDate, toDate) {
    const { validateGstin } = require('../utils/gstDetermination');
    const errors = [];
    const query = this._buildSalesQuery(companyId, { fromDate, toDate });
    const sales = await Sales.find(query)
      .populate('customerId', 'name gstin state stateCode')
      .populate('items.itemId', 'name hsnCode gstRate')
      .lean();

    const cfg = await gstConfigService.getOrCreate(companyId);
    const companyStateCode = cfg.stateCode || stateCodeFromGstin(cfg.gstin) || '';
    const invoiceNos = new Set();

    for (const s of sales) {
      const gstin = (s.customerId?.gstin || '').toUpperCase();
      const taxable = s.taxableAmount || 0;
      const totalGst = (s.cgst || 0) + (s.sgst || 0) + (s.igst || 0);

      // Duplicate invoice check
      if (invoiceNos.has(s.invoiceNo)) {
        errors.push({ severity: 'error', code: 'DUPLICATE_INVOICE', invoiceNo: s.invoiceNo, date: s.date, message: `Duplicate invoice number: ${s.invoiceNo}` });
      }
      invoiceNos.add(s.invoiceNo);

      // Invalid GSTIN
      if (gstin && gstin.length > 0 && gstin.length !== 15) {
        errors.push({ severity: 'error', code: 'INVALID_GSTIN', invoiceNo: s.invoiceNo, date: s.date, gstin, message: `Invalid GSTIN length (${gstin.length} chars): ${gstin}` });
      } else if (gstin.length === 15) {
        const v = validateGstin(gstin);
        if (!v.ok) {
          errors.push({ severity: 'error', code: 'INVALID_GSTIN_FORMAT', invoiceNo: s.invoiceNo, date: s.date, gstin, message: `GSTIN format error: ${v.reason}` });
        }
      }

      // Missing GSTIN for B2B (taxable > 2.5L interstate unregistered)
      if (!gstin && taxable > 250000 && s.igst > 0) {
        errors.push({ severity: 'warning', code: 'MISSING_GSTIN_B2CL', invoiceNo: s.invoiceNo, date: s.date, message: `Large B2C interstate sale (₹${taxable.toLocaleString()}) — verify B2CL classification` });
      }

      // Missing HSN
      const hasHsn = (s.items || []).some((i) => i.itemId?.hsnCode);
      if (!hasHsn && taxable > 0) {
        errors.push({ severity: 'warning', code: 'MISSING_HSN', invoiceNo: s.invoiceNo, date: s.date, message: 'Items missing HSN code — required for GSTR-1 HSN summary' });
      }

      // Zero GST on taxable
      if (taxable > 0 && totalGst === 0 && s.gstType !== 'Exempt' && s.gstType !== 'NilRated' && s.gstType !== 'ZeroRated' && s.gstType !== 'Export') {
        errors.push({ severity: 'error', code: 'ZERO_GST_TAXABLE', invoiceNo: s.invoiceNo, date: s.date, message: `Taxable amount ₹${taxable.toLocaleString()} but zero GST — check tax rate` });
      }

      // GST calculation mismatch
      if (taxable > 0 && s.gstRate > 0) {
        const expectedGst = round2(taxable * s.gstRate / 100);
        if (Math.abs(expectedGst - totalGst) > 1) {
          errors.push({ severity: 'warning', code: 'GST_MISMATCH', invoiceNo: s.invoiceNo, date: s.date, message: `GST mismatch: expected ₹${expectedGst} at ${s.gstRate}%, found ₹${round2(totalGst)}` });
        }
      }

      // CGST/SGST vs IGST conflict
      if (s.cgst > 0 && s.igst > 0) {
        errors.push({ severity: 'error', code: 'CGST_IGST_CONFLICT', invoiceNo: s.invoiceNo, date: s.date, message: 'Both CGST and IGST present — must be one or the other' });
      }

      // CGST ≠ SGST (should be equal for intra-state)
      if (s.cgst > 0 && s.sgst > 0 && Math.abs(s.cgst - s.sgst) > 0.01) {
        errors.push({ severity: 'warning', code: 'CGST_SGST_UNEQUAL', invoiceNo: s.invoiceNo, date: s.date, message: `CGST (₹${s.cgst}) ≠ SGST (₹${s.sgst}) — should be equal` });
      }

      // Place of supply check
      const partyStateCode = s.customerId?.stateCode || stateCodeFromGstin(gstin) || '';
      if (partyStateCode && partyStateCode !== companyStateCode && s.igst === 0 && totalGst > 0) {
        errors.push({ severity: 'error', code: 'INCORRECT_TAX_TYPE', invoiceNo: s.invoiceNo, date: s.date, message: `Inter-state sale (state ${partyStateCode}) but IGST is zero — should use IGST` });
      }
      if (partyStateCode && partyStateCode === companyStateCode && s.igst > 0) {
        errors.push({ severity: 'error', code: 'INCORRECT_TAX_TYPE', invoiceNo: s.invoiceNo, date: s.date, message: `Intra-state sale (state ${partyStateCode}) but IGST used — should use CGST+SGST` });
      }

      // Invalid invoice number (basic check)
      if (!s.invoiceNo || s.invoiceNo.length > 16) {
        errors.push({ severity: 'warning', code: 'INVALID_INVOICE_NO', invoiceNo: s.invoiceNo || '(empty)', date: s.date, message: 'Invoice number missing or exceeds 16 chars (GSTN limit)' });
      }

      // Net amount check
      const expectedNet = round2(taxable + totalGst + (s.roundOff || 0));
      if (Math.abs((s.netAmount || 0) - expectedNet) > 2) {
        errors.push({ severity: 'warning', code: 'NET_AMOUNT_MISMATCH', invoiceNo: s.invoiceNo, date: s.date, message: `Net amount ₹${s.netAmount} doesn't match taxable + GST (₹${expectedNet})` });
      }
    }

    // Check Credit/Debit Notes
    const notes = await DebitCreditNote.find({
      companyId: toOid(companyId),
      noteSide: 'Sales',
      status: 'Posted',
      ...this._dateFilter(fromDate, toDate),
    }).populate('partyLedgerId', 'name linkedPartyId').lean();

    for (const n of notes) {
      if (!n.noteNo) {
        errors.push({ severity: 'error', code: 'MISSING_NOTE_NO', invoiceNo: n.noteNo || '(empty)', date: n.date, message: 'Credit/Debit note number missing' });
      }
      if (n.taxableAmount > 0 && !n.gstRate && (n.cgst || 0) + (n.sgst || 0) + (n.igst || 0) === 0) {
        if (n.gstRate !== 0) {
          errors.push({ severity: 'warning', code: 'NOTE_ZERO_GST', invoiceNo: n.noteNo, date: n.date, message: `Note has taxable amount ₹${n.taxableAmount} but zero GST` });
        }
      }
      const noteGstin = (n.partyGstin || '').toUpperCase();
      if (noteGstin && noteGstin.length !== 15) {
        errors.push({ severity: 'error', code: 'NOTE_INVALID_GSTIN', invoiceNo: n.noteNo, date: n.date, message: `Note GSTIN invalid: ${noteGstin}` });
      }
    }

    return {
      period: { fromDate, toDate },
      totalErrors: errors.filter((e) => e.severity === 'error').length,
      totalWarnings: errors.filter((e) => e.severity === 'warning').length,
      errors: errors.sort((a, b) => (a.severity === 'error' ? -1 : 1)),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  GSTR-3B ERROR CHECKING
  // ═══════════════════════════════════════════════════════════════

  async checkGstr3bErrors(companyId, period) {
    const gstReturnService = require('./gstReturnService');
    const errors = [];

    const g3b = await gstReturnService.buildGstr3b(companyId, period);
    const outward = g3b.payload.outward || {};
    const netPayable = g3b.payload.netPayable || {};

    // Check if outward data exists but shows zero
    if (outward.taxable > 0 && outward.cgst === 0 && outward.sgst === 0 && outward.igst === 0) {
      errors.push({ severity: 'error', code: 'ZERO_OUTPUT_GST', message: `Outward taxable ₹${outward.taxable} but no output GST calculated` });
    }

    // GSTR-1 vs GSTR-3B reconciliation
    const g1 = await gstReturnService.buildGstr1(companyId, period);
    const g1Totals = g1.totals || {};
    if (Math.abs((g1Totals.taxable || 0) - (outward.taxable || 0)) > 1) {
      errors.push({ severity: 'warning', code: 'GSTR1_3B_TAXABLE_MISMATCH', message: `GSTR-1 taxable (₹${g1Totals.taxable}) ≠ GSTR-3B outward taxable (₹${outward.taxable})` });
    }
    if (Math.abs((g1Totals.cgst || 0) - (outward.cgst || 0)) > 1) {
      errors.push({ severity: 'warning', code: 'GSTR1_3B_CGST_MISMATCH', message: `GSTR-1 CGST (₹${g1Totals.cgst}) ≠ GSTR-3B output CGST (₹${outward.cgst})` });
    }

    // ITC checks
    const itcTotal = (g3b.payload.itc_elg?.itc_avl || []).reduce((s, x) => s + (x.camt || 0) + (x.samt || 0) + (x.iamt || 0), 0);
    if (g3b.payload.inward?.taxable > 0 && itcTotal === 0) {
      errors.push({ severity: 'warning', code: 'ZERO_ITC', message: `Inward supplies ₹${g3b.payload.inward.taxable} but zero ITC claimed — check purchase ITC eligibility` });
    }

    // Negative net payable check (not necessarily an error, but flagged)
    for (const key of ['cgst', 'sgst', 'igst']) {
      if (netPayable[key] < 0) {
        errors.push({ severity: 'info', code: 'NEGATIVE_NET', message: `Net ${key.toUpperCase()} is negative (₹${netPayable[key]}) — ITC exceeds liability, carry forward to next period` });
      }
    }

    // Duplicate invoice detection in sales
    const { periodBounds } = require('../utils/gstDetermination');
    const { startDate, endDate } = periodBounds(period);
    const dupSales = await Sales.aggregate([
      { $match: { companyId: toOid(companyId), date: { $gte: startDate, $lte: endDate }, status: { $ne: 'cancelled' } } },
      { $group: { _id: '$invoiceNo', c: { $sum: 1 } } },
      { $match: { c: { $gt: 1 } } },
    ]);
    if (dupSales.length) {
      errors.push({ severity: 'error', code: 'DUPLICATE_INVOICES', message: `${dupSales.length} duplicate invoice numbers in this period` });
    }

    return {
      period,
      totalErrors: errors.filter((e) => e.severity === 'error').length,
      totalWarnings: errors.filter((e) => e.severity === 'warning').length,
      totalInfo: errors.filter((e) => e.severity === 'info').length,
      errors: errors.sort((a, b) => {
        const order = { error: 0, warning: 1, info: 2 };
        return (order[a.severity] || 9) - (order[b.severity] || 9);
      }),
      gstr3bSummary: {
        outward,
        netPayable,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  GSTR-3B DETAILED DRILL-DOWN
  // ═══════════════════════════════════════════════════════════════

  async getGstr3bDrillDown(companyId, period, section) {
    const { periodBounds } = require('../utils/gstDetermination');
    const { startDate, endDate } = periodBounds(period);
    const filters = { fromDate: startDate, toDate: endDate };

    switch (section) {
      case 'outward_taxable':
      case 'outward_cgst':
      case 'outward_sgst':
      case 'outward_igst':
        return this.getGstinSalesDetail(companyId, filters);
      case 'itc_cgst':
      case 'itc_sgst':
      case 'itc_igst':
      case 'itc_taxable':
        return this.getGstinPurchaseDetail(companyId, filters);
      case 'rcm':
        return this.getGstinPurchaseDetail(companyId, { ...filters, reverseCharge: true });
      default:
        return this.getGstinSalesDetail(companyId, filters);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  ITC-04 (Job Work Quarterly)
  // ═══════════════════════════════════════════════════════════════

  async getItc04Report(companyId, filters = {}) {
    const query = {
      companyId: toOid(companyId),
      status: { $ne: 'Cancelled' },
      ...this._dateFilter(filters.fromDate, filters.toDate, 'issueDate'),
    };

    const jobs = await Job.find(query)
      .populate('workerId', 'name gstin state stateCode')
      .populate('lotId', 'lotId itemId')
      .populate({ path: 'lotId', populate: { path: 'itemId', select: 'name hsnCode' } })
      .sort({ issueDate: -1 })
      .lean();

    const rows = jobs.map((j) => {
      const workerGstin = (j.workerId?.gstin || '').toUpperCase();
      const itemName = j.lotId?.itemId?.name || '';
      const hsnCode = j.lotId?.itemId?.hsnCode || '';

      return {
        _id: j._id,
        jobCardNo: j.jobCardNo,
        issueDate: j.issueDate,
        receiveDate: j.receiveDate || null,
        workerName: j.workerId?.name || 'Unknown',
        workerGstin,
        processType: j.processType || '',
        itemName,
        hsnCode,
        issueQty: j.issueQty || 0,
        issuePcs: j.issuePcs || 0,
        receivedQty: j.receivedQty || 0,
        receivedPcs: j.receivedPcs || 0,
        wastage: j.wastage || 0,
        pendingQty: Math.max(0, (j.issueQty || 0) - (j.receivedQty || 0)),
        status: j.status,
        challanNo: j.challanNo || '',
        // Material movement — ITC-04 tracks goods sent/received, not financial amounts
        isReturned: j.status === 'Received',
        isPartial: j.status === 'Partial',
        isPending: j.status === 'Issued' || j.status === 'In-Process',
      };
    });

    const totals = {
      totalJobs: rows.length,
      totalIssueQty: round2(rows.reduce((s, r) => s + r.issueQty, 0)),
      totalReceivedQty: round2(rows.reduce((s, r) => s + r.receivedQty, 0)),
      totalPendingQty: round2(rows.reduce((s, r) => s + r.pendingQty, 0)),
      totalWastage: round2(rows.reduce((s, r) => s + r.wastage, 0)),
      completed: rows.filter((r) => r.isReturned).length,
      pending: rows.filter((r) => r.isPending).length,
      partial: rows.filter((r) => r.isPartial).length,
    };

    return { reportName: 'ITC-04 Job Work Report', filters, totals, rows };
  }

  // ═══════════════════════════════════════════════════════════════
  //  CROSS-REPORT RECONCILIATION
  // ═══════════════════════════════════════════════════════════════

  async crossReportReconciliation(companyId, period) {
    const gstReturnService = require('./gstReturnService');
    const { periodBounds } = require('../utils/gstDetermination');
    const { startDate, endDate } = periodBounds(period);

    // 1. Sales Register totals
    const salesRows = await this._fetchSalesRows(companyId, { fromDate: startDate, toDate: endDate });
    const salesTotals = this._computeTotals(salesRows);

    // 2. GSTR-1 totals
    const g1 = await gstReturnService.buildGstr1(companyId, period);
    const g1Totals = g1.totals || {};

    // 3. GSTR-3B outward
    const g3b = await gstReturnService.buildGstr3b(companyId, period);
    const outward = g3b.payload.outward || {};

    // 4. Purchase Register totals
    const purchaseRows = await this._fetchPurchaseRows(companyId, { fromDate: startDate, toDate: endDate });
    const purchaseTotals = this._computeTotals(purchaseRows);

    // 5. GSTR-3B inward (ITC)
    const inward = g3b.payload.inward || {};

    // Build reconciliation checks
    const checks = [];

    // Sales vs GSTR-1
    const salesVsG1Taxable = Math.abs(salesTotals.taxableAmount - (g1Totals.taxable || 0));
    checks.push({
      check: 'Sales Register Taxable vs GSTR-1 Taxable',
      value1: salesTotals.taxableAmount,
      source1: 'Sales Register',
      value2: g1Totals.taxable || 0,
      source2: 'GSTR-1',
      difference: round2(salesVsG1Taxable),
      status: salesVsG1Taxable < 1 ? 'MATCH' : 'MISMATCH',
    });

    // Sales CGST vs GSTR-1 CGST
    checks.push({
      check: 'Sales CGST vs GSTR-1 CGST',
      value1: salesTotals.cgst,
      source1: 'Sales Register',
      value2: g1Totals.cgst || 0,
      source2: 'GSTR-1',
      difference: round2(Math.abs(salesTotals.cgst - (g1Totals.cgst || 0))),
      status: Math.abs(salesTotals.cgst - (g1Totals.cgst || 0)) < 1 ? 'MATCH' : 'MISMATCH',
    });

    // Sales SGST vs GSTR-1 SGST
    checks.push({
      check: 'Sales SGST vs GSTR-1 SGST',
      value1: salesTotals.sgst,
      source1: 'Sales Register',
      value2: g1Totals.sgst || 0,
      source2: 'GSTR-1',
      difference: round2(Math.abs(salesTotals.sgst - (g1Totals.sgst || 0))),
      status: Math.abs(salesTotals.sgst - (g1Totals.sgst || 0)) < 1 ? 'MATCH' : 'MISMATCH',
    });

    // Sales IGST
    checks.push({
      check: 'Sales IGST vs GSTR-1 IGST',
      value1: salesTotals.igst,
      source1: 'Sales Register',
      value2: g1Totals.igst || 0,
      source2: 'GSTR-1',
      difference: round2(Math.abs(salesTotals.igst - (g1Totals.igst || 0))),
      status: Math.abs(salesTotals.igst - (g1Totals.igst || 0)) < 1 ? 'MATCH' : 'MISMATCH',
    });

    // GSTR-1 vs GSTR-3B outward
    const g1OutwardTaxable = g1Totals.netTaxable !== undefined ? g1Totals.netTaxable : (g1Totals.taxable || 0);
    checks.push({
      check: 'GSTR-1 Taxable vs GSTR-3B Outward Taxable',
      value1: g1OutwardTaxable,
      source1: 'GSTR-1',
      value2: outward.taxable || 0,
      source2: 'GSTR-3B',
      difference: round2(Math.abs(g1OutwardTaxable - (outward.taxable || 0))),
      status: Math.abs(g1OutwardTaxable - (outward.taxable || 0)) < 1 ? 'MATCH' : 'MISMATCH',
    });

    // Purchase vs GSTR-3B ITC
    checks.push({
      check: 'Purchase Register Taxable vs GSTR-3B Inward Taxable',
      value1: purchaseTotals.taxableAmount,
      source1: 'Purchase Register',
      value2: inward.taxable || 0,
      source2: 'GSTR-3B',
      difference: round2(Math.abs(purchaseTotals.taxableAmount - (inward.taxable || 0))),
      status: Math.abs(purchaseTotals.taxableAmount - (inward.taxable || 0)) < 1 ? 'MATCH' : 'MISMATCH',
    });

    const allMatch = checks.every((c) => c.status === 'MATCH');
    const mismatches = checks.filter((c) => c.status === 'MISMATCH');

    return {
      period,
      overallStatus: allMatch ? 'RECONCILED' : 'EXCEPTIONS_FOUND',
      checks,
      mismatches,
      summary: {
        salesRegister: salesTotals,
        gstr1: g1Totals,
        gstr3bOutward: outward,
        purchaseRegister: purchaseTotals,
        gstr3bInward: inward,
        gstr3bNetPayable: g3b.payload.netPayable || {},
      },
    };
  }
}

module.exports = new GstinReportService();
