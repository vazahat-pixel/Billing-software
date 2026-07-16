const gstConfigService = require('./gstConfigService');
const gstReturnService = require('./gstReturnService');
const gstReconciliation = require('./gstReconciliationService');
const tdsTcs = require('./tdsTcsService');
const GstPeriod = require('../models/GstPeriod');
const Gstr2bImport = require('../models/Gstr2bImport');
const EInvoice = require('../models/EInvoice');
const { periodKey } = require('../utils/gstDetermination');

const round2 = (n) => Number(Number(n || 0).toFixed(2));

/**
 * Compliance Dashboard — Sprint 4.9
 */
class ComplianceDashboardService {
  _dueDates(period) {
    // period YYYY-MM → GSTR-1 due 11th next month, GSTR-3B 20th (simplified)
    const [y, m] = period.split('-').map(Number);
    const next = new Date(y, m, 1); // first of next month
    const gstr1Due = new Date(next.getFullYear(), next.getMonth(), 11);
    const gstr3bDue = new Date(next.getFullYear(), next.getMonth(), 20);
    return { gstr1Due, gstr3bDue };
  }

  async get(companyId, { period } = {}) {
    const p = period || periodKey();
    const cfg = await gstConfigService.getOrCreate(companyId);
    const periodDoc = await gstConfigService.ensurePeriod(companyId, p);
    const g3 = await gstReturnService.buildGstr3b(companyId, p);
    const recon = await gstReconciliation.fullReconciliation(companyId, p);
    const tds = await tdsTcs.report(companyId, { deductionType: 'TDS', period: p });
    const tcs = await tdsTcs.report(companyId, { deductionType: 'TCS', period: p });
    const dues = this._dueDates(p);
    const now = new Date();

    const pending2b = await Gstr2bImport.countDocuments({ companyId, period: p });
    const pendingEinvoice = await EInvoice.countDocuments({
      companyId,
      status: { $in: ['Draft', 'Ready', 'Failed'] },
    });

    const payable = g3.payload.netPayable;
    const gstPayable = round2(
      Math.max(0, payable.cgst) + Math.max(0, payable.sgst) + Math.max(0, payable.igst) + Math.max(0, payable.cess || 0)
    );
    const gstReceivable = round2(
      Math.max(0, -payable.cgst) + Math.max(0, -payable.sgst) + Math.max(0, -payable.igst)
    );

    // Compliance score heuristic
    let score = 100;
    const warnings = [];
    if (!cfg.gstin) {
      score -= 20;
      warnings.push('GSTIN not configured');
    }
    if (!recon.ok) {
      score -= Math.min(30, 5 + recon.exceptions.length * 5);
      warnings.push(...recon.exceptions.map((e) => e.message || e.type));
    }
    if (periodDoc.gstr1Status === 'Pending') {
      score -= 10;
      warnings.push('GSTR-1 not generated for period');
    }
    if (periodDoc.gstr3bStatus === 'Pending') {
      score -= 10;
      warnings.push('GSTR-3B not generated for period');
    }
    if (dues.gstr1Due < now && periodDoc.gstr1Status !== 'Filed') {
      warnings.push('GSTR-1 filing overdue');
      score -= 5;
    }
    score = Math.max(0, Math.min(100, score));

    return {
      period: p,
      gstin: cfg.gstin,
      registrationType: cfg.registrationType,
      gstPayable,
      gstReceivable,
      netPayable: payable,
      filingStatus: {
        gstr1: periodDoc.gstr1Status,
        gstr3b: periodDoc.gstr3bStatus,
        gstr2b: periodDoc.gstr2bStatus,
        periodStatus: periodDoc.status,
      },
      upcomingDueDates: {
        gstr1: dues.gstr1Due,
        gstr3b: dues.gstr3bDue,
      },
      tdsPayable: tds.totalDeducted,
      tcsPayable: tcs.totalDeducted,
      pendingReconciliation: recon.exceptions.length,
      pending2bImport: pending2b === 0,
      pendingEinvoice,
      complianceScore: score,
      auditWarnings: warnings,
      reconciliationOk: recon.ok,
    };
  }

  async filingCalendar(companyId, year) {
    const y = Number(year) || new Date().getFullYear();
    const periods = await GstPeriod.find({
      companyId,
      period: { $regex: `^${y}` },
    }).sort({ period: 1 }).lean();
    return periods;
  }
}

module.exports = new ComplianceDashboardService();
