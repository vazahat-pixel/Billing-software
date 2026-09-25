import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { salesApi } from '../../api/sales.api';
import useStore from '../../store/useStore';
import { toast } from '../../store/useToastStore';

const today = () => new Date().toISOString().split('T')[0];

const EMPTY_LR = {
  lrNo: '',
  lrDate: today(),
  baleNo: '',
  weight: '',
  freight: '',
  transport: '',
  station: '',
  haste: '',
  remarks: '',
  _dirty: false,
  _saved: false,
};

/**
 * LrEntryModal
 * Shows ALL sales bills that have no LR number.
 * User fills LR fields row-by-row and saves in bulk or one by one.
 * After save those bills disappear from the list on next refresh.
 */
const LrEntryModal = ({ isOpen, onClose, onSaved }) => {
  const { sales, parties, fetchSales } = useStore();
  const [pendingBills, setPendingBills] = useState([]);
  const [lrData, setLrData] = useState({});
  const [saving, setSaving] = useState(false);
  const [filterText, setFilterText] = useState('');
  const cellRefs = useRef({});

  useEffect(() => {
    if (!isOpen) return;
    const pending = (sales || []).filter(
      (s) => !s.lrNo && s.status !== 'cancelled'
    );
    setPendingBills(pending);
    setLrData((prev) => {
      const next = { ...prev };
      pending.forEach((b) => {
        const id = b._id || b.id;
        if (!next[id] || !next[id]._dirty) {
          next[id] = {
            ...EMPTY_LR,
            lrNo: b.lrNo || '',
            lrDate: b.lrDate ? String(b.lrDate).split('T')[0] : today(),
            baleNo: b.baleNo || '',
            weight: b.weight || '',
            freight: b.freight || '',
            transport: b.transport || '',
            station: b.station || '',
            haste: b.haste || '',
            remarks: b.remarks || '',
          };
        }
      });
      return next;
    });
  }, [isOpen, sales]);

  const filtered = pendingBills.filter((b) => {
    if (!filterText) return true;
    const q = filterText.toLowerCase();
    const party = parties?.find((p) => p._id === b.customerId || p.id === b.customerId);
    return (
      String(b.invoiceNo || '').toLowerCase().includes(q) ||
      (party?.name || '').toLowerCase().includes(q)
    );
  });

  const setCell = (id, field, value) => {
    setLrData((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value, _dirty: true, _saved: false },
    }));
  };

  const buildEntry = (id, lr) => ({
    id,
    lrNo: lr.lrNo.trim(),
    lrDate: lr.lrDate || null,
    baleNo: lr.baleNo || '',
    weight: Number(lr.weight) || 0,
    freight: Number(lr.freight) || 0,
    transport: lr.transport || '',
    station: lr.station || '',
    haste: lr.haste || '',
    remarks: lr.remarks || '',
  });

  const handleSaveAll = useCallback(async () => {
    const entries = Object.entries(lrData)
      .filter(([, lr]) => lr._dirty && lr.lrNo?.trim())
      .map(([id, lr]) => buildEntry(id, lr));

    if (entries.length === 0) {
      toast.warn('Koi LR number nahi dala. Pehle LR No. bharo.');
      return;
    }
    setSaving(true);
    try {
      await salesApi.bulkUpdateLr(entries);
      toast.success(`${entries.length} bill(s) ka LR save ho gaya!`);
      const savedIds = new Set(entries.map((e) => e.id));
      setLrData((prev) => {
        const next = { ...prev };
        savedIds.forEach((id) => {
          if (next[id]) next[id] = { ...next[id], _saved: true, _dirty: false };
        });
        return next;
      });
      await fetchSales();
      if (onSaved) onSaved(entries.length);
    } catch (err) {
      toast.error(err?.message || 'Save karte waqt error aaya');
    } finally {
      setSaving(false);
    }
  }, [lrData, fetchSales, onSaved]);

  const handleSaveRow = useCallback(async (bill) => {
    const id = bill._id || bill.id;
    const lr = lrData[id];
    if (!lr?.lrNo?.trim()) {
      toast.warn('LR Number required');
      return;
    }
    setSaving(true);
    try {
      await salesApi.bulkUpdateLr([buildEntry(id, lr)]);
      toast.success(`Bill #${bill.invoiceNo} ka LR save!`);
      setLrData((prev) => ({
        ...prev,
        [id]: { ...prev[id], _saved: true, _dirty: false },
      }));
      await fetchSales();
      if (onSaved) onSaved(1);
    } catch (err) {
      toast.error(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [lrData, fetchSales, onSaved]);

  const COLS = [
    { key: 'lrNo',      label: 'LR No.',    type: 'text',   width: '10%', required: true },
    { key: 'lrDate',    label: 'LR Date',   type: 'date',   width: '9%'  },
    { key: 'baleNo',    label: 'Bale No.',  type: 'text',   width: '7%'  },
    { key: 'weight',    label: 'Weight',    type: 'number', width: '6%'  },
    { key: 'freight',   label: 'Freight',   type: 'number', width: '6%'  },
    { key: 'transport', label: 'Transport', type: 'text',   width: '12%' },
    { key: 'station',   label: 'Station',   type: 'text',   width: '8%'  },
    { key: 'haste',     label: 'Haste',     type: 'text',   width: '6%'  },
    { key: 'remarks',   label: 'Remarks',   type: 'text',   width: '14%' },
  ];

  const handleCellKeyDown = (e, rowIdx, colIdx) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const nextCol = colIdx + 1;
      if (nextCol < COLS.length) {
        cellRefs.current[`${rowIdx}-${nextCol}`]?.focus();
      } else {
        const nextRow = rowIdx + 1;
        if (nextRow < filtered.length) {
          cellRefs.current[`${nextRow}-0`]?.focus();
        }
      }
    }
  };

  const dirtyCount = Object.values(lrData).filter((v) => v._dirty && v.lrNo?.trim()).length;

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/60 p-2"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl border-2 border-[#1a3353] flex flex-col overflow-hidden"
        style={{ width: '98vw', maxWidth: '1380px', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#1a3353] text-white px-4 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="bg-amber-400 text-slate-900 font-black px-2 py-0.5 rounded text-[11px] tracking-wide uppercase">
              LR ENTRY
            </span>
            <h2 className="font-bold text-sm uppercase tracking-widest">
              Update LR No. — Pending Bills
            </h2>
            <span className="text-slate-400 text-xs">
              ({filtered.length} bill{filtered.length !== 1 ? 's' : ''} pending)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search party / bill..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="px-2 py-1 rounded text-xs bg-[#243f5c] border border-slate-500 text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 w-44"
            />
            <button
              onClick={onClose}
              className="text-slate-300 hover:text-white px-2 py-1 rounded text-lg font-bold"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <span className="text-5xl mb-4">✅</span>
              <p className="text-base font-semibold">Sabhi bills ka LR entry ho chuka hai!</p>
              <p className="text-xs mt-1">Koi pending bill nahi mila.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse" style={{ fontSize: '11.5px' }}>
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#e8ecf1] border-b-2 border-[#1a3353]">
                  <th className="px-2 py-2 font-bold text-[10px] uppercase text-slate-600 w-6 text-center">#</th>
                  <th className="px-2 py-2 font-bold text-[10px] uppercase text-slate-600" style={{ width: '8%' }}>Bill No</th>
                  <th className="px-2 py-2 font-bold text-[10px] uppercase text-slate-600" style={{ width: '7%' }}>Date</th>
                  <th className="px-2 py-2 font-bold text-[10px] uppercase text-slate-600" style={{ width: '14%' }}>Party</th>
                  {COLS.map((c) => (
                    <th key={c.key} className="px-1 py-2 font-bold text-[10px] uppercase text-slate-600" style={{ width: c.width }}>
                      {c.label}{c.required ? <span className="text-red-500">*</span> : ''}
                    </th>
                  ))}
                  <th className="px-2 py-2 font-bold text-[10px] uppercase text-slate-600 text-center" style={{ width: '5%' }}>Save</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((bill, rowIdx) => {
                  const id = bill._id || bill.id;
                  const lr = lrData[id] || { ...EMPTY_LR };
                  const party = parties?.find((p) => p._id === bill.customerId || p.id === bill.customerId);
                  const isSaved = lr._saved;
                  const isDirty = lr._dirty;

                  return (
                    <tr
                      key={id}
                      className={`border-b transition-colors ${
                        isSaved
                          ? 'bg-green-50 border-green-200'
                          : isDirty
                          ? 'bg-amber-50 border-amber-200'
                          : rowIdx % 2 === 0
                          ? 'bg-white hover:bg-slate-50'
                          : 'bg-[#f7f9fc] hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-2 py-1 text-center text-slate-400 font-mono text-[10px]">{rowIdx + 1}</td>
                      <td className="px-2 py-1 font-bold text-slate-800 font-mono">{bill.invoiceNo}</td>
                      <td className="px-2 py-1 text-slate-500 text-[10px]">
                        {bill.date ? new Date(bill.date).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="px-2 py-1 font-semibold text-slate-700 truncate max-w-[120px]" title={party?.name || ''}>
                        {party?.name || <span className="text-slate-300">—</span>}
                      </td>

                      {COLS.map((col, colIdx) => (
                        <td key={col.key} className="px-1 py-1">
                          <input
                            ref={(el) => { cellRefs.current[`${rowIdx}-${colIdx}`] = el; }}
                            type={col.type}
                            value={lr[col.key] ?? ''}
                            disabled={isSaved || saving}
                            step={col.type === 'number' ? '0.01' : undefined}
                            onChange={(e) => setCell(id, col.key, e.target.value)}
                            onKeyDown={(e) => handleCellKeyDown(e, rowIdx, colIdx)}
                            className={[
                              'w-full px-1.5 py-1 border rounded text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-500',
                              isSaved
                                ? 'bg-green-100 border-green-300 text-green-800 cursor-default'
                                : col.required && !lr[col.key] && isDirty
                                ? 'border-red-400 bg-white'
                                : 'border-slate-300 bg-white',
                            ].join(' ')}
                            placeholder={col.required ? col.label : ''}
                          />
                        </td>
                      ))}

                      <td className="px-1 py-1 text-center">
                        {isSaved ? (
                          <span className="text-green-600 font-bold text-[10px]">✓ Saved</span>
                        ) : (
                          <button
                            onClick={() => handleSaveRow(bill)}
                            disabled={saving || !lr.lrNo?.trim()}
                            className="px-2 py-1 bg-blue-600 text-white text-[10px] font-bold rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Save
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 bg-[#e8ecf1] border-t-2 border-[#1a3353] px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span>
              <span className="inline-block w-3 h-3 bg-amber-100 border border-amber-300 rounded mr-1" />
              Modified
            </span>
            <span>
              <span className="inline-block w-3 h-3 bg-green-100 border border-green-300 rounded mr-1" />
              Saved
            </span>
            <span className="text-slate-500">Tab / Enter → next cell</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 font-semibold">
              {dirtyCount} bill{dirtyCount !== 1 ? 's' : ''} ready
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-white border border-slate-400 rounded text-xs font-semibold hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAll}
              disabled={saving || dirtyCount === 0}
              className="px-6 py-1.5 bg-[#1a3353] text-white text-xs font-bold rounded hover:bg-[#243f5c] disabled:opacity-40 disabled:cursor-not-allowed shadow"
            >
              {saving ? 'Saving...' : `Save All (${dirtyCount})`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default LrEntryModal;
