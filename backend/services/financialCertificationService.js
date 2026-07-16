const CertificationRun = require('../models/CertificationRun');
const AccountGroup = require('../models/AccountGroup');
const LedgerMaster = require('../models/LedgerMaster');
const AccountingEntry = require('../models/AccountingEntry');
const CostCenter = require('../models/CostCenter');
const FinancialYear = require('../models/FinancialYear');
const financialAudit = require('./financialAuditService');
const financialReports = require('./financialReportsService');

const GATE = 90;

/**
 * Financial Readiness Certification — Sprint 3.10
 */
class FinancialCertificationService {
  async run(companyId, { triggeredBy = null } = {}) {
    const checklist = [];
    const gaps = [];

    const add = (key, label, weight, status, gapList = []) => {
      const score = status === 'pass' ? weight : status === 'warn' ? Math.round(weight * 0.5) : 0;
      checklist.push({
        key, label, weight, score, maxScore: weight, status, gaps: gapList,
      });
      gaps.push(...gapList);
    };

    // 3.1 CoA
    const groupCount = await AccountGroup.countDocuments({ companyId });
    const ledgerCount = await LedgerMaster.countDocuments({ companyId });
    add(
      'coa',
      'Chart of Accounts seeded & hierarchical',
      10,
      groupCount >= 10 && ledgerCount >= 15 ? 'pass' : groupCount > 0 ? 'warn' : 'fail',
      groupCount >= 10 ? [] : ['Seed account groups / system ledgers']
    );

    // 3.2 Journals balanced
    const journalAudit = await financialAudit.journalAudit(companyId);
    add(
      'journals',
      'All journals balanced (Dr=Cr)',
      15,
      journalAudit.ok ? 'pass' : 'fail',
      journalAudit.ok ? [] : [`${journalAudit.unbalanced.length} unbalanced journals`]
    );

    // 3.3 / 3.6 Trial Balance
    const tb = await financialReports.trialBalance(companyId);
    add(
      'trial_balance',
      'Trial Balance balances',
      15,
      tb.isBalanced ? 'pass' : 'fail',
      tb.isBalanced ? [] : [`TB difference ₹${tb.difference}`]
    );

    // Balance Sheet plug
    const bs = await financialReports.balanceSheet(companyId);
    add(
      'balance_sheet',
      'Balance Sheet balances (with P&L plug)',
      10,
      bs.isBalanced ? 'pass' : 'warn',
      bs.isBalanced ? [] : [`BS difference ₹${bs.difference}`]
    );

    // 3.8 Full recon
    const recon = await financialAudit.fullReconciliation(companyId);
    add(
      'reconciliation',
      'Financial reconciliation clean',
      15,
      recon.ok ? 'pass' : recon.exceptions.length <= 2 ? 'warn' : 'fail',
      recon.exceptions
    );

    // Duplicates / orphans
    add(
      'duplicates',
      'No duplicate voucher numbers',
      5,
      recon.duplicates.ok ? 'pass' : 'fail',
      recon.duplicates.ok ? [] : ['Duplicate entry numbers found']
    );
    add(
      'orphans',
      'No orphan journal lines',
      5,
      journalAudit.orphanLines.length === 0 ? 'pass' : 'fail',
      journalAudit.orphanLines.length ? [`${journalAudit.orphanLines.length} orphan lines`] : []
    );

    // Inventory / GST / Outstanding
    add(
      'inventory_gl',
      'Inventory value reconciles with GL',
      5,
      recon.inventory.ok ? 'pass' : 'warn',
      recon.inventory.ok ? [] : [`Diff ₹${recon.inventory.difference}`]
    );
    add(
      'gst_gl',
      'GST control accounts present',
      5,
      (recon.gst.ledgers || []).length >= 4 ? 'pass' : 'warn',
      (recon.gst.ledgers || []).length >= 4 ? [] : ['Seed GST ledgers']
    );
    add(
      'outstanding',
      'Outstanding matches party ledgers',
      5,
      recon.receivables.ok && recon.payables.ok ? 'pass' : 'warn',
      [
        ...(recon.receivables.ok ? [] : ['AR mismatches']),
        ...(recon.payables.ok ? [] : ['AP mismatches']),
      ]
    );

    // FY + Cost centers
    const fyCount = await FinancialYear.countDocuments({ companyId });
    add(
      'financial_year',
      'Financial year configured',
      5,
      fyCount > 0 ? 'pass' : 'fail',
      fyCount ? [] : ['Create financial year']
    );
    const ccCount = await CostCenter.countDocuments({ companyId });
    add(
      'cost_centers',
      'Cost centers / textile processes',
      5,
      ccCount > 0 ? 'pass' : 'warn',
      ccCount ? [] : ['Seed textile process cost centers']
    );

    // Entry volume (simulation readiness)
    const entryCount = await AccountingEntry.countDocuments({ companyId });
    add(
      'activity',
      'Journal activity present',
      5,
      entryCount > 0 ? 'pass' : 'warn',
      entryCount ? [] : ['Post sample transactions for simulation']
    );

    const score = checklist.reduce((s, c) => s + c.score, 0);
    const maxScore = checklist.reduce((s, c) => s + c.maxScore, 0);
    const pct = maxScore ? Math.round((score / maxScore) * 100) : 0;
    const passed = pct >= GATE && tb.isBalanced && journalAudit.ok;

    const run = await CertificationRun.create({
      companyId,
      score: pct,
      gate: GATE,
      passed,
      status: passed ? 'passed' : pct >= GATE - 10 ? 'partial' : 'failed',
      checklist,
      gaps: [...new Set(gaps)],
      reconcileStatus: recon.ok ? 'clean' : 'exceptions',
      meta: {
        stage: 3,
        type: 'financial',
        triggeredBy,
        trialBalance: { totalDebit: tb.totalDebit, totalCredit: tb.totalCredit },
        integrity: {
          journalsOk: journalAudit.ok,
          tbOk: tb.isBalanced,
          bsOk: bs.isBalanced,
          reconOk: recon.ok,
        },
      },
    });

    return {
      run,
      score: pct,
      gate: GATE,
      passed,
      checklist,
      gaps: run.gaps,
      integrityReport: recon,
      accountingReadinessScore: pct,
    };
  }

  async latest(companyId) {
    return CertificationRun.findOne({
      companyId,
      'meta.stage': 3,
    }).sort({ createdAt: -1 }).lean();
  }

  async list(companyId, limit = 20) {
    return CertificationRun.find({
      companyId,
      'meta.stage': 3,
    }).sort({ createdAt: -1 }).limit(limit).lean();
  }
}

module.exports = new FinancialCertificationService();
