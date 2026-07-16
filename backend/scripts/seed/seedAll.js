require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { QaRunner } = require('../../qa');
const { QaContext } = require('../../qa/context');

async function main() {
  const runner = new QaRunner(QaContext.fromCli());
  try {
    await runner.seed('all');
    console.log('[seed:all] done', { companyId: String(runner.ctx.companyId), profile: runner.ctx.profile.name });
    await runner.shutdown();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
