const { QaContext } = require('./context');
const { resolveCompanyId } = require('./utils/tenant');
const { seedAll } = require('./seed/seedAll');
const { simulateBusinessFlow } = require('./simulator/businessFlowSimulator');
const { buildReadinessReport } = require('./verifier/readinessReport');
const { runApiBenchmark } = require('./benchmark/apiLoad');
const { cleanByProfile } = require('./cleanup/clean');
const { resetQa } = require('./cleanup/reset');
const { truncateTenant } = require('./cleanup/truncate');

class QaRunner {
  constructor(ctx) {
    this.ctx = ctx || QaContext.fromCli();
  }

  async init() {
    await this.ctx.connect();
    await resolveCompanyId(this.ctx);
    return this.ctx;
  }

  async seed(scope = 'all') {
    await this.init();
    if (scope === 'masters') {
      const { seedMasters } = require('./seed/seedMasters');
      return seedMasters(this.ctx);
    }
    if (scope === 'inventory') {
      const { seedInventory } = require('./seed/seedInventory');
      return seedInventory(this.ctx);
    }
    if (scope === 'users') {
      const { seedUsers } = require('./seed/seedUsers');
      return seedUsers(this.ctx);
    }
    return seedAll(this.ctx);
  }

  async simulate() {
    await this.ctx.connect();
    if (this.ctx.args.fresh) {
      await cleanByProfile(this.ctx.profile.name);
      this.ctx.companyId = null;
    }
    await resolveCompanyId(this.ctx);
    return simulateBusinessFlow(this.ctx);
  }

  async verify() {
    await this.ctx.connect();
    await resolveCompanyId(this.ctx);
    const { report, exitCode } = await buildReadinessReport(this.ctx);
    return { report, exitCode };
  }

  async benchmark() {
    await this.ctx.connect();
    await resolveCompanyId(this.ctx);
    let token = null;
    try {
      const app = require('../server');
      const { getAuthToken } = require('../tests/api/apiTestEngine');
      token = await getAuthToken(app, this.ctx.companyId);
    } catch {
      token = null;
    }
    return runApiBenchmark(this.ctx, { token });
  }

  async qa() {
    await this.ctx.connect();
    const extras = {};

    if (this.ctx.args.fresh) {
      await cleanByProfile(this.ctx.profile.name);
      this.ctx.companyId = null;
    }
    await resolveCompanyId(this.ctx);

    if (!this.ctx.args['skip-simulate']) {
      extras.simulation = await simulateBusinessFlow(this.ctx);
    }

    if (!this.ctx.args['skip-benchmark'] && this.ctx.profile.name !== 'smoke') {
      try {
        extras.benchmark = await this.benchmark();
      } catch (err) {
        extras.benchmark = { passed: false, score: 0, issues: [err.message] };
      }
    }

    if (!this.ctx.args['skip-api']) {
      try {
        process.env.QA_TESTING = 'true';
        const app = require('../server');
        const { runApiTests } = require('../tests/api/apiTestEngine');
        extras.api = await runApiTests(app, this.ctx.companyId);
      } catch (err) {
        extras.api = { label: 'API Coverage', passed: false, score: 0, issues: [err.message] };
      }
    }

    extras.security = {
      label: 'Security',
      passed: process.env.NODE_ENV !== 'production' || process.env.QA_ALLOW === 'true',
      score: 100,
      issues: [],
    };

    const { report, exitCode } = await buildReadinessReport(this.ctx, extras);
    return { report, exitCode };
  }

  async clean() {
    await this.ctx.connect();
    return cleanByProfile(this.ctx.profile.name);
  }

  async reset() {
    return resetQa(this.ctx.profile.name);
  }

  async truncate() {
    await this.ctx.connect();
    await resolveCompanyId(this.ctx);
    return truncateTenant(this.ctx.companyId);
  }

  async shutdown() {
    await this.ctx.disconnect();
  }
}

module.exports = { QaRunner };
