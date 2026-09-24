import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, CloudUpload, AlertTriangle, RefreshCw, Check } from 'lucide-react';
import useOnlineStatus from '../hooks/useOnlineStatus';
import { isDesktopHybridMode } from '../utils/desktopMode';

const OfflineIndicator = ({ onOpenSync }) => {
  const { isOnline, pendingSync, failedSync, retryConnection } = useOnlineStatus();
  const [hybrid, setHybrid] = useState(null);

  useEffect(() => {
    if (!isDesktopHybridMode()) return undefined;
    let cancelled = false;
    const tick = async () => {
      try {
        const st = await window.textileDesktop?.getSyncStatus?.();
        if (!cancelled && st) setHybrid(st);
      } catch {
        /* ignore */
      }
    };
    tick();
    const id = setInterval(tick, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const hasIssues = failedSync > 0 || hybrid?.syncState === 'issue';
  const pending = Math.max(pendingSync || 0, hybrid?.pendingCount || 0);
  const connectivity = hybrid?.connectivity;
  const online =
    connectivity === 'online' ||
    (connectivity == null && isOnline);

  const label = (() => {
    if (hybrid?.syncState === 'syncing') return 'Syncing';
    if (!online) return 'Offline';
    if (hasIssues) return 'Sync Issue';
    if (hybrid?.syncState === 'synced' && pending === 0) return 'Synced';
    return 'Online';
  })();

  const onClick = async () => {
    if (!online && retryConnection) {
      await retryConnection();
    }
    onOpenSync?.();
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${
        online
          ? hasIssues
            ? 'bg-rose-50 text-rose-700 border-rose-200'
            : 'bg-emerald-50 text-emerald-700 border-emerald-100'
          : 'bg-amber-50 text-amber-700 border-amber-200'
      }`}
      title={
        hybrid?.lastSyncedAt
          ? `Last synced: ${hybrid.lastSyncedAt}`
          : online
            ? 'Connected — tap to view sync queue'
            : 'API unreachable — tap to retry / view pending'
      }
    >
      {hybrid?.syncState === 'syncing' ? (
        <RefreshCw size={14} className="animate-spin" />
      ) : online ? (
        hybrid?.syncState === 'synced' && !hasIssues ? (
          <Check size={14} />
        ) : (
          <Wifi size={14} />
        )
      ) : (
        <WifiOff size={14} />
      )}
      <span>{label}</span>
      {!online && <RefreshCw size={12} className="opacity-70" />}
      {hasIssues && (
        <span className="flex items-center gap-1 ml-1 px-2 py-0.5 bg-white/70 rounded-full text-[9px] text-rose-600">
          <AlertTriangle size={10} />
          {failedSync || '!'}
        </span>
      )}
      {pending > 0 && (
        <span className="flex items-center gap-1 ml-1 px-2 py-0.5 bg-white/70 rounded-full text-[9px]">
          <CloudUpload size={10} />
          {pending}
        </span>
      )}
    </button>
  );
};

export default OfflineIndicator;
