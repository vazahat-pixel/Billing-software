import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { resolveCompanyProfile } from '../../utils/invoiceHelpers';

/**
 * Generic list / register print for the Records hub.
 *
 * Renders the SAME `columns` and `rows` the on-screen table is given — including each
 * column's own `render()` — so the printed register is a literal copy of the list the
 * user is looking at, filters and all. Nothing is re-queried or re-sorted here.
 *
 * Columns whose key is in ACTION_KEYS are on-screen controls (row Print buttons), not
 * data, so they are dropped from the sheet.
 */

const ACTION_KEYS = new Set(['actions', 'action', '_actions']);

export default function ListPrint({ title, subtitle, columns = [], rows = [], onClose }) {
  const firm = useMemo(() => {
    const f = resolveCompanyProfile() || {};
    const area = Array.isArray(f.area) ? f.area.filter(Boolean).join(', ') : f.area;
    return {
      name: f.name || 'Company',
      addressLine: [f.address, area].filter(Boolean).join(', '),
      gstin: f.gstin || '',
    };
  }, []);

  const cols = useMemo(
    () => (columns || []).filter((c) => !ACTION_KEYS.has(String(c.key || '').toLowerCase())),
    [columns]
  );

  const printedOn = useMemo(() => {
    const d = new Date();
    const p = (x) => String(x).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }, []);

  return createPortal(
    <div className="lp-overlay" role="dialog" aria-label="List print preview">
      <style>{LIST_PRINT_CSS}</style>

      <div className="lp-bar no-print">
        <span className="lp-bar-title">Print Preview — {title}</span>
        <div className="lp-bar-actions">
          <button type="button" className="lp-btn lp-btn-primary" onClick={() => window.print()}>Print</button>
          <button type="button" className="lp-btn" onClick={onClose}>Close</button>
        </div>
      </div>

      <div className="lp-scroll">
        <div className="lp-paper">
          <div className="lp-head">
            <div className="lp-firm">{firm.name}</div>
            {firm.addressLine ? <div className="lp-addr">{firm.addressLine}</div> : null}
            {firm.gstin ? <div className="lp-addr">GSTIN : {firm.gstin}</div> : null}
          </div>

          <div className="lp-title-row">
            <div>
              <div className="lp-title">{title}</div>
              {subtitle ? <div className="lp-sub">{subtitle}</div> : null}
            </div>
            <div className="lp-meta">
              <div>Printed : {printedOn}</div>
              <div>Records : {rows.length}</div>
            </div>
          </div>

          <table className="lp-table">
            <thead>
              <tr>
                <th className="lp-sr">#</th>
                {cols.map((c) => (
                  <th key={c.key} className={c.align === 'right' ? 'lp-r' : c.align === 'center' ? 'lp-c' : ''}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="lp-empty" colSpan={cols.length + 1}>No records</td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr key={row._key || i}>
                    <td className="lp-sr">{i + 1}</td>
                    {cols.map((c) => (
                      <td key={c.key} className={c.align === 'right' ? 'lp-r' : c.align === 'center' ? 'lp-c' : ''}>
                        {c.render ? c.render(row) : row[c.key]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="lp-foot">
            <span>Total records : <b>{rows.length}</b></span>
            <span>For : {firm.name}</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

const LIST_PRINT_CSS = `
.lp-overlay { position: fixed; inset: 0; z-index: 10000; background: rgba(15,23,42,.55); display: flex; flex-direction: column; }
.lp-bar { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 14px; background: #1e293b; color: #fff; }
.lp-bar-title { font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
.lp-bar-actions { display: flex; gap: 8px; }
.lp-btn { font-size: 12px; font-weight: 700; padding: 5px 14px; border: 1px solid #94a3b8; background: #f1f5f9; color: #0f172a; border-radius: 3px; cursor: pointer; }
.lp-btn-primary { background: #2563eb; border-color: #1d4ed8; color: #fff; }
.lp-scroll { flex: 1; overflow: auto; padding: 18px; display: flex; justify-content: center; align-items: flex-start; }
.lp-paper { background: #fff; width: 297mm; max-width: 100%; padding: 10mm; box-shadow: 0 10px 30px rgba(0,0,0,.35); font-family: Arial, Helvetica, sans-serif; color: #000; }

.lp-head { text-align: center; border-bottom: 2px solid #000; padding-bottom: 5px; }
.lp-firm { font-size: 20px; font-weight: 700; }
.lp-addr { font-size: 10.5px; }

.lp-title-row { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin: 8px 0 6px; }
.lp-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; }
.lp-sub { font-size: 10.5px; color: #334155; }
.lp-meta { font-size: 10px; text-align: right; color: #334155; }

.lp-table { width: 100%; border-collapse: collapse; }
.lp-table th, .lp-table td { border: 1px solid #000; padding: 3px 6px; font-size: 10px; vertical-align: top; }
.lp-table th { background: #e2e8f0; font-weight: 700; text-align: left; text-transform: uppercase; font-size: 9.5px; letter-spacing: .03em; }
.lp-table td.lp-r, .lp-table th.lp-r { text-align: right; }
.lp-table td.lp-c, .lp-table th.lp-c { text-align: center; }
.lp-sr { width: 34px; text-align: center; }
.lp-empty { text-align: center; padding: 26px 0; font-style: italic; }

/* On-screen badges/pills carry colour + backgrounds that waste toner and can render as
   dark blocks; flatten them to plain text for the sheet. */
.lp-paper span[class*="rounded"], .lp-paper span[class*="bg-"] {
  background: transparent !important; border: none !important; color: #000 !important;
  padding: 0 !important; font-weight: 600 !important;
}

.lp-foot { display: flex; justify-content: space-between; margin-top: 10px; font-size: 10.5px; font-weight: 700; }

@media print {
  body * { visibility: hidden !important; }
  .lp-overlay, .lp-overlay * { visibility: visible !important; }
  .lp-overlay { position: absolute !important; inset: 0; background: #fff !important; display: block !important; }
  .lp-scroll { overflow: visible !important; padding: 0 !important; display: block !important; }
  .lp-paper { width: auto !important; box-shadow: none !important; padding: 0 !important; }
  .lp-table thead { display: table-header-group; }   /* repeat header on every page */
  .lp-table tr { break-inside: avoid; }
  .no-print { display: none !important; }
  @page { size: A4 landscape; margin: 10mm; }
}
`;
