const financialReports = require('./financialReportsService');
const ledgerEngine = require('./ledgerEngineService');
const journalEngine = require('./journalEngineService');
const gstReturnService = require('./gstReturnService');
const gstReconciliation = require('./gstReconciliationService');
const hsnEngine = require('./hsnEngineService');
const tdsTcs = require('./tdsTcsService');
const gstConfigService = require('./gstConfigService');
const financialAudit = require('./financialAuditService');
const { periodKey } = require('../utils/gstDetermination');

/**
 * CA Workspace — Sprint 4.7
 * Read-only aggregation for Chartered Accountant portal.
 */
class CaWorkspaceService {
  async overview(companyId, { period } = {}) {
    const p = period || periodKey();
    const cfg = await gstConfigService.getOrCreate(companyId);
    const [tb, pl, bs, g1, g3, recon, hsn, tds] = await Promise.all([
      financialReports.trialBalance(companyId),
      financialReports.profitAndLoss(companyId),
      financialReports.balanceSheet(companyId),
      gstReturnService.buildGstr1(companyId, p),
      gstReturnService.buildGstr3b(companyId, p),
      gstReconciliation.fullReconciliation(companyId, p),
      hsnEngine.summary(companyId, { period: p }),
      tdsTcs.report(companyId, { deductionType: 'TDS', period: p }),
    ]);

    return {
      period: p,
      company: {
        gstin: cfg.gstin,
        legalName: cfg.legalName,
        registrationType: cfg.registrationType,
      },
      trialBalance: {
        isBalanced: tb.isBalanced,
        totalDebit: tb.totalDebit,
        totalCredit: tb.totalCredit,
      },
      profitLoss: { netProfit: pl.netProfit, totalIncome: pl.totalIncome, totalExpenses: pl.totalExpenses },
      balanceSheet: {
        isBalanced: bs.isBalanced,
        totalAssets: bs.totalAssets,
        equity: bs.equity,
        currentPeriodPL: bs.currentPeriodPL,
      },
      gst: {
        gstr1: g1.totals,
        gstr3bPayable: g3.payload.netPayable,
        reconciliationOk: recon.ok,
        exceptionCount: recon.exceptions.length,
      },
      hsn: hsn.totals,
      tds: { totalDeducted: tds.totalDeducted, bySection: tds.bySection },
      readOnly: true,
    };
  }

  async trialBalance(companyId, query) {
    return financialReports.trialBalance(companyId, query);
  }

  async profitLoss(companyId, query) {
    return financialReports.profitAndLoss(companyId, query);
  }

  async balanceSheet(companyId, query) {
    return financialReports.balanceSheet(companyId, query);
  }

  async journalRegister(companyId, query) {
    return journalEngine.listJournals(companyId, query);
  }

  async ledgerStatement(companyId, ledgerId, query) {
    return ledgerEngine.getStatement(companyId, ledgerId, query);
  }

  async gstReturns(companyId, period) {
    const p = period || periodKey();
    return {
      gstr1: await gstReturnService.buildGstr1(companyId, p),
      gstr3b: await gstReturnService.buildGstr3b(companyId, p),
    };
  }

  async auditPack(companyId, period) {
    const p = period || periodKey();
    const [overview, recon, trail, gstGl] = await Promise.all([
      this.overview(companyId, { period: p }),
      gstReconciliation.fullReconciliation(companyId, p),
      financialAudit.auditTrail(companyId, { module: undefined, limit: 50 }),
      financialAudit.gstVsGl(companyId),
    ]);
    return { overview, reconciliation: recon, recentAudit: trail, gstLedgers: gstGl };
  }

  async exportCentre(companyId, period) {
    const p = period || periodKey();
    return {
      available: [
        { type: 'GSTR1', format: 'JSON', period: p },
        { type: 'GSTR3B', format: 'JSON', period: p },
        { type: 'HSN', format: 'JSON', period: p },
        { type: 'TrialBalance', format: 'JSON' },
        { type: 'ProfitLoss', format: 'JSON' },
        { type: 'BalanceSheet', format: 'JSON' },
      ],
    };
  }
}

module.exports = new CaWorkspaceService();
