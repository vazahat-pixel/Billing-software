import { useState, useEffect } from 'react';
import { getPendingCount, getFailedCount } from '../utils/syncQueue';
import { getNetworkStatus, subscribeNetworkStatus } from '../utils/networkStatus';

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(() => !getNetworkStatus().isOffline);
  const [pendingSync, setPendingSync] = useState(0);
  const [failedSync, setFailedSync] = useState(0);

  useEffect(() => {
    const unsub = subscribeNetworkStatus(({ isOffline }) => {
      setIsOnline(!isOffline);
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

    window.addEventListener('online', refreshCounts);
    refreshCounts();
    const interval = setInterval(refreshCounts, 5000);

    return () => {
      unsub();
      window.removeEventListener('online', refreshCounts);
      clearInterval(interval);
    };
  }, []);

  return { isOnline, pendingSync, failedSync };
};

export default useOnlineStatus;
