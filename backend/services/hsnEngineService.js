const HsnMaster = require('../models/HsnMaster');
const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');
const Item = require('../models/Item');
const { periodBounds } = require('../utils/gstDetermination');
const auditService = require('./auditService');

const round2 = (n) => Number(Number(n || 0).toFixed(2));

/**
 * HSN/SAC Engine — Sprint 4.4
 */
class HsnEngineService {
  async upsert(companyId, payload, userId) {
    const doc = await HsnMaster.findOneAndUpdate(
      { companyId, code: payload.code, type: payload.type || 'HSN' },
      {
        companyId,
        code: payload.code,
        type: payload.type || 'HSN',
        description: payload.description || '',
        gstRate: payload.gstRate ?? 5,
        cessRate: payload.cessRate || 0,
        unit: payload.unit || 'MTR',
        taxCategory: payload.taxCategory || 'Taxable',
        isActive: payload.isActive !== false,
        updatedBy: userId,
      },
      { upsert: true, new: true }
    );
    await auditService.logSystem({
      companyId, userId, action: 'HSN_UPSERT', module: 'HsnMaster',
      referenceId: doc._id, after: { code: doc.code, gstRate: doc.gstRate },
    });
    return doc;
  }

  async list(companyId, query = {}) {
    const filter = { companyId };
    if (query.type) filter.type = query.type;
    if (query.search) filter.code = { $regex: query.search, $options: 'i' };
    return HsnMaster.find(filter).sort({ code: 1 }).lean();
  }

  async syncFromItems(companyId) {
    const items = await Item.find({ companyId, hsnCode: { $nin: [null, ''] } });
    let count = 0;
    for (const item of items) {
      await this.upsert(companyId, {
        code: item.hsnCode,
        type: 'HSN',
        description: item.name,
        gstRate: item.gstRate ?? 5,
        unit: item.unit || 'MTR',
      });
      count += 1;
    }
    return { synced: count };
  }

  async summary(companyId, { period, from, to, type = 'HSN' } = {}) {
    let startDate;
    let endDate;
    if (period) {
      ({ startDate, endDate } = periodBounds(period));
    } else {
      startDate = from ? new Date(from) : new Date(0);
      endDate = to ? new Date(to) : new Date();
    }

    const sales = await Sales.find({
      companyId,
      status: { $ne: 'cancelled' },
      date: { $gte: startDate, $lte: endDate },
    }).populate('items.itemId', 'name hsnCode gstRate unit').lean();

    const purchases = await Purchase.find({
      companyId,
      date: { $gte: startDate, $lte: endDate },
    }).populate('items.itemId', 'name hsnCode gstRate unit').lean();

    const map = {};
    const addLines = (docs, direction) => {
      for (const doc of docs) {
        for (const line of doc.items || []) {
          const code = line.itemId?.hsnCode || line.hsnCode || '';
          if (!code) continue;
          if (!map[code]) {
            map[code] = {
              code,
              type: 'HSN',
              description: line.itemId?.name || '',
              unit: line.itemId?.unit || 'MTR',
              gstRate: line.itemId?.gstRate || doc.gstRate || 0,
              qtyOut: 0,
              qtyIn: 0,
              taxableOut: 0,
              taxableIn: 0,
              taxOut: 0,
              taxIn: 0,
            };
          }
          const qty = Number(line.mts || line.qty || 0);
          const taxable = round2(line.amount || qty * (line.rate || 0));
          const rate = (map[code].gstRate || 0) / 100;
          const tax = round2(taxable * rate);
          if (direction === 'out') {
            map[code].qtyOut = round2(map[code].qtyOut + qty);
            map[code].taxableOut = round2(map[code].taxableOut + taxable);
            map[code].taxOut = round2(map[code].taxOut + tax);
          } else {
            map[code].qtyIn = round2(map[code].qtyIn + qty);
            map[code].taxableIn = round2(map[code].taxableIn + taxable);
            map[code].taxIn = round2(map[code].taxIn + tax);
          }
        }
      }
    };

    addLines(sales, 'out');
    addLines(purchases, 'in');

    const rows = Object.values(map);
    return {
      period: period || null,
      rows,
      totals: {
        taxableOut: round2(rows.reduce((s, r) => s + r.taxableOut, 0)),
        taxableIn: round2(rows.reduce((s, r) => s + r.taxableIn, 0)),
        taxOut: round2(rows.reduce((s, r) => s + r.taxOut, 0)),
        taxIn: round2(rows.reduce((s, r) => s + r.taxIn, 0)),
      },
    };
  }
}

module.exports = new HsnEngineService();
