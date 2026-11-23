const mongoose = require('mongoose');
const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');
const InventoryLot = require('../models/InventoryLot');
const PaymentVoucher = require('../models/PaymentVoucher');
const Party = require('../models/Party');
const Job = require('../models/Job');

function dayBounds(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function toOid(companyId) {
  if (companyId instanceof mongoose.Types.ObjectId) return companyId;
  return new mongoose.Types.ObjectId(String(companyId));
}

/**
 * Tenant dashboard KPIs — computed server-side only.
 */
class DashboardService {
  async getSummary(companyId) {
    if (!companyId) throw new Error('companyId required');
    const cid = toOid(companyId);
    const { start, end } = dayBounds();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fyStart = new Date(fyYear, 3, 1);

    const [
      salesTodayAgg,
      purchaseTodayAgg,
      salesMonthAgg,
      purchaseMonthAgg,
      salesFyAgg,
      purchaseFyAgg,
      receivableOutstanding,
      payableOutstanding,
      lowStock,
      lotsAvailable,
      jobsOpen,
      partiesCount,
      topCustomers,
      topSuppliers,
      cashAgg,
    ] = await Promise.all([
      Sales.aggregate([
        { $match: { companyId: cid, status: { $ne: 'cancelled' }, date: { $gte: start, $lte: end } } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$netAmount' } } },
      ]),
      Purchase.aggregate([
        { $match: { companyId: cid, status: { $ne: 'cancelled' }, date: { $gte: start, $lte: end } } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$netAmount' } } },
      ]),
      Sales.aggregate([
        { $match: { companyId: cid, status: { $ne: 'cancelled' }, date: { $gte: monthStart } } },
        { $group: { _id: null, amount: { $sum: '$netAmount' } } },
      ]),
      Purchase.aggregate([
        { $match: { companyId: cid, status: { $ne: 'cancelled' }, date: { $gte: monthStart } } },
        { $group: { _id: null, amount: { $sum: '$netAmount' } } },
      ]),
      Sales.aggregate([
        { $match: { companyId: cid, status: { $ne: 'cancelled' }, date: { $gte: fyStart } } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$netAmount' } } },
      ]),
      Purchase.aggregate([
        { $match: { companyId: cid, status: { $ne: 'cancelled' }, date: { $gte: fyStart } } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$netAmount' } } },
      ]),
      Sales.aggregate([
        { $match: { companyId: cid, status: { $in: ['active', 'partial'] } } },
        { $group: { _id: null, amount: { $sum: { $subtract: ['$netAmount', { $ifNull: ['$paidAmount', 0] }] } } } },
      ]),
      Purchase.aggregate([
        { $match: { companyId: cid, status: { $in: ['active', 'partial'] } } },
        { $group: { _id: null, amount: { $sum: { $subtract: ['$netAmount', { $ifNull: ['$paidAmount', 0] }] } } } },
      ]),
      InventoryLot.countDocuments({ companyId: cid, remainingMtrs: { $gt: 0, $lt: 50 }, status: { $ne: 'Closed' } }),
      InventoryLot.countDocuments({ companyId: cid, status: { $ne: 'Closed' }, remainingMtrs: { $gt: 0 } }),
      Job.countDocuments({ companyId: cid, status: { $in: ['Issued', 'In-Process'] } }),
      Party.countDocuments({ companyId: cid }),
      Sales.aggregate([
        { $match: { companyId: cid, status: { $ne: 'cancelled' } } },
        { $group: { _id: '$customerId', amount: { $sum: '$netAmount' }, count: { $sum: 1 } } },
        { $sort: { amount: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'parties', localField: '_id', foreignField: '_id', as: 'party' } },
        { $unwind: { path: '$party', preserveNullAndEmptyArrays: true } },
        { $project: { name: '$party.name', amount: 1, count: 1 } },
      ]),
      Purchase.aggregate([
        { $match: { companyId: cid, status: { $ne: 'cancelled' } } },
        { $group: { _id: '$supplierId', amount: { $sum: '$netAmount' }, count: { $sum: 1 } } },
        { $sort: { amount: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'parties', localField: '_id', foreignField: '_id', as: 'party' } },
        { $unwind: { path: '$party', preserveNullAndEmptyArrays: true } },
        { $project: { name: '$party.name', amount: 1, count: 1 } },
      ]),
      PaymentVoucher.aggregate([
        { $match: { companyId: cid, voucherType: 'Receipt', date: { $gte: start, $lte: end }, status: { $ne: 'Draft' } } },
        { $group: { _id: null, amount: { $sum: '$amount' } } },
      ]).catch(() => []),
    ]);

    const salesToday = salesTodayAgg[0] || { count: 0, amount: 0 };
    const purchaseToday = purchaseTodayAgg[0] || { count: 0, amount: 0 };
    const salesMonth = salesMonthAgg[0]?.amount || 0;
    const purchaseMonth = purchaseMonthAgg[0]?.amount || 0;
    const salesFy = salesFyAgg[0] || { count: 0, amount: 0 };
    const purchaseFy = purchaseFyAgg[0] || { count: 0, amount: 0 };
    const receivable = receivableOutstanding[0]?.amount || 0;
    const payable = payableOutstanding[0]?.amount || 0;
    const cashToday = cashAgg[0]?.amount || 0;

    return {
      asOf: new Date().toISOString(),
      currentFy: `${fyYear}-${String((fyYear + 1) % 100).padStart(2, '0')}`,
      salesToday: { count: salesToday.count || 0, amount: salesToday.amount || 0 },
      purchaseToday: { count: purchaseToday.count || 0, amount: purchaseToday.amount || 0 },
      salesMonthAmount: salesMonth,
      purchaseMonthAmount: purchaseMonth,
      salesFy: { count: salesFy.count || 0, amount: salesFy.amount || 0 },
      purchaseFy: { count: purchaseFy.count || 0, amount: purchaseFy.amount || 0 },
      profitProxy: salesMonth - purchaseMonth,
      cashToday,
      receivable,
      payable,
      outstandingNet: receivable - payable,
      lowStockLots: lowStock,
      availableLots: lotsAvailable,
      openJobs: jobsOpen,
      partiesCount,
      topCustomers,
      topSuppliers,
    };
  }
}

module.exports = new DashboardService();
