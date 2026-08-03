import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/ui/Modal';

const num = (n, d = 2) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });

const fmtDate = (d) => {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
  } catch {
    return '';
  }
};

/**
 * BillNo Entry lookup — press Enter on the grid's BillNo cell to see every
 * outstanding bill for the selected party, so you pick which one to receive/pay against.
 */
export default function BillNoLookupModal({ isOpen, onClose, invoices = [], partyName = '', onSelect }) {
  const [search, setSearch] = useState('');
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setIdx(0);
    }
  }, [isOpen, invoices]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((r) => String(r.invoiceNo || '').toLowerCase().includes(q));
  }, [invoices, search]);

  const pick = (row) => {
    if (!row) return;
    onSelect?.(row);
    onClose?.();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIdx((i) => Math.min(i + 1, Math.max(0, rows.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && rows[idx]) {
      e.preventDefault();
      pick(rows[idx]);
    } else if (e.key === 'Escape') {
      onClose?.();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-[640px] w-full">
      <div className="flex flex-col bg-white overflow-hidden" onKeyDown={onKeyDown}>
        <div className="bg-[#374151] text-white px-3 py-1.5 text-[12px] font-bold flex justify-between items-center">
          <span>BillNo Entry — Outstanding Bills {partyName ? `for ${partyName}` : ''}</span>
          <span className="text-[10px] font-normal opacity-80">{rows.length} pending</span>
        </div>

        <div className="px-2 py-1 bg-slate-100 border-b">
          <input
            autoFocus
            type="text"
            className="w-full h-7 px-2 text-[12px] border border-slate-300 rounded-sm outline-none focus:border-blue-500"
            placeholder="Filter Bill No…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIdx(0);
            }}
          />
        </div>

        <div className="max-h-[320px] overflow-auto">
          <table className="w-full border-collapse text-[11px]" style={{ tableLayout: 'fixed' }}>
            <thead className="sticky top-0 bg-slate-200">
              <tr>
                <th className="px-1 py-1 border w-28">BillNo</th>
                <th className="px-1 py-1 border w-20">BillDt</th>
                <th className="px-1 py-1 border w-20 text-right">BillAmt</th>
                <th className="px-1 py-1 border w-20 text-right">OsAmt</th>
                <th className="px-1 py-1 border w-14 text-center">OsDy</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-slate-400">
                    {partyName ? 'No outstanding bills for this party' : 'Select Party first'}
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr
                    key={r._id}
                    className={`cursor-pointer ${i === idx ? 'bg-blue-600 text-white' : 'hover:bg-blue-50'}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(r);
                    }}
                    onMouseEnter={() => setIdx(i)}
                  >
                    <td className="px-1 py-0.5 border font-bold truncate">{r.invoiceNo || '—'}</td>
                    <td className="px-1 py-0.5 border">{fmtDate(r.billDt)}</td>
                    <td className="px-1 py-0.5 border text-right font-mono">{num(r.billAmt)}</td>
                    <td className="px-1 py-0.5 border text-right font-mono">{num(r.osAmt)}</td>
                    <td className="px-1 py-0.5 border text-center font-mono">{r.osDy || 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2 px-3 py-2 border-t bg-slate-50">
          <span className="text-[10px] text-slate-500 mr-auto self-center">
            Enter ⇒ Select · Esc ⇒ Close
          </span>
          <button type="button" className="classic-erp-btn text-[11px] h-7 px-4" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
