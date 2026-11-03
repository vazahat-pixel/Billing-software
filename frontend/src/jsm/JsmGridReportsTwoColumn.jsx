import React from 'react';
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
function SideTable({ side }) {
  return (
    <table className="jsmg-side-table">
      <thead>
        <tr>
          <th>{side.title}</th>
          <th className="is-num">RS</th>
        </tr>
      </thead>
      <tbody>
        {side.lines.map((l, i) => (
          <tr key={i} className={l.type}>
            <td>{l.label}</td>
            <td className="is-num">{l.value === undefined || l.value === null ? '' : formatNumber(l.value, 2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function JsmGridReportsTwoColumn({ result, companyName, onClose }) {
  const { left, right, title, period } = result || {};
  if (!left || !right) return null;
  const { text, index } = accel('E&xit');

  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose?.(); }
  };

  return (
    <div className="jsmg-window" tabIndex={0} onKeyDown={onKey}>
      <div className="jsmg-print-head">
        <div className="jsmg-print-company">{companyName}</div>
        <div>{title}</div>
        <div>{period}</div>
      </div>
      <div className="jsmg-two-col">
        <SideTable side={left} />
        <SideTable side={right} />
      </div>
      <div className="jsmg-bar">
        <button type="button" className="jsmg-button" style={{ left: 918, width: 78 }} onClick={onClose}>
          {text.slice(0, index)}<u>{text[index]}</u>{text.slice(index + 1)}
        </button>
      </div>
    </div>
  );
}
