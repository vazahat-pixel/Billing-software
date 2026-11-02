import React, { useEffect, useRef, useState } from 'react';
import api from '../../api/client';
import useStore from '../../store/useStore';

/**
 * Desktop (mirrored) only: covers the screen while the company is being downloaded from the cloud.
 * The local API refuses entries until the download is complete, so this explains the wait instead
 * of letting a save fail. Disappears by itself when done.
 */
export default function MirrorDownloadOverlay() {
  const [snap, setSnap] = useState(null);
  const wasRunning = useRef(false);

  useEffect(() => {
    let live = true;
    let timer = null;
    const poll = async () => {
      try {
        const res = await api.get('/sync/mirror/status', { skipAuthRedirect: true });
        const s = res.data?.data?.snapshot || null;
        if (!live) return;
        setSnap(s);
        if (s && s.state !== 'done') {
          wasRunning.current = true;
          timer = setTimeout(poll, 1500);
        } else if (wasRunning.current) {
          wasRunning.current = false;
          useStore.getState().refreshAllData?.().catch(() => {});
        }
      } catch {
        // Not a mirrored desktop (404) or API not up yet — check again shortly, then give up quietly.
        if (live) timer = setTimeout(poll, 5000);
      }
    };
    poll();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, []);

  if (!snap || snap.state === 'done') return null;

  const total = Number(snap.total || 0);
  const done = Number(snap.done || 0);
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const failed = snap.state === 'failed';

  const retry = async () => {
    setSnap({ ...snap, state: 'running', error: null });
    try {
      await api.post('/sync/mirror/retry', {});
    } catch { /* the next poll shows the result */ }
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-[var(--bg-base)]/95">
      <div className="w-full max-w-md mx-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-2xl text-center">
        <h2 className="text-lg font-semibold text-[var(--text-base)]">
          {failed ? 'Company data could not be downloaded' : 'Downloading your company data'}
        </h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          {failed
            ? 'Check the internet connection and try again. Nothing on the cloud has been changed.'
            : 'This computer is getting an exact copy of your company from the cloud. Entries can be made as soon as it finishes — this happens only once.'}
        </p>

        {!failed && (
          <>
            <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
              <div className="h-full bg-[var(--color-primary)] transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              {total > 0 ? `${done.toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')} records (${pct}%)` : 'Starting…'}
            </p>
          </>
        )}

        {failed && (
          <>
            {snap.error && <p className="mt-3 text-xs text-[var(--color-danger)] break-words">{snap.error}</p>}
            <button
              type="button"
              onClick={retry}
              className="mt-5 px-5 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold"
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
