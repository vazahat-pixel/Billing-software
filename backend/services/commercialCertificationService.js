const CertificationRun = require('../models/CertificationRun');
const businessFlow = require('./businessFlowCertificationService');
const qaRegression = require('./qaRegressionService');
const licensing = require('./licensingActivationService');
const onboarding = require('./onboardingService');
const releaseMgmt = require('./releaseManagementService');
const monitoringService = require('./monitoringService');

const GATE = 85;

/**
 * Stage 8.10 — Commercial / Production readiness certification.
 * Aggregates prior stages + business flows + license + desktop + docs.
 */
class CommercialCertificationService {
  async run(companyId, { triggeredBy = null } = {}) {
    const checklist = [];
    const gaps = [];

    const add = (key, label, weight, status, gapList = []) => {
      const score = status === 'pass' ? weight : status === 'warn' ? Math.round(weight * 0.5) : 0;
      checklist.push({ key, label, weight, score, maxScore: weight, status, gaps: gapList });
      gaps.push(...gapList);
    };

    // Prior stage certs (latest each)
    const prior = await CertificationRun.find({
      companyId,
      $or: [
        { 'meta.stage': { $in: [4, 6, 7] } },
        { reconcileStatus: { $in: ['enterprise-readiness', 'infrastructure-readiness'] } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const latestByStage = {};
    for (const r of prior) {
      const st = r.meta?.stage;
      if (st && !latestByStage[st]) latestByStage[st] = r;
    }

    add(
      'stage4',
      'Compliance engine certified',
      8,
      latestByStage[4]?.passed ? 'pass' : latestByStage[4] ? 'warn' : 'warn',
      latestByStage[4]?.passed ? [] : ['Run Stage 4 certification']
    );
    add(
      'stage6',
      'Enterprise productivity certified',
      8,
      latestByStage[6]?.passed ? 'pass' : latestByStage[6] ? 'warn' : 'warn',
      latestByStage[6]?.passed ? [] : ['Run Stage 6 certification']
    );
    add(
      'stage7',
      'Infrastructure certified',
      10,
      latestByStage[7]?.passed ? 'pass' : latestByStage[7] ? 'warn' : 'warn',
      latestByStage[7]?.passed ? [] : ['Run Stage 7 certification']
    );

    // 8.1 Business flows
    const flows = await businessFlow.run(companyId);
    add(
      'business_flows',
      'Business flow certification',
      15,
      flows.passed ? 'pass' : flows.fail === 0 ? 'warn' : 'fail',
      flows.passed ? [] : ['Seed sample sales/purchases/masters via QA simulate']
    );

    // 8.2 QA
    const qa = await qaRegression.runSmoke(companyId);
    add('qa_regression', 'QA / regression smoke', 10, qa.passed ? 'pass' : 'fail', qa.passed ? [] : ['Fix failing smoke checks']);

    // 8.3 UI
    const ui = qaRegression.uiuxChecklist();
    add('uiux', 'UI/UX enterprise polish', 8, ui.enforced.browserDialogGuard ? 'pass' : 'fail', []);

    // 8.4–8.5 Desktop
    const desktop = releaseMgmt.desktopStatus();
    add(
      'desktop',
      'Desktop packaging scaffold',
      8,
      desktop.scaffold && desktop.electron ? 'pass' : 'warn',
      desktop.electron ? [] : ['desktop/ Electron scaffold missing']
    );
    add(
      'installer',
      'Installer & auto-update config',
      5,
      desktop.installerConfig ? 'pass' : 'warn',
      desktop.installerConfig ? [] : ['Add electron-builder.yml']
    );

    // 8.6 Docs
    const docs = releaseMgmt.documentationIndex();
    add(
      'documentation',
      'Documentation & help center',
      8,
      (docs.guides?.length || 0) >= 5 || docs.helpCenter.length >= 8 ? 'pass' : 'warn',
      (docs.guides?.length || 0) >= 5 ? [] : ['Add customer guides under docs/guides']
    );

    // 8.7 Licensing
    const lic = await licensing.status(companyId);
    add(
      'licensing',
      'Commercial license active',
      10,
      lic.active ? 'pass' : 'warn',
      lic.active ? [] : ['Activate or renew company license']
    );

    // 8.8 Onboarding
    const onb = await onboarding.status(companyId, triggeredBy);
    add(
      'onboarding',
      'Customer onboarding',
      5,
      onb.status === 'completed' || onb.status === 'skipped' ? 'pass' : onb.progressPct > 0 ? 'warn' : 'warn',
      onb.status === 'completed' ? [] : ['Complete welcome wizard or quick setup']
    );

    // Performance / security signals from Stage 7 monitoring
    let mon = null;
    try {
      mon = await monitoringService.snapshot(companyId);
      add(
        'performance',
        'Performance budget',
        5,
        mon.api?.withinBudget !== false ? 'pass' : 'warn',
        []
      );
    } catch {
      add('performance', 'Performance budget', 5, 'warn', ['Monitoring unavailable']);
    }

    const totalWeight = checklist.reduce((s, c) => s + c.weight, 0);
    const totalScore = checklist.reduce((s, c) => s + c.score, 0);
    const score = totalWeight ? Math.round((totalScore / totalWeight) * 100) : 0;
    const passed = score >= GATE;

    const businessScore = flows.score;
    const securityScore = latestByStage[7]?.meta?.securityScore || (lic.active ? 90 : 60);
    const performanceScore = mon?.api?.withinBudget ? 90 : 70;
    const infrastructureScore = latestByStage[7]?.score || 70;
    const qualityScore = qa.score;
    const commercialScore = Math.round(
      (scoreFrom(checklist, ['licensing', 'onboarding', 'documentation', 'desktop']) + businessScore) / 2
    );
    const productionScore = score;

    const report = {
      score,
      gate: GATE,
      passed,
      status: passed ? 'passed' : score >= GATE - 15 ? 'partial' : 'failed',
      checklist,
      gaps: [...new Set(gaps.filter(Boolean))],
      meta: {
        stage: 8,
        name: 'Commercial Release & Production Certification',
        version: '1.0.0',
        businessScore,
        securityScore,
        performanceScore,
        infrastructureScore,
        qualityScore,
        commercialScore,
        productionScore,
        overallErpQualityScore: Math.round((businessScore + qualityScore + (ui.scoreHint || 90)) / 3),
        overallProductionScore: productionScore,
        overallCommercialScore: commercialScore,
        releaseCandidate: passed ? 'APPROVED' : 'PENDING',
        version1Approved: passed,
        flows,
        qa,
        license: lic,
        onboarding: { status: onb.status, progressPct: onb.progressPct },
        desktop,
        generatedAt: new Date().toISOString(),
      },
      reconcileStatus: 'commercial-readiness',
    };

    const run = await CertificationRun.create({
      companyId: companyId || null,
      score: report.score,
      gate: GATE,
      passed,
      status: report.status,
      checklist,
      gaps: report.gaps,
      reconcileStatus: report.reconcileStatus,
      meta: { ...report.meta, triggeredBy },
    });

    // Seed release record scores
    try {
      await releaseMgmt.ensureV1();
      await releaseMgmt.upsert({
        version: '1.0.0',
        scores: {
          business: businessScore,
          security: securityScore,
          performance: performanceScore,
          infrastructure: infrastructureScore,
          quality: qualityScore,
          commercial: commercialScore,
          production: productionScore,
          overall: score,
        },
        status: passed ? 'approved' : 'rc',
      });
    } catch {
      /* optional */
    }

    return { ...report, runId: run._id };
  }

  async latest(companyId) {
    return CertificationRun.findOne({
      $or: [{ 'meta.stage': 8 }, { reconcileStatus: 'commercial-readiness' }],
      ...(companyId ? { companyId } : {}),
    }).sort({ createdAt: -1 });
  }

  async list(companyId) {
    return CertificationRun.find({
      $or: [{ 'meta.stage': 8 }, { reconcileStatus: 'commercial-readiness' }],
      ...(companyId ? { companyId } : {}),
    })
      .sort({ createdAt: -1 })
      .limit(20);
  }
}

function scoreFrom(checklist, keys) {
  const rows = checklist.filter((c) => keys.includes(c.key));
  if (!rows.length) return 0;
  const w = rows.reduce((s, c) => s + c.maxScore, 0);
  const sc = rows.reduce((s, c) => s + c.score, 0);
  return w ? Math.round((sc / w) * 100) : 0;
}

module.exports = new CommercialCertificationService();
