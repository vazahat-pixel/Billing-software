import React, { useState } from 'react';
import { Wifi, WifiOff, CloudUpload, AlertTriangle } from 'lucide-react';
import useOnlineStatus from '../hooks/useOnlineStatus';

const OfflineIndicator = ({ onOpenSync }) => {
  const { isOnline, pendingSync, failedSync } = useOnlineStatus();
  const hasIssues = failedSync > 0;

  return (
    <button
      type="button"
      onClick={onOpenSync}
      className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${
        isOnline
          ? hasIssues
            ? 'bg-rose-50 text-rose-700 border-rose-200'
            : 'bg-emerald-50 text-emerald-700 border-emerald-100'
          : 'bg-amber-50 text-amber-700 border-amber-200'
      }`}
      title={isOnline ? 'Connected — tap to view sync queue' : 'Offline — tap to view pending changes'}
    >
      {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
      <span>{isOnline ? 'Online' : 'Offline'}</span>
      {failedSync > 0 && (
        <span className="flex items-center gap-1 ml-1 px-2 py-0.5 bg-white/70 rounded-full text-[9px] text-rose-600">
          <AlertTriangle size={10} />
          {failedSync}
        </span>
      )}
      {pendingSync > 0 && (
        <span className="flex items-center gap-1 ml-1 px-2 py-0.5 bg-white/70 rounded-full text-[9px]">
          <CloudUpload size={10} />
          {pendingSync}
        </span>
      )}
    </button>
  );
};

export default OfflineIndicator;
