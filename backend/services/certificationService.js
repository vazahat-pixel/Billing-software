const CertificationRun = require('../models/CertificationRun');
const DocumentTemplate = require('../models/DocumentTemplate');
const WorkflowDefinition = require('../models/WorkflowDefinition');
const BusinessRule = require('../models/BusinessRule');
const VoucherSeries = require('../models/VoucherSeries');
const Warehouse = require('../models/Warehouse');
const Order = require('../models/Order');
const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');
const Job = require('../models/Job');
const InventoryLot = require('../models/InventoryLot');
const StockReservation = require('../models/StockReservation');
const DeliveryChallan = require('../models/DeliveryChallan');
const ProcessChainTemplate = require('../models/ProcessChainTemplate');
const ItemProcessMapping = require('../models/ItemProcessMapping');
const AuditLog = require('../models/AuditLog');
const reconciliationService = require('./reconciliationService');
const { validateBusiness } = require('./validateBusinessService');

const GATE = 85;

/**
 * Business Readiness Certification — Sprint 2.10
 * Weighted checklist over Stage 2 engines + reconcile.
 */
class CertificationService {
  async run(companyId, { triggeredBy = null } = {}) {
    const checklist = [];
    const gaps = [];

    const add = (key, label, weight, status, score, gapList = []) => {
      checklist.push({
        key,
        label,
        weight,
        score: status === 'pass' ? weight : status === 'warn' ? Math.round(weight * 0.5) : score,
        maxScore: weight,
        status,
        gaps: gapList,
      });
      gaps.push(...gapList);
    };

    // Masters / warehouse
    const whCount = await Warehouse.countDocuments({ companyId });
    add(
      'master_warehouse',
      'Master data: warehouses',
      5,
      whCount > 0 ? 'pass' : 'fail',
      0,
      whCount ? [] : ['No warehouses configured']
    );

    // Purchase engine artifacts
    const poCount = await Order.countDocuments({ companyId, orderType: 'Purchase' });
    const purchaseCount = await Purchase.countDocuments({ companyId });
    add(
      'purchase_engine',
      'Purchase engine (PO/bills)',
      10,
      purchaseCount > 0 || poCount > 0 ? 'pass' : 'warn',
      0,
      purchaseCount || poCount ? [] : ['No purchase orders/bills yet — run simulation']
    );

    // Inventory
    const lotCount = await InventoryLot.countDocuments({ companyId });
    const rsvCount = await StockReservation.countDocuments({ companyId });
    add(
      'inventory_engine',
      'Inventory lots / reservation readiness',
      10,
      lotCount > 0 ? 'pass' : 'fail',
      0,
      lotCount > 0
        ? rsvCount > 0
          ? []
          : ['Reservations unused (optional)']
        : ['No inventory lots']
    );

    // Production
    const jobCount = await Job.countDocuments({ companyId });
    const chainCount = await ProcessChainTemplate.countDocuments({ companyId });
    const mapCount = await ItemProcessMapping.countDocuments({ companyId });
    add(
      'production_engine',
      'Production / job work',
      10,
      jobCount > 0 || chainCount > 0 ? 'pass' : 'warn',
      0,
      [
        ...(jobCount ? [] : ['No jobs issued yet']),
        ...(chainCount || mapCount ? [] : ['Seed process chains / item mappings']),
      ]
    );

    // Sales
    const soCount = await Order.countDocuments({ companyId, orderType: 'Sales' });
    const salesCount = await Sales.countDocuments({ companyId });
    const challanCount = await DeliveryChallan.countDocuments({ companyId });
    add(
      'sales_engine',
      'Sales engine (SO/challan/invoice)',
      10,
      salesCount > 0 ? 'pass' : 'warn',
      0,
      [
        ...(salesCount ? [] : ['No sales invoices']),
        ...(challanCount || soCount ? [] : ['No SO/challans — run sales engine path']),
      ]
    );

    // Automation
    const rules = await BusinessRule.countDocuments({ companyId, enabled: true });
    const series = await VoucherSeries.countDocuments({ companyId });
    add(
      'automation',
      'Business automation (rules + series)',
      10,
      rules > 0 && series > 0 ? 'pass' : rules > 0 || series > 0 ? 'warn' : 'fail',
      0,
      rules && series ? [] : ['Seed Business Automation defaults']
    );

    // Documents
    const docs = await DocumentTemplate.countDocuments({ companyId });
    add(
      'documents',
      'Document templates',
      10,
      docs > 0 ? 'pass' : 'warn',
      0,
      docs ? [] : ['Seed document templates']
    );

    // Workflow
    const wfDefs = await WorkflowDefinition.countDocuments({ companyId, enabled: true });
    add(
      'workflow',
      'Workflow definitions',
      10,
      wfDefs > 0 ? 'pass' : 'warn',
      0,
      wfDefs ? [] : ['Seed workflow definitions']
    );

    // Validation hub smoke
    const v = await validateBusiness({
      module: 'sales',
      action: 'create',
      companyId,
      payload: {},
      options: { skipParty: true, skipDuplicate: true, skipFy: false },
    });
    add(
      'validation',
      'validateBusiness hub',
      10,
      typeof v.ok === 'boolean' ? 'pass' : 'fail',
      0,
      typeof v.ok === 'boolean' ? [] : ['Validation service failed']
    );

    // Audit
    const audits = await AuditLog.countDocuments({ companyId });
    add(
      'audit',
      'Audit log activity',
      5,
      audits > 0 ? 'pass' : 'warn',
      0,
      audits ? [] : ['No audit logs yet']
    );

    // Reconciliation
    let reconcileStatus = 'skipped';
    try {
      const run = await reconciliationService.runFull(companyId, { triggeredBy });
      reconcileStatus = run.status;
      add(
        'reconcile',
        'Integrity reconcile',
        10,
        run.status === 'clean' ? 'pass' : run.status === 'warnings' ? 'warn' : 'fail',
        0,
        run.status === 'clean'
          ? []
          : [`Reconcile status: ${run.status} (${run.summary?.mismatches || 0} errors, ${run.summary?.warnings || 0} warnings)`]
      );
    } catch (err) {
      add('reconcile', 'Integrity reconcile', 10, 'fail', 0, [err.message]);
    }

    const earned = checklist.reduce((s, c) => s + (c.score || 0), 0);
    const max = checklist.reduce((s, c) => s + (c.maxScore || 0), 0);
    const score = max > 0 ? Math.round((earned / max) * 100) : 0;
    const passed = score >= GATE && reconcileStatus !== 'failures';
    const status = passed ? 'passed' : score >= GATE * 0.7 ? 'partial' : 'failed';

    const uniqueGaps = [...new Set(gaps.filter(Boolean))];

    const cert = await CertificationRun.create({
      companyId,
      score,
      gate: GATE,
      passed,
      status,
      checklist,
      gaps: uniqueGaps,
      reconcileStatus,
      meta: { triggeredBy, earned, max },
    });

    return cert;
  }

  async latest(companyId) {
    return CertificationRun.findOne({ companyId }).sort({ createdAt: -1 });
  }

  async list(companyId, { limit = 10 } = {}) {
    return CertificationRun.find({ companyId }).sort({ createdAt: -1 }).limit(limit);
  }
}

module.exports = new CertificationService();
