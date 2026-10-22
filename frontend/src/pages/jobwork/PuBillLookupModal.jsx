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


  const activeWeaver = (weaver || '').trim();

  const allRows = useMemo(
    () => buildPuBillRows({ inventoryLots, purchases, items, weaver: activeWeaver }),
    [inventoryLots, purchases, items, activeWeaver]
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
    try {
      onSelect?.(row);
    } catch (err) {
      console.error('PuBillLookupModal onSelect error:', err);
    } finally {
      onClose?.();
    }
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setIdx((i) => {
          const nextIdx = Math.min(i + 1, Math.max(0, rows.length - 1));
          document.getElementById(`pu-bill-row-${nextIdx}`)?.scrollIntoView({ block: 'nearest' });
          return nextIdx;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setIdx((i) => {
          const nextIdx = Math.max(i - 1, 0);
          document.getElementById(`pu-bill-row-${nextIdx}`)?.scrollIntoView({ block: 'nearest' });
          return nextIdx;
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (rows[idx]) {
          pick(rows[idx]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [isOpen, rows, idx]);

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape') {
      return;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-[1180px] w-full">
      <div className="flex flex-col bg-white overflow-hidden" onKeyDown={onKeyDown}>
        <div className="bg-[#374151] text-white px-3 py-1.5 text-[12px] font-bold flex justify-between items-center">
          <span>Select Purchase Bill / Inventory Lot {weaver ? `— Weaver: ${weaver}` : '(All Weavers)'}</span>
          <span className="text-[10px] font-normal opacity-80">{rows.length} line(s)</span>
        </div>

        <div className="px-2 py-1 bg-slate-100 border-b flex items-center gap-2">
          <input
            autoFocus
            type="text"
            className="flex-1 h-7 px-2 text-[12px] border border-slate-300 rounded-sm outline-none focus:border-blue-500"
            placeholder="Filter Bill No, Item, LR, Transport, Weaver…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIdx(0);
            }}
          />
          {weaver && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-700 font-medium select-none whitespace-nowrap bg-white px-2.5 py-1 border border-blue-200 rounded-sm">
              Weaver: <span className="font-bold text-blue-800">{weaver}</span>
            </div>
          )}
        </div>

        <div className="max-h-[340px] overflow-auto">
          <table className="w-full border-collapse text-[11px]" style={{ tableLayout: 'fixed' }}>
            <thead className="sticky top-0 bg-slate-200 text-slate-700 select-none">
              <tr>
                <th className="px-1 py-1 border w-10">Sral</th>
                <th className="px-1 py-1 border w-20">Bill No</th>
                <th className="px-1 py-1 border w-20">Date</th>
                <th className="px-1 py-1 border">Item Name</th>
                <th className="px-1 py-1 border w-14 text-right bg-blue-50" title="Original Pieces in Bill/Lot">Orig Pcs</th>
                <th className="px-1 py-1 border w-14 text-right bg-amber-50" title="Already Issued Pieces">Iss Pcs</th>
                <th className="px-1 py-1 border w-14 text-right bg-emerald-50 text-emerald-800 font-bold" title="Available Remaining Pieces">Avail Pcs</th>
                <th className="px-1 py-1 border w-16 text-right bg-blue-50" title="Original Meters in Bill/Lot">Orig Mtr</th>
                <th className="px-1 py-1 border w-16 text-right bg-amber-50" title="Already Issued Meters">Iss Mtr</th>
                <th className="px-1 py-1 border w-16 text-right bg-emerald-50 text-emerald-800 font-bold" title="Available Remaining Meters">Avail Mtr</th>
                <th className="px-1 py-1 border w-14 text-right">PuRate</th>
                <th className="px-1 py-1 border w-14">LR No</th>
                <th className="px-1 py-1 border w-20">Transport</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center py-6 text-slate-400">
                    {weaver ? 'No open stock for this weaver' : 'Select weaver first or no stock available'}
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => {
                  const hasPcs = (r.origPcs > 0) || (r.availPcs > 0);
                  const hasMts = (r.origMts > 0) || (r.availMts > 0);
                  return (
                    <tr
                      key={r.id || `${r.purchaseId}_${r.billNo}_${r.srNo}_${i}`}
                      id={`pu-bill-row-${i}`}
                      className={`cursor-pointer ${i === idx ? 'bg-blue-600 text-white' : 'hover:bg-blue-50'}`}
                      onClick={() => pick(r)}
                      onDoubleClick={() => pick(r)}
                      onMouseEnter={() => setIdx(i)}
                    >
                      <td className="px-1 py-0.5 border text-center">{r.sralNo}</td>
                      <td className="px-1 py-0.5 border font-bold">{r.billNo}</td>
                      <td className="px-1 py-0.5 border">{fmtBillDate(r.billDt)}</td>
                      <td className="px-1 py-0.5 border truncate" title={r.itemName}>{r.itemName}</td>
                      <td className="px-1 py-0.5 border text-right font-mono">{hasPcs ? (r.origPcs || '-') : '-'}</td>
                      <td className="px-1 py-0.5 border text-right font-mono">{hasPcs && r.issuedPcs > 0 ? r.issuedPcs : (hasPcs ? '0' : '-')}</td>
                      <td className={`px-1 py-0.5 border text-right font-mono font-bold ${i === idx ? 'text-white' : 'text-emerald-700'}`}>
                        {hasPcs ? (r.availPcs ?? '-') : '-'}
                      </td>
                      <td className="px-1 py-0.5 border text-right font-mono">{hasMts ? num(r.origMts, 3) : '-'}</td>
                      <td className="px-1 py-0.5 border text-right font-mono">{hasMts && r.issuedMts > 0 ? num(r.issuedMts, 3) : (hasMts ? '0.000' : '-')}</td>
                      <td className={`px-1 py-0.5 border text-right font-mono font-bold ${i === idx ? 'text-white' : 'text-emerald-700'}`}>
                        {hasMts ? num(r.availMts, 3) : '-'}
                      </td>
                      <td className="px-1 py-0.5 border text-right font-mono">{r.puRate ? num(r.puRate, 2) : '-'}</td>
                      <td className="px-1 py-0.5 border truncate">{r.lrNo || ''}</td>
                      <td className="px-1 py-0.5 border truncate">{r.transport || ''}</td>
                    </tr>
                  );
                })
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
