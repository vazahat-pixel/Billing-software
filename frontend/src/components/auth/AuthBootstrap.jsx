import React, { useEffect, useRef } from 'react';
import useStore from '../../store/useStore';
import { initSyncListener } from '../../utils/syncQueue';
import { subscribeNetworkStatus } from '../../utils/networkStatus';
import { useLocalApiAsSourceOfTruth } from '../../utils/desktopMode';

const AuthBootstrap = ({ children }) => {
  const { sessionReady, bootstrapMasters, token } = useStore();
  const mastersBootedRef = useRef(false);
  const desktopLocal = useLocalApiAsSourceOfTruth();

  useEffect(() => {
    if (!sessionReady || !token) {
      mastersBootedRef.current = false;
      return;
    }
    if (mastersBootedRef.current) return;
    mastersBootedRef.current = true;
    bootstrapMasters();
  }, [sessionReady, token, bootstrapMasters]);

  useEffect(() => {
    if (!token || desktopLocal) return undefined;

    const onSynced = (entityType, synced, localId, action) => {
      const store = useStore.getState();
      const keyMap = {
        sales: 'sales',
        purchases: 'purchases',
        parties: 'parties',
        items: 'items',
        payments: 'payments',
        receipts: 'receipts',
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
          ...(entityType === 'receipts' ? [synced, ...store.receipts] : store.receipts),
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
  }, [token, desktopLocal]);

  useEffect(() => {
    if (desktopLocal) return undefined;
    return subscribeNetworkStatus(({ isOffline }) => {
      if (isOffline && useStore.getState().token) {
        useStore.getState().hydrateFromCache();
      }
    });
  }, [desktopLocal]);

  if (!sessionReady) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--bg-base)] erp-motion-fade-in">
        <div className="h-9 w-9 rounded-full border-2 border-[var(--border)] border-t-[var(--color-primary)] animate-spin" />
        <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[var(--text-muted)]">
          Loading ERP…
        </p>
      </div>
    );
  }

  return <div className="erp-motion-fade-in min-h-full">{children}</div>;
};

export default AuthBootstrap;
