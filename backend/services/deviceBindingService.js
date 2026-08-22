/**
 * Device binding — one licence, one computer.
 *
 * The licence carries a device slot list (License.devices) and a maxDevices
 * cap. At login the client presents a deviceId; this service decides whether
 * that machine may hold the licence.
 *
 * Design notes
 * ------------
 * Hardware identity drifts. A network card swap, a rename, a RAM upgrade all
 * change part of the fingerprint on a machine the customer never replaced. So
 * the persisted deviceId is the identity, and the fingerprint is corroboration
 * only: a partial mismatch is recorded and warned about, never a lockout.
 *
 * The admin can always free a slot (`releaseDevice`). That escape hatch is the
 * point — without it a customer whose PC died cannot work and nobody can help
 * them. Every decision here assumes the admin is the recovery path.
 */
const License = require('../models/License');
const AppError = require('../utils/AppError');
const ErrorCodes = require('../constants/errorCodes');
const logger = require('../utils/logger');
const auditService = require('./auditService');

/** Enforcement switch — shadow (log-only) until explicitly turned on. */
const isEnforcing = () =>
  String(process.env.DEVICE_BINDING_ENFORCE || '').toLowerCase() === 'true';

/**
 * How many hashed traits may differ before the fingerprint is called a
 * mismatch. Two lets a user change a network adapter and rename the host
 * without tripping; a genuinely different machine differs in far more.
 */
const TRAIT_DRIFT_TOLERANCE = 2;

const nowish = () => new Date();

/** Compare stored vs presented trait hashes. */
function compareTraits(stored, presented) {
  if (!stored || !presented || typeof stored !== 'object' || typeof presented !== 'object') {
    return { comparable: false, changed: [], changedCount: 0 };
  }
  const keys = Object.keys(stored);
  if (!keys.length) return { comparable: false, changed: [], changedCount: 0 };

  const changed = keys.filter((k) => presented[k] && stored[k] !== presented[k]);
  return { comparable: true, changed, changedCount: changed.length };
}

/**
 * Decide whether this machine may use the licence, and record the outcome.
 *
 * Returns { allowed, action, reason, license, device, warning }.
 * Throws only when enforcement is on and the device must be refused.
 */
async function bindDevice(companyId, identity = {}, { userId = null, req = null } = {}) {
  const deviceId = identity.deviceId || '';
  const fingerprint = identity.fingerprint || '';
  const traits = identity.traits || null;
  const deviceName = identity.deviceName || 'Unknown device';
  const isDesktop = !!identity.isDesktop;

  const license = await License.findOne({ companyId, isActive: true }).sort({ createdAt: -1 });

  // No licence at all — subscription middleware already rules on this; do not
  // add a second, more confusing failure here.
  if (!license) {
    return { allowed: true, action: 'no_license', reason: 'No licence to bind against', license: null, device: null };
  }

  // A web browser (or an older desktop build) sends nothing. Refusing here
  // would lock every existing user out the moment this ships.
  if (!deviceId) {
    logger.warn('device.binding.missing_id', {
      companyId: String(companyId),
      isDesktop,
      requestId: req?.requestId,
    });
    return { allowed: true, action: 'no_device_id', reason: 'Client sent no device id', license, device: null };
  }

  const devices = Array.isArray(license.devices) ? license.devices : [];
  const maxDevices = license.maxDevices ?? 1;
  const existing = devices.find((d) => d.deviceId === deviceId);

  // ---- Known device: refresh and allow -------------------------------------
  if (existing) {
    const cmp = compareTraits(existing.traits, traits);
    let warning = null;

    if (existing.fingerprint && fingerprint && existing.fingerprint !== fingerprint) {
      if (cmp.comparable && cmp.changedCount > TRAIT_DRIFT_TOLERANCE) {
        // Same persisted id on visibly different hardware — the device file was
        // most likely copied. Record loudly; still allow, because a false lockout
        // is worse than a logged suspicion the admin can act on.
        warning = 'hardware_changed';
        logger.warn('device.binding.hardware_mismatch', {
          companyId: String(companyId),
          deviceId,
          changed: cmp.changed,
          changedCount: cmp.changedCount,
          requestId: req?.requestId,
        });
        await auditService.logSystem({
          companyId,
          userId,
          action: 'device.hardware_mismatch',
          module: 'licensing',
          after: { deviceId, changed: cmp.changed, changedCount: cmp.changedCount },
        }).catch(() => {});
      } else {
        warning = 'fingerprint_drift';
      }
    }

    const wasInactive = existing.active === false;
    if (wasInactive) {
      // Admin released this slot; the machine is re-claiming it. Allowed only
      // if that does not exceed the cap.
      const activeCount = devices.filter((d) => d.active).length;
      if (activeCount >= maxDevices) {
        return refuse({
          companyId, license, deviceId, deviceName, maxDevices, activeCount,
          userId, req, reason: 'slot_full_on_reclaim',
        });
      }
    }

    existing.active = true;
    existing.lastSeenAt = nowish();
    existing.deviceName = deviceName || existing.deviceName;
    if (fingerprint) existing.fingerprint = fingerprint;
    if (traits) existing.traits = traits;

    license.devices = devices;
    license.lastValidatedAt = nowish();
    await license.save();

    return {
      allowed: true,
      action: wasInactive ? 'reactivated' : 'recognised',
      reason: '',
      license,
      device: existing,
      warning,
    };
  }

  // ---- New device: claim a free slot ---------------------------------------
  const activeCount = devices.filter((d) => d.active).length;

  if (activeCount >= maxDevices) {
    return refuse({
      companyId, license, deviceId, deviceName, maxDevices, activeCount,
      userId, req, reason: 'slot_full',
    });
  }

  devices.push({
    deviceId,
    deviceName,
    fingerprint,
    traits: traits || undefined,
    activatedAt: nowish(),
    lastSeenAt: nowish(),
    active: true,
  });
  license.devices = devices;
  license.lastValidatedAt = nowish();
  await license.save();

  logger.info('device.binding.registered', {
    companyId: String(companyId),
    deviceId,
    deviceName,
    slot: `${activeCount + 1}/${maxDevices}`,
    requestId: req?.requestId,
  });

  await auditService.logSystem({
    companyId,
    userId,
    action: 'device.registered',
    module: 'licensing',
    after: { deviceId, deviceName, slot: activeCount + 1, maxDevices },
  }).catch(() => {});

  return {
    allowed: true,
    action: 'registered',
    reason: '',
    license,
    device: devices[devices.length - 1],
  };
}

/** Shared refusal path — shadow mode logs, enforce mode throws. */
async function refuse({ companyId, license, deviceId, deviceName, maxDevices, activeCount, userId, req, reason }) {
  const detail = {
    companyId: String(companyId),
    deviceId,
    deviceName,
    activeDevices: activeCount,
    maxDevices,
    reason,
    requestId: req?.requestId,
  };

  if (!isEnforcing()) {
    logger.warn('device.binding.shadow (would refuse)', detail);
    return {
      allowed: true,
      action: 'shadow_refused',
      reason,
      license,
      device: null,
      warning: 'would_be_refused',
    };
  }

  logger.warn('device.binding.refused', detail);
  await auditService.logSystem({
    companyId,
    userId,
    action: 'device.refused',
    module: 'licensing',
    after: detail,
  }).catch(() => {});

  const registered = (license.devices || [])
    .filter((d) => d.active)
    .map((d) => d.deviceName || d.deviceId)
    .join(', ');

  throw new AppError(
    maxDevices === 1
      ? `This licence is already active on another computer${registered ? ` (${registered})` : ''}. Ask your administrator to release it before signing in here.`
      : `This licence already uses all ${maxDevices} of its computers. Ask your administrator to release one before signing in here.`,
    { statusCode: 403, errorCode: ErrorCodes.LICENSE_INVALID, errors: [{ field: 'deviceId', message: deviceId }] }
  );
}

/**
 * Admin action: free a device slot so another computer can claim it.
 * This is the recovery path for a dead PC, a reinstall, or a hardware swap.
 */
async function releaseDevice(companyId, deviceId, { userId = null, reason = 'admin_release' } = {}) {
  const license = await License.findOne({ companyId, isActive: true }).sort({ createdAt: -1 });
  if (!license) throw AppError.notFound('No active licence for this company');

  const devices = Array.isArray(license.devices) ? license.devices : [];
  const device = devices.find((d) => d.deviceId === deviceId);
  if (!device) throw AppError.notFound('Device not registered on this licence');

  device.active = false;
  device.releasedAt = nowish();
  license.devices = devices;
  license.transferCount = (license.transferCount || 0) + 1;
  await license.save();

  logger.info('device.binding.released', {
    companyId: String(companyId),
    deviceId,
    reason,
  });

  await auditService.logSystem({
    companyId,
    userId,
    action: 'device.released',
    module: 'licensing',
    after: { deviceId, reason, transferCount: license.transferCount },
  }).catch(() => {});

  // Sessions opened from that machine must not outlive its slot.
  try {
    const UserSession = require('../models/UserSession');
    await UserSession.updateMany(
      { companyId, deviceId, status: 'active' },
      { status: 'revoked', revokedAt: nowish(), revokeReason: 'device_released' }
    );
  } catch (err) {
    logger.warn('device.binding.session_revoke_failed', { deviceId, error: err.message });
  }

  return listDevices(companyId);
}

/** Everything the admin panel needs to show and manage licence devices. */
async function listDevices(companyId) {
  const license = await License.findOne({ companyId, isActive: true }).sort({ createdAt: -1 }).lean();
  if (!license) {
    return { licenseKey: null, maxDevices: 0, activeDevices: 0, slotsFree: 0, devices: [] };
  }

  const devices = (license.devices || []).map((d) => ({
    deviceId: d.deviceId,
    deviceName: d.deviceName || 'Unknown device',
    active: d.active !== false,
    activatedAt: d.activatedAt,
    lastSeenAt: d.lastSeenAt,
    releasedAt: d.releasedAt || null,
    fingerprint: d.fingerprint ? `${String(d.fingerprint).slice(0, 8)}…` : '',
  }));

  const activeDevices = devices.filter((d) => d.active).length;
  const maxDevices = license.maxDevices ?? 1;

  return {
    licenseKey: license.licenseKey,
    maxDevices,
    activeDevices,
    slotsFree: Math.max(0, maxDevices - activeDevices),
    transferCount: license.transferCount || 0,
    enforcing: isEnforcing(),
    devices,
  };
}

/** Admin action: change how many computers a licence may run on. */
async function setMaxDevices(companyId, maxDevices, { userId = null } = {}) {
  const n = Number(maxDevices);
  if (!Number.isInteger(n) || n < 1 || n > 20) {
    throw AppError.badRequest('maxDevices must be a whole number between 1 and 20');
  }

  const license = await License.findOne({ companyId, isActive: true }).sort({ createdAt: -1 });
  if (!license) throw AppError.notFound('No active licence for this company');

  const before = license.maxDevices;
  license.maxDevices = n;
  await license.save();

  await auditService.logSystem({
    companyId,
    userId,
    action: 'device.max_changed',
    module: 'licensing',
    before: { maxDevices: before },
    after: { maxDevices: n },
  }).catch(() => {});

  return listDevices(companyId);
}

module.exports = {
  bindDevice,
  releaseDevice,
  listDevices,
  setMaxDevices,
  isEnforcing,
  compareTraits,
  TRAIT_DRIFT_TOLERANCE,
};
