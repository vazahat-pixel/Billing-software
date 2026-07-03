import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import api from '../api/client';
import useStore from '../store/useStore';
import { buildModuleConfig } from '../utils/configHelpers';
import { isOffline } from '../utils/networkStatus';

const ConfigContext = createContext(null);

const POLL_MS = 5000;

export const ConfigProvider = ({ children }) => {
  const token = useStore((s) => s.token);
  const user = useStore((s) => s.user);
  const syncActiveConfig = useStore((s) => s.syncActiveConfig);

  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState(null);
  const hashRef = useRef(null);
  const fetchingRef = useRef(false);

  const fetchBundle = useCallback(async () => {
    if (!token || fetchingRef.current || isOffline()) return null;
    fetchingRef.current = true;
    try {
      const res = await api.get('/config/active');
      if (res.data?.success && res.data.data) {
        const data = res.data.data;
        setBundle(data);
        hashRef.current = data.configHash;
        syncActiveConfig(data);
        setLastSynced(new Date());
        return data;
      }
    } catch (err) {
      console.warn('Config fetch failed, using cached:', err.message);
    } finally {
      fetchingRef.current = false;
    }
    return null;
  }, [token, syncActiveConfig]);

  const pollVersion = useCallback(async () => {
    if (!token || isOffline()) return;
    try {
      const res = await api.get('/config/version');
      const remoteHash = res.data?.data?.configHash;
      if (remoteHash && remoteHash !== hashRef.current) {
        await fetchBundle();
      }
    } catch {
      /* keep last cached bundle */
    }
  }, [token, fetchBundle]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return undefined;
    }

    if (isOffline()) {
      if (user?.activeConfig) {
        setBundle({
          ...user.activeConfig,
          bundleVersion: user.configVersion,
          configHash: user.configHash
        });
        hashRef.current = user.configHash || null;
      }
      setLoading(false);
      return undefined;
    }

    let mounted = true;
    (async () => {
      await fetchBundle();
      if (mounted) setLoading(false);
    })();

    const intervalId = setInterval(pollVersion, POLL_MS);
    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [token, user?.activeConfig, user?.configVersion, user?.configHash, fetchBundle, pollVersion]);

  const moduleConfig = buildModuleConfig(bundle, user?.moduleConfig);

  const value = {
    bundle,
    loading,
    lastSynced,
    moduleConfig,
    refreshConfig: fetchBundle,
    configVersion: bundle?.bundleVersion || user?.configVersion || 0,
    configHash: bundle?.configHash || user?.configHash || null
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
      configHash: null
    };
  }
  return ctx;
};

export default ConfigContext;
