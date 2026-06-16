const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');
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
}

module.exports = new GstService();
