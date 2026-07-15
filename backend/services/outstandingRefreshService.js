const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');
const Party = require('../models/Party');

/**
 * Recompute document-level outstanding snapshot for a party (or company summary).
 * Source of truth remains Sales/Purchase paidAmount — this refreshes derived views.
 */
async function refreshPartyOutstanding(companyId, partyId) {
  const [sales, purchases] = await Promise.all([
    Sales.find({
      companyId,
      customerId: partyId,
      status: { $in: ['active', 'partial'] },
    }).select('netAmount paidAmount invoiceNo date status').lean(),
    Purchase.find({
      companyId,
      supplierId: partyId,
      status: { $in: ['active', 'partial'] },
    }).select('netAmount paidAmount invoiceNo date status').lean(),
  ]);

  const receivable = sales.reduce((s, inv) => s + Math.max(0, (inv.netAmount || 0) - (inv.paidAmount || 0)), 0);
  const payable = purchases.reduce((s, inv) => s + Math.max(0, (inv.netAmount || 0) - (inv.paidAmount || 0)), 0);

  // Optional denormalize onto party if fields exist
  try {
    await Party.findOneAndUpdate(
      { _id: partyId, companyId },
      {
        $set: {
          outstandingReceivable: Number(receivable.toFixed(2)),
          outstandingPayable: Number(payable.toFixed(2)),
          outstandingRefreshedAt: new Date(),
        },
      }
    );
  } catch {
    /* party schema may not have these fields — ignore */
  }

  return {
    partyId,
    receivable: Number(receivable.toFixed(2)),
    payable: Number(payable.toFixed(2)),
    openSales: sales.length,
    openPurchases: purchases.length,
  };
}

async function refreshCompanyOutstandingSummary(companyId) {
  const sales = await Sales.find({
    companyId,
    status: { $in: ['active', 'partial'] },
  }).select('netAmount paidAmount').lean();

  const purchases = await Purchase.find({
    companyId,
    status: { $in: ['active', 'partial'] },
  }).select('netAmount paidAmount').lean();

  const totalReceivable = sales.reduce((s, i) => s + Math.max(0, (i.netAmount || 0) - (i.paidAmount || 0)), 0);
  const totalPayable = purchases.reduce((s, i) => s + Math.max(0, (i.netAmount || 0) - (i.paidAmount || 0)), 0);

  return {
    totalReceivable: Number(totalReceivable.toFixed(2)),
    totalPayable: Number(totalPayable.toFixed(2)),
    openSalesCount: sales.length,
    openPurchasesCount: purchases.length,
    refreshedAt: new Date(),
  };
}

async function listOverdueSales(companyId, { daysPastDue = 0 } = {}) {
  const today = new Date();
  const sales = await Sales.find({
    companyId,
    status: { $in: ['active', 'partial'] },
  })
    .populate('customerId', 'name')
    .select('invoiceNo netAmount paidAmount dueDate date customerId')
    .lean();

  return sales
    .map((s) => {
      const due = s.dueDate ? new Date(s.dueDate) : new Date(s.date);
      const outstanding = Math.max(0, (s.netAmount || 0) - (s.paidAmount || 0));
      const days = Math.floor((today - due) / (24 * 3600 * 1000));
      return { ...s, outstanding, daysOverdue: days };
    })
    .filter((s) => s.outstanding > 0 && s.daysOverdue >= daysPastDue);
}

module.exports = {
  refreshPartyOutstanding,
  refreshCompanyOutstandingSummary,
  listOverdueSales,
};
