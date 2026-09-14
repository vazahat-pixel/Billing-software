const logger = require('./logger');

const WEAK_SECRETS = new Set([
  'your_jwt_secret',
  'your_jwt_secret_here',
  'change_me',
  'secret',
  'jwt_secret',
]);

/**
 * Stage 7.1 / 7.9 — Environment variable validation.
 */
function assertProductionEnv() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv !== 'production') {
    if (!process.env.JWT_SECRET) {
      logger.warn('JWT_SECRET missing — required before serving authenticated traffic');
    }
    if (String(process.env.ALLOW_PUBLIC_REGISTER || '').toLowerCase() === 'true') {
      logger.warn('ALLOW_PUBLIC_REGISTER=true — anyone can create a free company');
    }
    return { ok: true, env: nodeEnv, warnings: [] };
  }

  const errors = [];
  const warnings = [];
  const secret = process.env.JWT_SECRET || '';

  if (!secret || secret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters in production');
  }
  if (WEAK_SECRETS.has(secret.toLowerCase())) {
    errors.push('JWT_SECRET is a known placeholder');
  }
  if (!process.env.MONGO_URI) {
    errors.push('MONGO_URI is required in production');
  }
  if (!process.env.FRONTEND_URL) {
    warnings.push('FRONTEND_URL recommended for CORS lockdown');
  }
  if (!process.env.BACKUP_ENCRYPTION_KEY) {
    warnings.push('BACKUP_ENCRYPTION_KEY recommended (falls back to JWT_SECRET)');
  }
  if (String(process.env.ALLOW_SUBSCRIPTION_BYPASS || '').toLowerCase() === 'true') {
    errors.push('ALLOW_SUBSCRIPTION_BYPASS must not be true in production');
  }
  if (String(process.env.ALLOW_PUBLIC_REGISTER || '').toLowerCase() === 'true') {
    warnings.push('ALLOW_PUBLIC_REGISTER=true — prefer admin-provisioned tenants only');
  }
  for (const flag of ['MODULE_GATE_ENFORCE', 'DEVICE_BINDING_ENFORCE', 'PLAN_LIMIT_ENFORCE']) {
    if (String(process.env[flag] || '').toLowerCase() !== 'true') {
      warnings.push(`${flag} is not true — commercial gates are soft/shadow in production`);
    }
  }
  if (!process.env.SMTP_HOST) {
    warnings.push('SMTP_HOST unset — invite/reset/dunning emails go to console only');
  }

  if (errors.length) {
    throw new Error(`FATAL: ${errors.join('; ')}`);
  }
  logger.info('Production environment checks passed', { warnings });
  return { ok: true, env: nodeEnv, warnings };
}

function envReport() {
  return {
    NODE_ENV: process.env.NODE_ENV || 'development',
    hasJwt: !!process.env.JWT_SECRET,
    jwtLength: (process.env.JWT_SECRET || '').length,
    hasMongo: !!process.env.MONGO_URI,
    hasFrontendUrl: !!process.env.FRONTEND_URL,
    hasRedis: !!process.env.REDIS_URL,
    hasBackupKey: !!process.env.BACKUP_ENCRYPTION_KEY,
    hasSmtp: !!process.env.SMTP_HOST,
    allowPublicRegister: String(process.env.ALLOW_PUBLIC_REGISTER || 'false'),
    moduleGateEnforce: String(process.env.MODULE_GATE_ENFORCE || 'false'),
    planLimitEnforce: String(process.env.PLAN_LIMIT_ENFORCE || 'false'),
    deviceBindingEnforce: String(process.env.DEVICE_BINDING_ENFORCE || 'false'),
    allowSubscriptionBypass: String(process.env.ALLOW_SUBSCRIPTION_BYPASS || 'false'),
    port: process.env.PORT || 5000,
    rateLimitMax: process.env.RATE_LIMIT_MAX || 1000,
  };
}

module.exports = { assertProductionEnv, envReport };
