const fs = require('fs');
const path = require('path');
const { QaRunner } = require('../../qa');
const { buildReadinessReport } = require('../../qa/verifier/readinessReport');
const ReconciliationRun = require('../../models/ReconciliationRun');
const Company = require('../../models/Company');

const activeRuns = new Map();

function latestReportDir() {
  const base = path.join(__dirname, '../../qa/reports/output');
  if (!fs.existsSync(base)) return null;
  const dirs = fs.readdirSync(base).sort().reverse();
  return dirs[0] ? path.join(base, dirs[0]) : null;
}

function devGuard(req, res, next) {
  if (process.env.NODE_ENV === 'production' && process.env.QA_ALLOW !== 'true') {
    return res.status(403).json({ success: false, message: 'Developer QA tools disabled in production' });
  }
  const role = req.user?.role;
  const companyRole = req.user?.companyRole;
  if (role !== 'super_admin' && companyRole !== 'owner') {
    return res.status(403).json({ success: false, message: 'Developer access required' });
  }
  return next();
}

exports.devGuard = devGuard;

exports.runSimulator = async (req, res) => {
  const profile = req.body.profile || 'smoke';
  const runId = `sim-${Date.now()}`;
  activeRuns.set(runId, { status: 'running', startedAt: new Date() });

  setImmediate(async () => {
    const runner = new QaRunner();
    runner.ctx.profile = require('../../qa/profiles').resolveProfile(profile);
    runner.ctx.args = { fresh: !!req.body.fresh };
    try {
      await runner.init();
      const simulation = await runner.simulate();
      const { report } = await buildReadinessReport(runner.ctx, { simulation });
      activeRuns.set(runId, { status: 'completed', simulation, report, finishedAt: new Date() });
      await runner.shutdown();
    } catch (err) {
      activeRuns.set(runId, { status: 'failed', error: err.message, finishedAt: new Date() });
      try {
        await runner.shutdown();
      } catch {
        /* ignore */
      }
    }
  });

  return res.json({ success: true, data: { runId, status: 'running' } });
};

exports.getRunStatus = async (req, res) => {
  const run = activeRuns.get(req.params.runId);
  if (!run) return res.status(404).json({ success: false, message: 'Run not found' });
  return res.json({ success: true, data: run });
};

exports.health = async (req, res) => {
  const companyId = req.companyId;
  const lastReconcile = await ReconciliationRun.findOne({ companyId }).sort({ createdAt: -1 }).lean();
  const company = await Company.findById(companyId).select('isQaTenant qaProfile name').lean();

  const latestDir = latestReportDir();
  let lastReport = null;
  if (latestDir) {
    try {
      lastReport = JSON.parse(fs.readFileSync(path.join(latestDir, 'report.json'), 'utf8'));
    } catch {
      lastReport = null;
    }
  }

  return res.json({
    success: true,
    data: {
      company,
      reconcile: lastReconcile
        ? { status: lastReconcile.status, mismatches: lastReconcile.summary?.mismatches, at: lastReconcile.finishedAt }
        : null,
      lastReadiness: lastReport
        ? { overallScore: lastReport.overallScore, recommendation: lastReport.recommendation, at: lastReport.generatedAt }
        : null,
      activeRuns: [...activeRuns.entries()].map(([id, v]) => ({ id, status: v.status })),
    },
  });
};

exports.latestReadiness = async (req, res) => {
  const latestDir = latestReportDir();
  if (!latestDir) return res.status(404).json({ success: false, message: 'No readiness report found' });
  const report = JSON.parse(fs.readFileSync(path.join(latestDir, 'report.json'), 'utf8'));
  return res.json({ success: true, data: report, meta: { path: latestDir } });
};
