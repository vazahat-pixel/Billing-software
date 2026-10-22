const STORAGE_PREFIX = 'erp-recent-';

function getActiveCompanyScope() {
  if (typeof window === 'undefined') return 'global';
  try {
    const offlineId = localStorage.getItem('offlineCompanyId');
    if (offlineId) return String(offlineId);
    const userRaw = localStorage.getItem('user');
    if (userRaw) {
      const u = JSON.parse(userRaw);
      if (u?.companyId) return String(u.companyId);
      if (u?.company?._id || u?.company?.id) return String(u.company._id || u.company.id);
    }
  } catch {
    /* ignore */
  }
  return 'global';
}

function getScopedKey(key) {
  const scope = getActiveCompanyScope();
  return `${STORAGE_PREFIX}${scope}-${key}`;
}

// Clean up any legacy un-scoped localStorage keys from earlier versions
if (typeof window !== 'undefined') {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX) && !k.slice(STORAGE_PREFIX.length).includes('-')) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    /* ignore */
  }
}

export function getRecent(key, limit = 8) {
  if (!key || typeof window === 'undefined') return [];
  try {
    const scopedKey = getScopedKey(key);
    const raw = localStorage.getItem(scopedKey);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.slice(0, limit) : [];
  } catch {
    return [];
  }
}

export function pushRecent(key, value, limit = 8) {
  if (!key || value == null || value === '' || typeof window === 'undefined') return;
  const prev = getRecent(key, limit + 4).filter((v) => String(v) !== String(value));
  const next = [String(value), ...prev].slice(0, limit);
  try {
    const scopedKey = getScopedKey(key);
    localStorage.setItem(scopedKey, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}

export function clearRecentForCompany(companyId) {
  if (typeof window === 'undefined') return;
  try {
    const targetScope = companyId ? String(companyId) : getActiveCompanyScope();
    const prefix = `${STORAGE_PREFIX}${targetScope}-`;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    /* ignore */
  }
}

export default { getRecent, pushRecent, clearRecentForCompany };
