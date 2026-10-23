import React, { useMemo, useState } from 'react';
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

export default function JsmGridReport({ result, layouts, fallbackColumns, companyName, onClose }) {
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
  const lines = useMemo(() => buildGridLines(rows, columns, grid), [rows, columns, grid]);

  const exportExcel = () => {
    const aoa = [columns.map((c) => c.caption), ...lines.map((l) => l.cells)];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `${(grid.title || 'Report').replace(/[^\w ]+/g, '')}.xlsx`);
  };

  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose?.(); return; }
    if (e.key === 'ArrowDown') { setSelected((s) => Math.min(lines.length - 1, s + 1)); e.preventDefault(); }
    if (e.key === 'ArrowUp') { setSelected((s) => Math.max(0, s - 1)); e.preventDefault(); }
    if (e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'e') onClose?.();
      if (k === 'l') exportExcel();
      if (k === 'p' || k === 'v') window.print();
      if (k === 'c') setSetOpen((o) => !o);
    }
  };

  return (
    <div className="jsmg-window" tabIndex={0} onKeyDown={onKey}>
      <div className="jsmg-print-head">
        <div className="jsmg-print-company">{companyName}</div>
        <div>{grid.title}</div>
        <div>{grid.period}</div>
      </div>
      <div className="jsmg-grid">
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
                className={`${l.type}${i === selected ? ' is-selected' : ''}`}
                style={l.style}
                onClick={() => setSelected(i)}
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
