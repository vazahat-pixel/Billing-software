require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { QaRunner } = require('../../qa');
const { QaContext } = require('../../qa/context');
const { simulatePurchases } = require('../../qa/simulator/purchaseSimulator');

async function main() {
  process.env.QA_CONCURRENCY = process.env.QA_CONCURRENCY || '1';
  process.env.QA_PURCHASES   = process.env.QA_PURCHASES   || '20';

  const runner = new QaRunner(QaContext.fromCli());
  try {
    await runner.init();
    console.log('[seed:purchases] Starting count=' + process.env.QA_PURCHASES + ' concurrency=' + process.env.QA_CONCURRENCY);
    const result = await simulatePurchases(runner.ctx);
    console.log('[seed:purchases] done created=' + result.created + ' failed=' + result.failed + ' lineItems=' + result.lineItems);
    if (result.errors && result.errors.length) {
      result.errors.slice(0, 3).forEach((e) => console.warn(' -', e && e.error || e));
    }
    await runner.shutdown();
    process.exit(result.failed > result.created ? 1 : 0);
  } catch (err) {
    console.error('[seed:purchases] Fatal:', err.message);
    process.exit(1);
  }
}

main();
