/**
 * Secure local offline session material for desktop hybrid.
 * Stores salted password hash only — never plaintext.
 */
const crypto = require('crypto');
const SyncState = require('../models/SyncState');

const KEY = 'offline:session';

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(String(password), salt, 120000, 32, 'sha512').toString('hex');
}

async function storeLocalSession({ companyId, userId, email, password, deviceId }) {
  if (!password) return null;
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const value = {
    companyId: String(companyId),
    userId: String(userId),
    email: String(email || '').toLowerCase(),
    salt,
    passwordHash,
    deviceId: String(deviceId || ''),
    storedAt: new Date().toISOString(),
  };
  await SyncState.findOneAndUpdate(
    { key: KEY },
    { $set: { companyId, value } },
    { upsert: true }
  );
  return { email: value.email, deviceId: value.deviceId, storedAt: value.storedAt };
}

async function verifyLocalSession({ email, password, deviceId }) {
  const doc = await SyncState.findOne({ key: KEY }).lean();
  if (!doc?.value?.passwordHash) return { ok: false, reason: 'no_session' };
  const v = doc.value;
  if (deviceId && v.deviceId && String(deviceId) !== String(v.deviceId)) {
    return { ok: false, reason: 'device_mismatch' };
  }
  if (email && String(email).toLowerCase() !== String(v.email).toLowerCase()) {
    return { ok: false, reason: 'email_mismatch' };
  }
  const hash = hashPassword(password, v.salt);
  if (hash !== v.passwordHash) return { ok: false, reason: 'bad_credentials' };
  return {
    ok: true,
    companyId: v.companyId,
    userId: v.userId,
    email: v.email,
    deviceId: v.deviceId,
  };
}

async function clearLocalSession() {
  await SyncState.deleteOne({ key: KEY });
}

module.exports = {
  storeLocalSession,
  verifyLocalSession,
  clearLocalSession,
};
