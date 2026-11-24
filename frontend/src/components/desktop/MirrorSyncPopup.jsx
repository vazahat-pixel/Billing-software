import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, CloudUpload } from 'lucide-react';
import api from '../../api/client';

const POLL_MS = 4000;
const POLL_BUSY_MS = 1200;
const DONE_SHOW_MS = 10000;

/**
 * Offline (mirrored) desktop only. When the internet comes back with entries waiting, says that they
 * are being uploaded and to wait before shutting the PC down, then that everything has reached the
 * cloud. Entries the cloud refused (e.g. a bill number also used on the web) are listed until fixed.
 * Never takes the keyboard focus and never covers the form: work carries on underneath.
 */
export default function MirrorSyncPopup() {
  const [view, setView] = useState(null); // { kind: 'syncing' | 'done' | 'problem', ... }
  const armed = useRef(false); // entries were waiting without internet (or when the app opened)
  const total = useRef(0);
  const hiddenProblem = useRef('');

  useEffect(() => {
    let live = true;
    let timer = null;
    let doneTimer = null;
    let first = true;
    let cameOnlineAt = 0;

    const poll = async () => {
      clearTimeout(timer);
      let next = POLL_MS;
      try {
        const res = await api.get('/sync/mirror/status', { skipAuthRedirect: true });
        if (!live) return;
        const s = res.data?.data || {};
        const pending = Number(s.pending) || 0;
        const failing = s.failing || [];
        const offline = s.online === false && !s.progress;
        if (s.snapshot?.state === 'done') {
          if (pending > 0 && (offline || first)) armed.current = true;
          first = false;
          if (armed.current) total.current = Math.max(total.current, pending);

          // Until a round that began after the internet came back has finished and said otherwise.
          const triedSince = s.lastTickAt && new Date(s.lastTickAt).getTime() > cameOnlineAt + 1500;
          const justOnline = cameOnlineAt > 0 && Date.now() - cameOnlineAt < 60000 && !(triedSince && offline);
          const refused = Number(s.failingCount ?? failing.length) || 0;
          const onlyRefused = pending > 0 && refused >= pending && !s.progress;
          const problemKey = failing.map((f) => `${f.collection}:${f.label || ''}:${f.code}`).join('|');

          if (armed.current && !onlyRefused && (s.progress || (pending > 0 && (justOnline || !offline)))) {
            const sent = Math.max(0, total.current - pending);
            setView({ kind: 'syncing', sent, total: total.current });
            next = POLL_BUSY_MS;
          } else if (failing.length && !s.progress) {
            armed.current = false;
            total.current = 0;
            setView(hiddenProblem.current === problemKey ? null : { kind: 'problem', failing, problemKey });
          } else if (armed.current && pending === 0 && s.online === true) {
            const sent = total.current;
            armed.current = false;
            total.current = 0;
            hiddenProblem.current = '';
            setView({ kind: 'done', sent });
            clearTimeout(doneTimer);
            doneTimer = setTimeout(() => live && setView((v) => (v?.kind === 'done' ? null : v)), DONE_SHOW_MS);
          } else {
            setView((v) => (v?.kind === 'done' ? v : null));
          }
        }
      } catch {
        /* not a mirrored desktop, or the local API is restarting: try again quietly */
        next = 10000;
      }
      if (live) timer = setTimeout(poll, next);
    };

    const onOnline = () => {
      cameOnlineAt = Date.now();
      api.post('/sync/mirror/retry', {}).catch(() => {}); // upload now, not at the next round
      poll();
    };
    window.addEventListener('online', onOnline);
    poll();
    return () => {
      live = false;
      clearTimeout(timer);
      clearTimeout(doneTimer);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  if (!view) return null;

  const close = () => {
    if (view.kind === 'problem') hiddenProblem.current = view.problemKey;
    setView(null);
  };
  const pct = view.total ? Math.min(100, Math.round((view.sent / view.total) * 100)) : 0;
  const tone = view.kind === 'done' ? '#059669' : view.kind === 'problem' ? '#b45309' : '#1d4ed8';

  return (
    <div
      role="status"
      aria-live="polite"
      data-mirror-sync={view.kind}
      data-enter-skip="true"
      style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 10070, width: 440, maxWidth: 'calc(100vw - 32px)', background: '#fff', color: '#0f172a', border: `1px solid ${tone}`, borderLeft: `6px solid ${tone}`, borderRadius: 8, boxShadow: '0 14px 36px rgba(15,23,42,.28)', padding: '12px 14px' }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ color: tone, marginTop: 1 }}>
          {view.kind === 'done' ? <CheckCircle2 size={20} /> : view.kind === 'problem' ? <AlertTriangle size={20} /> : <CloudUpload size={20} />}
        </span>
        <div style={{ flex: 1, fontSize: 13, lineHeight: 1.45 }}>
          {view.kind === 'syncing' && (
            <>
              <strong>Syncing your data to the cloud… please wait</strong>
              <div>The internet is back and your entries are uploading automatically. Please do not close the app or shut down the PC until this is finished.</div>
              <div style={{ height: 6, background: '#e2e8f0', borderRadius: 4, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: tone, transition: 'width .3s' }} />
              </div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{view.sent} / {view.total} ({pct}%)</div>
            </>
          )}
          {view.kind === 'done' && (
            <>
              <strong>All data has been synced to the cloud ✓</strong>
              <div>{view.sent > 0 ? `${view.sent} ${view.sent === 1 ? 'change' : 'changes'} uploaded. ` : ''}You can now close the app and shut down the PC.</div>
            </>
          )}
          {view.kind === 'problem' && (
            <>
              <strong>{view.failing.length} {view.failing.length === 1 ? 'entry was' : 'entries were'} not synced to the cloud</strong>
              <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                {view.failing.slice(0, 4).map((f) => (
                  <li key={`${f.collection}-${f.label}-${f.code}`}>{f.help || f.message}</li>
                ))}
              </ul>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>Nothing is lost: it is saved on this PC. Please contact support.</div>
            </>
          )}
        </div>
        <button type="button" tabIndex={-1} onClick={close} aria-label="Hide" style={{ border: 0, background: 'transparent', fontSize: 18, lineHeight: 1, color: '#64748b', cursor: 'pointer' }}>×</button>
      </div>
    </div>
  );
}
