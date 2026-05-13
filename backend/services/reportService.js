const InventoryLot = require('../models/InventoryLot');
const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');
const LedgerEntry = require('../models/LedgerEntry');
const Party = require('../models/Party');

class ReportService {
  async getStockReport(companyId) {
    return await InventoryLot.find({ companyId, remainingMtrs: { $gt: 0 } })
      .populate('itemId', 'name category fabricType')
      .sort({ itemId: 1 });
  }

  async getOutstanding(companyId, type = 'Receivable') {
    // Receivable -> Sundry Debtors, Payable -> Sundry Creditors
    const group = type === 'Receivable' ? 'Customer' : 'Supplier';
    const parties = await Party.find({ companyId, type: { $in: [group, 'Both'] } });
    
    const report = [];
    for (const party of parties) {
      const entries = await LedgerEntry.find({ accountId: party._id, companyId });
      const balance = entries.reduce((acc, e) => acc + (e.debit || 0) - (e.credit || 0), 0);
      
      if (Math.abs(balance) > 0.01) {
        report.push({
          partyName: party.name,
          mobile: party.mobile,
          balance: Math.abs(balance),
          type: balance > 0 ? 'Dr' : 'Cr'
        });
      }
    }
    return report;
  }

  async getProfitLoss(companyId, startDate, endDate) {
    const query = { companyId };
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const sales = await Sales.find(query);
    const purchases = await Purchase.find(query);

    const totalSales = sales.reduce((acc, s) => acc + s.taxableAmount, 0);
    const totalPurchases = purchases.reduce((acc, p) => acc + p.totalAmount, 0);
    
    // Very simplified P&L logic
    return {
      revenue: totalSales,
      cogs: totalPurchases, // Simplified
      grossProfit: totalSales - totalPurchases,
      netProfit: totalSales - totalPurchases // Placeholder for expense deduction
    };
  }
}

module.exports = new ReportService();
