import React, { useEffect, useMemo, useRef, useState } from 'react';
import { jsmColor, jsmFont } from './JsmFormCanvas';

/**
 * JSM's Help list (Help_Lst_Vw4): type to narrow the names, ↑/↓ to move, Enter to open,
 * F4 to open for editing, ← for New, Esc to close.
 * match = 'starts' (Find) or 'contains' (Sp.Find).
 */
export default function JsmFindList({ layout, items, match = 'starts', onPick, onNew, onClose }) {
  const [q, setQ] = useState('');
  const [at, setAt] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const byName = (n) => layout.controls.find((c) => c.n === n) || {};
  const title = byName('Label1');
  const box = byName('txt_find');
  const list = byName('lst_find');
  const foot = byName('lbl_bottom_Information');

  const rows = useMemo(() => {
    const s = q.trim().toUpperCase();
    const sorted = [...items].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    if (!s) return sorted;
    return sorted.filter((r) => {
      const n = String(r.name || '').toUpperCase();
      return match === 'contains' ? n.includes(s) : n.startsWith(s);
    });
  }, [items, q, match]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setAt(0); }, [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-row="${at}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [at]);

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAt((i) => Math.min(i + 1, rows.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAt((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (rows[at]) onPick(rows[at], false); }
    else if (e.key === 'F4') { e.preventDefault(); if (rows[at]) onPick(rows[at], true); }
    else if (e.key === 'ArrowLeft' && !q) { e.preventDefault(); onNew?.(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose?.(); }
  };

  const pos = (c) => ({ position: 'absolute', left: c.x, top: c.y, width: c.w, height: c.h, ...jsmFont(c.font) });
  return (
    <div className="jsm-find-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="jsm-find" style={{ position: 'relative', width: layout.w, height: layout.h, background: jsmColor(layout.back) }} onKeyDown={onKeyDown}>
        <div style={{ ...pos(title), background: jsmColor(title.back), color: jsmColor(title.fore), paddingLeft: 6, lineHeight: `${title.h}px` }}>{title.text}</div>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="jsm-input"
          style={{ ...pos(box), background: jsmColor(box.back), color: jsmColor(box.fore) }}
          autoComplete="off"
          spellCheck={false}
        />
        <div ref={listRef} className="jsm-listbox" style={{ ...pos(list), background: jsmColor(list.back) }}>
          {rows.map((r, i) => (
            <div
              key={r._id}
              data-row={i}
              className={i === at ? 'jsm-listbox-row jsm-listbox-row--sel' : 'jsm-listbox-row'}
              onMouseDown={() => setAt(i)}
              onDoubleClick={() => onPick(r, false)}
            >
              {r.name}
            </div>
          ))}
        </div>
        <div style={{ ...pos(foot), background: jsmColor(foot.back), color: jsmColor(foot.fore), paddingLeft: 6, lineHeight: `${foot.h}px` }}>{foot.text}</div>
      </div>
    </div>
  );
}
