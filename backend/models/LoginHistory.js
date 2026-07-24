const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/**
 * Stage 7.2 — Immutable login / auth event history.
 */
const LoginHistorySchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  email: { type: String, default: '', index: true },
  event: {
    type: String,
    enum: [
      'login_success',
      'login_failed',
      'logout',
      'logout_all',
      'refresh',
      'force_logout',
      'lockout',
      'suspicious',
      'password_reset',
      'token_revoked',
    ],
    required: true,
    index: true,
  },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  deviceId: { type: String, default: '' },
  deviceFingerprint: { type: String, default: '' },
  sessionId: { type: String, default: '' },
  success: { type: Boolean, default: true },
  reason: { type: String, default: '' },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

LoginHistorySchema.index({ companyId: 1, createdAt: -1 });
LoginHistorySchema.index({ userId: 1, createdAt: -1 });
LoginHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 3600 }); // retain 1 year
LoginHistorySchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('LoginHistory', LoginHistorySchema);
