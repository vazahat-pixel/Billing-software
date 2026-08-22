/**
 * Device identity for licence binding — one licence, one computer.
 *
 * On the desktop build the Electron preload exposes a hardware-derived id that
 * survives reinstalls; that is the real identity. In a browser there is no
 * trustworthy hardware signal, so a random id is persisted in localStorage —
 * weak, but enough to recognise the same browser, and the backend treats a
 * browser as unbound anyway.
 */

const STORAGE_KEY = 'erp_device_identity';

const isDesktop = () =>
  typeof window !== 'undefined' && !!window.textileDesktop?.isDesktop;

const randomId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `web-${crypto.randomUUID().replace(/-/g, '')}`;
  }
  return `web-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
};

/** Coarse browser traits — recognition only, never treated as secure. */
const browserTraits = () => {
  if (typeof navigator === 'undefined') return {};
  return {
    platform: navigator.platform || '',
    language: navigator.language || '',
    hardwareConcurrency: String(navigator.hardwareConcurrency || ''),
    screen: typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
  };
};

const readCached = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.deviceId ? parsed : null;
  } catch {
    return null;
  }
};

const writeCached = (identity) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {
    /* private mode / storage disabled — identity is per-session then */
  }
};

let inflight = null;

/**
 * Resolve this machine's identity. Cached after the first call.
 * Never throws: a failure returns an empty identity and the backend decides.
 */
export const getDeviceIdentity = async () => {
  const cached = readCached();
  if (cached && cached.isDesktop === isDesktop()) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    let identity;

    if (isDesktop()) {
      try {
        const hw = await window.textileDesktop.machineId();
        if (hw?.deviceId) {
          identity = {
            deviceId: hw.deviceId,
            deviceFingerprint: hw.fingerprint || '',
            deviceTraits: hw.traits || null,
            deviceName: hw.deviceName || 'Desktop',
            isDesktop: true,
          };
        }
      } catch {
        /* fall through to the browser path */
      }
    }

    if (!identity) {
      const existing = cached?.deviceId && !cached.isDesktop ? cached.deviceId : randomId();
      identity = {
        deviceId: existing,
        deviceFingerprint: '',
        deviceTraits: browserTraits(),
        deviceName: typeof navigator !== 'undefined'
          ? `Browser (${navigator.platform || 'web'})`
          : 'Browser',
        isDesktop: false,
      };
    }

    writeCached(identity);
    inflight = null;
    return identity;
  })();

  return inflight;
};

/** Cached identity without awaiting — for request headers on every call. */
export const getCachedDeviceIdentity = () => readCached();

/** Clear the stored identity (testing / explicit device reset). */
export const clearDeviceIdentity = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
};

export const isDesktopApp = isDesktop;
