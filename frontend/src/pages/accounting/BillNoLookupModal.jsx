import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const round2 = (n) => Number(Number(n || 0).toFixed(2));

/**
 * BillNo Entry & Multi-Bill Allocation modal:
 * Displays all eligible outstanding bills for the selected party.
 * Allows single-click picking or multi-bill selection with individual allocation amounts.
 */
export default function BillNoLookupModal({
  isOpen,
  onClose,
  invoices = [],
  partyName = '',
  receiptAmount = 0,
  onSelect,
  onSelectMulti,
}) {
  const [search, setSearch] = useState('');
  const [idx, setIdx] = useState(0);
  const [selectedMap, setSelectedMap] = useState({}); // { [invoiceId]: allocatedAmount }
  const activeRef = useRef(null);

  // Initialize or reset selections when modal opens or invoices change
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setIdx(0);
      const initialMap = {};
      setSelectedMap(initialMap);
    }
  }, [isOpen, invoices]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((r) =>
      String(r.invoiceNo || '').toLowerCase().includes(q) ||
      String(r.billType || '').toLowerCase().includes(q)
    );
  }, [invoices, search]);

  const totalOutstanding = useMemo(() => {
    return round2(rows.reduce((sum, r) => sum + (Number(r.osAmt) || 0), 0));
  }, [rows]);

  const totalAllocated = useMemo(() => {
    return round2(Object.values(selectedMap).reduce((sum, amt) => sum + (Number(amt) || 0), 0));
  }, [selectedMap]);

  const selectedCount = useMemo(() => {
    return Object.keys(selectedMap).length;
  }, [selectedMap]);

  // Toggle selection for a single bill
  const toggleRow = (row) => {
    const id = String(row._id);
    setSelectedMap((prev) => {
      const next = { ...prev };
      if (next[id] != null) {
        delete next[id];
      } else {
        // Allocate full outstanding or remaining receipt amount
        const currentTotal = Object.values(next).reduce((s, a) => s + (Number(a) || 0), 0);
        let defaultAmt = row.osAmt;
        if (receiptAmount > 0) {
          const remaining = Math.max(0, receiptAmount - currentTotal);
          defaultAmt = Math.min(row.osAmt, remaining);
        }
        next[id] = round2(defaultAmt);
      }
      return next;
    });
  };

  // Set specific allocation amount for a bill
  const setAllocation = (row, amt) => {
    const id = String(row._id);
    const parsed = Math.max(0, Math.min(row.osAmt, Number(amt) || 0));
    setSelectedMap((prev) => {
      const next = { ...prev };
      if (parsed <= 0) {
        delete next[id];
      } else {
        next[id] = round2(parsed);
      }
      return next;
    });
  };

  // Select all visible bills with auto-allocation
  const handleSelectAll = () => {
    const next = {};
    let remainingReceipt = receiptAmount > 0 ? receiptAmount : Infinity;
    rows.forEach((r) => {
      const id = String(r._id);
      if (remainingReceipt <= 0) {
        next[id] = 0;
      } else {
        const alloc = Math.min(r.osAmt, remainingReceipt);
        next[id] = round2(alloc);
        if (receiptAmount > 0) remainingReceipt = Math.max(0, remainingReceipt - alloc);
      }
    });
    setSelectedMap(next);
  };

  const handleClearAll = () => {
    setSelectedMap({});
  };

  // Auto-allocate receipt amount across bills in FIFO (date) order
  const handleAutoAllocate = () => {
    const targetAmt = receiptAmount > 0 ? receiptAmount : totalOutstanding;
    let pool = targetAmt;
    const next = {};
    // Sort rows by bill date ascending (FIFO)
    const sorted = [...rows].sort((a, b) => new Date(a.billDt || 0) - new Date(b.billDt || 0));
    for (const r of sorted) {
      if (pool <= 0) break;
      const id = String(r._id);
      const alloc = Math.min(r.osAmt, pool);
      next[id] = round2(alloc);
      pool = round2(pool - alloc);
    }
    setSelectedMap(next);
  };

  // Pick single row (legacy click/enter)
  const pickSingle = (row) => {
    if (!row) return;
    onSelect?.(row);
    onClose?.();
  };

  // Apply multi-bill allocations
  const handleApplyMulti = () => {
    const items = Object.entries(selectedMap)
      .filter(([, amt]) => Number(amt) > 0)
      .map(([id, amt]) => {
        const inv = invoices.find((i) => String(i._id) === id);
        return { invoice: inv, allocatedAmt: amt };
      })
      .filter((item) => item.invoice);

    if (items.length > 0 && onSelectMulti) {
      onSelectMulti(items);
      onClose?.();
      return;
    }

    if (items.length === 1 && onSelect) {
      onSelect(items[0].invoice);
      onClose?.();
      return;
    }

    // If nothing selected but active row exists, pick active row
    if (rows[idx]) {
      pickSingle(rows[idx]);
    } else {
      onClose?.();
    }
  };

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [idx, isOpen]);

  // Keyboard handler — attached to search input AND the wrapper div so it fires
  // regardless of where focus lands inside the modal.
  const onKeyDown = (e) => {
    // Inside an allocation amount input: only intercept Escape, let rest go
    if (e.target?.tagName === 'INPUT' && e.target.type === 'number') {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose?.(); }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setIdx((i) => Math.min(i + 1, Math.max(0, rows.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === ' ') {
      // Space toggles the highlighted row's checkbox
      if (rows[idx]) {
        e.preventDefault();
        e.stopPropagation();
        toggleRow(rows[idx]);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (selectedCount > 0) {
        handleApplyMulti();
      } else if (rows[idx]) {
        pickSingle(rows[idx]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose?.();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-[840px] w-full">
      {/* tabIndex allows div to catch keydown when focus leaves the search input */}
      <div className="flex flex-col bg-white overflow-hidden" onKeyDown={onKeyDown} tabIndex={-1} data-enter-nav="off">
        {/* Header */}
        <div className="bg-[#374151] text-white px-3 py-1.5 text-[12px] font-bold flex justify-between items-center">
          <span>BillNo Entry — Outstanding Bills {partyName ? `for ${partyName}` : ''}</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-normal opacity-90 bg-slate-600 px-2 py-0.5 rounded">
              {rows.length} pending bill(s) · O/S: ₹{num(totalOutstanding)}
            </span>
          </div>
        </div>

        {/* Toolbar & Filter */}
        <div className="px-2 py-1.5 bg-slate-100 border-b flex flex-wrap items-center gap-2">
          <input
            autoFocus
            type="text"
            className="flex-1 min-w-[180px] h-7 px-2 text-[12px] border border-slate-300 rounded-sm outline-none focus:border-blue-500 bg-white"
            placeholder="Filter Bill No, Type… (↑↓ navigate · Enter select · Space toggle)"
            value={search}
            onKeyDown={onKeyDown}
            onChange={(e) => {
              setSearch(e.target.value);
              setIdx(0);
            }}
          />

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="classic-erp-btn text-[11px] h-7 px-2.5 bg-white border border-slate-300 hover:bg-slate-50"
              onClick={handleSelectAll}
              title="Select all bills"
            >
              Select All
            </button>
            <button
              type="button"
              className="classic-erp-btn text-[11px] h-7 px-2.5 bg-white border border-slate-300 hover:bg-slate-50"
              onClick={handleClearAll}
              title="Clear selection"
            >
              Clear
            </button>
            {receiptAmount > 0 && (
              <button
                type="button"
                className="classic-erp-btn text-[11px] h-7 px-2.5 bg-blue-50 border border-blue-300 text-blue-800 font-semibold hover:bg-blue-100"
                onClick={handleAutoAllocate}
                title="Auto-distribute receipt amount across bills (FIFO)"
              >
                Auto-Allocate ₹{num(receiptAmount)}
              </button>
            )}
          </div>
        </div>

        {/* Bills Table */}
        <div className="max-h-[340px] overflow-auto">
          <table className="w-full border-collapse text-[11px]" style={{ tableLayout: 'fixed' }}>
            <thead className="sticky top-0 bg-slate-200 text-slate-700 select-none">
              <tr>
                <th className="px-1 py-1 border w-8 text-center">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && selectedCount === rows.length}
                    onChange={(e) => (e.target.checked ? handleSelectAll() : handleClearAll())}
                    title="Select / Deselect all"
                  />
                </th>
                <th className="px-1 py-1 border w-24">Bill No</th>
                <th className="px-1 py-1 border w-20">Bill Dt</th>
                <th className="px-1 py-1 border w-12 text-center">Type</th>
                <th className="px-1 py-1 border w-20 text-right">Bill Amt</th>
                <th className="px-1 py-1 border w-20 text-right">Paid</th>
                <th className="px-1 py-1 border w-20 text-right font-bold text-red-700">Os Amt</th>
                <th className="px-1 py-1 border w-12 text-center">Os Dy</th>
                <th className="px-1 py-1 border w-24 text-right bg-blue-50 text-blue-900 font-bold">Allocate (₹)</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-6 text-slate-400">
                    {partyName ? 'No outstanding bills for this party' : 'Select Party first'}
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => {
                  const id = String(r._id);
                  const isChecked = selectedMap[id] != null;
                  const allocVal = selectedMap[id] ?? '';

                  return (
                    <tr
                      key={r._id}
                      ref={i === idx ? activeRef : undefined}
                      className={`cursor-pointer ${
                        isChecked
                          ? i === idx ? 'bg-blue-100 font-medium outline outline-2 outline-blue-400' : 'bg-blue-50 font-medium'
                          : i === idx ? 'bg-amber-50 outline outline-2 outline-amber-400' : 'hover:bg-slate-50'
                      }`}
                      onClick={() => { setIdx(i); }}
                      onDoubleClick={() => pickSingle(r)}
                    >
                      <td className="px-1 py-0.5 border text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleRow(r)}
                        />
                      </td>
                      <td className="px-1 py-0.5 border font-bold truncate" title={r.invoiceNo}>{r.invoiceNo || '—'}</td>
                      <td className="px-1 py-0.5 border">{fmtDate(r.billDt)}</td>
                      <td className="px-1 py-0.5 border text-center font-mono">{r.billType || ''}</td>
                      <td className="px-1 py-0.5 border text-right font-mono">{num(r.billAmt)}</td>
                      <td className="px-1 py-0.5 border text-right font-mono">{num(r.paidAmt)}</td>
                      <td className="px-1 py-0.5 border text-right font-mono font-bold text-red-700">{num(r.osAmt)}</td>
                      <td className="px-1 py-0.5 border text-center font-mono">{r.osDy || 0}</td>
                      <td className="px-1 py-0.5 border text-right bg-blue-50/50" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={r.osAmt}
                          className="w-full h-6 px-1 text-right font-mono text-[11px] font-bold text-blue-900 border border-slate-300 rounded-sm focus:border-blue-600 outline-none bg-white"
                          placeholder={isChecked ? '0.00' : '—'}
                          value={allocVal}
                          onChange={(e) => setAllocation(r, e.target.value)}
                          onFocus={() => {
                            if (!isChecked) toggleRow(r);
                          }}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer & Allocation Summary */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 border-t bg-slate-50">
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <span className="text-slate-600">
              Selected: <b className="text-slate-900">{selectedCount}</b> bill(s)
            </span>
            <span className="text-slate-600">
              Total O/S: <b className="text-red-700 font-mono">₹{num(totalOutstanding)}</b>
            </span>
            <span className="text-slate-600">
              Allocated: <b className="text-emerald-700 font-mono text-[12px]">₹{num(totalAllocated)}</b>
            </span>
            {receiptAmount > 0 && (
              <span className={`font-mono font-bold ${totalAllocated > receiptAmount ? 'text-red-600' : 'text-slate-700'}`}>
                {totalAllocated > receiptAmount
                  ? `(Exceeds Receipt by ₹${num(totalAllocated - receiptAmount)})`
                  : `(Remaining: ₹${num(receiptAmount - totalAllocated)})`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="classic-erp-btn text-[11px] h-7 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold border-none rounded-sm shadow-sm"
              onClick={handleApplyMulti}
              disabled={selectedCount === 0 && !rows[idx]}
            >
              {selectedCount > 0 ? `Apply Allocation (${selectedCount} Bills)` : 'Select Bill'}
            </button>
            <button
              type="button"
              className="classic-erp-btn text-[11px] h-7 px-3"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
