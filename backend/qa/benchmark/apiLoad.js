const autocannon = require('autocannon');
const { collectDbMetrics } = require('./dbMetrics');

const DEFAULT_PATHS = [
  { method: 'GET', path: '/health' },
  { method: 'GET', path: '/api/dashboard/summary' },
  { method: 'GET', path: '/api/purchases?page=1&limit=10' },
  { method: 'GET', path: '/api/sales?page=1&limit=10' },
  { method: 'GET', path: '/api/parties?page=1&limit=10' },
  { method: 'GET', path: '/api/items?page=1&limit=10' },
];

async function runApiBenchmark(ctx, { token } = {}) {
  const baseUrl = process.env.QA_BENCHMARK_URL || `http://localhost:${process.env.PORT || 5000}`;
  const concurrent = ctx.profile.benchmarkConcurrent;
  const duration = ctx.profile.benchmarkDurationSec;
  const headers = token ? { authorization: `Bearer ${token}` } : {};

  const results = [];
  for (const route of DEFAULT_PATHS) {
  const url = `${baseUrl}${route.path}`;
    try {
      const result = await autocannon({
        url,
        method: route.method,
        connections: Math.min(concurrent, 20),
        duration,
        headers,
      });
      results.push({
        path: route.path,
        requests: result.requests.total,
        throughput: result.throughput.mean,
        latencyMean: result.latency.mean,
        latencyP99: result.latency.p99,
        errors: result.errors,
      });
    } catch (err) {
      results.push({ path: route.path, error: err.message });
    }
  }

  const dbMetrics = await collectDbMetrics();
  const p99Values = results.filter((r) => r.latencyP99).map((r) => r.latencyP99);
  const maxP99 = p99Values.length ? Math.max(...p99Values) : 0;
  const threshold = Number(process.env.QA_P99_THRESHOLD_MS || 2000);
  const passed = maxP99 <= threshold && results.every((r) => !r.error);

  return {
    label: 'Performance',
    passed,
    score: passed ? 100 : Math.max(0, 100 - Math.floor(maxP99 / 50)),
    baseUrl,
    concurrent,
    duration,
    maxP99,
    threshold,
    routes: results,
    dbMetrics,
    issues: passed ? [] : [`p99 ${maxP99}ms exceeds threshold ${threshold}ms`],
  };
}

module.exports = { runApiBenchmark };
