const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');
const ReturnInvoice = require('../models/ReturnInvoice');
const DebitCreditNote = require('../models/DebitCreditNote');
const Company = require('../models/Company');

class GstService {
  async getGstr1(companyId, startDate, endDate) {
    const { periodKey } = require('../utils/gstDetermination');
    const gstReturnService = require('./gstReturnService');
    const period = startDate ? periodKey(new Date(startDate)) : periodKey();
    const built = await gstReturnService.buildGstr1(companyId, period);

    // Flatten for CA dashboard / legacy consumers
    const invoices = [];
    for (const party of built.payload.b2b || []) {
      for (const inv of party.inv || []) {
        const det = inv.itms?.[0]?.itm_det || {};
        invoices.push({
          invoiceNo: inv.inum,
          date: inv.idt,
          partyName: '',
          gstin: party.ctin,
          taxable: det.txval,
          cgst: det.camt,
          sgst: det.samt,
          igst: det.iamt,
          totalGst: (det.camt || 0) + (det.samt || 0) + (det.iamt || 0),
          netAmount: inv.val,
        });
      }
    }

    return {
      ...built.payload,
      invoices: invoices.length ? invoices : built.payload.invoices,
      period,
      totals: built.totals,
    };
  }

  async getGstr2(companyId, startDate, endDate) {
    const query = { companyId };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    const purchases = await Purchase.find(query)
      .populate('supplierId', 'name gstin state')
      .populate('items.itemId', 'name hsnCode gstRate');

    return purchases.map(p => ({
      invoiceNo: p.invoiceNo,
      date: p.date,
      partyName: p.supplierId?.name,
      gstin: p.supplierId?.gstin,
      // FIXED: Now using standardized field name taxableAmount (was totalAmount — confusing)
      taxable: p.taxableAmount || 0,
      cgst: p.cgst || (p.gstAmount || 0) / 2,
      sgst: p.sgst || (p.gstAmount || 0) / 2,
      igst: p.igst || 0,
      gstAmount: p.gstAmount || 0,
      netAmount: p.netAmount || p.taxableAmount
    }));
  }

  /** Unified CA dashboard — GSTR-1, GSTR-2, GSTR-3B, registers, warnings */
  async getCADashboard(companyId, startDate, endDate) {
    const dateFilter = {};
    if (startDate || endDate) {
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }
    }

    const [gstr1, gstr2, company, returns, notes] = await Promise.all([
      this.getGstr1(companyId, startDate, endDate),
      this.getGstr2(companyId, startDate, endDate),
      Company.findById(companyId).lean(),
      ReturnInvoice.find({
        companyId,
        ...(Object.keys(dateFilter).length ? { date: dateFilter } : {})
      }).populate('partyId', 'name gstin').lean(),
      DebitCreditNote.find({
        companyId,
        ...(Object.keys(dateFilter).length ? { date: dateFilter } : {})
      }).populate('partyLedgerId', 'name').lean()
    ]);

    let outwardTaxable = 0;
    let outwardCgst = 0;
    let outwardSgst = 0;
    let outwardIgst = 0;
    (gstr1.invoices || []).forEach((inv) => {
      outwardTaxable += inv.taxable || 0;
      outwardCgst += inv.cgst || 0;
      outwardSgst += inv.sgst || 0;
      outwardIgst += inv.igst || 0;
    });

    let inwardTaxable = 0;
    let itcCgst = 0;
    let itcSgst = 0;
    let itcIgst = 0;
    gstr2.forEach((p) => {
      inwardTaxable += p.taxable || 0;
      itcCgst += p.cgst || 0;
      itcSgst += p.sgst || 0;
      itcIgst += p.igst || 0;
    });

    const netCgst = outwardCgst - itcCgst;
    const netSgst = outwardSgst - itcSgst;
    const netIgst = outwardIgst - itcIgst;

    const warnings = [];
    (gstr1.invoices || []).forEach((inv) => {
      if (!inv.gstin && (inv.taxable || 0) > 250000) {
        warnings.push({ type: 'error', code: 'B2CL_CHECK', message: `Invoice ${inv.invoiceNo}: large B2C sale — verify B2CL classification` });
      }
      if ((inv.totalGst || 0) === 0 && (inv.taxable || 0) > 0) {
        warnings.push({ type: 'warn', code: 'ZERO_GST', message: `Invoice ${inv.invoiceNo}: taxable amount with zero GST` });
      }
    });
    gstr2.forEach((p) => {
      if (!p.gstin) {
        warnings.push({ type: 'warn', code: 'NO_GSTIN', message: `Purchase ${p.invoiceNo}: supplier GSTIN missing — ITC may be blocked` });
      }
    });
    if (!(gstr1.hsn?.data || []).length && (gstr1.invoices || []).length) {
      warnings.push({ type: 'warn', code: 'HSN_MISSING', message: 'HSN summary empty — check item HSN codes in master' });
    }

    const returnGst = returns.reduce((s, r) => s + (r.gstAmount || 0), 0);
    const noteGst = notes.reduce((s, n) => s + (n.gstAmount || 0), 0);

    return {
      generatedAt: new Date().toISOString(),
      company: {
        name: company?.name || '',
        gstin: company?.meta?.gstin || gstr1.gstin || '',
        state: company?.meta?.state || ''
      },
      period: { startDate: startDate || null, endDate: endDate || null, fp: gstr1.fp },
      summary: {
        salesCount: (gstr1.invoices || []).length,
        purchaseCount: gstr2.length,
        b2bCount: (gstr1.b2b || []).length,
        b2clCount: (gstr1.b2cl || []).length,
        b2csCount: (gstr1.b2cs || []).length,
        hsnCount: (gstr1.hsn?.data || []).length,
        returnsCount: returns.length,
        notesCount: notes.length,
        outwardTaxable: parseFloat(outwardTaxable.toFixed(2)),
        outwardGst: parseFloat((outwardCgst + outwardSgst + outwardIgst).toFixed(2)),
        inwardTaxable: parseFloat(inwardTaxable.toFixed(2)),
        itcAvailable: parseFloat((itcCgst + itcSgst + itcIgst).toFixed(2)),
        returnGst: parseFloat(returnGst.toFixed(2)),
        noteGst: parseFloat(noteGst.toFixed(2))
      },
      gstr3b: {
        outward: {
          taxable: parseFloat(outwardTaxable.toFixed(2)),
          cgst: parseFloat(outwardCgst.toFixed(2)),
          sgst: parseFloat(outwardSgst.toFixed(2)),
          igst: parseFloat(outwardIgst.toFixed(2)),
          total: parseFloat((outwardCgst + outwardSgst + outwardIgst).toFixed(2))
        },
        itc: {
          taxable: parseFloat(inwardTaxable.toFixed(2)),
          cgst: parseFloat(itcCgst.toFixed(2)),
          sgst: parseFloat(itcSgst.toFixed(2)),
          igst: parseFloat(itcIgst.toFixed(2)),
          total: parseFloat((itcCgst + itcSgst + itcIgst).toFixed(2))
        },
        net: {
          cgst: parseFloat(netCgst.toFixed(2)),
          sgst: parseFloat(netSgst.toFixed(2)),
          igst: parseFloat(netIgst.toFixed(2)),
          total: parseFloat((netCgst + netSgst + netIgst).toFixed(2))
        }
      },
      gstr1,
      gstr2,
      returns: returns.map((r) => ({
        returnNo: r.invoiceNo,
        date: r.date,
        type: r.returnType,
        partyName: r.partyId?.name,
        gstin: r.partyId?.gstin,
        taxable: r.taxableAmount || 0,
        gstAmount: r.gstAmount || 0,
        netAmount: r.netAmount || 0
      })),
      notes: notes.map((n) => ({
        noteNo: n.noteNo,
        date: n.date,
        noteType: n.noteType,
        partyName: n.partyLedgerId?.name,
        amount: n.amount || 0,
        againstInvoiceNo: n.againstInvoiceNo || ''
      })),
      warnings
    };
  }
}

module.exports = new GstService();
