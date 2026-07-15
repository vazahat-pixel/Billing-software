const InventoryLot = require('../models/InventoryLot');
const StockMovement = require('../models/StockMovement');
const AccountingEntry = require('../models/AccountingEntry');
const Purchase = require('../models/Purchase');
const Sales = require('../models/Sales');
const Job = require('../models/Job');
const Party = require('../models/Party');
const Item = require('../models/Item');
const ReconciliationRun = require('../models/ReconciliationRun');

/**
 * Reconciliation & Data Quality engine — read-only diagnostics.
 * Does not mutate transactional data. Reports mismatches for ops/CTO.
 */
class ReconciliationService {
  async runFull(companyId, { triggeredBy = null } = {}) {
    const startedAt = new Date();
    const findings = [];

    findings.push(...(await this.checkInventory(companyId)));
    findings.push(...(await this.checkAccounting(companyId)));
    findings.push(...(await this.checkGst(companyId)));
    findings.push(...(await this.checkOutstanding(companyId)));
    findings.push(...(await this.checkDataQuality(companyId)));

    const mismatches = findings.filter((f) => f.severity === 'error').length;
    const warnings = findings.filter((f) => f.severity === 'warning').length;
    const status = mismatches > 0 ? 'failures' : warnings > 0 ? 'warnings' : 'clean';

    const run = await ReconciliationRun.create({
      companyId,
      runType: 'full',
      status,
      summary: { checks: findings.length, mismatches, warnings },
      findings,
      startedAt,
      finishedAt: new Date(),
      triggeredBy,
    });

    return run;
  }

  async checkInventory(companyId) {
    const findings = [];
    const lots = await InventoryLot.find({ companyId }).select('_id lotId remainingMtrs totalMtrs itemId purchaseId source').lean();

    for (const lot of lots) {
      if (lot.remainingMtrs < -0.001) {
        findings.push({
          code: 'NEG_STOCK',
          severity: 'error',
          module: 'inventory',
          message: `Lot ${lot.lotId} has negative remaining mtrs (${lot.remainingMtrs})`,
          meta: { lotId: lot._id, lotNo: lot.lotId },
        });
      }
      if (lot.remainingMtrs - lot.totalMtrs > 0.01) {
        findings.push({
          code: 'REMAINING_GT_TOTAL',
          severity: 'error',
          module: 'inventory',
          message: `Lot ${lot.lotId}: remaining (${lot.remainingMtrs}) > total (${lot.totalMtrs})`,
          meta: { lotId: lot._id },
        });
      }

      const movements = await StockMovement.find({ companyId, lotId: lot._id }).select('qtyMtrs type').lean();
      if (movements.length === 0 && lot.source !== 'opening') {
        findings.push({
          code: 'LOT_WITHOUT_MOVEMENT',
          severity: 'warning',
          module: 'inventory',
          message: `Lot ${lot.lotId} has no stock movements`,
          meta: { lotId: lot._id },
        });
      } else if (movements.length) {
        const net = movements.reduce((s, m) => s + (m.qtyMtrs || 0), 0);
        // Remaining should ≈ sum of movements when starting from 0 (purchase adds, sale subtracts)
        // For purchase lots: first movement = total; net of all ≈ remaining
        const drift = Math.abs(net - lot.remainingMtrs);
        if (drift > 0.05) {
          findings.push({
            code: 'LOT_MOVEMENT_DRIFT',
            severity: 'error',
            module: 'inventory',
            message: `Lot ${lot.lotId}: movement net ${net.toFixed(3)} ≠ remaining ${lot.remainingMtrs}`,
            meta: { lotId: lot._id, net, remaining: lot.remainingMtrs },
          });
        }
      }
    }

    // Purchase active without inventory lot
    const purchases = await Purchase.find({ companyId, status: { $ne: 'cancelled' } })
      .select('_id invoiceNo items')
      .lean();
    for (const p of purchases) {
      for (const item of p.items || []) {
        if (!item.lotId) continue;
        const lot = await InventoryLot.findOne({ companyId, lotId: item.lotId }).select('_id').lean();
        if (!lot) {
          findings.push({
            code: 'PURCHASE_MISSING_LOT',
            severity: 'error',
            module: 'inventory',
            message: `Purchase ${p.invoiceNo} references missing lot ${item.lotId}`,
            meta: { purchaseId: p._id, lotId: item.lotId },
          });
        }
      }
    }

    return findings;
  }

  async checkAccounting(companyId) {
    const findings = [];
    const entries = await AccountingEntry.find({ companyId, isReversed: { $ne: true } })
      .select('entryNo totalDebit totalCredit lines')
      .lean();

    for (const e of entries) {
      if (Math.abs((e.totalDebit || 0) - (e.totalCredit || 0)) > 0.01) {
        findings.push({
          code: 'UNBALANCED_JOURNAL',
          severity: 'error',
          module: 'accounting',
          message: `Entry ${e.entryNo} unbalanced Dr ${e.totalDebit} Cr ${e.totalCredit}`,
          meta: { entryId: e._id },
        });
      }
    }

    const activePurchases = await Purchase.find({
      companyId,
      status: { $in: ['active', 'partial', 'paid'] },
    })
      .select('_id invoiceNo accountingEntryId')
      .lean();

    for (const p of activePurchases) {
      if (!p.accountingEntryId) {
        findings.push({
          code: 'PURCHASE_NO_LEDGER',
          severity: 'warning',
          module: 'accounting',
          message: `Purchase ${p.invoiceNo} has no accountingEntryId`,
          meta: { purchaseId: p._id },
        });
      }
    }

    const activeSales = await Sales.find({
      companyId,
      status: { $in: ['active', 'partial', 'paid'] },
    })
      .select('_id invoiceNo accountingEntryId')
      .lean();

    for (const s of activeSales) {
      if (!s.accountingEntryId) {
        findings.push({
          code: 'SALE_NO_LEDGER',
          severity: 'warning',
          module: 'accounting',
          message: `Sale ${s.invoiceNo} has no accountingEntryId`,
          meta: { salesId: s._id },
        });
      }
    }

    return findings;
  }

  async checkGst(companyId) {
    const findings = [];
    const sales = await Sales.find({ companyId, status: { $ne: 'cancelled' } })
      .select('invoiceNo taxableAmount gstAmount cgst sgst igst netAmount')
      .lean();

    for (const s of sales) {
      const components = (s.cgst || 0) + (s.sgst || 0) + (s.igst || 0);
      if (Math.abs(components - (s.gstAmount || 0)) > 0.05) {
        findings.push({
          code: 'GST_COMPONENT_MISMATCH',
          severity: 'error',
          module: 'gst',
          message: `Sale ${s.invoiceNo}: CGST+SGST+IGST (${components}) ≠ gstAmount (${s.gstAmount})`,
          meta: { salesId: s._id },
        });
      }
      const expectedNet = (s.taxableAmount || 0) + (s.gstAmount || 0);
      // Allow round-off / tcs noise up to ₹2
      if (Math.abs(expectedNet - (s.netAmount || 0)) > 2) {
        findings.push({
          code: 'GST_NET_MISMATCH',
          severity: 'warning',
          module: 'gst',
          message: `Sale ${s.invoiceNo}: taxable+gst (${expectedNet}) vs net (${s.netAmount})`,
          meta: { salesId: s._id },
        });
      }
    }

    const purchases = await Purchase.find({ companyId, status: { $ne: 'cancelled' } })
      .select('invoiceNo taxableAmount gstAmount cgst sgst igst netAmount')
      .lean();

    for (const p of purchases) {
      const components = (p.cgst || 0) + (p.sgst || 0) + (p.igst || 0);
      if (p.gstAmount != null && Math.abs(components - (p.gstAmount || 0)) > 0.05 && components > 0) {
        findings.push({
          code: 'PURCHASE_GST_COMPONENT_MISMATCH',
          severity: 'warning',
          module: 'gst',
          message: `Purchase ${p.invoiceNo}: tax components vs gstAmount`,
          meta: { purchaseId: p._id },
        });
      }
    }

    return findings;
  }

  async checkOutstanding(companyId) {
    const findings = [];
    const sales = await Sales.find({
      companyId,
      status: { $in: ['active', 'partial'] },
    })
      .select('invoiceNo netAmount paidAmount')
      .lean();

    for (const s of sales) {
      if ((s.paidAmount || 0) - (s.netAmount || 0) > 0.05) {
        findings.push({
          code: 'OVERPAID_INVOICE',
          severity: 'warning',
          module: 'outstanding',
          message: `Sale ${s.invoiceNo} paidAmount exceeds netAmount`,
          meta: { salesId: s._id },
        });
      }
    }
    return findings;
  }

  async checkDataQuality(companyId) {
    const findings = [];

    const parties = await Party.countDocuments({ companyId });
    const items = await Item.countDocuments({ companyId });
    if (parties === 0) {
      findings.push({
        code: 'NO_PARTIES',
        severity: 'info',
        module: 'masters',
        message: 'No parties configured for company',
      });
    }
    if (items === 0) {
      findings.push({
        code: 'NO_ITEMS',
        severity: 'info',
        module: 'masters',
        message: 'No items configured for company',
      });
    }

    const orphanJobs = await Job.find({ companyId, status: { $ne: 'Cancelled' } })
      .select('_id jobCardNo lotId')
      .lean();
    for (const j of orphanJobs) {
      if (!j.lotId) continue;
      const lot = await InventoryLot.findOne({ _id: j.lotId, companyId }).select('_id').lean();
      if (!lot) {
        findings.push({
          code: 'JOB_BROKEN_LOT_REF',
          severity: 'error',
          module: 'jobwork',
          message: `Job ${j.jobCardNo} references missing lot`,
          meta: { jobId: j._id },
        });
      }
    }

    return findings;
  }
}

module.exports = new ReconciliationService();
