const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');
const ReturnInvoice = require('../models/ReturnInvoice');
const DebitCreditNote = require('../models/DebitCreditNote');
const Company = require('../models/Company');

class GstService {
  async getGstr1(companyId, startDate, endDate) {
    const query = { companyId, status: { $ne: 'cancelled' } };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    const company = await Company.findById(companyId);
    const sales = await Sales.find(query)
      .populate('customerId', 'name gstin state')
      .populate('items.itemId', 'name hsnCode gstRate');

    const b2b = [];
    const b2cl = [];
    const b2cs = [];
    const hsnMap = {};

    sales.forEach((s) => {
      const gstin = s.customerId?.gstin || '';
      const isRegistered = gstin.length >= 15;
      const taxable = s.taxableAmount || 0;
      const gst = s.gstAmount || 0;
      const cgst = s.cgst || (gst / 2);
      const sgst = s.sgst || (gst / 2);

      const row = {
        inum: s.invoiceNo,
        idt: s.date ? new Date(s.date).toISOString().split('T')[0] : '',
        val: s.netAmount,
        pos: company?.meta?.state || 'Gujarat',
        rchrg: 'N',
        inv_typ: 'R',
        ctin: gstin,
        cname: s.customerId?.name || 'Cash Customer',
        txval: parseFloat(taxable.toFixed(2)),
        iamt: s.igst || 0,
        camt: parseFloat(cgst.toFixed(2)),
        samt: parseFloat(sgst.toFixed(2)),
        csamt: 0
      };

      if (isRegistered) {
        b2b.push(row);
      } else if (taxable > 250000) {
        b2cl.push({ ...row, etin: '' });
      } else {
        // FIXED: Accumulate into b2cs (multiple invoices can fall here)
        b2cs.push({
          typ: 'OE',
          pos: row.pos,
          rt: 5, // Default GST rate for b2cs summary — will vary per item below
          txval: parseFloat(taxable.toFixed(2)),
          iamt: 0,
          camt: parseFloat(cgst.toFixed(2)),
          samt: parseFloat(sgst.toFixed(2)),
          csamt: 0
        });
      }

      (s.items || []).forEach((line) => {
        const hsn = line.itemId?.hsnCode || '5208';
        // FIXED: Use actual item GST rate instead of hardcoded 5%
        const itemGstRate = (line.itemId?.gstRate || 5) / 100;
        const halfGstRate = itemGstRate / 2;

        const lineTaxable = line.amount || (line.mts || 0) * (line.rate || 0);

        if (!hsnMap[hsn]) {
          hsnMap[hsn] = {
            hsn_sc: hsn,
            desc: line.itemId?.name || '',
            uqc: 'MTR',
            qty: 0,
            rt: line.itemId?.gstRate || 5,
            txval: 0,
            iamt: 0,
            camt: 0,
            samt: 0,
            csamt: 0
          };
        }
        hsnMap[hsn].qty += line.mts || 0;
        hsnMap[hsn].txval += lineTaxable;
        // FIXED: Use item's actual GST rate for CGST/SGST calculation
        hsnMap[hsn].camt += parseFloat((lineTaxable * halfGstRate).toFixed(2));
        hsnMap[hsn].samt += parseFloat((lineTaxable * halfGstRate).toFixed(2));
      });
    });

    const fp = startDate
      ? `${String(new Date(startDate).getMonth() + 1).padStart(2, '0')}${new Date(startDate).getFullYear()}`
      : '';

    return {
      gstin: company?.meta?.gstin || '',
      fp,
      version: 'GST3.2.2',
      hash: 'hash',
      b2b,
      b2cl,
      b2cs,
      hsn: { data: Object.values(hsnMap) },
      invoices: sales.map(s => ({
        invoiceNo: s.invoiceNo,
        date: s.date,
        partyName: s.customerId?.name,
        gstin: s.customerId?.gstin,
        taxable: s.taxableAmount,
        cgst: s.cgst || (s.gstAmount || 0) / 2,
        sgst: s.sgst || (s.gstAmount || 0) / 2,
        igst: s.igst || 0,
        totalGst: s.gstAmount,
        netAmount: s.netAmount
      }))
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
