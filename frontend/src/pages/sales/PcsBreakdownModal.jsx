import React, { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../../components/ui/Modal';

const emptyRow = (srNo) => ({ srNo, remark: '', netQty: 0, pcs: 0 });
const ROWS_DEFAULT = 6;

const normalizeRows = (rows) => {
  if (Array.isArray(rows) && rows.length) {
    const mapped = rows.map((r, i) => ({
      srNo: i + 1,
      remark: String(r.remark || ''),
      netQty: Number(r.netQty ?? r.kgs ?? r.qty ?? 0),
      pcs: Number(r.pcs ?? (r.qty > 0 && !r.netQty && !r.kgs ? r.qty : 0) ?? 0),
    }));
    while (mapped.length < ROWS_DEFAULT) {
      mapped.push(emptyRow(mapped.length + 1));
    }
    return mapped;
  }
  return Array.from({ length: ROWS_DEFAULT }, (_, i) => emptyRow(i + 1));
};

const cellInput =
  'w-full h-7 px-1 text-center font-mono text-[12px] border border-slate-300 rounded-sm bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-400 outline-none';

export default function PcsBreakdownModal({ isOpen, onClose, rows = [], onSave, locked = false }) {
  const [localRows, setLocalRows] = useState(() => normalizeRows(rows));
  const firstNetQtyRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setLocalRows(normalizeRows(rows));
      requestAnimationFrame(() => firstNetQtyRef.current?.focus());
    }
  }, [isOpen, rows]);

  const totals = useMemo(() => {
    const netQty = localRows.reduce((s, r) => s + (Number(r.netQty) || 0), 0);
    const pcs = localRows.reduce((s, r) => s + (Number(r.pcs) || 0), 0);
    return { netQty: Number(netQty.toFixed(3)), pcs: Number(pcs) };
  }, [localRows]);

  const patchRow = (idx, patch) => {
    setLocalRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const addRow = () => {
    setLocalRows((prev) => [...prev, emptyRow(prev.length + 1)]);
  };

  const handleOk = () => {
    const cleaned = localRows.filter((r) => r.remark || r.netQty > 0 || r.pcs > 0);
    const formatted = cleaned.map((r) => ({
      srNo: r.srNo,
      remark: r.remark,
      netQty: r.netQty,
      pcs: r.pcs,
      // preserve kgs/qty backward compatibility for backend schema
      kgs: r.netQty,
      qty: r.pcs,
      qtyPerBndl: r.pcs > 0 ? Number((r.netQty / r.pcs).toFixed(2)) : r.netQty,
    }));
    onSave?.(formatted.length ? formatted : []);
    onClose?.();
  };

  const handleKeyDown = (e, idx, field) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const order = ['netQty', 'pcs', 'remark'];
    const i = order.indexOf(field);
    if (i < order.length - 1) {
      document.getElementById(`pcs-${idx}-${order[i + 1]}`)?.focus();
      return;
    }
    if (idx < localRows.length - 1) {
      document.getElementById(`pcs-${idx + 1}-netQty`)?.focus();
      return;
    }
    if (!locked) addRow();
    setTimeout(() => document.getElementById(`pcs-${idx + 1}-netQty`)?.focus(), 0);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-[450px] w-[450px]">
      <div className="classic-erp-window flex flex-col overflow-hidden bg-slate-100 border border-slate-400">
        <div className="classic-erp-header shrink-0 py-1.5 px-2 bg-slate-200 border-b border-slate-300">
          <span className="erp-window-title text-[12px] font-bold text-slate-800">Pcs / NetQty Breakdown</span>
        </div>

        <div className="p-2 bg-white">
          <table className="w-full border-collapse text-[11px]" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 36 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 50 }} />
              <col style={{ width: 75 }} />
            </colgroup>
            <thead>
              <tr className="text-[10px] font-bold border-b border-slate-300 text-slate-700 bg-slate-50">
                <th className="py-1 text-center border-r border-slate-200">SrNo</th>
                <th className="py-1 text-left pl-1 border-r border-slate-200">Remark</th>
                <th className="py-1 text-right pr-1 border-r border-slate-200">NetQty</th>
                <th className="py-1 text-center border-r border-slate-200">Pcs</th>
                <th className="py-1 text-right pr-1">Qty/Bndl</th>
              </tr>
            </thead>
            <tbody>
              {localRows.map((row, idx) => {
                const qtyPerBndl = row.pcs > 0 ? (row.netQty / row.pcs).toFixed(2) : (row.netQty || 0).toFixed(2);
                return (
                  <tr key={row.srNo} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-0.5 text-center font-mono text-slate-600 text-[11px] border-r border-slate-200">
                      {row.srNo}
                    </td>
                    <td className="py-0.5 px-0.5 border-r border-slate-200">
                      <input
                        id={`pcs-${idx}-remark`}
                        type="text"
                        className="w-full h-6 px-1 text-[11px] border border-slate-200 rounded-none bg-white focus:border-blue-500 outline-none"
                        value={row.remark}
                        onChange={(e) => patchRow(idx, { remark: e.target.value })}
                        onKeyDown={(e) => handleKeyDown(e, idx, 'remark')}
                        disabled={locked}
                      />
                    </td>
                    <td className="py-0.5 px-0.5 border-r border-slate-200">
                      <input
                        id={`pcs-${idx}-netQty`}
                        ref={idx === 0 ? firstNetQtyRef : undefined}
                        type="number"
                        step="0.01"
                        className={`${cellInput} text-right`}
                        value={row.netQty > 0 ? row.netQty : ''}
                        onChange={(e) => patchRow(idx, { netQty: Number(e.target.value) || 0 })}
                        onKeyDown={(e) => handleKeyDown(e, idx, 'netQty')}
                        disabled={locked}
                        placeholder="0.00"
                      />
                    </td>
                    <td className="py-0.5 px-0.5 border-r border-slate-200">
                      <input
                        id={`pcs-${idx}-pcs`}
                        type="number"
                        step="1"
                        className={`${cellInput} text-center font-bold`}
                        value={row.pcs > 0 ? row.pcs : ''}
                        onChange={(e) => patchRow(idx, { pcs: Number(e.target.value) || 0 })}
                        onKeyDown={(e) => handleKeyDown(e, idx, 'pcs')}
                        disabled={locked}
                        placeholder="0"
                      />
                    </td>
                    <td className="py-0.5 px-1 text-right font-mono text-[11px] text-slate-700 bg-slate-50 font-semibold">
                      {row.netQty > 0 || row.pcs > 0 ? qtyPerBndl : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Modal Footer matching reference options & total */}
        <div className="shrink-0 flex flex-col gap-1.5 px-2 py-1.5 border-t border-slate-300 bg-slate-200 text-[11px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-[10px] text-slate-700">
              <label className="flex items-center gap-1"><input type="checkbox" disabled /> Colour</label>
              <label className="flex items-center gap-1"><input type="checkbox" disabled /> Size</label>
              <label className="flex items-center gap-1"><input type="checkbox" defaultChecked /> Remark</label>
              <input type="text" className="w-6 h-4 text-center border border-slate-300 bg-white text-[10px]" defaultValue="0" readOnly />
            </div>
            <div className="text-right">
              <span className="font-bold text-slate-600 mr-2">Total :</span>
              <span className="font-mono font-bold text-sm text-black">{totals.netQty.toFixed(3)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-300">
            <div className="flex items-center gap-3 text-[10px] text-slate-700">
              <label className="flex items-center gap-1"><input type="checkbox" defaultChecked /> Pcs</label>
              <label className="flex items-center gap-1"><input type="checkbox" defaultChecked /> NetQty</label>
              <label className="flex items-center gap-1 ml-2"><input type="checkbox" /> Horizontal(-&gt;&gt;&gt;&gt;&gt;) Row Enter</label>
            </div>
            <div className="flex gap-1.5 justify-end">
              {!locked && (
                <button type="button" className="classic-erp-btn text-[11px] h-6 px-2" onClick={addRow}>
                  + Row
                </button>
              )}
              <button type="button" className="classic-erp-btn primary text-[11px] h-6 px-3" onClick={handleOk} disabled={locked}>
                OK
              </button>
              <button type="button" className="classic-erp-btn text-[11px] h-6 px-2" onClick={onClose}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
