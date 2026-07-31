import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/ui/Modal';
import { buildPuBillRows, fmtBillDate } from './puBillLookupUtils';

const num = (n, d = 2) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Purchase bill line picker — BalPcs / BalMts / PuRate (classic Job Issue flow). */
export default function PuBillLookupModal({
  isOpen,
  onClose,
  weaver = '',
  inventoryLots = [],
  purchases = [],
  items = [],
  onSelect,
}) {
  const [search, setSearch] = useState('');
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setIdx(0);
    }
  }, [isOpen, weaver]);

  const allRows = useMemo(
    () => buildPuBillRows({ inventoryLots, purchases, items, weaver }),
    [inventoryLots, purchases, items, weaver]
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter((r) =>
      [r.billNo, r.itemName, r.lrNo, r.transport, r.supplierName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [allRows, search]);

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
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-[920px] w-full">
      <div className="flex flex-col bg-white overflow-hidden" onKeyDown={onKeyDown}>
        <div className="bg-[#374151] text-white px-3 py-1.5 text-[12px] font-bold flex justify-between items-center">
          <span>Select Purchase Bill {weaver ? `— ${weaver}` : ''}</span>
          <span className="text-[10px] font-normal opacity-80">{rows.length} line(s)</span>
        </div>

        <div className="px-2 py-1 bg-slate-100 border-b">
          <input
            autoFocus
            type="text"
            className="w-full h-7 px-2 text-[12px] border border-slate-300 rounded-sm outline-none focus:border-blue-500"
            placeholder="Filter Bill No, Item, LR, Transport…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIdx(0);
            }}
          />
        </div>

        <div className="max-h-[280px] overflow-auto">
          <table className="w-full border-collapse text-[11px]" style={{ tableLayout: 'fixed' }}>
            <thead className="sticky top-0 bg-slate-200">
              <tr>
                <th className="px-1 py-1 border w-10">SralNo</th>
                <th className="px-1 py-1 border w-16">BillNo</th>
                <th className="px-1 py-1 border w-20">Date</th>
                <th className="px-1 py-1 border w-10">SrNo</th>
                <th className="px-1 py-1 border">ItemName</th>
                <th className="px-1 py-1 border w-12 text-right">BalPcs</th>
                <th className="px-1 py-1 border w-16 text-right">BalMts</th>
                <th className="px-1 py-1 border w-16 text-right">BalKgs</th>
                <th className="px-1 py-1 border w-16 text-right">PuRate</th>
                <th className="px-1 py-1 border w-14">LrNo</th>
                <th className="px-1 py-1 border w-20">Transport</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-6 text-slate-400">
                    {weaver ? 'No open stock for this weaver' : 'Select weaver first or no stock available'}
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr
                    key={`${r.lotId}-${r.srNo}`}
                    className={`cursor-pointer ${i === idx ? 'bg-blue-600 text-white' : 'hover:bg-blue-50'}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(r);
                    }}
                    onMouseEnter={() => setIdx(i)}
                  >
                    <td className="px-1 py-0.5 border text-center">{r.sralNo}</td>
                    <td className="px-1 py-0.5 border font-bold">{r.billNo}</td>
                    <td className="px-1 py-0.5 border">{fmtBillDate(r.billDt)}</td>
                    <td className="px-1 py-0.5 border text-center">{r.srNo}</td>
                    <td className="px-1 py-0.5 border truncate">{r.itemName}</td>
                    <td className="px-1 py-0.5 border text-right font-mono">{r.balPcs || ''}</td>
                    <td className="px-1 py-0.5 border text-right font-mono">{num(r.balMts, 3)}</td>
                    <td className="px-1 py-0.5 border text-right font-mono">{num(r.balKgs, 3)}</td>
                    <td className="px-1 py-0.5 border text-right font-mono">{num(r.puRate, 2)}</td>
                    <td className="px-1 py-0.5 border">{r.lrNo || ''}</td>
                    <td className="px-1 py-0.5 border truncate">{r.transport || ''}</td>
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
