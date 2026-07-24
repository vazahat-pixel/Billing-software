const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

/**
 * Stage 7.3 — Database performance health & index report.
 */
class DbPerformanceService {
  async health() {
    const conn = mongoose.connection;
    const admin = conn.db?.admin?.();
    let serverStatus = null;
    try {
      serverStatus = admin ? await admin.serverStatus() : null;
    } catch {
      serverStatus = null;
    }

    return {
      readyState: conn.readyState,
      status: conn.readyState === 1 ? 'up' : 'down',
      host: conn.host,
      name: conn.name,
      pool: {
        maxPoolSize: Number(process.env.MONGO_MAX_POOL || 20),
        minPoolSize: Number(process.env.MONGO_MIN_POOL || 2),
      },
      server: serverStatus
        ? {
            version: serverStatus.version,
            uptime: serverStatus.uptime,
            connections: serverStatus.connections,
          }
        : null,
      slowQueryThresholdMs: Number(process.env.MONGO_SLOW_MS || 200),
      recommendations: [
        'Use lean() for read-only lists',
        'Project only required fields',
        'Prefer compound indexes matching filter + sort',
        'Cap pagination with max limit',
      ],
    };
  }

  async indexReport() {
    const db = mongoose.connection.db;
    if (!db) return { collections: [] };
    const cols = await db.listCollections().toArray();
    const report = [];
    for (const c of cols.slice(0, 60)) {
      if (c.name.startsWith('system.')) continue;
      try {
        const indexes = await db.collection(c.name).indexes();
        report.push({
          collection: c.name,
          indexCount: indexes.length,
          indexes: indexes.map((i) => ({ name: i.name, key: i.key, unique: !!i.unique })),
        });
      } catch {
        /* skip */
      }
    }
    return {
      collections: report,
      totalIndexes: report.reduce((s, r) => s + r.indexCount, 0),
      uniqueConstraints: report.reduce(
        (s, r) => s + r.indexes.filter((i) => i.unique).length,
        0
      ),
    };
  }

  async analyzeQuery({ collection, filter = {}, limit = 20 } = {}) {
    const db = mongoose.connection.db;
    if (!db) throw new Error('DB not connected');
    const col = db.collection(collection);
    const start = Date.now();
    const explain = await col.find(filter).limit(Math.min(limit, 100)).explain('executionStats');
    const durationMs = Date.now() - start;
    const stats = explain?.executionStats || {};
    return {
      collection,
      durationMs,
      nReturned: stats.nReturned,
      totalDocsExamined: stats.totalDocsExamined,
      totalKeysExamined: stats.totalKeysExamined,
      executionTimeMillis: stats.executionTimeMillis,
      efficient: (stats.totalDocsExamined || 0) <= Math.max((stats.nReturned || 0) * 3, 10),
      hint: 'Add compound index if docsExamined >> nReturned',
    };
  }

  listMigrationFiles() {
    const dir = path.join(__dirname, '..', 'migrations');
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.js'))
      .sort();
  }
}

module.exports = new DbPerformanceService();
