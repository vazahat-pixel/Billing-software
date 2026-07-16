const path = require('path');
const fs = require('fs');
const { connectDb, disconnectDb } = require('./utils/db');
const { resolveProfile, applyConcurrencyCap } = require('./profiles');
const { parseArgs } = require('./utils/parseArgs');
const { assertQaAllowed } = require('./devGuard');
const logger = require('./utils/logger');

class QaContext {
  constructor(options = {}) {
    this.profile = resolveProfile(options.profile || process.env.QA_PROFILE || 'dev');
    this.companyId = options.companyId || null;
    this.userId = options.userId || null;
    this.outputDir =
      options.outputDir ||
      path.join(__dirname, 'reports', 'output', new Date().toISOString().replace(/[:.]/g, '-'));
    this.timings = {};
    this.masters = options.masters || {};
    this.args = options.args || {};
  }

  static fromCli(argv = process.argv) {
    const args = parseArgs(argv);
    const profile = args.profile || args.p || process.env.QA_PROFILE || 'dev';
    return new QaContext({
      profile,
      companyId: args.companyId || args.c || null,
      outputDir: args.output || null,
      args,
    });
  }

  async connect() {
    assertQaAllowed();
    const uri = await connectDb();
    const prevConcurrency = this.profile.concurrency;
    this.profile = applyConcurrencyCap(this.profile, uri);
    fs.mkdirSync(this.outputDir, { recursive: true });
    logger.initLogger(this.outputDir);
    logger.info('QA context connected', {
      uri,
      profile: this.profile.name,
      concurrency: this.profile.concurrency,
      ...(this.profile.concurrencyCappedFrom
        ? { concurrencyCappedFrom: this.profile.concurrencyCappedFrom }
        : {}),
    });
    if (this.profile.concurrency !== prevConcurrency) {
      logger.warn('Concurrency capped for remote MongoDB', {
        from: prevConcurrency,
        to: this.profile.concurrency,
      });
    }
    return uri;
  }

  async disconnect() {
    await disconnectDb();
  }

  startTimer(key) {
    this.timings[key] = { start: Date.now() };
  }

  endTimer(key) {
    if (!this.timings[key]) return 0;
    const ms = Date.now() - this.timings[key].start;
    this.timings[key].ms = ms;
    return ms;
  }
}

module.exports = { QaContext };
