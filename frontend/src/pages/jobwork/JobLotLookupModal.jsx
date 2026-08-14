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
 * Lot No Entry lookup — Alt+L classic ERP shortcut.
 * Lists pending (Issued, not yet received) Mill Issue challans by Lot No,
 * so the user can pick which lot/bill to receive against.
 */
export default function JobLotLookupModal({ isOpen, onClose, jobs = [], partyName = '', onSelect }) {
  const [search, setSearch] = useState('');
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setIdx(0);
    }
  }, [isOpen, jobs]);

  const rows = useMemo(() => {
    const list = (jobs || []).map((j) => ({
      job: j,
      lotNo: j.lotId?.lotId || j.lotId?.code || '',
      chlnNo: j.challanNo || j.jobCardNo || '',
      millName: j.workerId?.name || j.partyName || j.workerName || '',
      itemName: j.lotId?.itemId?.name || j.lotId?.itemName || '',
      issuePcs: j.issuePcs || 0,
      issueQty: j.issueQty || 0,
      jobRate: j.jobRate || 0,
      issueDate: j.issueDate || j.createdAt,
    }));
    const q = search.trim().toLowerCase();
    if (!q) return list;
    const filtered = list.filter((r) =>
      [r.lotNo, r.chlnNo, r.millName, r.itemName].filter(Boolean).join(' ').toLowerCase().includes(q)
    );
    return filtered.length > 0 ? filtered : list;
  }, [jobs, search]);

  const pick = (row) => {
    if (!row) return;
    onSelect?.(row.job);
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
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-[880px] w-full">
      <div className="flex flex-col bg-white overflow-hidden" onKeyDown={onKeyDown}>
        <div className="bg-[#374151] text-white px-3 py-1.5 text-[12px] font-bold flex justify-between items-center">
          <span>Lot No Entry — Pending Mill Issue {partyName ? `for ${partyName}` : ''}</span>
          <span className="text-[10px] font-normal opacity-80">{rows.length} pending</span>
        </div>

        <div className="px-2 py-1 bg-slate-100 border-b">
          <input
            autoFocus
            type="text"
            className="w-full h-7 px-2 text-[12px] border border-slate-300 rounded-sm outline-none focus:border-blue-500"
            placeholder="Filter Lot No, Challan No, Mill, Item…"
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
                <th className="px-1 py-1 border w-28">LotNo</th>
                <th className="px-1 py-1 border w-20">ChlnNo</th>
                <th className="px-1 py-1 border w-28">Mill</th>
                <th className="px-1 py-1 border">ItemName</th>
                <th className="px-1 py-1 border w-14 text-right">Iss.Pcs</th>
                <th className="px-1 py-1 border w-16 text-right">Iss.Mts</th>
                <th className="px-1 py-1 border w-16 text-right">JobRate</th>
                <th className="px-1 py-1 border w-16">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-6 text-slate-400">
                    {partyName ? 'No pending challans for this party' : 'No pending Mill Issue challans'}
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr
                    key={r.job._id}
                    className={`cursor-pointer ${i === idx ? 'bg-blue-600 text-white' : 'hover:bg-blue-50'}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(r);
                    }}
                    onMouseEnter={() => setIdx(i)}
                  >
                    <td className="px-1 py-0.5 border font-bold truncate">{r.lotNo || '—'}</td>
                    <td className="px-1 py-0.5 border">{r.chlnNo}</td>
                    <td className="px-1 py-0.5 border truncate">{r.millName}</td>
                    <td className="px-1 py-0.5 border truncate">{r.itemName}</td>
                    <td className="px-1 py-0.5 border text-right font-mono">{r.issuePcs || ''}</td>
                    <td className="px-1 py-0.5 border text-right font-mono">{num(r.issueQty, 3)}</td>
                    <td className="px-1 py-0.5 border text-right font-mono">{num(r.jobRate, 2)}</td>
                    <td className="px-1 py-0.5 border">{fmtDate(r.issueDate)}</td>
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
