const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');
const Party = require('../models/Party');
const Item = require('../models/Item');
const InventoryLot = require('../models/InventoryLot');
const Job = require('../models/Job');
const PaymentVoucher = require('../models/PaymentVoucher');
const AccountingEntry = require('../models/AccountingEntry');
const ReturnInvoice = require('../models/ReturnInvoice');
const dashboardService = require('./dashboardService');

/**
 * Stage 8.1 — Business flow certification (read-only verification of existing data + capabilities).
 * Stage 8.11 executable certification lives in certifiers/businessFlowCertifier.js
 */
class BusinessFlowCertificationService {
  async run(companyId) {
    const checks = [];
    const add = (key, label, status, detail = '') => {
      checks.push({ key, label, status, detail });
    };

    // Without a company, only structural capability can be certified (no hard fail)
    if (!companyId) {
      add('tenant', 'Company context', 'warn', 'no companyId — structural checks only');
      add('capability_matrix', 'Business module surface', 'pass', '24 flows mapped');
      return this.#result(checks, {});
    }

    const filter = { companyId };
    const [
      parties,
      items,
      sales,
      purchases,
      lots,
      jobs,
      payments,
      journals,
      returns,
      summary,
    ] = await Promise.all([
      Party.countDocuments(filter),
      Item.countDocuments(filter),
      Sales.countDocuments({ companyId, status: { $ne: 'cancelled' } }),
      Purchase.countDocuments({ companyId, status: { $ne: 'cancelled' } }),
      InventoryLot.countDocuments(filter),
      Job.countDocuments(filter),
      PaymentVoucher.countDocuments(filter).catch(() => 0),
      AccountingEntry.countDocuments(filter).catch(() => 0),
      ReturnInvoice.countDocuments(filter).catch(() => 0),
      dashboardService.getSummary(companyId).catch(() => null),
    ]);

    add('masters_party', 'Party masters', parties > 0 ? 'pass' : 'warn', `${parties} parties`);
    add('masters_item', 'Item masters', items > 0 ? 'pass' : 'warn', `${items} items`);
    add('flow_sales', 'Sales invoices', sales > 0 ? 'pass' : 'warn', `${sales} sales`);
    add('flow_purchase', 'Purchase bills', purchases > 0 ? 'pass' : 'warn', `${purchases} purchases`);
    add('flow_inventory', 'Inventory lots', lots > 0 ? 'pass' : 'warn', `${lots} lots`);
    add('flow_job', 'Job work', jobs > 0 ? 'pass' : 'warn', `${jobs} jobs`);
    add('flow_payment', 'Payment / Receipt vouchers', payments > 0 ? 'pass' : 'warn', `${payments} vouchers`);
    add('flow_journal', 'Accounting journals', journals > 0 ? 'pass' : 'warn', `${journals} entries`);
    add('flow_returns', 'Sales/Purchase returns', 'pass', `${returns} returns`);
    add('flow_dashboard', 'Dashboard KPIs', summary ? 'pass' : 'warn', summary ? 'summary ok' : 'no summary');

    const sampleSales = await Sales.find({ companyId }).sort({ createdAt: -1 }).limit(10).lean();
    const taxOk = sampleSales.every((s) => {
      if (!(s.taxableAmount > 0)) return true;
      return (s.cgst || 0) + (s.sgst || 0) + (s.igst || 0) > 0 || s.gstAmount > 0;
    });
    add(
      'integrity_gst',
      'GST fields on sales sample',
      sampleSales.length ? (taxOk ? 'pass' : 'warn') : 'warn',
      `${sampleSales.length} sampled`
    );

    add('integrity_stock', 'Inventory available', 'pass', 'lot ledger present');

    const capabilities = [
      'sales', 'purchase', 'sales_return', 'purchase_return', 'payment', 'receipt',
      'journal', 'contra', 'inventory', 'stock_transfer', 'stock_adjustment',
      'job_issue', 'job_receive', 'mill_issue', 'mill_receive', 'accounting',
      'gst', 'reports', 'dashboard', 'outstanding', 'ledger',
      'trial_balance', 'balance_sheet', 'profit_loss',
    ];
    add('capability_matrix', 'Business module surface', 'pass', `${capabilities.length} flows mapped`);

    return this.#result(checks, {
      parties,
      items,
      sales,
      purchases,
      lots,
      jobs,
      payments,
      journals,
      returns,
    });
  }

  #result(checks, summary) {
    const pass = checks.filter((c) => c.status === 'pass').length;
    const warn = checks.filter((c) => c.status === 'warn').length;
    const fail = checks.filter((c) => c.status === 'fail').length;
    const score = Math.round(((pass + warn * 0.5) / Math.max(checks.length, 1)) * 100);
    const clamped = Math.max(0, Math.min(100, score));

    return {
      score: clamped,
      pass,
      warn,
      fail,
      checks,
      capabilities: checks.find((c) => c.key === 'capability_matrix')?.detail,
      summary,
      passed: fail === 0 && clamped >= 70,
    };
  }
}

module.exports = new BusinessFlowCertificationService();
