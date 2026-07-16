const Purchase = require('../models/Purchase');
const Sales = require('../models/Sales');
const Gstr2bImport = require('../models/Gstr2bImport');
const gstReturnService = require('./gstReturnService');
const financialAudit = require('./financialAuditService');
const { periodBounds, normalizeGstin } = require('../utils/gstDetermination');
const auditService = require('./auditService');

const round2 = (n) => Number(Number(n || 0).toFixed(2));

/**
 * GST Reconciliation Engine — Sprint 4.8
 */
class GstReconciliationService {
  async importGstr2b(companyId, { period, rows, source = 'JSON' }, userId) {
    if (!period) throw new Error('period required (YYYY-MM)');
    const normalized = (rows || []).map((r) => ({
      ctin: normalizeGstin(r.ctin || r.gstin),
      tradeName: r.tradeName || r.cname || '',
      inum: String(r.inum || r.invoiceNo || ''),
      idt: r.idt || r.date || '',
      val: round2(r.val || r.netAmount || 0),
      txval: round2(r.txval || r.taxableAmount || 0),
      igst: round2(r.igst || r.iamt || 0),
      cgst: round2(r.cgst || r.camt || 0),
      sgst: round2(r.sgst || r.samt || 0),
      cess: round2(r.cess || r.csamt || 0),
      invTyp: r.invTyp || 'R',
      matchStatus: 'Unmatched',
    }));

    const doc = await Gstr2bImport.create({
      companyId,
      period,
      source,
      importedAt: new Date(),
      importedBy: userId,
      rows: normalized,
      summary: { totalRows: normalized.length },
    });

    await auditService.logSystem({
      companyId, userId, action: 'GSTR2B_IMPORT', module: 'Gstr2bImport',
      referenceId: doc._id, after: { period, rows: normalized.length },
    });

    return this.reconcile2b(companyId, doc._id, userId);
  }

  async reconcile2b(companyId, importId, userId) {
    const doc = await Gstr2bImport.findOne({ _id: importId, companyId });
    if (!doc) throw new Error('2B import not found');

    const { startDate, endDate } = periodBounds(doc.period);
    const purchases = await Purchase.find({
      companyId,
      date: { $gte: startDate, $lte: endDate },
    }).populate('supplierId', 'gstin name').lean();

    const purchaseIndex = {};
    for (const p of purchases) {
      const key = `${normalizeGstin(p.supplierId?.gstin)}|${String(p.invoiceNo || '').trim()}`;
      purchaseIndex[key] = p;
      purchaseIndex[`|${String(p.invoiceNo || '').trim()}`] = p;
    }

    let matched = 0;
    let mismatched = 0;
    let missingInErp = 0;
    const matchedPurchaseIds = new Set();

    for (const row of doc.rows) {
      const key = `${row.ctin}|${row.inum}`;
      const p = purchaseIndex[key] || purchaseIndex[`|${row.inum}`];
      if (!p) {
        row.matchStatus = 'MissingInERP';
        row.remarks = 'Invoice not found in ERP purchases';
        missingInErp += 1;
        continue;
      }
      matchedPurchaseIds.add(p._id.toString());
      row.matchedPurchaseId = p._id;
      const taxDiff = round2(
        (row.cgst + row.sgst + row.igst) - ((p.cgst || 0) + (p.sgst || 0) + (p.igst || 0))
      );
      const valDiff = round2(row.txval - (p.taxableAmount || 0));
      const gstinOk = !row.ctin || row.ctin === normalizeGstin(p.supplierId?.gstin);

      if (!gstinOk) {
        row.matchStatus = 'Mismatch';
        row.difference = valDiff;
        row.remarks = 'Wrong GSTIN';
        mismatched += 1;
      } else if (Math.abs(taxDiff) > 1 || Math.abs(valDiff) > 1) {
        row.matchStatus = 'Partial';
        row.difference = taxDiff || valDiff;
        row.remarks = Math.abs(taxDiff) > 1 ? 'Tax difference' : 'Taxable value difference';
        mismatched += 1;
      } else {
        row.matchStatus = 'Matched';
        row.difference = 0;
        row.remarks = '';
        matched += 1;
      }
    }

    // Purchases missing in 2B
    const missingIn2bRows = [];
    for (const p of purchases) {
      if (matchedPurchaseIds.has(p._id.toString())) continue;
      missingIn2bRows.push({
        ctin: normalizeGstin(p.supplierId?.gstin),
        tradeName: p.supplierId?.name || '',
        inum: p.invoiceNo,
        idt: p.date ? new Date(p.date).toISOString().slice(0, 10) : '',
        val: p.netAmount,
        txval: p.taxableAmount,
        igst: p.igst || 0,
        cgst: p.cgst || 0,
        sgst: p.sgst || 0,
        matchStatus: 'MissingIn2B',
        matchedPurchaseId: p._id,
        remarks: 'In ERP but not in GSTR-2B',
      });
    }

    doc.rows = [...doc.rows, ...missingIn2bRows];
    doc.summary = {
      totalRows: doc.rows.length,
      matched,
      mismatched,
      missingInErp,
      missingIn2b: missingIn2bRows.length,
    };
    doc.updatedBy = userId;
    await doc.save();
    return doc;
  }

  async salesVsGstr1(companyId, period) {
    const g1 = await gstReturnService.buildGstr1(companyId, period);
    const { startDate, endDate } = periodBounds(period);
    const sales = await Sales.find({
      companyId,
      status: { $ne: 'cancelled' },
      date: { $gte: startDate, $lte: endDate },
    }).lean();

    const exceptions = [];
    for (const s of sales) {
      if (!s.customerId) continue;
      if ((s.taxableAmount || 0) > 0 && !(s.cgst || s.sgst || s.igst) && s.gstType !== 'Exempt' && s.gstType !== 'NilRated' && s.gstType !== 'ZeroRated') {
        exceptions.push({
          type: 'ZeroGST',
          invoiceNo: s.invoiceNo,
          message: 'Taxable invoice with zero GST',
        });
      }
    }

    return {
      period,
      salesCount: sales.length,
      gstr1InvoiceCount: g1.totals.invoiceCount,
      totalsMatch: Math.abs(
        round2(sales.reduce((a, s) => a + (s.taxableAmount || 0), 0)) - g1.totals.taxable
      ) < 1,
      exceptions,
      gstr1Totals: g1.totals,
    };
  }

  async gstVsBooks(companyId, period) {
    const g3 = await gstReturnService.buildGstr3b(companyId, period);
    const gl = await financialAudit.gstVsGl(companyId);
    return {
      period,
      gstr3b: g3.payload.netPayable,
      gstLedgers: gl.ledgers,
      ok: true,
    };
  }

  async fullReconciliation(companyId, period) {
    const sales = await this.salesVsGstr1(companyId, period);
    const books = await this.gstVsBooks(companyId, period);
    const latest2b = await Gstr2bImport.findOne({ companyId, period }).sort({ createdAt: -1 }).lean();

    const exceptions = [...(sales.exceptions || [])];
    if (latest2b?.summary) {
      if (latest2b.summary.mismatched) {
        exceptions.push({ type: '2B_Mismatch', message: `${latest2b.summary.mismatched} tax/value mismatches` });
      }
      if (latest2b.summary.missingInErp) {
        exceptions.push({ type: '2B_MissingInERP', message: `${latest2b.summary.missingInErp} portal invoices missing in ERP` });
      }
      if (latest2b.summary.missingIn2b) {
        exceptions.push({ type: '2B_MissingIn2B', message: `${latest2b.summary.missingIn2b} ERP purchases missing in 2B` });
      }
    }

    // Duplicate invoice detection
    const { startDate, endDate } = periodBounds(period);
    const dupSales = await Sales.aggregate([
      {
        $match: {
          companyId: new (require('mongoose').Types.ObjectId)(String(companyId)),
          date: { $gte: startDate, $lte: endDate },
        },
      },
      { $group: { _id: '$invoiceNo', c: { $sum: 1 } } },
      { $match: { c: { $gt: 1 } } },
    ]);
    if (dupSales.length) {
      exceptions.push({ type: 'DuplicateInvoice', message: `${dupSales.length} duplicate sales invoice numbers` });
    }

    return {
      period,
      ok: exceptions.length === 0 && sales.totalsMatch,
      exceptions,
      sales,
      books,
      gstr2b: latest2b?.summary || null,
    };
  }
}

module.exports = new GstReconciliationService();
