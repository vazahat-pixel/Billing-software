const mongoose = require('mongoose');
const logger = require('../utils/logger');

const MONGO_OPTIONS = {
  maxPoolSize: Number(process.env.MONGO_MAX_POOL || 20),
  minPoolSize: Number(process.env.MONGO_MIN_POOL || 2),
  serverSelectionTimeoutMS: 30000, // 30 seconds to select server (handles network latency)
  socketTimeoutMS: 45000,          // Close sockets after 45s of inactivity
  connectTimeoutMS: 30000,         // 30 seconds connection timeout
  heartbeatFrequencyMS: 10000,     // Ping server every 10s
  retryWrites: true,
};

let isConnecting = false;
let retryCount = 0;
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY_MS = 2000;

/**
 * Connects to MongoDB with retry logic and configures connection handlers.
 */
async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/billing_software';

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (isConnecting) {
    logger.info('MongoDB connection already in progress...');
    return;
  }

  isConnecting = true;

  // Setup connection event listeners once
  if (mongoose.connection.listenerCount('disconnected') === 0) {
    mongoose.connection.on('connected', () => {
      logger.info('MongoDB connected successfully', { host: mongoose.connection.host, db: mongoose.connection.name });
      retryCount = 0;
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error event', { error: err.message });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
      scheduleReconnect();
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
      retryCount = 0;
    });
  }

  return attemptConnection(uri);
}

async function attemptConnection(uri) {
  try {
    await mongoose.connect(uri, MONGO_OPTIONS);
    isConnecting = false;
    retryCount = 0;
    return mongoose.connection;
  } catch (err) {
    isConnecting = false;
    logger.error('MongoDB initial connection attempt failed', { error: err.message, retryCount });
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount - 1);
      logger.info(`Retrying MongoDB connection in ${delay}ms (Attempt ${retryCount}/${MAX_RETRIES})...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return attemptConnection(uri);
    } else {
      logger.error('Exhausted MongoDB connection retry attempts');
      throw err;
    }
  }
}

function scheduleReconnect() {
  if (mongoose.connection.readyState === 0 && !isConnecting) {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/billing_software';
    setTimeout(() => {
      attemptConnection(uri).catch((err) => {
        logger.error('Scheduled reconnect failed', { error: err.message });
      });
    }, INITIAL_RETRY_DELAY_MS);
  }
}

/**
 * Middleware that fails fast with 503 if DB is disconnected, preventing 10s buffering timeouts.
 */
function dbCheckMiddleware(req, res, next) {
  // Allow health check routes through regardless of DB status
  if (req.path.startsWith('/health') || req.path === '/api/health') {
    return next();
  }

  // 1 = connected, 2 = connecting
  if (mongoose.connection.readyState === 1) {
    return next();
  }

  if (mongoose.connection.readyState === 2) {
    logger.warn('Request received while MongoDB is connecting...', { path: req.path });
  } else {
    logger.error('Request rejected: MongoDB is disconnected', { path: req.path });
  }

  // Fail fast with 503 instead of buffering for 10s and timing out
  return res.status(503).json({
    success: false,
    message: 'Database connection is temporarily unavailable. Please retry in a few seconds.',
    meta: { requestId: req.requestId },
    errors: [{ field: 'database', message: 'Database disconnected or re-establishing connection' }],
  });
}

async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected cleanly');
  }
}

module.exports = {
  connectDB,
  disconnectDB,
  dbCheckMiddleware,
  MONGO_OPTIONS,
};
