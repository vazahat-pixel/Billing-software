/**
 * Entitlements — what this company may use, and how much quota is left.
 *
 * Reads /config/entitlements, which the backend computes from the same
 * resolver the API gate uses. The UI must never recompute this from the plan
 * itself: if the two ever disagreed, a module would look open and then 403.
 *
 * Falls back to permissive (everything on) when the call fails, matching the
 * backend's own degraded behaviour — a monitoring blip must not lock the
 * operator out of a product they paid for.
 */
import { useCallback, useEffect, useState } from 'react';
import { configApi } from '../api';
import useStore from '../store/useStore';
import { isOffline } from '../utils/networkStatus';

const REFRESH_MS = 60_000;

const PERMISSIVE = {
  modules: {},
  entitledModules: {},
  enabledModules: {},
  status: 'unknown',
  daysLeft: null,
  isUsable: true,
  isReadOnly: false,
  plan: null,
  limits: {},
  license: null,
  usage: null,
  degraded: true,
};

let cached = null;
let inflight = null;
const listeners = new Set();

const publish = (value) => {
  cached = value;
  listeners.forEach((fn) => {
    try { fn(value); } catch { /* a bad subscriber must not break the rest */ }
  });
};

export const fetchEntitlements = async ({ force = false } = {}) => {
  if (isOffline()) return cached || PERMISSIVE;
  if (cached && !force) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const data = await configApi.entitlements({ silent: true });
      publish(data || PERMISSIVE);
      return cached;
    } catch {
      publish(cached || PERMISSIVE);
      return cached;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
};

/** Drop the cache — call after anything that changes the plan or quota. */
export const invalidateEntitlements = () => {
  cached = null;
};

export const useEntitlements = () => {
  const token = useStore((s) => s.token);
  const [entitlements, setEntitlements] = useState(cached || PERMISSIVE);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    if (!token) {
      cached = null;
      setEntitlements(PERMISSIVE);
      setLoading(false);
      return undefined;
    }

    let alive = true;
    listeners.add(setEntitlements);

    fetchEntitlements().then(() => {
      if (alive) setLoading(false);
    });

    const id = setInterval(() => fetchEntitlements({ force: true }), REFRESH_MS);

    return () => {
      alive = false;
      listeners.delete(setEntitlements);
      clearInterval(id);
    };
  }, [token]);

  /** Is this module usable right now? Unknown keys default to yes. */
  const hasModule = useCallback(
    (key) => entitlements.modules?.[key] !== false,
    [entitlements]
  );

  /**
   * Is it locked because the plan does not include it (an upsell), rather than
   * because the admin switched it off (a support question)?
   */
  const isUpsell = useCallback(
    (key) => entitlements.entitledModules?.[key] === false,
    [entitlements]
  );

  const refresh = useCallback(() => fetchEntitlements({ force: true }), []);

  return {
    entitlements,
    loading,
    hasModule,
    isUpsell,
    refresh,
    status: entitlements.status,
    daysLeft: entitlements.daysLeft,
    isReadOnly: !!entitlements.isReadOnly,
    plan: entitlements.plan,
    usage: entitlements.usage,
  };
};

export default useEntitlements;
