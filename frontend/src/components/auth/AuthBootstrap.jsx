import React, { useEffect, useRef } from 'react';
import useStore from '../../store/useStore';
import { initSyncListener } from '../../utils/syncQueue';
import { subscribeNetworkStatus, isOffline as isNetworkOffline } from '../../utils/networkStatus';
import SessionExpiredModal from './SessionExpiredModal';
import { useLocalApiAsSourceOfTruth, isDesktopShell } from '../../utils/desktopMode';
import { notifySuccess, notifyWarning } from '../../utils/notify';

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

    const onComplete = ({ synced, needsInventoryRefresh, renumbered = [] }) => {
      const store = useStore.getState();
      if (needsInventoryRefresh) store.fetchInventory();
      if (synced > 0) {
        store.fetchJobs?.();
        store.fetchVouchers?.();
        store.fetchNotes?.();
      }
      // The cloud already had this number (made online meanwhile): the offline entry took the next one.
      const LABEL = { sales: 'Sale bill', purchases: 'Purchase', jobs: 'Challan' };
      for (const n of renumbered) {
        notifyWarning(
          `Offline ${LABEL[n.entityType] || 'entry'} ${n.from} was saved on cloud as ${n.to} (number ${n.from} was already used). Reprint it if you printed it offline.`,
          { duration: 15000 }
        );
      }
      if (renumbered.length) {
        try {
          const log = JSON.parse(localStorage.getItem('erp_sync_renumbered') || '[]');
          const at = new Date().toISOString();
          localStorage.setItem('erp_sync_renumbered', JSON.stringify([...renumbered.map((n) => ({ ...n, at })), ...log].slice(0, 200)));
        } catch { /* ignore */ }
      }
      if (synced > 0) notifySuccess(`${synced} offline ${synced === 1 ? 'entry' : 'entries'} uploaded to cloud`);
    };

    return initSyncListener(onSynced, null, onComplete);
  }, [token, desktopLocal]);

  // Browser: warn before leaving while offline entries are still waiting to upload. (The desktop
  // app warns from its own close/quit handler — a beforeunload there would silently block quitting.)
  useEffect(() => {
    if (desktopLocal || isDesktopShell()) return undefined;
    let pending = 0;
    const onQueue = (e) => { pending = Number(e.detail?.pending) || 0; };
    const onBeforeUnload = (e) => {
      if (pending <= 0) return undefined;
      e.preventDefault();
      e.returnValue = 'Offline entries are not uploaded yet. Turn the internet on before closing.';
      return e.returnValue;
    };
    window.addEventListener('erp-sync-queue-changed', onQueue);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('erp-sync-queue-changed', onQueue);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [desktopLocal]);

  useEffect(() => {
    if (desktopLocal) return undefined;
    return subscribeNetworkStatus(({ isOffline }) => {
      if (isOffline && useStore.getState().token) {
        useStore.getState().hydrateFromCache();
      }
    });
  }, [desktopLocal]);

  // Renewed login token (API client refresh): keep the store in step.
  useEffect(() => {
    const onRefreshed = (e) => {
      if (e.detail?.token) useStore.setState({ token: e.detail.token });
    };
    window.addEventListener('erp-token-refreshed', onRefreshed);
    return () => window.removeEventListener('erp-token-refreshed', onRefreshed);
  }, []);

  // Several devices on one account: when the app comes back to the front after a while (next
  // morning, after working on another PC), reload from the cloud so their entries show here.
  useEffect(() => {
    if (desktopLocal) return undefined;
    const STALE_MS = 5 * 60 * 1000;
    let hiddenAt = document.visibilityState === 'hidden' ? Date.now() : null;
    let blurredAt = null;
    const reload = () => {
      const st = useStore.getState();
      if (!st.token || isNetworkOffline()) return;
      st.refreshAllData?.().catch(() => {});
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
      } else if (hiddenAt && Date.now() - hiddenAt > STALE_MS) {
        hiddenAt = null;
        reload();
      } else {
        hiddenAt = null;
      }
    };
    // Electron tray hide/show does not always change visibility; window focus covers it.
    const onBlur = () => { blurredAt = Date.now(); };
    const onFocus = () => {
      if (blurredAt && Date.now() - blurredAt > STALE_MS) reload();
      blurredAt = null;
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
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

  return (
    <div className="erp-motion-fade-in min-h-full">
      {children}
      <SessionExpiredModal />
    </div>
  );
};

export default AuthBootstrap;
