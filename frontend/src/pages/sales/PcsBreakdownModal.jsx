import React, { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../../components/ui/Modal';

/**
 * PcsBreakdownModal — Pcs × Qty/Bndl breakdown
 *
 * Column logic:
 *   Pcs      = user enters (number of bundles / pieces)
 *   Qty/Bndl = user enters (qty per bundle — meters, kgs, etc.)
 *   NetQty   = AUTO = Pcs × Qty/Bndl  ← displayed read-only
 *
 * Calculation radio (Pcs / Mts / Kgs):
 *   Tells SalesModal which qty drives the Amount:
 *     Pcs → Amount = totalPcs × Rate
 *     Mts → Amount = totalNetQty × Rate  (both Pcs & Mts shown)
 *     Kgs → Amount = totalNetQty × Rate  (treated as kgs)
 */

const emptyRow = (srNo) => ({ srNo, remark: '', pcs: 0, qtyBndl: 0 });
const ROWS_DEFAULT = 6;

const normalizeRows = (rows) => {
  if (Array.isArray(rows) && rows.length) {
    const mapped = rows.map((r, i) => {
      // Support old data: if qtyBndl stored, use it; else derive from netQty/pcs
      const pcs = Number(r.pcs ?? r.qty ?? 0);
      let qtyBndl = Number(r.qtyBndl ?? 0);
      if (!qtyBndl && pcs > 0) {
        const storedNetQty = Number(r.netQty ?? r.kgs ?? 0);
        qtyBndl = storedNetQty > 0 ? Number((storedNetQty / pcs).toFixed(3)) : 0;
      }
      return { srNo: i + 1, remark: String(r.remark || ''), pcs, qtyBndl };
    });
    while (mapped.length < ROWS_DEFAULT) {
      mapped.push(emptyRow(mapped.length + 1));
    }
    return mapped;
  }
  return Array.from({ length: ROWS_DEFAULT }, (_, i) => emptyRow(i + 1));
};

const cellInput =
  'w-full h-7 px-1 text-center font-mono text-[12px] border border-slate-300 rounded-sm bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-400 outline-none';

const CALC_TYPES = ['Pcs', 'Mts', 'Kgs'];

export default function PcsBreakdownModal({
  isOpen,
  onClose,
  rows = [],
  onSave,
  locked = false,
  initialCalcType = 'Mts',
}) {
  const [localRows, setLocalRows] = useState(() => normalizeRows(rows));
  const [calcType, setCalcType] = useState(initialCalcType || 'Mts');
  const firstPcsRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setLocalRows(normalizeRows(rows));
      setCalcType(initialCalcType || 'Mts');
      requestAnimationFrame(() => firstPcsRef.current?.focus());
    }
  }, [isOpen, rows, initialCalcType]);

  // NetQty per row = Pcs × Qty/Bndl (auto)
  const rowsWithNetQty = useMemo(
    () =>
      localRows.map((r) => ({
        ...r,
        netQty: Number(r.pcs) > 0 && Number(r.qtyBndl) > 0
          ? Number((Number(r.pcs) * Number(r.qtyBndl)).toFixed(3))
          : 0,
      })),
    [localRows]
  );

  const totals = useMemo(() => {
    const totalPcs = rowsWithNetQty.reduce((s, r) => s + (Number(r.pcs) || 0), 0);
    const totalNetQty = rowsWithNetQty.reduce((s, r) => s + (Number(r.netQty) || 0), 0);
    return { pcs: totalPcs, netQty: Number(totalNetQty.toFixed(3)) };
  }, [rowsWithNetQty]);

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
    const cleaned = rowsWithNetQty.filter(
      (r) => r.remark || r.pcs > 0 || r.qtyBndl > 0
    );
    const formatted = cleaned.map((r) => ({
      srNo: r.srNo,
      remark: r.remark,
      pcs: r.pcs,
      qtyBndl: r.qtyBndl,
      netQty: r.netQty,
      // Backward compat fields
      kgs: r.netQty,
      qty: r.pcs,
      qtyPerBndl: r.qtyBndl,
    }));
    onSave?.(formatted.length ? formatted : [], calcType);
    onClose?.();
  };

  // Tab-order: Pcs → Qty/Bndl → Remark → next row Pcs
  const handleKeyDown = (e, idx, field) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const order = ['pcs', 'qtyBndl', 'remark'];
    const i = order.indexOf(field);
    if (i < order.length - 1) {
      document.getElementById(`pcs-${idx}-${order[i + 1]}`)?.focus();
      return;
    }
    if (idx < localRows.length - 1) {
      document.getElementById(`pcs-${idx + 1}-pcs`)?.focus();
      return;
    }
    if (!locked) addRow();
    setTimeout(() => document.getElementById(`pcs-${idx + 1}-pcs`)?.focus(), 0);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-[500px] w-[500px]">
      <div className="classic-erp-window flex flex-col overflow-hidden bg-slate-100 border border-slate-400">
        <div className="classic-erp-header shrink-0 py-1.5 px-2 bg-slate-200 border-b border-slate-300">
          <span className="erp-window-title text-[12px] font-bold text-slate-800">
            Pcs / Qty Breakdown
          </span>
        </div>

        {/* Calculation radio */}
        <div className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-white border-b border-slate-200">
          <span className="text-[11px] font-bold text-red-700 mr-2">Calculation :</span>
          {CALC_TYPES.map((ct) => (
            <label
              key={ct}
              className={`flex items-center gap-1 cursor-pointer px-2 py-0.5 rounded text-[11px] font-bold border ${
                calcType === ct
                  ? 'bg-blue-600 text-white border-blue-700'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="calcType"
                value={ct}
                checked={calcType === ct}
                onChange={() => setCalcType(ct)}
                disabled={locked}
                className="hidden"
              />
              {ct}
            </label>
          ))}
          <span className="ml-3 text-[10px] text-slate-500 italic">
            {calcType === 'Pcs'
              ? 'Amount = Total Pcs × Rate'
              : calcType === 'Mts'
              ? 'Amount = Total NetQty (Mts) × Rate'
              : 'Amount = Total NetQty (Kgs) × Rate'}
          </span>
        </div>

        <div className="p-2 bg-white">
          <table className="w-full border-collapse text-[11px]" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 32 }} />
              <col style={{ width: 85 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 55 }} />
              <col style={{ width: 75 }} />
            </colgroup>
            <thead>
              <tr className="text-[10px] font-bold border-b border-slate-300 text-slate-700 bg-slate-50">
                <th className="py-1 text-center border-r border-slate-200">SrNo</th>
                <th className="py-1 text-left pl-1 border-r border-slate-200">Remark</th>
                <th className="py-1 text-right pr-1 border-r border-slate-200 text-blue-700">
                  NetQty
                  <span className="text-[9px] font-normal text-slate-400 ml-0.5">(auto)</span>
                </th>
                <th className="py-1 text-center border-r border-slate-200">Pcs</th>
                <th className="py-1 text-right pr-1">Qty/Bndl</th>
              </tr>
            </thead>
            <tbody>
              {rowsWithNetQty.map((row, idx) => (
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
                  {/* NetQty auto — after Remark */}
                  <td className="py-0.5 px-1 text-right font-mono text-[11px] text-blue-800 bg-blue-50 font-semibold border-r border-slate-200">
                    {row.netQty > 0 ? row.netQty.toFixed(3) : ''}
                  </td>
                  {/* Pcs */}
                  <td className="py-0.5 px-0.5 border-r border-slate-200">
                    <input
                      id={`pcs-${idx}-pcs`}
                      ref={idx === 0 ? firstPcsRef : undefined}
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
                  {/* Qty/Bndl */}
                  <td className="py-0.5 px-0.5">
                    <input
                      id={`pcs-${idx}-qtyBndl`}
                      type="number"
                      step="0.001"
                      className={`${cellInput} text-right`}
                      value={row.qtyBndl > 0 ? row.qtyBndl : ''}
                      onChange={(e) => patchRow(idx, { qtyBndl: Number(e.target.value) || 0 })}
                      onKeyDown={(e) => handleKeyDown(e, idx, 'qtyBndl')}
                      disabled={locked}
                      placeholder="0.000"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex flex-col gap-1.5 px-2 py-1.5 border-t border-slate-300 bg-slate-200 text-[11px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-[10px] text-slate-700">
              <label className="flex items-center gap-1">
                <input type="checkbox" disabled /> Colour
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" disabled /> Size
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" defaultChecked /> Remark
              </label>
              <input
                type="text"
                className="w-6 h-4 text-center border border-slate-300 bg-white text-[10px]"
                defaultValue="0"
                readOnly
              />
            </div>
            <div className="text-right flex items-center gap-3">
              <span className="text-slate-600">
                Pcs: <strong className="text-black font-mono">{totals.pcs}</strong>
              </span>
              <span>
                <span className="font-bold text-slate-600 mr-1">NetQty :</span>
                <span className="font-mono font-bold text-sm text-blue-800">
                  {totals.netQty.toFixed(3)}
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-300">
            <div className="flex items-center gap-3 text-[10px] text-slate-700">
              <label className="flex items-center gap-1">
                <input type="checkbox" defaultChecked /> Pcs
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" defaultChecked /> NetQty
              </label>
              <label className="flex items-center gap-1 ml-2">
                <input type="checkbox" /> Horizontal(-&gt;&gt;&gt;&gt;&gt;) Row Enter
              </label>
            </div>
            <div className="flex gap-1.5 justify-end">
              {!locked && (
                <button type="button" className="classic-erp-btn text-[11px] h-6 px-2" onClick={addRow}>
                  + Row
                </button>
              )}
              <button
                type="button"
                className="classic-erp-btn primary text-[11px] h-6 px-3"
                onClick={handleOk}
                disabled={locked}
              >
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
