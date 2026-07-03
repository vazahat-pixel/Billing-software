import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CloudUpload, RefreshCw, X } from 'lucide-react';
import {
  getFailedSyncItems,
  getPendingCount,
  retryAllFailed,
  retrySyncItem,
  processSyncQueue
} from '../utils/syncQueue';
import useStore from '../store/useStore';
import { subscribeNetworkStatus } from '../utils/networkStatus';

const ENTITY_LABELS = {
  sales: 'Sales Invoice',
  purchases: 'Purchase Bill',
  parties: 'Party',
  items: 'Item',
  payments: 'Payment',
  receipts: 'Receipt'
};

const FailedSyncModal = ({ isOpen, onClose }) => {
  const [failed, setFailed] = useState([]);
  const [pending, setPending] = useState(0);
  const [retrying, setRetrying] = useState(false);

  const refresh = useCallback(async () => {
    const [failedItems, pendingCount] = await Promise.all([
      getFailedSyncItems(),
      getPendingCount()
    ]);
    setFailed(failedItems);
    setPending(pendingCount);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    refresh();
    return subscribeNetworkStatus(() => refresh());
  }, [isOpen, refresh]);

  const onSynced = (entityType, synced, localId, action) => {
    const store = useStore.getState();
    const keyMap = {
      sales: 'sales',
      purchases: 'purchases',
      parties: 'parties',
      items: 'items',
      payments: 'payments',
      receipts: 'receipts'
    };
    const key = keyMap[entityType];
    if (!key || !store[key]) return;
    if (action === 'delete') {
      useStore.setState({ [key]: store[key].filter((r) => (r.id || r._id) !== localId) });
      return;
    }
    const list = store[key].filter((r) => (r.id || r._id) !== localId);
    useStore.setState({ [key]: [synced, ...list] });
  };

  const onComplete = ({ needsInventoryRefresh }) => {
    if (needsInventoryRefresh) useStore.getState().fetchInventory();
    refresh();
    setRetrying(false);
  };

  const handleRetryAll = async () => {
    setRetrying(true);
    await retryAllFailed(onSynced, null, onComplete);
  };

  const handleRetryOne = async (id) => {
    setRetrying(true);
    await retrySyncItem(id, onSynced, null, onComplete);
  };

  const handleSyncNow = async () => {
    setRetrying(true);
    await processSyncQueue(onSynced, null, onComplete);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-amber-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <CloudUpload size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">Sync Queue</h3>
              <p className="text-[10px] text-slate-500">{pending} pending · {failed.length} failed</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto p-4 space-y-2">
          {failed.length === 0 && pending === 0 && (
            <p className="text-center text-xs text-slate-400 py-8">All changes are synced.</p>
          )}
          {failed.map((item) => (
            <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl bg-rose-50 border border-rose-100">
              <AlertTriangle size={16} className="text-rose-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-slate-800 uppercase">
                  {ENTITY_LABELS[item.entityType] || item.entityType} · {item.action || 'create'}
                </p>
                <p className="text-[10px] text-rose-600 mt-1 break-words">{item.error || 'Sync failed'}</p>
              </div>
              <button
                type="button"
                disabled={retrying}
                onClick={() => handleRetryOne(item.id)}
                className="shrink-0 px-2 py-1 text-[9px] font-black uppercase bg-white border border-rose-200 rounded-md hover:bg-rose-100 disabled:opacity-50"
              >
                Retry
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2 p-4 border-t border-slate-100 bg-slate-50">
          <button
            type="button"
            disabled={retrying || (failed.length === 0 && pending === 0)}
            onClick={handleSyncNow}
            className="flex-1 h-9 text-[10px] font-black uppercase rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <RefreshCw size={12} className={retrying ? 'animate-spin' : ''} />
            Sync Now
          </button>
          {failed.length > 0 && (
            <button
              type="button"
              disabled={retrying}
              onClick={handleRetryAll}
              className="flex-1 h-9 text-[10px] font-black uppercase rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
            >
              Retry Failed
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FailedSyncModal;
