const Party = require('../models/Party');
const Item = require('../models/Item');
const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');
const Job = require('../models/Job');
const InventoryLot = require('../models/InventoryLot');
const Warehouse = require('../models/Warehouse');
const Book = require('../models/Book');
const Order = require('../models/Order');
const User = require('../models/User');
const Company = require('../models/Company');

const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Stage 6.1 — Universal company-scoped search across ERP entities.
 * Reuses existing collections; does not invent parallel indexes of truth.
 */
class GlobalSearchService {
  async search(companyId, q, { limit = 8, types } = {}) {
    const query = String(q || '').trim();
    if (!query || query.length < 1) {
      return { query, groups: [], total: 0 };
    }

    const rx = new RegExp(escapeRegex(query), 'i');
    const per = Math.min(Math.max(Number(limit) || 8, 1), 20);
    const allow = types
      ? new Set(String(types).split(',').map((t) => t.trim()).filter(Boolean))
      : null;

    const want = (t) => !allow || allow.has(t);

    const tasks = [];

    if (want('party') || want('customer') || want('supplier') || want('broker')) {
      tasks.push(
        Party.find({
          companyId,
          $or: [{ name: rx }, { gstin: rx }, { mobile: rx }, { city: rx }],
        })
          .select('name type gstin mobile isFavorite lastUsedAt')
          .sort({ lastUsedAt: -1, name: 1 })
          .limit(per)
          .lean()
          .then((rows) =>
            rows.map((r) => ({
              id: r._id,
              kind: 'party',
              subtype: r.type || 'Party',
              label: r.name,
              meta: r.gstin || r.mobile || '',
              modal: 'accountMaster',
              favorite: !!r.isFavorite,
            }))
          )
      );
    } else {
      tasks.push(Promise.resolve([]));
    }

    if (want('item')) {
      tasks.push(
        Item.find({
          companyId,
          $or: [
            { name: rx },
            { hsnCode: rx },
            { design: rx },
            { barcode: rx },
            { brand: rx },
            { quality: rx },
          ],
        })
          .select('name hsnCode barcode category isFavorite lastUsedAt')
          .sort({ lastUsedAt: -1, name: 1 })
          .limit(per)
          .lean()
          .then((rows) =>
            rows.map((r) => ({
              id: r._id,
              kind: 'item',
              label: r.name,
              meta: r.hsnCode || r.barcode || r.category || '',
              modal: 'itemMaster',
              favorite: !!r.isFavorite,
            }))
          )
      );
    } else {
      tasks.push(Promise.resolve([]));
    }

    if (want('sales') || want('invoice')) {
      tasks.push(
        Sales.find({
          companyId,
          status: { $ne: 'cancelled' },
          $or: [{ invoiceNo: rx }, { billNo: rx }],
        })
          .select('invoiceNo billNo netAmount date status')
          .sort({ date: -1 })
          .limit(per)
          .lean()
          .then((rows) =>
            rows.map((r) => ({
              id: r._id,
              kind: 'sales',
              label: `Sale ${r.invoiceNo || r.billNo || r._id}`,
              meta: `₹${r.netAmount || 0}`,
              modal: 'sales',
            }))
          )
      );
    } else {
      tasks.push(Promise.resolve([]));
    }

    if (want('purchase')) {
      tasks.push(
        Purchase.find({
          companyId,
          status: { $ne: 'cancelled' },
          $or: [{ invoiceNo: rx }, { billNo: rx }],
        })
          .select('invoiceNo billNo netAmount date status')
          .sort({ date: -1 })
          .limit(per)
          .lean()
          .then((rows) =>
            rows.map((r) => ({
              id: r._id,
              kind: 'purchase',
              label: `Purchase ${r.invoiceNo || r.billNo || r._id}`,
              meta: `₹${r.netAmount || 0}`,
              modal: 'purchase',
            }))
          )
      );
    } else {
      tasks.push(Promise.resolve([]));
    }

    if (want('lot') || want('inventory')) {
      tasks.push(
        InventoryLot.find({
          companyId,
          $or: [{ lotId: rx }, { barcode: rx }],
        })
          .select('lotId barcode remainingMtrs status')
          .sort({ updatedAt: -1 })
          .limit(per)
          .lean()
          .then((rows) =>
            rows.map((r) => ({
              id: r._id,
              kind: 'lot',
              label: `Lot ${r.lotId || r.barcode || r._id}`,
              meta: `${r.remainingMtrs || 0} mtrs`,
              modal: 'inventoryPage',
            }))
          )
          .catch(() => [])
      );
    } else {
      tasks.push(Promise.resolve([]));
    }

    if (want('job')) {
      tasks.push(
        Job.find({
          companyId,
          $or: [{ jobCardNo: rx }, { processType: rx }],
        })
          .select('jobCardNo status processType')
          .sort({ createdAt: -1 })
          .limit(per)
          .lean()
          .then((rows) =>
            rows.map((r) => ({
              id: r._id,
              kind: 'job',
              label: `Job ${r.jobCardNo || r._id}`,
              meta: r.status || r.processType || '',
              modal: 'jobIssue',
            }))
          )
          .catch(() => [])
      );
    } else {
      tasks.push(Promise.resolve([]));
    }

    if (want('order')) {
      tasks.push(
        Order.find({
          companyId,
          $or: [{ orderNo: rx }],
        })
          .select('orderNo orderType status netAmount')
          .sort({ createdAt: -1 })
          .limit(per)
          .lean()
          .then((rows) =>
            rows.map((r) => ({
              id: r._id,
              kind: 'order',
              label: `${r.orderType || 'Order'} ${r.orderNo || r._id}`,
              meta: r.status || '',
              modal: 'order',
            }))
          )
      );
    } else {
      tasks.push(Promise.resolve([]));
    }

    if (want('warehouse')) {
      tasks.push(
        Warehouse.find({ companyId, $or: [{ name: rx }, { code: rx }] })
          .select('name code')
          .limit(per)
          .lean()
          .then((rows) =>
            rows.map((r) => ({
              id: r._id,
              kind: 'warehouse',
              label: r.name,
              meta: r.code || '',
              modal: 'warehouseMaster',
            }))
          )
          .catch(() => [])
      );
    } else {
      tasks.push(Promise.resolve([]));
    }

    if (want('book') || want('ledger') || want('voucher')) {
      tasks.push(
        Book.find({ companyId, $or: [{ name: rx }, { bookType: rx }] })
          .select('name bookType')
          .limit(per)
          .lean()
          .then((rows) =>
            rows.map((r) => ({
              id: r._id,
              kind: 'book',
              label: r.name,
              meta: r.bookType || '',
              modal: 'bookMaster',
            }))
          )
          .catch(() => [])
      );
    } else {
      tasks.push(Promise.resolve([]));
    }

    if (want('employee') || want('user')) {
      tasks.push(
        User.find({
          companyId,
          $or: [{ name: rx }, { email: rx }, { mobile: rx }],
        })
          .select('name email role')
          .limit(per)
          .lean()
          .then((rows) =>
            rows.map((r) => ({
              id: r._id,
              kind: 'employee',
              label: r.name || r.email,
              meta: r.role || '',
              modal: null,
            }))
          )
          .catch(() => [])
      );
    } else {
      tasks.push(Promise.resolve([]));
    }

    const results = await Promise.all(tasks);
    const flat = results.flat();

    // Static navigable surfaces (reports / GST / modules) matched by label
    const nav = this.navigationActions().filter(
      (a) =>
        a.label.toLowerCase().includes(query.toLowerCase()) ||
        a.group.toLowerCase().includes(query.toLowerCase())
    );

    const groups = {};
    for (const row of [...nav, ...flat]) {
      const g = row.group || this.groupFor(row.kind);
      if (!groups[g]) groups[g] = [];
      groups[g].push(row);
    }

    return {
      query,
      groups: Object.entries(groups).map(([name, items]) => ({ name, items })),
      total: flat.length + nav.length,
      items: [...nav, ...flat].slice(0, 60),
    };
  }

  groupFor(kind) {
    const map = {
      party: 'Parties',
      item: 'Items',
      sales: 'Sales',
      purchase: 'Purchases',
      lot: 'Inventory',
      job: 'Job Work',
      order: 'Orders',
      warehouse: 'Warehouses',
      book: 'Books',
      employee: 'People',
      action: 'Quick Actions',
      report: 'Reports',
    };
    return map[kind] || 'Other';
  }

  navigationActions() {
    return [
      { id: 'nav-sales', kind: 'action', group: 'Modules', label: 'Open Sales', modal: 'sales' },
      { id: 'nav-purchase', kind: 'action', group: 'Modules', label: 'Open Purchase', modal: 'purchase' },
      { id: 'nav-ledger', kind: 'action', group: 'Accounting', label: 'Open Ledger', modal: 'ledger' },
      { id: 'nav-party', kind: 'action', group: 'Masters', label: 'Create Party', modal: 'accountMaster' },
      { id: 'nav-item', kind: 'action', group: 'Masters', label: 'Create Item', modal: 'itemMaster' },
      { id: 'nav-receipt', kind: 'action', group: 'Modules', label: 'Bank Receipt', modal: 'receipt' },
      { id: 'nav-payment', kind: 'action', group: 'Modules', label: 'Bank Payment', modal: 'payment' },
      { id: 'nav-inventory', kind: 'action', group: 'Modules', label: 'Stock Ledger', modal: 'inventoryPage' },
      { id: 'nav-outstanding', kind: 'action', group: 'Reports', label: 'Outstanding', modal: 'outstanding' },
      { id: 'nav-gstr1', kind: 'action', group: 'GST', label: 'GSTR-1', modal: 'gstr1' },
      { id: 'nav-ca', kind: 'action', group: 'GST', label: 'CA Desk', modal: 'caDashboard' },
      { id: 'nav-reports', kind: 'action', group: 'Reports', label: 'Reports Hub', modal: 'reportsHub' },
      { id: 'nav-bi', kind: 'action', group: 'Analytics', label: 'Business Intelligence', modal: 'enterprisePlatform' },
      { id: 'nav-approvals', kind: 'action', group: 'Workflow', label: 'Approval Inbox', modal: 'enterprisePlatform' },
      { id: 'nav-settings', kind: 'action', group: 'Setup', label: 'Company Settings', modal: 'companySettings' },
    ];
  }

  async companyHint(companyId) {
    const c = await Company.findById(companyId).select('name').lean();
    return c?.name || '';
  }
}

module.exports = new GlobalSearchService();
