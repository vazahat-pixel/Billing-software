import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/ui/Modal';

const fmtBal = (n, dec = 2) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const partyAddress = (p) =>
  [p?.address, p?.city || p?.station, p?.state, p?.pincode].filter(Boolean).join(' ');

const closingLabel = (p) => {
  const ob = Number(p?.openingBalance || 0);
  const type = p?.openingBalanceType || 'Dr';
  if (!ob) return '0.00';
  return `${fmtBal(ob)} ${type === 'Cr' ? 'CR' : 'DR'}`;
};

/** Account List — weaver / supplier picker (classic ERP style). */
export default function WeaverLookupModal({ isOpen, onClose, parties = [], onSelect }) {
  const [search, setSearch] = useState('');
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setIdx(0);
    }
  }, [isOpen]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...(parties || [])];
    if (q) {
      list = list.filter((p) => {
        const hay = [p.name, p.city, p.station, p.group, p.type, p.gstin, p.mobile, p.phone]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }
    list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    return list.slice(0, 200);
  }, [parties, search]);

  const active = rows[idx] || null;

  const pick = (party) => {
    if (!party) return;
    onSelect?.(party);
    onClose?.();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIdx((i) => Math.min(i + 1, Math.max(0, rows.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && active) {
      e.preventDefault();
      pick(active);
    } else if (e.key === 'Escape') {
      onClose?.();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-[520px] w-full">
      <div className="flex flex-col overflow-hidden bg-white" onKeyDown={onKeyDown}>
        <div className="bg-[#1e3a8a] text-white px-3 py-1.5 text-[12px] font-bold">Account List</div>

        <div className="bg-[#dc2626] px-2 py-1">
          <input
            autoFocus
            type="text"
            className="w-full h-7 px-2 text-[12px] border-0 outline-none"
            placeholder="Search account name, city, GSTIN…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIdx(0);
            }}
          />
        </div>

        <div className="max-h-[180px] overflow-auto border-b border-slate-300">
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 bg-slate-100">
              <tr>
                <th className="px-2 py-1 text-left border-b">AC_NAME</th>
                <th className="px-2 py-1 text-left border-b">ST_NAME</th>
                <th className="px-2 py-1 text-left border-b">AC_ID</th>
                <th className="px-2 py-1 text-left border-b">AC_CD</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-4 text-slate-400">No accounts found</td>
                </tr>
              ) : (
                rows.map((p, i) => (
                  <tr
                    key={p._id || p.id || i}
                    className={`cursor-pointer ${i === idx ? 'bg-blue-600 text-white' : 'hover:bg-blue-50'}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(p);
                    }}
                    onMouseEnter={() => setIdx(i)}
                  >
                    <td className="px-2 py-1 border-b border-slate-200 font-semibold">{p.name}</td>
                    <td className="px-2 py-1 border-b border-slate-200">{p.city || p.station || '—'}</td>
                    <td className="px-2 py-1 border-b border-slate-200 font-mono">
                      {String(p._id || p.id || '').slice(-6)}
                    </td>
                    <td className="px-2 py-1 border-b border-slate-200 font-mono">{p.partyCode || p.code || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-2 gap-0 text-[11px] min-h-[72px]">
          <div className="bg-teal-100/50 border-r border-slate-300 p-2">
            <div className="font-bold text-[10px] mb-1">Address :-</div>
            <div className="leading-snug">{partyAddress(active) || '—'}</div>
          </div>
          <div className="bg-green-100/50 p-2">
            <div className="font-bold text-[10px] mb-1">Closing Bal.</div>
            <div className="text-[13px] font-bold font-mono">{active ? closingLabel(active) : '—'}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 bg-yellow-50 px-3 py-2 text-[10px] border-t border-slate-300">
          <div><span className="font-bold">Broker:</span> {active?.brokerName || '—'}</div>
          <div><span className="font-bold">Group:</span> {active?.group || active?.type || '—'}</div>
          <div><span className="font-bold">MSME No:</span> {active?.msmeNo || '—'}</div>
          <div>
            <span className="font-bold">Op.Bal:</span>{' '}
            {active ? `${fmtBal(active.openingBalance)} ${active.openingBalanceType || 'Dr'}` : '—'}
          </div>
          <div><span className="font-bold">PAN NO:</span> {active?.pan || '—'}</div>
          <div><span className="font-bold">GSTIN:</span> {active?.gstin || '—'}</div>
          <div><span className="font-bold">ST.CD:</span> {active?.stateCode || '—'}</div>
        </div>

        <div className="px-3 py-1.5 text-[10px] font-bold text-red-700 border-t border-slate-200">
          ↑↓ Navigate · Enter ⇒ Select A/c · Esc ⇒ Close
        </div>
      </div>
    </Modal>
  );
}
