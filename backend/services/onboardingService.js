const OnboardingProgress = require('../models/OnboardingProgress');
const Company = require('../models/Company');
const CompanySettings = require('../models/CompanySettings');
const configService = require('./configService');
const accountingService = require('./accountingService');
const jobQueueService = require('./jobQueueService');
const AppError = require('../utils/AppError');
const auditService = require('./auditService');

const STEP_ORDER = [
  'companyProfile',
  'financialYear',
  'gstConfig',
  'chartOfAccounts',
  'mastersSeed',
  'invoiceSeries',
  'roles',
  'backupSchedule',
  'welcomeComplete',
];

/**
 * Stage 8.8 — Customer onboarding (< 15 minutes target).
 */
class OnboardingService {
  async getOrCreate(companyId, userId) {
    let row = await OnboardingProgress.findOne({ companyId });
    if (!row) {
      row = await OnboardingProgress.create({
        companyId,
        startedBy: userId || null,
        status: 'pending',
      });
    }
    return row;
  }

  async status(companyId, userId) {
    const row = await this.getOrCreate(companyId, userId);
    const done = Object.values(row.steps || {}).filter(Boolean).length;
    const total = STEP_ORDER.length;
    return {
      ...row.toObject(),
      progressPct: Math.round((done / total) * 100),
      remainingSteps: STEP_ORDER.filter((s) => !row.steps?.[s]),
      estimatedMinutesLeft: Math.max(0, (total - done) * 1.5),
      targetMinutes: 15,
    };
  }

  async completeStep(companyId, step, payload = {}, userId) {
    if (!STEP_ORDER.includes(step)) throw AppError.badRequest(`Unknown step: ${step}`);
    const row = await this.getOrCreate(companyId, userId);
    row.status = 'in_progress';
    row.steps[step] = true;
    row.currentStep = Math.max(row.currentStep || 0, STEP_ORDER.indexOf(step) + 1);

    // Side effects using existing services
    if (step === 'companyProfile' && payload.legalName) {
      await CompanySettings.findOneAndUpdate(
        { companyId },
        { legalName: payload.legalName, gstin: payload.gstin || '', address: payload.address || '' },
        { upsert: true }
      );
      if (payload.companyName) {
        await Company.findByIdAndUpdate(companyId, { name: payload.companyName });
      }
    }

    if (step === 'chartOfAccounts' || step === 'mastersSeed') {
      try {
        await configService.seedCompanyDefaults(companyId, userId);
      } catch {
        /* may already exist */
      }
    }

    if (step === 'chartOfAccounts') {
      try {
        await accountingService.seedSystemLedgers(companyId);
      } catch {
        /* optional */
      }
    }

    if (step === 'backupSchedule') {
      try {
        await jobQueueService.enqueue(companyId, {
          queue: 'backup',
          jobType: 'backup.run',
          payload: { companyId: String(companyId), type: 'scheduled' },
          delayMs: 0,
        });
      } catch {
        /* optional */
      }
    }

    const allDone = STEP_ORDER.every((s) => row.steps[s]);
    if (allDone || step === 'welcomeComplete') {
      row.steps.welcomeComplete = true;
      row.status = 'completed';
      row.completedAt = new Date();
    }

    await row.save();
    await auditService.logSystem({
      companyId,
      userId,
      action: 'onboarding.step',
      module: 'commercial',
      after: { step, status: row.status },
    });
    return this.status(companyId, userId);
  }

  async runQuickSetup(companyId, userId, profile = {}) {
    const steps = [
      ['companyProfile', profile],
      ['financialYear', {}],
      ['gstConfig', {}],
      ['chartOfAccounts', {}],
      ['mastersSeed', {}],
      ['invoiceSeries', {}],
      ['roles', {}],
      ['backupSchedule', {}],
      ['welcomeComplete', {}],
    ];
    let last = null;
    for (const [step, payload] of steps) {
      last = await this.completeStep(companyId, step, payload, userId);
    }
    return last;
  }

  async skip(companyId, userId) {
    const row = await this.getOrCreate(companyId, userId);
    row.status = 'skipped';
    row.completedAt = new Date();
    await row.save();
    return row;
  }

  wizardDefinition() {
    return {
      title: 'Welcome — Setup your Textile ERP',
      targetMinutes: 15,
      steps: [
        { key: 'companyProfile', title: 'Company Profile', minutes: 2 },
        { key: 'financialYear', title: 'Financial Year', minutes: 1 },
        { key: 'gstConfig', title: 'GST Configuration', minutes: 2 },
        { key: 'chartOfAccounts', title: 'Chart of Accounts', minutes: 2 },
        { key: 'mastersSeed', title: 'Default Masters', minutes: 2 },
        { key: 'invoiceSeries', title: 'Invoice Series', minutes: 1 },
        { key: 'roles', title: 'Roles & Permissions', minutes: 2 },
        { key: 'backupSchedule', title: 'Backup Schedule', minutes: 1 },
        { key: 'welcomeComplete', title: 'Finish', minutes: 1 },
      ],
    };
  }
}

module.exports = new OnboardingService();
