/**
 * Boot the Express app against an in-memory MongoDB.
 *
 * NEVER load the repo .env here — it commonly points MONGO_URI at Atlas.
 * Call bootIsolatedApp() before any require('../../server').
 */
'use strict';

const { startMemoryDb, stopMemoryDb, assertNotProduction } = require('./memoryDb');

async function bootIsolatedApp(extraEnv = {}) {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET =
    process.env.JWT_SECRET || 'ci-test-jwt-secret-minimum-32-characters-long';
  process.env.ALLOW_PUBLIC_REGISTER = process.env.ALLOW_PUBLIC_REGISTER || 'true';
  // Wipe any Atlas URI inherited from the parent shell / prior dotenv.
  delete process.env.MONGO_URI;
  Object.assign(process.env, extraEnv);

  const uri = await startMemoryDb();
  assertNotProduction(uri);

  const mongoose = require('mongoose');
  const request = require('supertest');
  const app = require('../../server');

  await new Promise((resolve, reject) => {
    if (mongoose.connection.readyState === 1) return resolve();
    const t = setTimeout(() => reject(new Error('Mongo connect timeout')), 20000);
    mongoose.connection.once('connected', () => {
      clearTimeout(t);
      resolve();
    });
    mongoose.connection.once('error', (e) => {
      clearTimeout(t);
      reject(e);
    });
  });

  assertNotProduction(process.env.MONGO_URI);

  return {
    app,
    mongoose,
    request,
    uri,
    async shutdown() {
      await stopMemoryDb();
    },
  };
}

module.exports = { bootIsolatedApp };
