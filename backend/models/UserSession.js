const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/**
 * Stage 7.2 — User session / device registration.
 */
const UserSessionSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sessionId: { type: String, required: true, unique: true, index: true },
  refreshTokenHash: { type: String, required: true, select: false },
  deviceId: { type: String, default: '', index: true },
  deviceName: { type: String, default: 'Unknown device' },
  deviceFingerprint: { type: String, default: '', index: true },
  trusted: { type: Boolean, default: false },
  rememberDevice: { type: Boolean, default: false },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  locationHint: { type: String, default: '' },
  status: {
    type: String,
    enum: ['active', 'revoked', 'expired', 'forced'],
    default: 'active',
    index: true,
  },
  lastActiveAt: { type: Date, default: Date.now, index: true },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  revokeReason: { type: String, default: '' },
}, { timestamps: true });

UserSessionSchema.index({ userId: 1, status: 1, lastActiveAt: -1 });
UserSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL when past expiresAt
UserSessionSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('UserSession', UserSessionSchema);
