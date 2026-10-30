import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Clock, CloudUpload, RefreshCw, Trash2, X } from 'lucide-react';
import {
  getFailedSyncItems,
  getWaitingSyncItems,
  retryAllFailed,
  retrySyncItem,
  processSyncQueue,
  discardSyncItem
} from '../utils/syncQueue';
import useStore from '../store/useStore';
import { subscribeNetworkStatus } from '../utils/networkStatus';
import { erpConfirm } from '../utils/confirm';

const ENTITY_LABELS = {
  sales: 'Sales Invoice',
  purchases: 'Purchase Bill',
  parties: 'Party',
  items: 'Item',
  payments: 'Payment / Voucher',
  receipts: 'Receipt',
  jobs: 'Mill / Job Challan',
  ledgers: 'Ledger',
  notes: 'Debit / Credit Note'
};

/** "Purchase Bill 6 · RAJA TEX · ₹851" — enough for the user to recognise the entry. */
const describe = (item) => {
  const p = item.payload || {};
  const no = p.invoiceNo || p.jobCardNo || p.challanNo || p.voucherNo || p.noteNo || '';
  const party = p.customerName || p.supplierName || p.partyName || p.customerId?.name || p.supplierId?.name || p.name || '';
  const amount = p.netAmount || p.amount || p.totalAmount;
  return [no && `No. ${no}`, party, amount ? `₹${Number(amount).toLocaleString('en-IN')}` : '', p.date || p.issueDate || p.entryDate || '']
    .filter(Boolean)
    .join(' · ');
};

const FailedSyncModal = ({ isOpen, onClose }) => {
  const [failed, setFailed] = useState([]);
  const [waiting, setWaiting] = useState([]);
  const [retrying, setRetrying] = useState(false);

  const refresh = useCallback(async () => {
    const [failedItems, waitingItems] = await Promise.all([getFailedSyncItems(), getWaitingSyncItems()]);
    setFailed(failedItems);
    setWaiting(waitingItems);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    refresh();
    const onQueue = () => refresh();
    window.addEventListener('erp-sync-queue-changed', onQueue);
    const unsub = subscribeNetworkStatus(() => refresh());
    return () => {
      unsub();
      window.removeEventListener('erp-sync-queue-changed', onQueue);
    };
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
  };

  // The sync run returns early (no onComplete) when offline or already running, so always re-enable.
  const run = async (fn) => {
    setRetrying(true);
    try {
      await fn();
    } finally {
      setRetrying(false);
      refresh();
    }
  };

  const handleDiscard = async (item) => {
    const ok = await erpConfirm({
      title: 'Discard this entry?',
      message: `${ENTITY_LABELS[item.entityType] || item.entityType} ${describe(item)}\n\nIt will NOT be saved on the cloud and is removed from this computer. Only do this if you have re-entered it or do not need it.`,
      confirmLabel: 'Discard',
      danger: true,
    });
    if (!ok) return;
    await discardSyncItem(item.id);
    refresh();
  };

  if (!isOpen) return null;

  const row = (item, kind) => (
    <div
      key={item.id}
      className={`flex items-start gap-3 p-3 rounded-xl border ${kind === 'failed' ? 'bg-rose-50 border-rose-100' : 'bg-amber-50 border-amber-100'}`}
    >
      {kind === 'failed'
        ? <AlertTriangle size={16} className="text-rose-500 mt-0.5 shrink-0" />
        : <Clock size={16} className="text-amber-600 mt-0.5 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-slate-800 uppercase">
          {ENTITY_LABELS[item.entityType] || item.entityType} · {item.action || 'create'}
        </p>
        <p className="text-[10px] text-slate-600 mt-0.5 break-words">{describe(item)}</p>
        <p className={`text-[10px] mt-1 break-words ${kind === 'failed' ? 'text-rose-600' : 'text-amber-700'}`}>
          {item.error || (kind === 'failed' ? 'Sync failed' : 'Waiting for internet')}
        </p>
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        {kind === 'failed' && (
          <button
            type="button"
            disabled={retrying}
            onClick={() => run(() => retrySyncItem(item.id, onSynced, null, onComplete))}
            className="px-2 py-1 text-[9px] font-black uppercase bg-white border border-rose-200 rounded-md hover:bg-rose-100 disabled:opacity-50"
          >
            Retry
          </button>
        )}
        <button
          type="button"
          disabled={retrying}
          onClick={() => handleDiscard(item)}
          title="Discard — not saved to cloud"
          className="px-2 py-1 text-[9px] font-black uppercase bg-white border border-slate-200 rounded-md hover:bg-slate-100 disabled:opacity-50 flex items-center gap-1"
        >
          <Trash2 size={10} /> Discard
        </button>
      </div>
    </div>
  );

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
              <p className="text-[10px] text-slate-500">{waiting.length} waiting · {failed.length} need attention</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-4 space-y-2">
          {failed.length === 0 && waiting.length === 0 && (
            <p className="text-center text-xs text-slate-400 py-8">All changes are synced.</p>
          )}
          {failed.length > 0 && (
            <p className="text-[10px] font-bold uppercase text-rose-700">
              Cloud refused these — correct the reason and Retry, or Discard
            </p>
          )}
          {failed.map((item) => row(item, 'failed'))}
          {waiting.length > 0 && (
            <p className="text-[10px] font-bold uppercase text-amber-700 pt-1">Waiting to upload (internet ON karein)</p>
          )}
          {waiting.map((item) => row(item, 'waiting'))}
        </div>

        <div className="flex gap-2 p-4 border-t border-slate-100 bg-slate-50">
          <button
            type="button"
            disabled={retrying || (failed.length === 0 && waiting.length === 0)}
            onClick={() => run(() => processSyncQueue(onSynced, null, onComplete))}
            className="flex-1 h-9 text-[10px] font-black uppercase rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <RefreshCw size={12} className={retrying ? 'animate-spin' : ''} />
            Sync Now
          </button>
          {failed.length > 0 && (
            <button
              type="button"
              disabled={retrying}
              onClick={() => run(() => retryAllFailed(onSynced, null, onComplete))}
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
