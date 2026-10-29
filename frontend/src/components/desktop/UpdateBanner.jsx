import React, { useEffect, useState } from 'react';

/**
 * Desktop app only: shows when a new version is downloading / ready, with what's new and "Update now".
 * The desktop side (desktop/updater.js) checks the server every 30 minutes and downloads in the background.
 */
const bridge = () => (typeof window !== 'undefined' ? window.textileDesktop?.update : null);

const noteLines = (notes) =>
  String(notes || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(#+|[-*•]|\d+\.)\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 30);

export default function UpdateBanner() {
  const [st, setSt] = useState(null);
  const [hidden, setHidden] = useState(false);
  const [showNotes, setShowNotes] = useState(true);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const up = bridge();
    if (!up) return undefined;
    let alive = true;
    const apply = (s) => {
      if (!alive || !s) return;
      setSt(s);
      if (s.manual) setHidden(false); // a check the user asked for always shows its answer
    };
    up.getState().then(apply).catch(() => {});
    const off = up.onState(apply);
    return () => { alive = false; off?.(); };
  }, []);

  // "Checking / latest / could not check" answers go away by themselves.
  useEffect(() => {
    if (!st?.manual || !['none', 'error'].includes(st.status)) return undefined;
    const t = setTimeout(() => setSt((s) => (s === st ? { ...s, manual: false } : s)), st.status === 'error' ? 7000 : 4000);
    return () => clearTimeout(t);
  }, [st]);

  const up = bridge();
  if (!up || !st) return null;
  const { status, version, notes, percent, current, manual, error } = st;
  const lines = noteLines(notes);

  const box = 'fixed z-[100000] right-24 bottom-12 w-[380px] max-w-[calc(100vw-32px)] bg-white border border-slate-300 rounded-lg shadow-2xl text-slate-800';

  if (status === 'checking' && manual) {
    return <div className={`${box} px-4 py-3 text-[12px] font-semibold`}>Checking for updates…</div>;
  }
  if (status === 'none' && manual) {
    return <div className={`${box} px-4 py-3 text-[12px] font-semibold text-emerald-800`}>You have the latest version ({current}).</div>;
  }
  if (status === 'error' && manual) {
    return <div className={`${box} px-4 py-3 text-[12px] font-semibold text-red-700`}>{error || 'Could not check for updates.'}</div>;
  }
  if (status !== 'downloading' && status !== 'downloaded') return null;

  const ready = status === 'downloaded';
  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => setHidden(false)}
        className="fixed z-[100000] right-24 bottom-12 px-3 py-1.5 rounded-full bg-blue-700 text-white text-[11px] font-bold shadow-lg hover:bg-blue-800"
      >
        {ready ? `Update ready: ${version}` : `Downloading update ${percent || 0}%`}
      </button>
    );
  }

  return (
    <div className={box} role="status">
      <div className="px-4 pt-3 pb-2 border-b border-slate-200">
        <div className="text-[13px] font-bold text-blue-800">
          {ready ? `New version ${version} is ready` : `New version ${version} is downloading…`}
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5">You have {current}. Your data stays as it is.</div>
        {!ready && (
          <div className="mt-2 h-1.5 bg-slate-200 rounded overflow-hidden">
            <div className="h-full bg-blue-600 transition-all" style={{ width: `${Math.max(3, percent || 0)}%` }} />
          </div>
        )}
      </div>
      {lines.length > 0 && (
        <div className="px-4 py-2">
          <button type="button" onClick={() => setShowNotes((v) => !v)} className="text-[11px] font-bold text-slate-700 hover:underline">
            {showNotes ? '▾' : '▸'} What's new
          </button>
          {showNotes && (
            <ul className="mt-1 max-h-48 overflow-y-auto list-disc pl-5 text-[11px] text-slate-700 space-y-0.5">
              {lines.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          )}
        </div>
      )}
      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 rounded-b-lg flex items-center gap-2">
        {ready ? (
          <>
            <button
              type="button"
              disabled={installing}
              onClick={() => { setInstalling(true); up.install().then((ok) => { if (!ok) setInstalling(false); }).catch(() => setInstalling(false)); }}
              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-[11px] font-bold rounded"
            >
              {installing ? 'Updating…' : 'Update now'}
            </button>
            <span className="text-[10px] text-slate-500 flex-1">Save open entries first. The app closes and opens again by itself.</span>
          </>
        ) : (
          <span className="text-[10px] text-slate-500 flex-1">You can keep working. We will tell you when it is ready.</span>
        )}
        <button type="button" onClick={() => setHidden(true)} className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900">
          Later
        </button>
      </div>
    </div>
  );
}
