const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');

class GstService {
  async getGstr1(companyId, startDate, endDate) {
    const query = { companyId };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const sales = await Sales.find(query).populate('customerId', 'name gstin state');
    
    return sales.map(s => {
      // Logic for GST Split (Simplified for this ERP context)
      // If Customer State == Company State -> CGST/SGST, else IGST
      // Real implementation would compare with company.state
      return {
        invoiceNo: s.invoiceNo,
        date: s.date,
        partyName: s.customerId?.name,
        gstin: s.customerId?.gstin,
        taxable: s.taxableAmount,
        cgst: s.gstAmount / 2, // Assuming 50/50 split for intrastate
        sgst: s.gstAmount / 2,
        igst: 0, 
        totalGst: s.gstAmount,
        netAmount: s.netAmount
      };
    });
  }

  async getGstr2(companyId, startDate, endDate) {
    const query = { companyId };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const purchases = await Purchase.find(query).populate('supplierId', 'name gstin state');

    return purchases.map(p => ({
      invoiceNo: p.invoiceNo,
      date: p.date,
      partyName: p.supplierId?.name,
      gstin: p.supplierId?.gstin,
      taxable: p.totalAmount, // Purchase model totalAmount is taxable in current schema
      gstAmount: p.gstAmount || 0,
      netAmount: p.netAmount || p.totalAmount
    }));
  }
}

module.exports = new GstService();
