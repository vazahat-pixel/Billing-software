const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const errorHandler = require('./middlewares/error.middleware');
const requestIdMiddleware = require('./middlewares/requestId.middleware');
const requestLogger = require('./middlewares/requestLogger.middleware');
const { apiLimiter } = require('./middlewares/rateLimit.middleware');
const logger = require('./utils/logger');

dotenv.config({ path: path.join(__dirname, '.env') });

// Desktop-local: override .env SaaS locks after dotenv loads
if (String(process.env.DESKTOP_LOCAL || '').toLowerCase() === 'true') {
  // Never allow public register on desktop — activation pack only
  process.env.ALLOW_PUBLIC_REGISTER = 'false';
  process.env.DUNNING_INTERVAL_MS = process.env.DUNNING_INTERVAL_MS || '0';
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'desktop-local-jwt-secret-minimum-32-characters!!';
  }
  // Pack HMAC: prefer dedicated secret; fall back to JWT_SECRET (must match admin issuer for signed packs)
  if (!process.env.PROVISIONING_PACK_SECRET) {
    process.env.PROVISIONING_PACK_SECRET = process.env.JWT_SECRET;
  }
  if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production';
}

const { assertProductionEnv, envReport } = require('./utils/startupChecks');
assertProductionEnv();

const app = express();
const startedAt = Date.now(); // reload trigger

// Optional compression (Stage 7.8)
let compression;
try {
  compression = require('compression');
} catch {
  compression = null;
}

app.use(requestIdMiddleware);

// Stage 7.1 — hardened helmet + CSP
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: process.env.NODE_ENV === 'production'
    ? {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", process.env.FRONTEND_URL || '', 'https://*.vercel.app'].filter(Boolean),
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
        },
      }
    : false,
  referrerPolicy: { policy: 'no-referrer' },
}));

if (compression) {
  app.use(compression());
}

app.use(apiLimiter);

const allowedOrigins = [
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return callback(null, true);
    if (origin.endsWith('.vercel.app') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '2mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.JSON_BODY_LIMIT || '2mb' }));
app.use(mongoSanitize());
app.use(requestLogger);

// Stage 7.5 / 7.6 — metrics + platform logs
try {
  const monitoringService = require('./services/monitoringService');
  const platformLogService = require('./services/platformLogService');
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      monitoringService.trackRequest({ statusCode: res.statusCode, durationMs: Date.now() - start });
    });
    next();
  });
  app.use(platformLogService.middleware());
} catch (err) {
  logger.warn('monitoring middleware skipped', { error: err.message });
}

const { connectDB, dbCheckMiddleware, disconnectDB } = require('./config/db');

let bootPromise = null;
let listenersReady = false;

async function runPostConnectHooks() {
  if (listenersReady) return;
  listenersReady = true;
  if (String(process.env.DESKTOP_LOCAL || '').toLowerCase() === 'true') {
    try {
      const mongoose = require('mongoose');
      const { ensureDesktopIndexes } = require('./utils/desktopIndexes');
      await ensureDesktopIndexes(mongoose);
    } catch (err) {
      logger.warn('desktop indexes skipped', { error: err.message });
    }
  }
  try {
    require('./events/registerAutomation').registerAutomationListeners();
  } catch (err) {
    logger.warn('automation listeners failed to register', { error: err.message });
  }
  try {
    require('./services/entitlementCacheHooks').install();
  } catch (err) {
    logger.warn('entitlement cache hooks failed to install', { error: err.message });
  }
  try {
    require('./services/cacheService').init();
    require('./services/jobQueueService').startWorker({
      intervalMs: Number(process.env.JOB_POLL_MS || 5000),
    });
    const jobQueue = require('./services/jobQueueService');
    const backupService = require('./services/backupService');
    jobQueue.registerHandler('backup.run', async (job) => {
      const companyId = job.payload?.companyId || job.companyId;
      return backupService.create(companyId, { type: 'scheduled', userId: null });
    });

    const dunningMs = Number(process.env.DUNNING_INTERVAL_MS ?? 21600000);
    const isDesktop = String(process.env.DESKTOP_LOCAL || '').toLowerCase() === 'true';
    if (!isDesktop && dunningMs > 0) {
      const dunningService = require('./services/dunningService');
      const run = () => {
        dunningService.runDunningSweep().catch((e) =>
          logger.warn('dunning.interval.failed', { error: e.message })
        );
      };
      setTimeout(run, 60_000).unref?.();
      setInterval(run, dunningMs).unref?.();
      logger.info('dunning.interval.started', { intervalMs: dunningMs });
    }
  } catch (err) {
    logger.warn('cache/queue init skipped', { error: err.message });
  }
}

function ensureDbBoot() {
  if (!bootPromise) {
    bootPromise = connectDB()
      .then(() => runPostConnectHooks())
      .catch((err) => {
        bootPromise = null;
        logger.error('MongoDB initial connection error', { error: err.message });
        throw err;
      });
  }
  return bootPromise;
}

// Auto-connect when loaded as HTTP server or tests (not when only exporting app for attach)
if (!process.env.VERCEL && process.env.DESKTOP_SKIP_AUTO_CONNECT !== 'true') {
  ensureDbBoot().catch((err) => logger.error('MongoDB initial connection error', { error: err.message }));
}

// Slow query logging (Stage 7.3)
if (process.env.MONGO_DEBUG === 'true') {
  mongoose.set('debug', (coll, method, query) => {
    logger.debug('mongo.query', { coll, method, query });
  });
}

app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    success: true,
    message: 'ok',
    data: {
      mongo: mongoose.connection.readyState === 1 ? 'up' : 'down',
      env: process.env.NODE_ENV || 'development',
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    },
    meta: { requestId: req.requestId },
    errors: [],
  });
});

app.get(['/health/live', '/api/health/live'], (req, res) => {
  res.status(200).json({ success: true, data: { status: 'live' } });
});

app.get(['/health/ready', '/api/health/ready'], (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({
    success: ready,
    data: { status: ready ? 'ready' : 'not_ready', mongo: ready ? 'up' : 'down' },
  });
});

app.use('/api', dbCheckMiddleware, require('./routes/index.js'));

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Billing Software SaaS API is running...',
    data: {
      version: process.env.npm_package_version || '1.0.0',
      stage: 8,
      requestId: req.requestId,
    },
    meta: {},
    errors: [],
  });
});

app.get('/metrics', async (req, res) => {
  try {
    const monitoringService = require('./services/monitoringService');
    const snap = await monitoringService.snapshot(null);
    res.json({ success: true, data: snap, meta: { requestId: req.requestId }, errors: [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/env-check', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ success: false, message: 'Not found' });
  }
  return res.json({ success: true, data: envReport() });
});

app.use(errorHandler);

let server = null;

function gracefulShutdown(signal, { exitProcess = true } = {}) {
  logger.info(`graceful.shutdown.${signal}`);
  try {
    require('./services/jobQueueService').stopWorker();
  } catch {
    /* ignore */
  }
  const force = setTimeout(() => {
    logger.error('graceful.shutdown.timeout');
    if (exitProcess) process.exit(1);
  }, 15000);
  force.unref?.();

  const closeHttp = server
    ? new Promise((resolve) => server.close(() => resolve()))
    : Promise.resolve();

  return closeHttp
    .then(() => disconnectDB())
    .then(() => {
      logger.info('graceful.shutdown.complete');
      server = null;
      if (exitProcess) process.exit(0);
    })
    .catch((err) => {
      logger.error('graceful.shutdown.error', { error: err.message });
      if (exitProcess) process.exit(1);
      throw err;
    });
}

/**
 * Programmatic start for Electron desktop-local / tests.
 * @param {{ port?: number, mongoUri?: string }} opts
 */
async function startServer(opts = {}) {
  if (opts.mongoUri) process.env.MONGO_URI = opts.mongoUri;
  const port = Number(opts.port || process.env.PORT || 5000);
  process.env.PORT = String(port);

  await ensureDbBoot();

  if (server) {
    return {
      app,
      server,
      port,
      async stop() {
        await gracefulShutdown('stop', { exitProcess: false });
      },
    };
  }

  await new Promise((resolve, reject) => {
    server = app.listen(port, '127.0.0.1', (err) => {
      if (err) return reject(err);
      logger.info(`Server listening on http://127.0.0.1:${port}`);
      resolve();
    });
  });

  return {
    app,
    server,
    port,
    async stop() {
      await gracefulShutdown('stop', { exitProcess: false });
    },
  };
}

if (!process.env.VERCEL && require.main === module) {
  const PORT = process.env.PORT || 5000;
  ensureDbBoot()
    .then(() => {
      server = app.listen(PORT, () => {
        logger.info(`Server listening on http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      logger.error('Failed to start server', { error: err.message });
      process.exit(1);
    });
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

// Force nodemon reload: 2026-09-09T15:36:00
module.exports = app;
module.exports.app = app;
module.exports.startServer = startServer;
module.exports.stopServer = () => gracefulShutdown('stop', { exitProcess: false });
module.exports.ensureDbBoot = ensureDbBoot;
