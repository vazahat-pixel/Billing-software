const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/**
 * Stage 7 — Per-company (or global) security / session / infra toggles.
 */
const SecurityConfigSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null,
  },
  scope: { type: String, enum: ['global', 'company'], default: 'company' },
  passwordPolicy: {
    minLength: { type: Number, default: 8 },
    requireUppercase: { type: Boolean, default: true },
    requireLowercase: { type: Boolean, default: true },
    requireNumber: { type: Boolean, default: true },
    requireSpecial: { type: Boolean, default: false },
  },
  lockout: {
    maxFailedAttempts: { type: Number, default: 5 },
    lockoutMinutes: { type: Number, default: 30 },
  },
  session: {
    singleActiveSession: { type: Boolean, default: false },
    maxSessions: { type: Number, default: 5 },
    accessTokenTtl: { type: String, default: '8h' },
    refreshTokenTtlDays: { type: Number, default: 30 },
    idleTimeoutMinutes: { type: Number, default: 60 },
    absoluteTimeoutHours: { type: Number, default: 24 * 7 },
    rememberDeviceDays: { type: Number, default: 90 },
  },
  security: {
    requireRefreshRotation: { type: Boolean, default: true },
    suspiciousLoginDetect: { type: Boolean, default: true },
    forceHttpsCookies: { type: Boolean, default: true },
  },
  features: {
    caching: { type: Boolean, default: true },
    queues: { type: Boolean, default: true },
    monitoring: { type: Boolean, default: true },
    backups: { type: Boolean, default: true },
  },
}, { timestamps: true });

SecurityConfigSchema.index({ companyId: 1 }, { unique: true, sparse: true });
SecurityConfigSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('SecurityConfig', SecurityConfigSchema);
