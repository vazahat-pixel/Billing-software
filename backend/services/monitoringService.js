const os = require('os');
const mongoose = require('mongoose');
const cacheService = require('./cacheService');
const jobQueueService = require('./jobQueueService');

const startedAt = Date.now();
const requestStats = {
  total: 0,
  errors: 0,
  latencies: [],
  maxSamples: 500,
};

/**
 * Stage 7.5 — Platform observability metrics.
 */
class MonitoringService {
  trackRequest({ statusCode, durationMs }) {
    requestStats.total += 1;
    if (statusCode >= 400) requestStats.errors += 1;
    requestStats.latencies.push(durationMs);
    if (requestStats.latencies.length > requestStats.maxSamples) {
      requestStats.latencies.shift();
    }
  }

  percentile(p) {
    const arr = [...requestStats.latencies].sort((a, b) => a - b);
    if (!arr.length) return 0;
    const idx = Math.min(arr.length - 1, Math.floor((p / 100) * arr.length));
    return Math.round(arr[idx]);
  }

  async snapshot(companyId) {
    const mem = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const load = os.loadavg();
    const queue = await jobQueueService.stats(companyId).catch(() => ({ byStatus: {} }));
    const cache = cacheService.stats();

    const avg =
      requestStats.latencies.length
        ? Math.round(requestStats.latencies.reduce((a, b) => a + b, 0) / requestStats.latencies.length)
        : 0;

    return {
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
      uptimeHuman: formatUptime(Date.now() - startedAt),
      cpu: {
        cores: os.cpus().length,
        model: os.cpus()[0]?.model || '',
        load1: load[0],
        load5: load[1],
        load15: load[2],
        usageHintPct: Math.min(100, Math.round((load[0] / Math.max(os.cpus().length, 1)) * 100)),
      },
      memory: {
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        systemUsedPct: Math.round(((totalMem - freeMem) / totalMem) * 100),
        freeMb: Math.round(freeMem / 1024 / 1024),
      },
      disk: {
        note: 'Host disk metrics require OS agent — container reports process heap only',
        tmpWritable: true,
      },
      database: {
        status: mongoose.connection.readyState === 1 ? 'up' : 'down',
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host || '',
        name: mongoose.connection.name || '',
      },
      api: {
        requestRateApprox: requestStats.total,
        errorRatePct: requestStats.total
          ? Math.round((requestStats.errors / requestStats.total) * 1000) / 10
          : 0,
        avgLatencyMs: avg,
        p50Ms: this.percentile(50),
        p95Ms: this.percentile(95),
        p99Ms: this.percentile(99),
        targetAvgMs: 300,
        withinBudget: avg === 0 || avg < 300,
      },
      cache,
      queue,
      server: {
        platform: os.platform(),
        node: process.version,
        pid: process.pid,
        env: process.env.NODE_ENV || 'development',
      },
      targets: {
        avgLatencyMs: 300,
        concurrentUsers: 1000,
        uptimePct: 99.9,
        rtoMinutes: 30,
        rpoMinutes: 15,
      },
    };
  }

  async healthDetailed() {
    const mongoUp = mongoose.connection.readyState === 1;
    return {
      status: mongoUp ? 'healthy' : 'degraded',
      checks: {
        mongo: mongoUp ? 'pass' : 'fail',
        cache: cacheService.stats().driver,
        queueWorker: (await jobQueueService.stats()).polling ? 'running' : 'idle',
      },
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    };
  }
}

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}

module.exports = new MonitoringService();
