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

const { assertProductionEnv, envReport } = require('./utils/startupChecks');
assertProductionEnv();

const app = express();
const startedAt = Date.now();

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

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/billing_software';
mongoose
  .connect(MONGO_URI, {
    maxPoolSize: Number(process.env.MONGO_MAX_POOL || 20),
    minPoolSize: Number(process.env.MONGO_MIN_POOL || 2),
    serverSelectionTimeoutMS: 10000,
  })
  .then(() => {
    logger.info('MongoDB connected', { pool: process.env.MONGO_MAX_POOL || 20 });
    try {
      require('./events/registerAutomation').registerAutomationListeners();
    } catch (err) {
      logger.warn('automation listeners failed to register', { error: err.message });
    }
    try {
      require('./services/cacheService').init();
      require('./services/jobQueueService').startWorker({
        intervalMs: Number(process.env.JOB_POLL_MS || 5000),
      });
      // Wire backup job handler
      const jobQueue = require('./services/jobQueueService');
      const backupService = require('./services/backupService');
      jobQueue.registerHandler('backup.run', async (job) => {
        const companyId = job.payload?.companyId || job.companyId;
        return backupService.create(companyId, { type: 'scheduled', userId: null });
      });
    } catch (err) {
      logger.warn('cache/queue init skipped', { error: err.message });
    }
  })
  .catch((err) => logger.error('MongoDB connection error', { error: err.message }));

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

app.use('/api', require('./routes/index.js'));

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

function gracefulShutdown(signal) {
  logger.info(`graceful.shutdown.${signal}`);
  try {
    require('./services/jobQueueService').stopWorker();
  } catch {
    /* ignore */
  }
  const force = setTimeout(() => {
    logger.error('graceful.shutdown.timeout');
    process.exit(1);
  }, 15000);
  force.unref?.();

  const closeHttp = server
    ? new Promise((resolve) => server.close(() => resolve()))
    : Promise.resolve();

  closeHttp
    .then(() => mongoose.connection.close(false))
    .then(() => {
      logger.info('graceful.shutdown.complete');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('graceful.shutdown.error', { error: err.message });
      process.exit(1);
    });
}

if (!process.env.VERCEL && require.main === module) {
  const PORT = process.env.PORT || 5000;
  server = app.listen(PORT, () => {
    logger.info(`Server listening on http://localhost:${PORT}`);
  });
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

module.exports = app;
