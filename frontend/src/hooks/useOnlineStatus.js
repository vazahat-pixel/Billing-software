import { useState, useEffect, useRef } from 'react';
import { getPendingCount, getFailedCount } from '../utils/syncQueue';
import {
  getNetworkStatus,
  subscribeNetworkStatus,
  probeServerReachability,
} from '../utils/networkStatus';
import { resetApiLoadingState } from '../api/client';

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(() => !getNetworkStatus().isOffline);
  const [pendingSync, setPendingSync] = useState(0);
  const [failedSync, setFailedSync] = useState(0);
  const wasOffline = useRef(!isOnline);

  useEffect(() => {
    const unsub = subscribeNetworkStatus(({ isOffline }) => {
      setIsOnline(!isOffline);
      if (wasOffline.current && !isOffline) {
        resetApiLoadingState();
      }
      wasOffline.current = isOffline;
    });

    const refreshCounts = async () => {
      try {
        const [pending, failed] = await Promise.all([getPendingCount(), getFailedCount()]);
        setPendingSync(pending);
        setFailedSync(failed);
      } catch {
        setPendingSync(0);
        setFailedSync(0);
      }
    };

    const onOnline = () => {
      probeServerReachability().finally(refreshCounts);
    };

    window.addEventListener('online', onOnline);
    refreshCounts();
    // Recover sticky offline every few seconds while still showing offline
    const interval = setInterval(() => {
      const { isOffline } = getNetworkStatus();
      if (isOffline) {
        probeServerReachability().finally(refreshCounts);
      } else {
        refreshCounts();
      }
    }, 5000);

    // Immediate recovery attempt on mount
    probeServerReachability();

    return () => {
      unsub();
      window.removeEventListener('online', onOnline);
      clearInterval(interval);
    };
  }, []);

  return { isOnline, pendingSync, failedSync, retryConnection: probeServerReachability };
};

export default useOnlineStatus;
