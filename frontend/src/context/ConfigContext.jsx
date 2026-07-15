import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { configApi } from '../api';
import useStore from '../store/useStore';
import useConfigStore from '../store/useConfigStore';
import { buildModuleConfig } from '../utils/configHelpers';
import { isOffline } from '../utils/networkStatus';

const ConfigContext = createContext(null);

const POLL_MS = 15000;

export const ConfigProvider = ({ children }) => {
  const token = useStore((s) => s.token);
  const user = useStore((s) => s.user);
  const syncActiveConfig = useStore((s) => s.syncActiveConfig);
  const syncBundle = useConfigStore((s) => s.syncBundle);

  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState(null);
  const hashRef = useRef(null);
  const fetchingRef = useRef(false);
  const bootedForTokenRef = useRef(null);

  const applyBundle = useCallback(
    (data) => {
      if (!data) return false;
      const nextHash = data.configHash || null;
      // Same hash → do not touch user store (avoids Effect loops + top-bar spam)
      if (nextHash && nextHash === hashRef.current) {
        return false;
      }
      hashRef.current = nextHash;
      setBundle(data);
      syncActiveConfig(data);
      syncBundle(data);
      setLastSynced(new Date());
      return true;
    },
    [syncActiveConfig, syncBundle]
  );

  const fetchBundle = useCallback(async () => {
    if (!token || fetchingRef.current || isOffline()) return null;
    fetchingRef.current = true;
    try {
      const data = await configApi.active({ silent: true });
      if (data) {
        applyBundle(data);
        return data;
      }
    } catch (err) {
      console.warn('Config fetch failed, using cached:', err.message);
    } finally {
      fetchingRef.current = false;
    }
    return null;
  }, [token, applyBundle]);

  const pollVersion = useCallback(async () => {
    if (!token || isOffline() || fetchingRef.current) return;
    try {
      const data = await configApi.version({ silent: true });
      const remoteHash = data?.configHash;
      if (remoteHash && remoteHash !== hashRef.current) {
        await fetchBundle();
      }
    } catch {
      /* keep last cached bundle */
    }
  }, [token, fetchBundle]);

  // Boot once per token. Never depend on user.activeConfig — that caused infinite reload.
  useEffect(() => {
    if (!token) {
      bootedForTokenRef.current = null;
      hashRef.current = null;
      setBundle(null);
      setLoading(false);
      return undefined;
    }

    if (isOffline()) {
      const cachedUser = useStore.getState().user;
      if (cachedUser?.activeConfig) {
        setBundle({
          ...cachedUser.activeConfig,
          bundleVersion: cachedUser.configVersion,
          configHash: cachedUser.configHash,
        });
        hashRef.current = cachedUser.configHash || null;
      }
      setLoading(false);
      return undefined;
    }

    let mounted = true;
    (async () => {
      if (bootedForTokenRef.current !== token) {
        bootedForTokenRef.current = token;
        await fetchBundle();
      }
      if (mounted) setLoading(false);
    })();

    const intervalId = setInterval(pollVersion, POLL_MS);
    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [token, fetchBundle, pollVersion]);

  const moduleConfig = buildModuleConfig(bundle, user?.moduleConfig);

  const value = {
    bundle,
    loading,
    lastSynced,
    moduleConfig,
    refreshConfig: fetchBundle,
    configVersion: bundle?.bundleVersion || user?.configVersion || 0,
    configHash: bundle?.configHash || user?.configHash || null,
  };

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const ctx = useContext(ConfigContext);
  if (!ctx) {
    return {
      bundle: null,
      loading: false,
      lastSynced: null,
      moduleConfig: null,
      refreshConfig: async () => null,
      configVersion: 0,
      configHash: null,
    };
  }
  return ctx;
};

export default ConfigContext;
