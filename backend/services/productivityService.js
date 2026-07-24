const UserProductivity = require('../models/UserProductivity');
const Party = require('../models/Party');
const Item = require('../models/Item');
const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');
const Book = require('../models/Book');
const AppError = require('../utils/AppError');

const MAX_RECENT = 20;
const MAX_PINNED = 30;

/**
 * Stage 6.9 — Productivity tools (favorites, pins, recent, drafts, bulk helpers).
 */
class ProductivityService {
  async getOrCreate(companyId, userId) {
    let row = await UserProductivity.findOne({ companyId, userId });
    if (!row) {
      row = await UserProductivity.create({
        companyId,
        userId,
        quickActions: ['sales', 'purchase', 'receipt', 'payment', 'ledger', 'accountMaster', 'itemMaster'],
      });
    }
    return row;
  }

  async dashboard(companyId, userId) {
    const prefs = await this.getOrCreate(companyId, userId);
    const [favParties, favItems, recentSales, recentPurchases, recentBooks] = await Promise.all([
      Party.find({ companyId, isFavorite: true }).select('name partyType').limit(15).lean(),
      Item.find({ companyId, isFavorite: true }).select('name category').limit(15).lean(),
      Sales.find({ companyId, status: { $ne: 'cancelled' } })
        .select('invoiceNo netAmount date')
        .sort({ date: -1 })
        .limit(10)
        .lean(),
      Purchase.find({ companyId, status: { $ne: 'cancelled' } })
        .select('invoiceNo billNo netAmount date')
        .sort({ date: -1 })
        .limit(10)
        .lean(),
      Book.find({ companyId }).select('name bookType lastUsedAt').sort({ updatedAt: -1 }).limit(10).lean().catch(() => []),
    ]);

    return {
      prefs,
      recentParties: await Party.find({ companyId })
        .select('name lastUsedAt isFavorite')
        .sort({ lastUsedAt: -1 })
        .limit(10)
        .lean(),
      recentItems: await Item.find({ companyId })
        .select('name lastUsedAt isFavorite')
        .sort({ lastUsedAt: -1 })
        .limit(10)
        .lean(),
      favoriteParties: favParties,
      favoriteItems: favItems,
      recentBills: [
        ...recentSales.map((s) => ({
          kind: 'sales',
          id: s._id,
          label: `Sale ${s.invoiceNo}`,
          amount: s.netAmount,
          at: s.date,
        })),
        ...recentPurchases.map((p) => ({
          kind: 'purchase',
          id: p._id,
          label: `Purchase ${p.invoiceNo || p.billNo}`,
          amount: p.netAmount,
          at: p.date,
        })),
      ]
        .sort((a, b) => new Date(b.at) - new Date(a.at))
        .slice(0, 15),
      recentBooks,
      shortcuts: {
        commandPalette: 'Ctrl+K / Ctrl+Space',
        save: 'Ctrl+Enter',
        nextField: 'Enter',
      },
    };
  }

  async recordSearch(companyId, userId, query) {
    const q = String(query || '').trim();
    if (!q) return this.getOrCreate(companyId, userId);
    const prefs = await this.getOrCreate(companyId, userId);
    prefs.recentSearches = [
      { query: q, at: new Date() },
      ...(prefs.recentSearches || []).filter((s) => s.query !== q),
    ].slice(0, MAX_RECENT);
    await prefs.save();
    return prefs;
  }

  async pin(companyId, userId, { kind, id, label = '', modal = '' }) {
    if (!kind || !id) throw AppError.badRequest('kind and id required');
    const prefs = await this.getOrCreate(companyId, userId);
    prefs.pinnedRecords = [
      { kind, id, label, modal, pinnedAt: new Date() },
      ...(prefs.pinnedRecords || []).filter((p) => String(p.id) !== String(id)),
    ].slice(0, MAX_PINNED);
    await prefs.save();
    return prefs;
  }

  async unpin(companyId, userId, id) {
    const prefs = await this.getOrCreate(companyId, userId);
    prefs.pinnedRecords = (prefs.pinnedRecords || []).filter((p) => String(p.id) !== String(id));
    await prefs.save();
    return prefs;
  }

  async touchDocument(companyId, userId, doc) {
    const prefs = await this.getOrCreate(companyId, userId);
    prefs.recentDocuments = [
      { ...doc, at: new Date() },
      ...(prefs.recentDocuments || []).filter((d) => String(d.id) !== String(doc.id)),
    ].slice(0, MAX_RECENT);
    if (doc.kind === 'sales' || doc.kind === 'purchase') {
      prefs.recentBills = [
        { kind: doc.kind, id: doc.id, label: doc.label, at: new Date() },
        ...(prefs.recentBills || []).filter((b) => String(b.id) !== String(doc.id)),
      ].slice(0, MAX_RECENT);
    }
    await prefs.save();
    return prefs;
  }

  async saveDraft(companyId, userId, { module, payload }) {
    if (!module) throw AppError.badRequest('module required');
    const prefs = await this.getOrCreate(companyId, userId);
    const others = (prefs.drafts || []).filter((d) => d.module !== module);
    prefs.drafts = [{ module, payload: payload || {}, updatedAt: new Date() }, ...others].slice(0, 10);
    await prefs.save();
    return prefs;
  }

  async clearDraft(companyId, userId, module) {
    const prefs = await this.getOrCreate(companyId, userId);
    prefs.drafts = (prefs.drafts || []).filter((d) => d.module !== module);
    await prefs.save();
    return prefs;
  }

  async toggleFavorite(companyId, { kind, id, favorite = true }) {
    if (kind === 'party') {
      return Party.findOneAndUpdate(
        { _id: id, companyId },
        { isFavorite: !!favorite, lastUsedAt: new Date() },
        { new: true }
      );
    }
    if (kind === 'item') {
      return Item.findOneAndUpdate(
        { _id: id, companyId },
        { isFavorite: !!favorite, lastUsedAt: new Date() },
        { new: true }
      );
    }
    throw AppError.badRequest('kind must be party or item');
  }

  /** Soft duplicate helper — returns source document for FE copy flows */
  async duplicateSource(companyId, { kind, id }) {
    if (kind === 'sales') {
      const doc = await Sales.findOne({ _id: id, companyId }).lean();
      if (!doc) throw AppError.notFound('Sales not found');
      const { _id, invoiceNo, createdAt, updatedAt, paidAmount, status, ...rest } = doc;
      return { kind, sourceId: id, draft: { ...rest, invoiceNo: undefined, status: 'draft' } };
    }
    if (kind === 'purchase') {
      const doc = await Purchase.findOne({ _id: id, companyId }).lean();
      if (!doc) throw AppError.notFound('Purchase not found');
      const { _id, invoiceNo, billNo, createdAt, updatedAt, paidAmount, status, ...rest } = doc;
      return { kind, sourceId: id, draft: { ...rest, invoiceNo: undefined, billNo: undefined, status: 'draft' } };
    }
    throw AppError.badRequest('kind must be sales or purchase');
  }

  async bulkExportMeta(companyId, { kind = 'sales', ids = [] } = {}) {
    return {
      kind,
      count: ids.length,
      format: 'json',
      note: 'Use existing report/export endpoints for PDF/Excel; this returns selection meta for bulk UI',
      ids,
    };
  }
}

module.exports = new ProductivityService();
