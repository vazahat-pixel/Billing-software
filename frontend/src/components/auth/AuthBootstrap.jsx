import React, { useEffect } from 'react';
import useStore from '../../store/useStore';
import { initSyncListener } from '../../utils/syncQueue';
import { subscribeNetworkStatus } from '../../utils/networkStatus';

const AuthBootstrap = ({ children }) => {
  const { sessionReady, restoreSession, bootstrapMasters, token } = useStore();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    if (sessionReady && token) {
      bootstrapMasters();
    }
  }, [sessionReady, token, bootstrapMasters]);

  useEffect(() => {
    if (!token) return undefined;

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
      if (entityType === 'payments' || entityType === 'receipts') {
        const vouchers = [
          ...(entityType === 'payments' ? [synced, ...store.payments] : store.payments),
          ...(entityType === 'receipts' ? [synced, ...store.receipts] : store.receipts)
        ].filter((v, i, arr) => arr.findIndex((x) => (x.id || x._id) === (v.id || v._id)) === i);
        useStore.setState({ vouchers });
      }
    };

    const onComplete = ({ needsInventoryRefresh }) => {
      if (needsInventoryRefresh) {
        useStore.getState().fetchInventory();
      }
    };

    return initSyncListener(onSynced, null, onComplete);
  }, [token]);

  useEffect(() => {
    return subscribeNetworkStatus(({ isOffline }) => {
      if (isOffline && useStore.getState().token) {
        useStore.getState().hydrateFromCache();
      }
    });
  }, []);

  if (!sessionReady) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Loading ERP...</p>
      </div>
    );
  }

  return children;
};

export default AuthBootstrap;
