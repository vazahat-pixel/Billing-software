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

const app = express();

app.use(requestIdMiddleware);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(apiLimiter);

const allowedOrigins = [
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (/^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true);
    if (origin.endsWith('.vercel.app') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(mongoSanitize());
app.use(requestLogger);

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/billing_software';
mongoose.connect(MONGO_URI)
  .then(() => {
    logger.info('MongoDB connected');
    try {
      require('./events/registerAutomation').registerAutomationListeners();
    } catch (err) {
      logger.warn('automation listeners failed to register', { error: err.message });
    }
  })
  .catch((err) => logger.error('MongoDB connection error', { error: err.message }));

app.use('/api', require('./routes/index.js'));

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Billing Software SaaS API is running...',
    data: { version: '1.2.0', requestId: req.requestId },
    meta: {},
    errors: [],
  });
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'ok',
    data: {
      mongo: mongoose.connection.readyState === 1 ? 'up' : 'down',
      env: process.env.NODE_ENV || 'development',
    },
    meta: { requestId: req.requestId },
    errors: [],
  });
});

app.use(errorHandler);

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    logger.info(`Server listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
