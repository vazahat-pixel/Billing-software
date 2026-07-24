const mongoose = require('mongoose');
const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');
const InventoryLot = require('../models/InventoryLot');
const Job = require('../models/Job');
const Party = require('../models/Party');
const PaymentVoucher = require('../models/PaymentVoucher');
const dashboardService = require('./dashboardService');
const complianceDashboard = require('./complianceDashboardService');

function toOid(companyId) {
  if (companyId instanceof mongoose.Types.ObjectId) return companyId;
  return new mongoose.Types.ObjectId(String(companyId));
}

function monthStart(monthsAgo = 0) {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() - monthsAgo);
  return d;
}

/**
 * Stage 6.8 — Business Intelligence dashboards.
 * Extends dashboardService + compliance KPIs; no parallel transaction truth.
 */
class BiAnalyticsService {
  async overview(companyId) {
    const summary = await dashboardService.getSummary(companyId);
    let gst = null;
    try {
      gst = await complianceDashboard.get(companyId);
    } catch {
      gst = null;
    }
    return {
      summary,
      gst,
      modules: [
        'sales',
        'purchase',
        'inventory',
        'production',
        'gst',
        'accounting',
        'cashflow',
        'trends',
      ],
    };
  }

  async salesAnalytics(companyId, { months = 6 } = {}) {
    const cid = toOid(companyId);
    const since = monthStart(months - 1);
    const byMonth = await Sales.aggregate([
      { $match: { companyId: cid, status: { $ne: 'cancelled' }, date: { $gte: since } } },
      {
        $group: {
          _id: { y: { $year: '$date' }, m: { $month: '$date' } },
          amount: { $sum: '$netAmount' },
          count: { $sum: 1 },
          taxable: { $sum: { $ifNull: ['$taxableAmount', 0] } },
        },
      },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]);
    const topCustomers = await Sales.aggregate([
      { $match: { companyId: cid, status: { $ne: 'cancelled' }, date: { $gte: since } } },
      { $group: { _id: '$customerId', amount: { $sum: '$netAmount' }, count: { $sum: 1 } } },
      { $sort: { amount: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'parties', localField: '_id', foreignField: '_id', as: 'party' } },
      { $unwind: { path: '$party', preserveNullAndEmptyArrays: true } },
      { $project: { name: '$party.name', amount: 1, count: 1 } },
    ]);
    return { byMonth, topCustomers, since };
  }

  async purchaseAnalytics(companyId, { months = 6 } = {}) {
    const cid = toOid(companyId);
    const since = monthStart(months - 1);
    const byMonth = await Purchase.aggregate([
      { $match: { companyId: cid, status: { $ne: 'cancelled' }, date: { $gte: since } } },
      {
        $group: {
          _id: { y: { $year: '$date' }, m: { $month: '$date' } },
          amount: { $sum: '$netAmount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]);
    const topSuppliers = await Purchase.aggregate([
      { $match: { companyId: cid, status: { $ne: 'cancelled' }, date: { $gte: since } } },
      { $group: { _id: '$supplierId', amount: { $sum: '$netAmount' }, count: { $sum: 1 } } },
      { $sort: { amount: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'parties', localField: '_id', foreignField: '_id', as: 'party' } },
      { $unwind: { path: '$party', preserveNullAndEmptyArrays: true } },
      { $project: { name: '$party.name', amount: 1, count: 1 } },
    ]);
    return { byMonth, topSuppliers, since };
  }

  async inventoryAnalytics(companyId) {
    const cid = toOid(companyId);
    const [openLots, lowStock, deadStock, fastMoving] = await Promise.all([
      InventoryLot.countDocuments({ companyId: cid, status: { $ne: 'Closed' }, remainingMtrs: { $gt: 0 } }),
      InventoryLot.countDocuments({
        companyId: cid,
        remainingMtrs: { $gt: 0, $lt: 50 },
        status: { $ne: 'Closed' },
      }),
      InventoryLot.find({
        companyId: cid,
        remainingMtrs: { $gt: 0 },
        status: { $ne: 'Closed' },
        updatedAt: { $lte: new Date(Date.now() - 90 * 24 * 3600 * 1000) },
      })
        .select('lotId remainingMtrs updatedAt')
        .limit(20)
        .lean(),
      Sales.aggregate([
        { $match: { companyId: cid, status: { $ne: 'cancelled' } } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.itemId',
            qty: { $sum: { $ifNull: ['$items.meters', '$items.qty', 0] } },
            amount: { $sum: { $ifNull: ['$items.amount', 0] } },
          },
        },
        { $sort: { qty: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'items', localField: '_id', foreignField: '_id', as: 'item' } },
        { $unwind: { path: '$item', preserveNullAndEmptyArrays: true } },
        { $project: { name: '$item.name', qty: 1, amount: 1 } },
      ]),
    ]);
    return { openLots, lowStock, deadStock, fastMoving };
  }

  async productionAnalytics(companyId) {
    const cid = toOid(companyId);
    const byStatus = await Job.aggregate([
      { $match: { companyId: cid } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const open = await Job.countDocuments({ companyId: cid, status: { $in: ['Issued', 'In-Process'] } });
    return { byStatus, open };
  }

  async accountingAnalytics(companyId) {
    const cid = toOid(companyId);
    const since = monthStart(5);
    const cashflow = await PaymentVoucher.aggregate([
      {
        $match: {
          companyId: cid,
          date: { $gte: since },
          status: { $ne: 'Draft' },
        },
      },
      {
        $group: {
          _id: {
            y: { $year: '$date' },
            m: { $month: '$date' },
            type: '$voucherType',
          },
          amount: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]).catch(() => []);

    const sales = await Sales.aggregate([
      { $match: { companyId: cid, status: { $ne: 'cancelled' }, date: { $gte: since } } },
      {
        $group: {
          _id: { y: { $year: '$date' }, m: { $month: '$date' } },
          sales: { $sum: '$netAmount' },
        },
      },
    ]);
    const purchases = await Purchase.aggregate([
      { $match: { companyId: cid, status: { $ne: 'cancelled' }, date: { $gte: since } } },
      {
        $group: {
          _id: { y: { $year: '$date' }, m: { $month: '$date' } },
          purchases: { $sum: '$netAmount' },
        },
      },
    ]);

    const profitMap = {};
    for (const s of sales) {
      const k = `${s._id.y}-${s._id.m}`;
      profitMap[k] = { ...profitMap[k], ...s._id, sales: s.sales, purchases: 0 };
    }
    for (const p of purchases) {
      const k = `${p._id.y}-${p._id.m}`;
      profitMap[k] = {
        ...(profitMap[k] || { ...p._id, sales: 0 }),
        purchases: p.purchases,
      };
    }
    const profitTrends = Object.values(profitMap).map((r) => ({
      ...r,
      gross: (r.sales || 0) - (r.purchases || 0),
    }));

    return { cashflow, profitTrends };
  }

  async branchComparison(companyId) {
    // Single-company ERP: compare party branches / cities as soft dimension
    const cid = toOid(companyId);
    const byCity = await Party.aggregate([
      { $match: { companyId: cid } },
      { $group: { _id: { $ifNull: ['$city', 'Unknown'] }, parties: { $sum: 1 } } },
      { $sort: { parties: -1 } },
      { $limit: 15 },
    ]);
    return { dimension: 'city', rows: byCity, note: 'Branch dimension uses party city until multi-branch ledger lands' };
  }

  async exportBundle(companyId) {
    const [overview, sales, purchase, inventory, production, accounting] = await Promise.all([
      this.overview(companyId),
      this.salesAnalytics(companyId),
      this.purchaseAnalytics(companyId),
      this.inventoryAnalytics(companyId),
      this.productionAnalytics(companyId),
      this.accountingAnalytics(companyId),
    ]);
    return {
      generatedAt: new Date().toISOString(),
      overview,
      sales,
      purchase,
      inventory,
      production,
      accounting,
    };
  }
}

module.exports = new BiAnalyticsService();
