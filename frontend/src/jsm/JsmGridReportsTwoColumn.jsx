import React, { useState, useEffect, useRef } from 'react';
import { formatNumber } from './jcGrid';
import { accel } from './winforms';

/**
 * JSM's "GridReports" window (not the single-table "Report Control" grid every other rebuilt
 * screen uses) — two independent column stacks side by side, used only by Profit & Loss
 * (EXPENDITURE | INCOME) and Balance Sheet (LIABILITIES | ASSETS). Each side is a plain list of
 * pre-built lines (header / detail / total / grand) the backend report lays out itself — these
 * reports mix group subtotals, a carried-down Gross figure and a final plug line in an order no
 * generic grouped-table engine produces, so, unlike every other rebuilt report, there is no
 * captured STP_REPORT layout or jcGrid column set behind them.
 */
function SideTable({ side, sideKey, selected, onSelect, onOpenLedger }) {
  return (
    <table className="jsmg-side-table">
      <thead>
        <tr>
          <th>{side.title}</th>
          <th className="is-num">RS</th>
        </tr>
      </thead>
      <tbody>
        {side.lines.map((l, i) => {
          const isClickable = l.type === 'detail' && (l.ledgerId || l.label);
          const isSelected = selected.side === sideKey && selected.index === i;
          return (
            <tr
              key={i}
              className={`${l.type}${isClickable ? ' clickable' : ''}${isSelected ? ' is-selected' : ''}`}
              onClick={() => {
                onSelect(sideKey, i);
                if (isClickable && onOpenLedger) {
                  onOpenLedger({ ledgerId: l.ledgerId, name: l.label });
                }
              }}
              title={isClickable ? `Click to view Ledger for ${l.label} (Enter)` : undefined}
            >
              <td>{l.label}</td>
              <td className="is-num">{l.value === undefined || l.value === null ? '' : formatNumber(l.value, 2)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function JsmGridReportsTwoColumn({ result, companyName, onClose, onOpenLedger }) {
  const { left, right, title, period } = result || {};
  if (!left || !right) return null;
  const { text, index } = accel('E&xit');
  const rootRef = useRef(null);

  const firstDetailIdx = (s) => {
    const idx = (s?.lines || []).findIndex((l) => l.type === 'detail');
    return idx >= 0 ? idx : 0;
  };

  const [selected, setSelected] = useState({
    side: 'left',
    index: firstDetailIdx(left),
  });

  useEffect(() => {
    rootRef.current?.focus();
  }, []);

  const curSide = selected.side === 'left' ? left : right;
  const curLines = curSide?.lines || [];
  const curLine = curLines[selected.index];

  const handleSelect = (side, index) => {
    setSelected({ side, index });
  };

  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose?.();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      for (let i = selected.index + 1; i < curLines.length; i++) {
        if (curLines[i].type === 'detail') {
          setSelected((prev) => ({ ...prev, index: i }));
          return;
        }
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      for (let i = selected.index - 1; i >= 0; i--) {
        if (curLines[i].type === 'detail') {
          setSelected((prev) => ({ ...prev, index: i }));
          return;
        }
      }
      return;
    }

    if (e.key === 'ArrowLeft') {
      if (selected.side === 'right') {
        e.preventDefault();
        const otherIdx = Math.min(selected.index, (left.lines || []).length - 1);
        setSelected({ side: 'left', index: Math.max(0, otherIdx) });
      }
      return;
    }

    if (e.key === 'ArrowRight') {
      if (selected.side === 'left') {
        e.preventDefault();
        const otherIdx = Math.min(selected.index, (right.lines || []).length - 1);
        setSelected({ side: 'right', index: Math.max(0, otherIdx) });
      }
      return;
    }

    if (e.key === 'Enter') {
      if (curLine && curLine.type === 'detail' && onOpenLedger) {
        e.preventDefault();
        onOpenLedger({ ledgerId: curLine.ledgerId, name: curLine.label });
      }
      return;
    }
  };

  return (
    <div
      ref={rootRef}
      className="jsmg-window"
      tabIndex={0}
      onKeyDown={onKey}
      style={{ outline: 'none', display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <div className="jsmg-print-head">
        <div className="jsmg-print-company">{companyName}</div>
        <div>{title}</div>
        <div>{period}</div>
      </div>
      <div className="jsmg-two-col" style={{ flex: 1, minHeight: 0 }}>
        <SideTable
          side={left}
          sideKey="left"
          selected={selected}
          onSelect={handleSelect}
          onOpenLedger={onOpenLedger}
        />
        <SideTable
          side={right}
          sideKey="right"
          selected={selected}
          onSelect={handleSelect}
          onOpenLedger={onOpenLedger}
        />
      </div>
      <div
        className="jsmg-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 10px',
          background: '#f1f5f9',
          borderTop: '1px solid #cbd5e1',
          fontSize: 12,
        }}
      >
        <div style={{ color: '#475569', display: 'flex', gap: 14 }}>
          <span>💡 <strong>Click</strong> or <strong>Enter</strong> on any account to view Zoom Ledger</span>
          <span><strong>↑ / ↓</strong> Navigate</span>
          <span><strong>← / →</strong> Switch Side</span>
          <span><strong>Esc</strong> Exit</span>
        </div>
        <button
          type="button"
          className="jsmg-button"
          style={{ width: 78, height: 26, position: 'static' }}
          onClick={onClose}
        >
          {text.slice(0, index)}<u>{text[index]}</u>{text.slice(index + 1)}
        </button>
      </div>
    </div>
  );
}
