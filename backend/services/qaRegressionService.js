const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

/**
 * Stage 8.2 — Regression / QA harness status (orchestrates existing QA scripts conceptually).
 */
class QaRegressionService {
  async inventory() {
    const backendRoot = path.join(__dirname, '..');
    const qaDir = path.join(backendRoot, 'qa');
    const scripts = {
      simulate: fs.existsSync(path.join(backendRoot, 'scripts', 'simulator', 'simulate.js')),
      verify: fs.existsSync(path.join(backendRoot, 'scripts', 'verifier', 'verify.js')),
      qaRunner: fs.existsSync(path.join(backendRoot, 'scripts', 'qa', 'run.js')),
      tests: fs.existsSync(path.join(backendRoot, 'tests')),
      migrations: fs.existsSync(path.join(backendRoot, 'migrations')),
      e2eConfig: fs.existsSync(path.join(backendRoot, '..', 'frontend', 'playwright.config.js')),
    };

    let qaModules = [];
    if (fs.existsSync(qaDir)) {
      qaModules = fs.readdirSync(qaDir).filter((f) => !f.startsWith('.'));
    }

    return {
      scripts,
      qaModules,
      npmScripts: ['simulate', 'verify', 'qa', 'test', 'benchmark', 'migrate'],
      suites: [
        { id: 'api', label: 'API envelope & auth', command: 'npm test' },
        { id: 'business', label: 'Business simulate + verify', command: 'npm run simulate && npm run verify' },
        { id: 'offline', label: 'Offline feature', command: 'npm run test:offline' },
        { id: 'security', label: 'Stage 7 security posture', command: 'GET /api/stage7/security/posture' },
        { id: 'e2e', label: 'Playwright offline E2E', command: 'cd frontend && npm run test:e2e' },
        { id: 'concurrency', label: 'Multi-company isolation', command: 'manual / middleware' },
        { id: 'performance', label: 'Latency budget <300ms', command: 'GET /api/stage7/monitor/snapshot' },
        { id: 'recovery', label: 'Backup verify', command: 'POST /api/stage7/backups' },
      ],
    };
  }

  async runSmoke(companyId) {
    const results = [];
    const push = (id, status, detail) => results.push({ id, status, detail });

    push('mongo', mongoose.connection.readyState === 1 ? 'pass' : 'fail', `readyState=${mongoose.connection.readyState}`);
    push('company', companyId ? 'pass' : 'warn', companyId ? String(companyId) : 'no company');

    try {
      const Party = require('../models/Party');
      const n = await Party.countDocuments(companyId ? { companyId } : {});
      push('db_read', 'pass', `parties=${n}`);
    } catch (err) {
      push('db_read', 'fail', err.message);
    }

    try {
      require('../middlewares/auth.middleware');
      require('../middlewares/rateLimit.middleware');
      push('security_mw', 'pass', 'auth+rateLimit loadable');
    } catch (err) {
      push('security_mw', 'fail', err.message);
    }

    try {
      require('../routes/stage6Enterprise.routes');
      require('../routes/stage7Infra.routes');
      push('stage_packages', 'pass', 'stage6+7 routes');
    } catch (err) {
      push('stage_packages', 'fail', err.message);
    }

    const inv = await this.inventory();
    push('qa_scripts', inv.scripts.simulate && inv.scripts.verify ? 'pass' : 'warn', JSON.stringify(inv.scripts));

    const fail = results.filter((r) => r.status === 'fail').length;
    const pass = results.filter((r) => r.status === 'pass').length;
    return {
      score: Math.round((pass / results.length) * 100),
      passed: fail === 0,
      results,
      inventory: inv,
    };
  }

  uiuxChecklist() {
    return {
      categories: [
        'Spacing & alignment',
        'Typography & icons',
        'Buttons / tables / forms',
        'Search & keyboard navigation',
        'Loaders / skeletons / empty states',
        'Enterprise toast & confirm (no browser alerts)',
        'Themes: light-pro, dark-pro, classic ERP',
        'Desktop compact layout',
      ],
      enforced: {
        browserDialogGuard: true,
        toastHost: true,
        confirmDialogHost: true,
        themePicker: true,
        commandPalette: true,
        notificationCenter: true,
      },
      scoreHint: 90,
    };
  }
}

module.exports = new QaRegressionService();
