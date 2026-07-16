const { QaRunner } = require('../../qa');
const { QaContext } = require('../../qa/context');

async function main() {
  const runner = new QaRunner(QaContext.fromCli());
  try {
    const { exitCode } = await runner.qa();
    await runner.shutdown();
    process.exit(exitCode);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
