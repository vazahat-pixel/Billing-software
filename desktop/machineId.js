/**
 * Stable machine identity for licence binding.
 *
 * One licence is tied to one computer, so this has to survive ordinary events
 * (reboot, app reinstall, Windows update) without being trivially forgeable.
 *
 * Two values are produced:
 *
 *   deviceId    A persisted random id, written next to the app's user data.
 *               This is the primary key for the licence device slot. It is
 *               stable across hardware changes but lost on a clean OS wipe.
 *
 *   fingerprint A hash of several hardware/OS traits. Used as corroboration,
 *               never as the sole identity: any single trait may change when a
 *               user swaps a network card or upgrades RAM. The backend compares
 *               it loosely, so a partial change warns rather than locks out.
 *
 * Deliberately NOT used: MAC address alone (changes with adapters, spoofable),
 * or a single "machine GUID" (a Windows reinstall changes it and the customer
 * is locked out of a licence they paid for).
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

/**
 * Hardware traits, each independently weak but jointly stable.
 * Sorted where order is not guaranteed, so the hash does not drift.
 */
function collectTraits() {
  const cpus = os.cpus() || [];
  const nets = os.networkInterfaces() || {};

  const macs = Object.values(nets)
    .flat()
    .filter((n) => n && !n.internal && n.mac && n.mac !== '00:00:00:00:00:00')
    .map((n) => n.mac)
    .sort();

  return {
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    cpuModel: cpus[0]?.model?.trim() || 'unknown',
    cpuCount: String(cpus.length),
    // Rounded to GB — a RAM upgrade should not silently invalidate a licence,
    // but a totally different machine still reads differently.
    totalMemGb: String(Math.round(os.totalmem() / 1024 ** 3)),
    macs: macs.join(','),
    username: os.userInfo?.().username || '',
  };
}

/** Full fingerprint over all traits. */
function computeFingerprint() {
  const t = collectTraits();
  const payload = [
    t.platform, t.arch, t.hostname, t.cpuModel,
    t.cpuCount, t.totalMemGb, t.macs, t.username,
  ].join('|');
  return sha(payload).substring(0, 32);
}

/**
 * Per-trait hashes. The backend can count how many still match, so one changed
 * component (new NIC, renamed host) is a warning, not a lockout.
 */
function computeTraitHashes() {
  const t = collectTraits();
  const out = {};
  for (const [k, v] of Object.entries(t)) {
    out[k] = sha(`${k}:${v}`).substring(0, 12);
  }
  return out;
}

/**
 * Read (or create once) the persisted device id.
 * Stored beside the app's userData so an app reinstall keeps the same identity.
 */
function loadOrCreateDeviceId(userDataPath) {
  const file = path.join(userDataPath, 'device.json');

  try {
    if (fs.existsSync(file)) {
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (saved && typeof saved.deviceId === 'string' && saved.deviceId.length >= 16) {
        return { deviceId: saved.deviceId, createdAt: saved.createdAt || null, fresh: false };
      }
    }
  } catch {
    // Corrupt file — fall through and reissue rather than blocking startup.
  }

  const deviceId = `dsk-${crypto.randomBytes(16).toString('hex')}`;
  const record = { deviceId, createdAt: new Date().toISOString() };
  try {
    fs.mkdirSync(userDataPath, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(record, null, 2), 'utf8');
  } catch {
    // Non-fatal: an unwritable profile still gets a working (per-run) id.
  }
  return { ...record, fresh: true };
}

/** Everything the renderer sends at login. */
function getMachineIdentity(userDataPath) {
  const { deviceId, createdAt, fresh } = loadOrCreateDeviceId(userDataPath);
  return {
    deviceId,
    fingerprint: computeFingerprint(),
    traits: computeTraitHashes(),
    deviceName: `${os.hostname()} (${os.platform()})`,
    createdAt,
    fresh,
  };
}

module.exports = {
  getMachineIdentity,
  computeFingerprint,
  computeTraitHashes,
  loadOrCreateDeviceId,
};
