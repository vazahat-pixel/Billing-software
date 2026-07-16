const { QaRunner } = require('../../qa');
const { QaContext } = require('../../qa/context');

async function main() {
  const runner = new QaRunner(QaContext.fromCli());
  try {
    await runner.seed('users');
    console.log('[seed:users] done', { companyId: String(runner.ctx.companyId) });
    await runner.shutdown();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
