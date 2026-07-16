const os = require('os');

async function collectDbMetrics() {
  const mongoose = require('mongoose');
  const mem = process.memoryUsage();
  let serverStatus = null;
  try {
    serverStatus = await mongoose.connection.db.command({ serverStatus: 1 });
  } catch {
    serverStatus = null;
  }

  return {
    timestamp: new Date().toISOString(),
    heapUsedMb: Number((mem.heapUsed / 1024 / 1024).toFixed(2)),
    heapTotalMb: Number((mem.heapTotal / 1024 / 1024).toFixed(2)),
    rssMb: Number((mem.rss / 1024 / 1024).toFixed(2)),
    cpuCount: os.cpus().length,
    loadAvg: os.loadavg(),
    mongo: serverStatus
      ? {
          connections: serverStatus.connections?.current,
          opcounters: serverStatus.opcounters,
        }
      : null,
  };
}

module.exports = { collectDbMetrics };
