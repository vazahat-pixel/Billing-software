import React, { useEffect, useMemo, useRef, useState } from 'react';
import ErpFindOverlay from './ErpFindOverlay';

/**
 * F3 list for master screens (as JSM): every saved entry, type to filter, ↑/↓ (or + / −) to move,
 * Enter opens it, Esc closes. rows: [{ id, no, name, meta }].
 */
export default function MasterFindOverlay({ open, title = 'FIND', rows = [], onPick, onClose, countLabel = 'entries' }) {
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setActive(0);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? rows.filter((r) => `${r.name} ${r.no} ${r.meta || ''}`.toLowerCase().includes(q))
      : rows;
    return list.map((r) => ({ id: r.id, no: r.no || '—', party: r.name, meta: r.meta || '', amount: r.right || '' }));
  }, [rows, search]);

  useEffect(() => { setActive((i) => Math.min(i, Math.max(0, shown.length - 1))); }, [shown.length]);

  if (!open) return null;

  const pick = (row) => { if (row) onPick?.(row.id); };
  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose?.(); return; }
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); pick(shown[active]); return; }
    const step = { ArrowDown: 1, ArrowUp: -1, PageDown: 10, PageUp: -10, '+': 1, '-': -1 }[e.key];
    const plusMinus = e.key === '+' || e.key === '-';
    // + / − move only while nothing is typed (otherwise they are part of the search text)
    if (step && (!plusMinus || !search)) {
      e.preventDefault(); e.stopPropagation();
      setActive((i) => Math.max(0, Math.min(shown.length - 1, i + step)));
      return;
    }
    if (e.key === 'Home' && !search) { e.preventDefault(); setActive(0); }
    if (e.key === 'End' && !search) { e.preventDefault(); setActive(Math.max(0, shown.length - 1)); }
  };

  return (
    <ErpFindOverlay
      title={title}
      search={search}
      onSearch={(v) => { setSearch(v); setActive(0); }}
      inputRef={inputRef}
      onKeyDown={onKeyDown}
      countLabel={countLabel}
      label="Name:"
      placeholder="Type name or code · ↑ ↓ · Enter"
      rows={shown}
      activeIdx={active}
      onSelect={pick}
      onClose={onClose}
    />
  );
}
