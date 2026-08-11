const mongoose = require('mongoose');

/**
 * Isolated in-memory MongoDB for tests.
 *
 * The repo's .env points MONGO_URI at a live Atlas cluster, so anything that merely
 * `require`s the app connects to production. Every test that writes MUST go through
 * this helper: it starts a throwaway mongod, repoints MONGO_URI at it BEFORE the app
 * is loaded, and refuses to run if the target still looks like a real database.
 *
 *   const { startMemoryDb, stopMemoryDb } = require('../helpers/memoryDb');
 *   before(async () => { await startMemoryDb(); });
 *   after(async () => { await stopMemoryDb(); });
 */
let mongod = null;

/** Refuses anything that is not an obvious throwaway target. */
function assertNotProduction(uri) {
  const u = String(uri || '');
  if (/mongodb\+srv:/i.test(u) || /\.mongodb\.net/i.test(u)) {
    throw new Error(
      'REFUSING TO RUN: test pointed at a remote/Atlas cluster.\n' +
      'Tests must use the in-memory server (startMemoryDb) or a local throwaway database.'
    );
  }
  // The DATABASE NAME must itself look disposable. Checking the host is not enough —
  // a local mongod can still hold the real "billing_software" database.
  const dbName = (u.split('/').pop() || '').split('?')[0];
  if (!/(^|[-_])(test|memory|tmp)/i.test(dbName)) {
    throw new Error(
      `REFUSING TO RUN: database "${dbName}" does not look like a test database. ` +
      'Use startMemoryDb(), or point MONGO_URI at a database whose name contains "test".'
    );
  }
}

async function startMemoryDb() {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri('erp_test');

  assertNotProduction(uri);

  // Must be set before the app/config reads it.
  process.env.MONGO_URI = uri;
  process.env.NODE_ENV = 'test';

  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  await mongoose.connect(uri);
  assertNotProduction(mongoose.connection.client?.s?.url || uri);
  return uri;
}

async function stopMemoryDb() {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  } finally {
    if (mongod) await mongod.stop();
    mongod = null;
  }
}

/** Wipe every collection between tests without paying to restart mongod. */
async function clearDb() {
  assertNotProduction(process.env.MONGO_URI);
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

module.exports = { startMemoryDb, stopMemoryDb, clearDb, assertNotProduction };
