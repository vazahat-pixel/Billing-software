const crypto = require('crypto');
const License = require('../models/License');
const Company = require('../models/Company');
const Subscription = require('../models/Subscription');
const { generateLicenseKey, validateLicenseKey } = require('../utils/license');
const AppError = require('../utils/AppError');
const auditService = require('./auditService');

function makeChecksum(companyId, key) {
  return crypto
    .createHash('sha256')
    .update(`${companyId}:${key}:${process.env.JWT_SECRET || ''}`)
    .digest('hex')
    .substring(0, 16)
    .toUpperCase();
}

function antiTamper(license) {
  return crypto
    .createHash('sha256')
    .update(`${license.licenseKey}|${license.expiresAt?.toISOString?.() || ''}|${license.checksum}|${process.env.JWT_SECRET || ''}`)
    .digest('hex')
    .substring(0, 24);
}

/**
 * Stage 8.7 — Commercial licensing & activation.
 * Extends existing License model; does not replace subscription middleware.
 */
class LicensingActivationService {
  async status(companyId) {
    const license = await License.findOne({ companyId, isActive: true }).sort({ createdAt: -1 });
    const sub = await Subscription.findOne({ companyId }).sort({ createdAt: -1 });
    if (!license) {
      return { active: false, reason: 'no_license', grace: false };
    }
    const now = new Date();
    const expired = license.expiresAt < now;
    const graceEnd = new Date(license.expiresAt);
    graceEnd.setDate(graceEnd.getDate() + (license.graceDays || 7));
    const inGrace = expired && now <= graceEnd;
    const tamperOk = !license.antiTamperHash || license.antiTamperHash === antiTamper(license);

    return {
      active: (!expired || inGrace) && license.isActive && tamperOk,
      expired,
      inGrace,
      graceEndsAt: inGrace ? graceEnd : null,
      expiresAt: license.expiresAt,
      licenseKey: license.licenseKey,
      planTier: license.planTier || 'trial',
      devices: (license.devices || []).filter((d) => d.active).length,
      maxDevices: license.maxDevices || 3,
      lastValidatedAt: license.lastValidatedAt,
      tamperOk,
      subscriptionStatus: sub?.status || null,
    };
  }

  async activateOnline(companyId, { licenseKey, deviceId, deviceName = '', fingerprint = '' }, userId) {
    if (!licenseKey || !deviceId) throw AppError.badRequest('licenseKey and deviceId required');

    let license = await License.findOne({ licenseKey });
    if (!license) throw AppError.notFound('License key not found');
    if (!license.isActive) throw AppError.forbidden('License inactive');

    // Bind or verify company
    if (String(license.companyId) !== String(companyId)) {
      // Allow transfer if unbound trial key matching company via validate
      if (!validateLicenseKey(licenseKey, companyId)) {
        throw AppError.forbidden('License does not belong to this company');
      }
    }

    const checksum = makeChecksum(license.companyId, license.licenseKey);
    if (license.checksum === 'CHECKSUM_PLACEHOLDER') {
      license.checksum = checksum;
    }

    const devices = license.devices || [];
    const existing = devices.find((d) => d.deviceId === deviceId);
    if (existing) {
      existing.active = true;
      existing.lastSeenAt = new Date();
      existing.deviceName = deviceName || existing.deviceName;
      existing.fingerprint = fingerprint || existing.fingerprint;
    } else {
      const activeCount = devices.filter((d) => d.active).length;
      if (activeCount >= (license.maxDevices || 3)) {
        throw AppError.forbidden('Maximum devices registered — deactivate a device first');
      }
      devices.push({
        deviceId,
        deviceName,
        fingerprint,
        activatedAt: new Date(),
        lastSeenAt: new Date(),
        active: true,
      });
    }
    license.devices = devices;
    license.lastValidatedAt = new Date();
    license.activationMode = 'online';
    license.antiTamperHash = antiTamper(license);
    await license.save();

    await Company.findByIdAndUpdate(companyId, { licenseKey: license.licenseKey });
    await auditService.logSystem({
      companyId,
      userId,
      action: 'license.activated',
      module: 'commercial',
      after: { licenseKey, deviceId },
    });

    return this.status(companyId);
  }

  async activateOffline(companyId, { licenseKey, offlineCode, deviceId, deviceName = '' }, userId) {
    if (!licenseKey || !offlineCode || !deviceId) {
      throw AppError.badRequest('licenseKey, offlineCode, deviceId required');
    }
    const expected = crypto
      .createHash('sha256')
      .update(`${licenseKey}:${companyId}:${process.env.JWT_SECRET || ''}`)
      .digest('hex')
      .substring(0, 12)
      .toUpperCase();
    if (offlineCode.toUpperCase() !== expected) {
      throw AppError.forbidden('Invalid offline activation code');
    }
    const license = await License.findOne({ licenseKey, companyId });
    if (!license) throw AppError.notFound('License not found');
    license.offlineCode = expected;
    license.activationMode = 'offline';
    return this.activateOnline(companyId, { licenseKey, deviceId, deviceName }, userId);
  }

  async generateOfflineCode(companyId, licenseKey) {
    const license = await License.findOne({ licenseKey, companyId });
    if (!license) throw AppError.notFound('License not found');
    const code = crypto
      .createHash('sha256')
      .update(`${licenseKey}:${companyId}:${process.env.JWT_SECRET || ''}`)
      .digest('hex')
      .substring(0, 12)
      .toUpperCase();
    license.offlineCode = code;
    await license.save();
    return { offlineCode: code, licenseKey };
  }

  async deactivateDevice(companyId, deviceId, userId) {
    const license = await License.findOne({ companyId, isActive: true }).sort({ createdAt: -1 });
    if (!license) throw AppError.notFound('License not found');
    license.devices = (license.devices || []).map((d) =>
      d.deviceId === deviceId ? { ...d.toObject?.() || d, active: false } : d
    );
    await license.save();
    await auditService.logSystem({
      companyId,
      userId,
      action: 'license.device.deactivated',
      module: 'commercial',
      after: { deviceId },
    });
    return this.status(companyId);
  }

  async renew(companyId, { expiresAt, planTier }, userId) {
    const license = await License.findOne({ companyId, isActive: true }).sort({ createdAt: -1 });
    if (!license) throw AppError.notFound('License not found');
    if (expiresAt) license.expiresAt = new Date(expiresAt);
    if (planTier) license.planTier = planTier;
    license.checksum = makeChecksum(license.companyId, license.licenseKey);
    license.antiTamperHash = antiTamper(license);
    await license.save();
    await auditService.logSystem({
      companyId,
      userId,
      action: 'license.renewed',
      module: 'commercial',
      after: { expiresAt: license.expiresAt, planTier: license.planTier },
    });
    return license;
  }

  async upgrade(companyId, planTier, userId) {
    return this.renew(companyId, { planTier }, userId);
  }

  async issue(companyId, { expiresAt, planTier = 'pro', maxDevices = 5 }, userId) {
    const key = generateLicenseKey(companyId);
    const checksum = makeChecksum(companyId, key);
    const license = await License.create({
      companyId,
      licenseKey: key,
      expiresAt: expiresAt || new Date(Date.now() + 365 * 86400000),
      isActive: true,
      checksum,
      planTier,
      maxDevices,
      antiTamperHash: '',
    });
    license.antiTamperHash = antiTamper(license);
    await license.save();
    await Company.findByIdAndUpdate(companyId, { licenseKey: key });
    await auditService.logSystem({
      companyId,
      userId,
      action: 'license.issued',
      module: 'commercial',
      after: { licenseKey: key },
    });
    return license;
  }

  async audit(companyId) {
    const licenses = await License.find({ companyId }).sort({ createdAt: -1 });
    return {
      count: licenses.length,
      active: licenses.filter((l) => l.isActive).length,
      devices: licenses.reduce((s, l) => s + (l.devices || []).filter((d) => d.active).length, 0),
      licenses: licenses.map((l) => ({
        key: l.licenseKey,
        expiresAt: l.expiresAt,
        planTier: l.planTier,
        devices: (l.devices || []).length,
        tamperOk: !l.antiTamperHash || l.antiTamperHash === antiTamper(l),
      })),
    };
  }
}

module.exports = new LicensingActivationService();
module.exports.makeChecksum = makeChecksum;
