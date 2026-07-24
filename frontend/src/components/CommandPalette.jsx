import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useUiStore from '../store/useUiStore';
import useStore from '../store/useStore';
import useConfigStore from '../store/useConfigStore';
import ThemePicker from './ui/ThemePicker';
import { stage6Api } from '../api/stage6.api';

const RECENT_KEY = 'erp_cmd_recent_searches';

function loadLocalRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveLocalRecent(query) {
  const q = String(query || '').trim();
  if (!q) return;
  const prev = loadLocalRecent().filter((x) => x !== q);
  localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...prev].slice(0, 8)));
}

/**
 * Stage 6.1 — Global Search & Command Center (Ctrl+K / Ctrl+Space).
 * Server-backed search with offline local fallback.
 */
export default function CommandPalette() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const close = useUiStore((s) => s.closeCommandPalette);
  const query = useUiStore((s) => s.globalSearchQuery);
  const setQuery = useUiStore((s) => s.setGlobalSearchQuery);
  const inputRef = useRef(null);

  const parties = useStore((s) => s.parties);
  const items = useStore((s) => s.items);
  const sales = useStore((s) => s.sales);
  const purchases = useStore((s) => s.purchases);
  const companyName = useConfigStore((s) => s.company?.name || s.companySettings?.legalName || 'Company');
  const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

  const [active, setActive] = useState(0);
  const [remote, setRemote] = useState([]);
  const [pinned, setPinned] = useState([]);
  const [recentDocs, setRecentDocs] = useState([]);
  const [recentSearches, setRecentSearches] = useState(loadLocalRecent);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setRemote([]);
      setRecentSearches(loadLocalRecent());
      setTimeout(() => inputRef.current?.focus(), 50);
      stage6Api
        .productivity()
        .then((d) => {
          setPinned(d?.prefs?.pinnedRecords || []);
          setRecentDocs(d?.prefs?.recentDocuments || d?.recentBills || []);
        })
        .catch(() => {});
    }
  }, [open, setQuery]);

  const staticActions = useMemo(
    () => [
      { id: 'sales', label: 'Open Sales', group: 'Modules', modal: 'sales', kind: 'action' },
      { id: 'purchase', label: 'Open Purchase', group: 'Modules', modal: 'purchase', kind: 'action' },
      { id: 'receipt', label: 'Bank Receipt', group: 'Modules', modal: 'receipt', kind: 'action' },
      { id: 'payment', label: 'Bank Payment', group: 'Modules', modal: 'payment', kind: 'action' },
      { id: 'inventory', label: 'Stock Ledger', group: 'Modules', modal: 'inventoryPage', kind: 'action' },
      { id: 'outstanding', label: 'Outstanding', group: 'Reports', modal: 'outstanding', kind: 'action' },
      { id: 'gstr1', label: 'GSTR-1', group: 'GST', modal: 'gstr1', kind: 'action' },
      { id: 'ca', label: 'CA Desk', group: 'GST', modal: 'caDashboard', kind: 'action' },
      { id: 'ledger', label: 'Open Ledger', group: 'Accounting', modal: 'ledger', kind: 'action' },
      { id: 'party', label: 'Create Party', group: 'Masters', modal: 'accountMaster', kind: 'action' },
      { id: 'item', label: 'Create Item', group: 'Masters', modal: 'itemMaster', kind: 'action' },
      { id: 'reports', label: 'Reports Hub', group: 'Reports', modal: 'reportsHub', kind: 'action' },
      { id: 'enterprise', label: 'Enterprise Platform', group: 'Analytics', modal: 'enterprisePlatform', kind: 'action' },
      { id: 'settings', label: 'Company Settings', group: 'Setup', modal: 'companySettings', kind: 'action' },
    ],
    []
  );

  const localResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = [];
    staticActions.forEach((a) => {
      if (!q || a.label.toLowerCase().includes(q) || a.group.toLowerCase().includes(q)) {
        rows.push(a);
      }
    });
    if (q.length >= 1) {
      parties.slice(0, 40).forEach((p) => {
        if ((p.name || '').toLowerCase().includes(q)) {
          rows.push({
            id: `party-${p._id || p.id}`,
            label: p.name,
            group: 'Parties',
            kind: 'party',
            modal: 'accountMaster',
            recordId: p._id || p.id,
          });
        }
      });
      items.slice(0, 40).forEach((it) => {
        if ((it.name || '').toLowerCase().includes(q)) {
          rows.push({
            id: `item-${it._id || it.id}`,
            label: it.name,
            group: 'Items',
            kind: 'item',
            modal: 'itemMaster',
            recordId: it._id || it.id,
          });
        }
      });
      sales.slice(0, 20).forEach((s) => {
        const no = String(s.invoiceNo || '');
        if (no.toLowerCase().includes(q)) {
          rows.push({
            id: `sale-${s._id || s.id}`,
            label: `Sale ${no}`,
            group: 'Sales',
            kind: 'sales',
            modal: 'sales',
            recordId: s._id || s.id,
          });
        }
      });
      purchases.slice(0, 20).forEach((p) => {
        const no = String(p.invoiceNo || p.billNo || '');
        if (no.toLowerCase().includes(q)) {
          rows.push({
            id: `pur-${p._id || p.id}`,
            label: `Purchase ${no}`,
            group: 'Purchases',
            kind: 'purchase',
            modal: 'purchase',
            recordId: p._id || p.id,
          });
        }
      });
    }
    return rows;
  }, [staticActions, query, parties, items, sales, purchases]);

  const fetchRemote = useCallback(
    async (q) => {
      if (!q || q.length < 1 || !isOnline) {
        setRemote([]);
        return;
      }
      setLoading(true);
      try {
        const data = await stage6Api.search(q, { limit: 10 });
        const items = (data?.items || []).map((r) => ({
          id: r.id || `${r.kind}-${r.label}`,
          label: r.label,
          group: r.group || r.kind,
          kind: r.kind,
          modal: r.modal,
          meta: r.meta,
          recordId: r.id,
        }));
        setRemote(items);
      } catch {
        setRemote([]);
      } finally {
        setLoading(false);
      }
    },
    [isOnline]
  );

  useEffect(() => {
    const q = query.trim();
    const t = setTimeout(() => fetchRemote(q), 220);
    return () => clearTimeout(t);
  }, [query, fetchRemote]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) {
      const pins = pinned.map((p) => ({
        id: `pin-${p.id}`,
        label: p.label || 'Pinned',
        group: 'Pinned',
        kind: p.kind,
        modal: p.modal || 'accountMaster',
        recordId: p.id,
      }));
      const recent = recentDocs.slice(0, 8).map((d) => ({
        id: `doc-${d.id}`,
        label: d.label || 'Document',
        group: 'Recent Documents',
        kind: d.kind,
        modal: d.modal || (d.kind === 'purchase' ? 'purchase' : 'sales'),
        recordId: d.id,
      }));
      const searches = recentSearches.map((s) => ({
        id: `rs-${s}`,
        label: s,
        group: 'Recent Searches',
        kind: 'search',
        modal: null,
        isSearchReplay: true,
      }));
      return [...pins, ...recent, ...searches, ...staticActions].slice(0, 40);
    }
    const seen = new Set();
    const merged = [];
    for (const row of [...remote, ...localResults]) {
      const key = String(row.id);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(row);
    }
    return merged.slice(0, 40);
  }, [query, remote, localResults, pinned, recentDocs, recentSearches, staticActions]);

  useEffect(() => {
    setActive(0);
  }, [query, results.length]);

  if (!open) return null;

  const run = (row) => {
    if (!row) return;
    if (row.isSearchReplay) {
      setQuery(row.label);
      return;
    }
    if (query.trim()) saveLocalRecent(query.trim());
    if (row.recordId && row.kind && row.kind !== 'action') {
      stage6Api.touch({ kind: row.kind, id: row.recordId, label: row.label, modal: row.modal }).catch(() => {});
    }
    if (row.modal) {
      window.dispatchEvent(
        new CustomEvent('erp:open-modal', { detail: { modal: row.modal, row } })
      );
    }
    close();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      run(results[active]);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[99998] flex items-start justify-center pt-[12vh] bg-black/40"
      data-command-palette
      onClick={close}
    >
      <div
        className="w-[min(640px,92vw)] bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command search"
      >
        <div className="px-4 py-3 border-b border-slate-100">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={`Search ${companyName} — parties, items, invoices, lots, modules…`}
            className="w-full text-[13px] font-medium outline-none bg-transparent"
          />
          <p className="mt-1 text-[10px] text-slate-400 uppercase tracking-wider">
            Ctrl+K · Ctrl+Space · Esc to close
            {loading ? ' · Searching…' : !isOnline ? ' · Offline local' : ''}
          </p>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto py-1">
          {results.length === 0 && (
            <li className="px-4 py-6 text-[12px] text-slate-500 text-center">No matches</li>
          )}
          {results.map((row, idx) => (
            <li key={row.id}>
              <button
                type="button"
                className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 text-[12px] ${
                  idx === active ? 'bg-slate-900 text-white' : 'hover:bg-slate-50 text-slate-800'
                }`}
                onMouseEnter={() => setActive(idx)}
                onClick={() => run(row)}
              >
                <span className="font-semibold truncate">
                  {row.label}
                  {row.meta ? (
                    <span className={`ml-2 font-normal ${idx === active ? 'text-slate-300' : 'text-slate-400'}`}>
                      {row.meta}
                    </span>
                  ) : null}
                </span>
                <span
                  className={`text-[10px] uppercase tracking-wide shrink-0 ${
                    idx === active ? 'text-slate-300' : 'text-slate-400'
                  }`}
                >
                  {row.group}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="px-4 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
          <ThemePicker />
        </div>
      </div>
    </div>
  );
}
