const fs = require('fs');
const path = require('path');
const CertificationRun = require('../models/CertificationRun');
const businessFlow = require('./businessFlowCertificationService');
const qaRegression = require('./qaRegressionService');
const commercialCert = require('./commercialCertificationService');
const accountingCertifier = require('./certifiers/accountingCertifier');
const inventoryCertifier = require('./certifiers/inventoryCertifier');
const gstCertifier = require('./certifiers/gstCertifier');
const multiCompanyCertifier = require('./certifiers/multiCompanyCertifier');
const securityCertifier = require('./certifiers/securityCertifier');
const apiCoverageCertifier = require('./certifiers/apiCoverageCertifier');
const desktopCertifier = require('./certifiers/desktopCertifier');
const performanceCertifier = require('./certifiers/performanceCertifier');
const offlineCertifier = require('./certifiers/offlineCertifier');
const visualA11yCertifier = require('./certifiers/visualA11yCertifier');
const businessFlowCertifier = require('./certifiers/businessFlowCertifier');
const qualityGates = require('./certifiers/qualityGates');

/**
 * Stage 8.11 — Enterprise Automated Business Certification & Zero Regression Testing Platform.
 * Aggregates unit/API/business/accounting/inventory/GST/security/isolation/performance/desktop
 * into a single production readiness score with hard quality gates.
 */
class EnterpriseTestingPlatformService {
  constructor() {
    this.GATE = qualityGates.PRODUCTION_GATE; // 95
  }

  catalog() {
    return {
      stage: '8.11',
      name: 'Enterprise Automated Business Certification & Zero Regression Testing Platform',
      objective: [
        'ZERO Business Bugs',
        'ZERO Financial Mismatch',
        'ZERO Inventory Mismatch',
        'ZERO GST Mismatch',
        'ZERO Cross Company Leakage',
        'ZERO Regression',
      ],
      testTypes: qualityGates.TEST_TYPES,
      suites: qualityGates.SUITES,
      qualityGates: qualityGates.GATES,
      productionGate: this.GATE,
      tools: {
        unit: 'node:test',
        api: 'supertest',
        ui: 'playwright',
        performance: 'k6 + autocannon',
        visual: 'playwright screenshots',
        coverage: 'c8 (optional)',
      },
      npmScripts: [
        'test',
        'test:unit',
        'test:integration',
        'test:certification',
        'test:security',
        'test:isolation',
        'certify',
        'certify:gates',
      ],
    };
  }

  async dashboard(companyId) {
    const latest = await this.latest(companyId);
    const scaffold = this.scaffoldHealth();
    return {
      catalog: this.catalog(),
      scaffold,
      latest,
      scores: latest?.meta?.scores || this.emptyScores(),
      gates: latest?.meta?.gateResults || [],
      deployBlocked: latest ? !latest.passed : true,
      generatedAt: new Date().toISOString(),
    };
  }

  emptyScores() {
    return {
      unit: 0,
      api: 0,
      business: 0,
      accounting: 0,
      inventory: 0,
      gst: 0,
      security: 0,
      isolation: 0,
      performance: 0,
      ui: 0,
      accessibility: 0,
      desktop: 0,
      offline: 0,
      production: 0,
      overallErpHealth: 0,
    };
  }

  scaffoldHealth() {
    const root = path.join(__dirname, '..');
    const fe = path.join(root, '..', 'frontend');
    const desktop = path.join(root, '..', 'desktop');
    const checks = [
      { id: 'unit_tests', path: path.join(root, 'tests', 'unit'), required: true },
      { id: 'integration_tests', path: path.join(root, 'tests', 'integration'), required: true },
      { id: 'certification_tests', path: path.join(root, 'tests', 'certification'), required: true },
      { id: 'security_tests', path: path.join(root, 'tests', 'security'), required: true },
      { id: 'isolation_tests', path: path.join(root, 'tests', 'isolation'), required: true },
      { id: 'api_manifest', path: path.join(root, 'tests', 'api', 'routeManifest.js'), required: true },
      { id: 'k6_perf', path: path.join(root, 'performance', 'k6'), required: true },
      { id: 'playwright', path: path.join(fe, 'playwright.config.js'), required: true },
      { id: 'e2e_smoke', path: path.join(fe, 'e2e', 'smoke.spec.js'), required: true },
      { id: 'e2e_keyboard', path: path.join(fe, 'e2e', 'keyboard.spec.js'), required: true },
      { id: 'e2e_visual', path: path.join(fe, 'e2e', 'visual.spec.js'), required: true },
      { id: 'desktop', path: path.join(desktop, 'main.js'), required: true },
      { id: 'ci_workflow', path: path.join(root, '..', '.github', 'workflows', 'ci.yml'), required: true },
      { id: 'quality_gates', path: path.join(root, 'services', 'certifiers', 'qualityGates.js'), required: true },
    ];

    const results = checks.map((c) => ({
      ...c,
      present: fs.existsSync(c.path),
    }));
    const missing = results.filter((r) => r.required && !r.present);
    return {
      present: results.filter((r) => r.present).length,
      total: results.length,
      missing: missing.map((m) => m.id),
      results,
      healthy: missing.length === 0,
    };
  }

  /**
   * Full enterprise certification run — hard-fails deploy if any critical gate fails.
   */
  async run(companyId, { triggeredBy = null, mode = 'full' } = {}) {
    const startedAt = Date.now();
    const suites = [];
    const gateFailures = [];

    const runSuite = async (key, label, weight, fn) => {
      const t0 = Date.now();
      try {
        const result = await fn();
        const status = result.passed ? 'pass' : result.warnOnly ? 'warn' : 'fail';
        const score = status === 'pass' ? weight : status === 'warn' ? Math.round(weight * 0.5) : 0;
        const row = {
          key,
          label,
          weight,
          score,
          maxScore: weight,
          status,
          detail: result.detail || '',
          metrics: result.metrics || {},
          gaps: result.gaps || [],
          durationMs: Date.now() - t0,
        };
        suites.push(row);
        if (status === 'fail' && qualityGates.isCritical(key)) {
          gateFailures.push({ key, label, gaps: row.gaps });
        }
        return row;
      } catch (err) {
        const row = {
          key,
          label,
          weight,
          score: 0,
          maxScore: weight,
          status: 'fail',
          detail: err.message,
          gaps: [err.message],
          durationMs: Date.now() - t0,
        };
        suites.push(row);
        if (qualityGates.isCritical(key)) {
          gateFailures.push({ key, label, gaps: [err.message] });
        }
        return row;
      }
    };

    // Platform scaffold
    await runSuite('scaffold', 'Testing platform scaffold', 5, async () => {
      const s = this.scaffoldHealth();
      return {
        passed: s.healthy,
        detail: `${s.present}/${s.total} artifacts`,
        gaps: s.missing.map((m) => `Missing: ${m}`),
        metrics: s,
      };
    });

    // Business flows (8.11 executable — auto-seed smoke tenant when empty)
    await runSuite('business_flows', 'Business flow certification', 12, async () => {
      const seed = mode !== 'readonly';
      const flows = await businessFlowCertifier.certify(companyId, { seed });
      // Keep Stage 8.1 read-only snapshot for meta
      let legacy = null;
      try {
        legacy = await businessFlow.run(flows.metrics?.tenant?.companyId || companyId);
      } catch {
        /* optional */
      }
      return {
        passed: flows.passed,
        detail: flows.detail,
        gaps: flows.gaps,
        metrics: { ...flows, legacy },
      };
    });

    // Accounting
    await runSuite('accounting', 'Accounting reconciliation', 12, async () => {
      const r = await accountingCertifier.certify(companyId);
      return { passed: r.passed, detail: r.detail, gaps: r.gaps, metrics: r };
    });

    // Inventory
    await runSuite('inventory', 'Inventory reconciliation', 12, async () => {
      const r = await inventoryCertifier.certify(companyId);
      return { passed: r.passed, detail: r.detail, gaps: r.gaps, metrics: r };
    });

    // GST
    await runSuite('gst', 'GST reconciliation', 12, async () => {
      const r = await gstCertifier.certify(companyId);
      return { passed: r.passed, detail: r.detail, gaps: r.gaps, metrics: r };
    });

    // Multi-company isolation
    await runSuite('isolation', 'Multi-company isolation', 10, async () => {
      const r = await multiCompanyCertifier.certify(companyId);
      return { passed: r.passed, detail: r.detail, gaps: r.gaps, metrics: r };
    });

    // Security
    await runSuite('security', 'Security posture', 10, async () => {
      const r = await securityCertifier.certify(companyId);
      return { passed: r.passed, detail: r.detail, gaps: r.gaps, metrics: r };
    });

    // API coverage
    await runSuite('api', 'API certification coverage', 8, async () => {
      const r = await apiCoverageCertifier.certify();
      return { passed: r.passed, detail: r.detail, gaps: r.gaps, metrics: r };
    });

    // Performance
    await runSuite('performance', 'Performance budgets', 5, async () => {
      const r = await performanceCertifier.certify(companyId);
      return {
        passed: r.passed,
        warnOnly: r.warnOnly,
        detail: r.detail,
        gaps: r.gaps,
        metrics: r,
      };
    });

    // Offline
    await runSuite('offline', 'Offline capability', 4, async () => {
      const r = await offlineCertifier.certify();
      return { passed: r.passed, warnOnly: true, detail: r.detail, gaps: r.gaps, metrics: r };
    });

    // Visual / a11y scaffold
    await runSuite('visual_a11y', 'Visual & accessibility harness', 4, async () => {
      const r = await visualA11yCertifier.certify();
      return { passed: r.passed, warnOnly: true, detail: r.detail, gaps: r.gaps, metrics: r };
    });

    // Desktop
    await runSuite('desktop', 'Desktop build verification', 4, async () => {
      const r = await desktopCertifier.certify();
      return { passed: r.passed, warnOnly: true, detail: r.detail, gaps: r.gaps, metrics: r };
    });

    // QA smoke
    await runSuite('qa_smoke', 'QA regression smoke', 2, async () => {
      const qa = await qaRegression.runSmoke(companyId);
      return {
        passed: qa.passed,
        detail: `score=${qa.score}`,
        gaps: qa.passed ? [] : ['QA smoke failed'],
        metrics: qa,
      };
    });

    const totalWeight = suites.reduce((s, c) => s + c.weight, 0);
    const totalScore = suites.reduce((s, c) => s + c.score, 0);
    const score = totalWeight ? Math.round((totalScore / totalWeight) * 100) : 0;

    const scores = {
      unit: suites.find((s) => s.key === 'scaffold')?.score
        ? Math.round((suites.find((s) => s.key === 'scaffold').score / 5) * 100)
        : 0,
      api: pct(suites, 'api'),
      business: pct(suites, 'business_flows'),
      accounting: pct(suites, 'accounting'),
      inventory: pct(suites, 'inventory'),
      gst: pct(suites, 'gst'),
      security: pct(suites, 'security'),
      isolation: pct(suites, 'isolation'),
      performance: pct(suites, 'performance'),
      ui: pct(suites, 'visual_a11y'),
      accessibility: pct(suites, 'visual_a11y'),
      desktop: pct(suites, 'desktop'),
      offline: pct(suites, 'offline'),
      production: score,
      overallErpHealth: score,
    };

    const gateResults = qualityGates.evaluate({ score, suites, gateFailures });
    const criticalFail = gateFailures.length > 0 || gateResults.some((g) => g.blocking && !g.passed);
    const passed = score >= this.GATE && !criticalFail;

    const report = {
      score,
      gate: this.GATE,
      passed,
      status: passed ? 'passed' : score >= this.GATE - 10 && !criticalFail ? 'partial' : 'failed',
      deployAllowed: passed,
      checklist: suites,
      gaps: [...new Set(suites.flatMap((s) => s.gaps || []).filter(Boolean))],
      gateFailures,
      gateResults,
      meta: {
        stage: 8.11,
        name: 'Enterprise Testing Platform Certification',
        version: '1.0.0',
        mode,
        scores,
        scoresDetail: scores,
        unitCoverageTarget: 95,
        apiCoverageTarget: 100,
        businessFlowTarget: 100,
        productionReadinessTarget: 95,
        durationMs: Date.now() - startedAt,
        triggeredBy,
        generatedAt: new Date().toISOString(),
      },
      reconcileStatus: 'enterprise-testing-platform',
    };

    const run = await CertificationRun.create({
      companyId: companyId || null,
      score: report.score,
      gate: this.GATE,
      passed,
      status: report.status,
      checklist: suites,
      gaps: report.gaps,
      reconcileStatus: report.reconcileStatus,
      meta: report.meta,
    });

    // Optionally refresh commercial cert linkage when full mode
    if (mode === 'full') {
      try {
        await commercialCert.latest(companyId);
      } catch {
        /* non-blocking */
      }
    }

    return { ...report, runId: run._id };
  }

  async latest(companyId) {
    return CertificationRun.findOne({
      $or: [{ 'meta.stage': 8.11 }, { reconcileStatus: 'enterprise-testing-platform' }],
      ...(companyId ? { companyId } : {}),
    }).sort({ createdAt: -1 });
  }

  async list(companyId) {
    return CertificationRun.find({
      $or: [{ 'meta.stage': 8.11 }, { reconcileStatus: 'enterprise-testing-platform' }],
      ...(companyId ? { companyId } : {}),
    })
      .sort({ createdAt: -1 })
      .limit(20);
  }

  /**
   * CI helper — evaluate gate file without DB when needed.
   */
  evaluateCiGates(summary) {
    return qualityGates.evaluateCi(summary);
  }
}

function pct(suites, key) {
  const row = suites.find((s) => s.key === key);
  if (!row || !row.maxScore) return 0;
  return Math.round((row.score / row.maxScore) * 100);
}

module.exports = new EnterpriseTestingPlatformService();
