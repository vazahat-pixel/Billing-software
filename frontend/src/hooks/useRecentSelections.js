const STORAGE_PREFIX = 'erp-recent-';

export function getRecent(key, limit = 8) {
  if (!key || typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
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
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}

export default { getRecent, pushRecent };
