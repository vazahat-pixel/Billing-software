const { QaRunner } = require('../../qa');
const { QaContext } = require('../../qa/context');

async function main() {
  const runner = new QaRunner(QaContext.fromCli());
  try {
    const result = await runner.benchmark();
    console.log(JSON.stringify(result, null, 2));
    await runner.shutdown();
    process.exit(result.passed ? 0 : 2);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
