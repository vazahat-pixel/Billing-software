const { QaRunner } = require('../../qa');
const { QaContext } = require('../../qa/context');
const { printSimulationSummary } = require('../../qa/reports/consoleReporter');

async function main() {
  const runner = new QaRunner(QaContext.fromCli());
  try {
    const result = await runner.simulate();
    printSimulationSummary(result);
    await runner.shutdown();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
