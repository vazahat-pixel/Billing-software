const PROFILES = {
  smoke: {
    purchases: 5,
    itemsPerLineAvg: 3,
    itemsPerLineMax: 5,
    salesInvoices: 3,
    jobCards: 2,
    paymentsReceipts: 4,
    concurrency: 2,
    benchmarkConcurrent: 5,
    benchmarkDurationSec: 10,
  },
  dev: {
    purchases: 50,
    itemsPerLineAvg: 5,
    itemsPerLineMax: 8,
    salesInvoices: 40,
    jobCards: 15,
    paymentsReceipts: 30,
    concurrency: 5,
    benchmarkConcurrent: 10,
    benchmarkDurationSec: 15,
  },
  staging: {
    purchases: 500,
    itemsPerLineAvg: 5,
    itemsPerLineMax: 8,
    salesInvoices: 400,
    jobCards: 120,
    paymentsReceipts: 250,
    concurrency: 5,
    benchmarkConcurrent: 50,
    benchmarkDurationSec: 20,
  },
  full: {
    purchases: 5000,
    itemsPerLineAvg: 5,
    itemsPerLineMax: 8,
    salesInvoices: 4000,
    jobCards: 1000,
    paymentsReceipts: 2000,
    concurrency: 5,
    benchmarkConcurrent: 100,
    benchmarkDurationSec: 30,
  },
};

function isRemoteMongo(uri = '') {
  return uri && !/localhost|127\.0\.0\.1/i.test(uri);
}

/** Cap parallel transactions on shared Atlas clusters to avoid ECONNRESET. */
function applyConcurrencyCap(profile, uri) {
  if (!isRemoteMongo(uri) || process.env.QA_CONCURRENCY) {
    return profile;
  }
  const remoteCap = profile.name === 'full' ? 2 : profile.name === 'staging' ? 3 : profile.concurrency;
  const capped = Math.min(profile.concurrency, remoteCap);
  if (capped === profile.concurrency) return profile;
  return { ...profile, concurrency: capped, concurrencyCappedFrom: profile.concurrency };
}

function envInt(key, fallback) {
  const v = process.env[key];
  if (v == null || v === '') return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function resolveProfile(name = 'dev') {
  const key = String(name || 'dev').toLowerCase();
  const base = PROFILES[key] || PROFILES.dev;
  return {
    name: PROFILES[key] ? key : 'dev',
    purchases: envInt('QA_PURCHASES', base.purchases),
    itemsPerLineAvg: envInt('QA_ITEMS_PER_LINE', base.itemsPerLineAvg),
    itemsPerLineMax: envInt('QA_ITEMS_PER_LINE_MAX', base.itemsPerLineMax),
    salesInvoices: envInt('QA_SALES', base.salesInvoices),
    jobCards: envInt('QA_JOBS', base.jobCards),
    paymentsReceipts: envInt('QA_PAYMENTS', base.paymentsReceipts),
    concurrency: envInt('QA_CONCURRENCY', base.concurrency),
    benchmarkConcurrent: envInt('QA_BENCHMARK_CONCURRENT', base.benchmarkConcurrent),
    benchmarkDurationSec: envInt('QA_BENCHMARK_DURATION', base.benchmarkDurationSec),
    jobWorkLotPct: 0.4,
    settlementPct: 0.7,
    salesDirectPct: 0.6,
    salesPipelinePct: 0.35,
    salesReturnPct: 0.05,
  };
}

module.exports = { PROFILES, resolveProfile, isRemoteMongo, applyConcurrencyCap };
