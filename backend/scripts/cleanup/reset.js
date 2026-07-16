const { QaRunner } = require('../../qa');
const { QaContext } = require('../../qa/context');

async function main() {
  const runner = new QaRunner(QaContext.fromCli());
  try {
    const result = await runner.reset();
    console.log('[reset]', result);
    await runner.shutdown();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
