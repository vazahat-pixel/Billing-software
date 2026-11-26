import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { buildGridLines, layoutColumns } from './jcGrid';
import { accel } from './winforms';

/** JSM "Report Control" window (AA_Rpt_GridReport_JC): grid + bottom bar, sizes from its .resources. */
const BUTTONS = [
  { name: 'btn_columnset', text: '&ColumnSet', x: 6, w: 90, back: '#c8c8c8' },
  { name: 'btn_Excel', text: 'Exce&l', x: 495, w: 78 },
  { name: 'btn_screen', text: 'Pre&View', x: 579, w: 78 },
  { name: 'btn_print', text: '&Print', x: 833, w: 78 },
  { name: 'btn_exit', text: '&Exit', x: 918, w: 78 },
];

function Btn({ b, onClick }) {
  const { text, index } = accel(b.text);
  return (
    <button type="button" className="jsmg-button" style={{ left: b.x, width: b.w, background: b.back }} onClick={onClick}>
      {text.slice(0, index)}<u>{text[index]}</u>{text.slice(index + 1)}
    </button>
  );
}

export default function JsmGridReport({ result, layouts, fallbackColumns, companyName, onClose, onOpenRow, onExcel }) {
  const { rows = [], grid = {} } = result || {};
  const allColumns = useMemo(
    () => layoutColumns(layouts, grid.layout, grid.variant, {
      captions: grid.captions, fallback: fallbackColumns?.[grid.layout],
    }),
    [layouts, grid, fallbackColumns]
  );
  const [hidden, setHidden] = useState(() => new Set());
  const [setOpen, setSetOpen] = useState(false);
  const [selected, setSelected] = useState(-1);
  const columns = allColumns.filter((c) => !hidden.has(c.field));
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);
  const shownRows = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return rows;
    return rows.filter((r) => Object.values(r || {}).some((v) => v != null && typeof v !== 'object' && String(v).toUpperCase().includes(q)));
  }, [rows, query]);
  const lines = useMemo(() => buildGridLines(shownRows, columns, grid), [shownRows, columns, grid]);

  const exportExcel = () => {
    if (typeof onExcel === 'function' && onExcel(result) !== false) return;
    const aoa = [columns.map((c) => c.caption), ...lines.map((l) => l.cells)];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `${(grid.title || 'Report').replace(/[^\w ]+/g, '')}.xlsx`);
  };

  // The grid holds the keyboard as soon as the report opens: Up/Down (PgUp/PgDn, Home/End) walk the rows,
  // Left/Right slide the columns, Enter opens the row's voucher, Tab reaches the buttons (Left/Right there).
  const winRef = useRef(null);
  const gridRef = useRef(null);
  useEffect(() => {
    const t = setTimeout(() => winRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);
  const onKey = (e) => {
    if (e.target === searchRef.current) {
      if (e.key === 'Escape') { e.preventDefault(); if (query) setQuery(''); else winRef.current?.focus(); return; }
      if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); setSelected(0); winRef.current?.focus(); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); onClose?.(); return; }
    const onGrid = e.target === winRef.current;
    // Typing a letter or digit on the grid starts a search (Ctrl+F also opens it).
    if (onGrid && ((e.key.length === 1 && !e.altKey && !e.ctrlKey && e.key !== ' ') || (e.ctrlKey && e.key.toLowerCase() === 'f'))) {
      e.preventDefault();
      if (e.key.length === 1 && !e.ctrlKey) setQuery((q) => q + e.key);
      setTimeout(() => searchRef.current?.focus(), 0);
      return;
    }
    if (onGrid && !e.altKey && !e.ctrlKey) {
      const last = lines.length - 1;
      const step = { ArrowDown: 1, ArrowUp: -1, PageDown: 20, PageUp: -20 }[e.key];
      if (step) { e.preventDefault(); setSelected((s) => Math.max(0, Math.min(last, (s < 0 ? -1 : s) + step))); return; }
      if (e.key === 'Home') { e.preventDefault(); setSelected(0); return; }
      if (e.key === 'End') { e.preventDefault(); setSelected(last); return; }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        gridRef.current?.scrollBy({ left: e.key === 'ArrowRight' ? 120 : -120 });
        return;
      }
      if (e.key === 'Enter' && selected > -1) {
        const l = lines[selected];
        if (onOpenRow && l?.type === 'detail' && l.row?.ENT_NO) { e.preventDefault(); onOpenRow(l.row); }
        return;
      }
    }
    if (e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'e') onClose?.();
      if (k === 'l') exportExcel();
      if (k === 'p' || k === 'v') window.print();
      if (k === 'c') setSetOpen((o) => !o);
    }
  };

  return (
    <div className="jsmg-window" tabIndex={0} onKeyDown={onKey} ref={winRef}>
      <div className="jsmg-print-head">
        <div className="jsmg-print-company">{companyName}</div>
        <div>{grid.title}</div>
        <div>{grid.period}</div>
      </div>
      {grid.notice && (
        <div style={{ padding: '4px 10px', fontSize: 12, background: '#fff8e1', borderBottom: '1px solid #f0d78c', color: '#7a5800' }}>
          {grid.notice}
        </div>
      )}
      <style>{'@media print{.jsmg-search{display:none!important}}'}</style>
      <div className="jsmg-search" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 8px', background: query ? '#fff7d6' : '#eef2f7', borderBottom: '1px solid #cbd5e1', fontSize: 12 }}>
        <span>🔍</span>
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelected(-1); }}
          placeholder="Search name, bill no, amount… (just start typing)"
          style={{ flex: 1, maxWidth: 360, height: 22, padding: '0 6px', border: '1px solid #94a3b8', borderRadius: 3, fontSize: 12 }}
        />
        {query ? <span>{shownRows.length} of {rows.length} rows — Esc clears</span> : null}
      </div>
      <div className="jsmg-grid" ref={gridRef}>
        <table>
          <colgroup>
            <col style={{ width: 22 }} />
            {columns.map((c, i) => <col key={c.field} style={{ width: i === 0 ? 200 : 100 }} />)}
          </colgroup>
          <thead>
            <tr>
              <th />
              {columns.map((c) => <th key={c.field} className={c.kind === 'N' ? 'is-num' : ''}>{c.caption}</th>)}
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr
                key={i}
                className={`${l.type}${i === selected ? ' is-selected' : ''}${onOpenRow && l.type === 'detail' && l.row?.ENT_NO ? ' jsmg-row--clickable' : ''}`}
                style={l.style}
                ref={i === selected ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
                onClick={() => {
                  setSelected(i);
                  if (onOpenRow && l.type === 'detail' && l.row?.ENT_NO) onOpenRow(l.row);
                }}
              >
                <td className="jsmg-rowhead">{i === selected ? '▶' : ''}</td>
                {l.cells.map((v, k) => (
                  <td
                    key={k}
                    className={columns[k]?.kind === 'N' ? 'is-num' : ''}
                    style={k === 0 ? l.firstCellStyle : undefined}
                  >
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="jsmg-bar">
        <Btn b={BUTTONS[0]} onClick={() => setSetOpen((o) => !o)} />
        <div className="jsmg-progress"><div style={{ width: '100%' }} /></div>
        <span className="jsmg-length">Total Lenth</span>
        <Btn b={BUTTONS[1]} onClick={exportExcel} />
        <Btn b={BUTTONS[2]} onClick={() => window.print()} />
        <Btn b={BUTTONS[3]} onClick={() => window.print()} />
        <Btn b={BUTTONS[4]} onClick={onClose} />
      </div>
      {setOpen && (
        <div className="jsmg-columnset">
          {allColumns.map((c) => (
            <label key={c.field}>
              <input
                type="checkbox"
                checked={!hidden.has(c.field)}
                onChange={(e) => {
                  const next = new Set(hidden);
                  if (e.target.checked) next.delete(c.field); else next.add(c.field);
                  setHidden(next);
                }}
              />
              {c.caption}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
