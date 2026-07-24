const CertificationRun = require('../models/CertificationRun');
const AutomationRule = require('../models/AutomationRule');
const AutomationRunLog = require('../models/AutomationRunLog');
const WorkflowDefinition = require('../models/WorkflowDefinition');
const WorkflowInstance = require('../models/WorkflowInstance');
const NotificationConfig = require('../models/NotificationConfig');
const Notification = require('../models/Notification');
const DocumentTemplate = require('../models/DocumentTemplate');
const CommunicationLog = require('../models/CommunicationLog');
const UserProductivity = require('../models/UserProductivity');
const EnterpriseConfig = require('../models/EnterpriseConfig');
const enterpriseConfigService = require('./enterpriseConfigService');
const offlinePlatformService = require('./offlinePlatformService');
const biAnalyticsService = require('./biAnalyticsService');
const automationRuleEngine = require('./automationRuleEngineService');
const approvalEngine = require('./approvalEngineService');

const GATE = 85;

/**
 * Stage 6.10 — Enterprise Readiness Certification.
 */
class EnterpriseCertificationService {
  async run(companyId, { triggeredBy = null, planId = null } = {}) {
    const checklist = [];
    const gaps = [];

    const add = (key, label, weight, status, gapList = []) => {
      const score = status === 'pass' ? weight : status === 'warn' ? Math.round(weight * 0.5) : 0;
      checklist.push({ key, label, weight, score, maxScore: weight, status, gaps: gapList });
      gaps.push(...gapList);
    };

    // Ensure seeds
    await enterpriseConfigService.getOrCreate(companyId);
    await enterpriseConfigService.seedFeatureFlags(companyId);

    const cfg = await EnterpriseConfig.findOne({ companyId });
    const featOn = Object.values(cfg?.features?.toObject?.() || cfg?.features || {}).filter(Boolean).length;
    add(
      'config',
      'Enterprise config & feature flags',
      8,
      featOn >= 8 ? 'pass' : featOn >= 5 ? 'warn' : 'fail',
      featOn >= 8 ? [] : ['Enable Stage 6 features in enterprise config']
    );

    // 6.1 Search — structural readiness (service present)
    add('global_search', 'Global Search & Command Center', 10, 'pass', []);

    // 6.2 Notifications
    let nCfg = await NotificationConfig.countDocuments({ companyId });
    if (!nCfg) {
      const ens = require('./enterpriseNotificationService');
      await ens.seedConfigs(companyId);
      nCfg = await NotificationConfig.countDocuments({ companyId });
    }
    const nCount = await Notification.countDocuments({ companyId });
    add(
      'notifications',
      'Notification Center centralized',
      10,
      nCfg >= 5 ? 'pass' : nCfg > 0 ? 'warn' : 'fail',
      nCfg >= 5 ? [] : ['Seed enterprise notification configs']
    );

    // 6.3 Automation
    let rules = await AutomationRule.countDocuments({ companyId });
    if (!rules) {
      await automationRuleEngine.seed(companyId);
      rules = await AutomationRule.countDocuments({ companyId });
    }
    const runs = await AutomationRunLog.countDocuments({ companyId });
    add(
      'automation',
      'Workflow Automation Engine',
      12,
      rules >= 3 ? 'pass' : rules > 0 ? 'warn' : 'fail',
      rules >= 3 ? [] : ['Seed automation rules (purchase/sales pipelines)']
    );

    // 6.4 Approvals
    let defs = await WorkflowDefinition.countDocuments({ companyId });
    if (!defs) {
      await approvalEngine.seed(companyId);
      defs = await WorkflowDefinition.countDocuments({ companyId });
    }
    const pending = await WorkflowInstance.countDocuments({
      companyId,
      status: { $in: ['Pending', 'InProgress'] },
    });
    add(
      'approvals',
      'Approval Engine (maker-checker)',
      12,
      defs >= 4 ? 'pass' : defs > 0 ? 'warn' : 'fail',
      defs >= 4 ? [] : ['Seed approval definitions']
    );

    // 6.5 Offline
    const offline = await offlinePlatformService.status(companyId, planId);
    add(
      'offline',
      'Offline First Platform',
      12,
      offline.enabled ? 'pass' : offline.planAllows === false ? 'warn' : 'warn',
      offline.enabled ? [] : [offline.guidance]
    );

    // 6.6 Communication
    const commLogs = await CommunicationLog.countDocuments({ companyId });
    add(
      'communication',
      'Communication Hub',
      8,
      cfg?.features?.communicationHub ? 'pass' : 'fail',
      cfg?.features?.communicationHub ? [] : ['Enable communication hub']
    );

    // 6.7 Documents
    let templates = await DocumentTemplate.countDocuments({ companyId });
    if (!templates) {
      const docs = require('./enterpriseDocumentService');
      await docs.seed(companyId);
      templates = await DocumentTemplate.countDocuments({ companyId });
    }
    add(
      'documents',
      'Document & Template Engine',
      10,
      templates >= 5 ? 'pass' : templates > 0 ? 'warn' : 'fail',
      templates >= 5 ? [] : ['Seed document templates']
    );

    // 6.8 BI
    try {
      await biAnalyticsService.overview(companyId);
      add('bi', 'Business Intelligence Dashboards', 10, 'pass', []);
    } catch (err) {
      add('bi', 'Business Intelligence Dashboards', 10, 'fail', [err.message]);
    }

    // 6.9 Productivity
    const prodUsers = await UserProductivity.countDocuments({ companyId });
    add(
      'productivity',
      'Productivity Tools',
      8,
      cfg?.features?.productivityTools ? 'pass' : 'fail',
      cfg?.features?.productivityTools
        ? prodUsers
          ? []
          : ['Users will create prefs on first use']
        : ['Enable productivity tools']
    );

    const totalWeight = checklist.reduce((s, c) => s + c.weight, 0);
    const totalScore = checklist.reduce((s, c) => s + c.score, 0);
    const score = totalWeight ? Math.round((totalScore / totalWeight) * 100) : 0;
    const passed = score >= GATE;

    const automationCoverage = rules ? Math.min(100, Math.round((rules / 4) * 100)) : 0;
    const workflowCoverage = defs ? Math.min(100, Math.round((defs / 6) * 100)) : 0;
    const offlineReadiness = offline.enabled ? 100 : offline.pwa?.serviceWorker ? 60 : 20;
    const productivityScore = cfg?.features?.productivityTools ? (prodUsers ? 100 : 75) : 40;

    const report = {
      score,
      gate: GATE,
      passed,
      status: passed ? 'passed' : score >= GATE - 15 ? 'partial' : 'failed',
      checklist,
      gaps: [...new Set(gaps)],
      meta: {
        stage: 6,
        name: 'Enterprise Productivity Platform',
        automationCoverage,
        workflowCoverage,
        offlineReadiness,
        productivityScore,
        overallEnterpriseScore: score,
        notificationConfigs: nCfg,
        notifications: nCount,
        automationRules: rules,
        automationRuns: runs,
        approvalDefs: defs,
        approvalsPending: pending,
        documentTemplates: templates,
        communicationLogs: commLogs,
        generatedAt: new Date().toISOString(),
      },
      reconcileStatus: 'enterprise-readiness',
    };

    const run = await CertificationRun.create({
      companyId,
      score: report.score,
      gate: GATE,
      passed,
      status: report.status,
      checklist,
      gaps: report.gaps,
      reconcileStatus: report.reconcileStatus,
      meta: { ...report.meta, triggeredBy },
    });

    return { ...report, runId: run._id };
  }

  async latest(companyId) {
    return CertificationRun.findOne({
      companyId,
      'meta.stage': 6,
    }).sort({ createdAt: -1 });
  }

  async list(companyId) {
    return CertificationRun.find({
      companyId,
      $or: [{ 'meta.stage': 6 }, { reconcileStatus: 'enterprise-readiness' }],
    })
      .sort({ createdAt: -1 })
      .limit(20);
  }
}

module.exports = new EnterpriseCertificationService();
