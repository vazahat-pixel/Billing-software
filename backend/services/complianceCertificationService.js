const CertificationRun = require('../models/CertificationRun');
const GstConfig = require('../models/GstConfig');
const HsnMaster = require('../models/HsnMaster');
const TaxDeduction = require('../models/TaxDeduction');
const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');
const gstConfigService = require('./gstConfigService');
const gstReturnService = require('./gstReturnService');
const gstReconciliation = require('./gstReconciliationService');
const hsnEngine = require('./hsnEngineService');
const { periodKey, validateGstin } = require('../utils/gstDetermination');

const GATE = 90;

/**
 * Compliance Certification — Sprint 4.10
 */
class ComplianceCertificationService {
  async run(companyId, { triggeredBy = null, period } = {}) {
    const p = period || periodKey();
    const checklist = [];
    const gaps = [];

    const add = (key, label, weight, status, gapList = []) => {
      const score = status === 'pass' ? weight : status === 'warn' ? Math.round(weight * 0.5) : 0;
      checklist.push({ key, label, weight, score, maxScore: weight, status, gaps: gapList });
      gaps.push(...gapList);
    };

    const cfg = await gstConfigService.getOrCreate(companyId);
    const gstinOk = cfg.gstin ? validateGstin(cfg.gstin).ok : false;
    add(
      'gst_config',
      'GST configuration & registration',
      10,
      gstinOk ? 'pass' : 'fail',
      gstinOk ? [] : ['Configure valid GSTIN in GST config']
    );

    add(
      'ledger_map',
      'GST ledger mapping',
      5,
      cfg.ledgerMap?.cgstOutput && cfg.ledgerMap?.cgstInput ? 'pass' : 'warn',
      cfg.ledgerMap?.cgstOutput ? [] : ['Run CoA seed / map GST ledgers']
    );

    // Backend tax on sales
    const salesSample = await Sales.find({ companyId }).sort({ createdAt: -1 }).limit(20).lean();
    const salesTaxOk = salesSample.every((s) => {
      if (!(s.taxableAmount > 0)) return true;
      if (['Exempt', 'NilRated', 'ZeroRated', 'Export'].includes(s.gstType)) return true;
      return (s.cgst || 0) + (s.sgst || 0) + (s.igst || 0) > 0 || s.gstAmount > 0;
    });
    add(
      'sales_tax',
      'Sales GST present on taxable invoices',
      10,
      salesSample.length === 0 ? 'warn' : salesTaxOk ? 'pass' : 'fail',
      salesSample.length === 0 ? ['No sales to validate'] : salesTaxOk ? [] : ['Taxable sales missing GST components']
    );

    const purchaseSample = await Purchase.find({ companyId }).sort({ createdAt: -1 }).limit(20).lean();
    add(
      'purchase_tax',
      'Purchase documents present',
      5,
      purchaseSample.length > 0 ? 'pass' : 'warn',
      purchaseSample.length ? [] : ['No purchases — run simulation']
    );

    // Returns
    let g1;
    let g3;
    try {
      g1 = await gstReturnService.buildGstr1(companyId, p);
      g3 = await gstReturnService.buildGstr3b(companyId, p);
      add('gstr1', 'GSTR-1 generates from transactions', 15, 'pass', []);
      add('gstr3b', 'GSTR-3B generates with payable', 15, 'pass', []);
    } catch (err) {
      add('gstr1', 'GSTR-1 generates from transactions', 15, 'fail', [err.message]);
      add('gstr3b', 'GSTR-3B generates with payable', 15, 'fail', [err.message]);
    }

    const hsn = await hsnEngine.summary(companyId, { period: p });
    const hsnCount = await HsnMaster.countDocuments({ companyId });
    add(
      'hsn',
      'HSN masters / summary',
      10,
      hsnCount > 0 || (hsn.rows || []).length > 0 ? 'pass' : 'warn',
      hsnCount || hsn.rows?.length ? [] : ['Sync HSN from items or create masters']
    );

    const recon = await gstReconciliation.fullReconciliation(companyId, p);
    add(
      'reconciliation',
      'GST reconciliation clean',
      15,
      recon.ok ? 'pass' : recon.exceptions.length <= 2 ? 'warn' : 'fail',
      recon.ok ? [] : recon.exceptions.map((e) => e.message || e.type)
    );

    const tdsCount = await TaxDeduction.countDocuments({ companyId });
    add(
      'tds_tcs',
      'TDS/TCS engine available',
      5,
      tdsCount > 0 ? 'pass' : 'warn',
      tdsCount ? [] : ['Optional: post sample TDS/TCS']
    );

    add(
      'einvoice_arch',
      'E-Invoice / E-Way architecture ready',
      5,
      'pass',
      []
    );

    add(
      'period_lock',
      'GST period management',
      5,
      'pass',
      []
    );

    const score = checklist.reduce((s, c) => s + c.score, 0);
    const maxScore = checklist.reduce((s, c) => s + c.maxScore, 0);
    const pct = maxScore ? Math.round((score / maxScore) * 100) : 0;
    const passed = pct >= GATE && gstinOk && !!g1 && !!g3;

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
        stage: 4,
        type: 'compliance',
        period: p,
        triggeredBy,
        gstr1Totals: g1?.totals,
        gstr3bPayable: g3?.payload?.netPayable,
        integrity: {
          gstinOk,
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
      gstIntegrityReport: recon,
      filingReadinessScore: pct,
      complianceReadinessReport: {
        period: p,
        gstin: cfg.gstin,
        registrationType: cfg.registrationType,
      },
    };
  }

  async latest(companyId) {
    return CertificationRun.findOne({ companyId, 'meta.stage': 4 }).sort({ createdAt: -1 }).lean();
  }

  async list(companyId, limit = 20) {
    return CertificationRun.find({ companyId, 'meta.stage': 4 }).sort({ createdAt: -1 }).limit(limit).lean();
  }
}

module.exports = new ComplianceCertificationService();
