import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/ui/Modal';
import useStore from '../../store/useStore';
import { notifySuccess, notifyError, notifyWarning } from '../../utils/notify';

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const drCr = (t) => (String(t || '').toUpperCase().startsWith('C') ? 'Cr' : 'Dr');

/**
 * JSM Tran_Op_Bal: every account in one grid — GROUP, AC CODE, AC ID, ACCOUNT, STATION, OP.BAL,
 * DR/CR — with DEBIT / CREDIT / DIFF totals, so the opening balances can be checked to tally
 * before work starts. Saves only the rows that changed (party openingBalance / openingBalanceType).
 */
const OpeningBalanceModal = ({ isOpen, onClose, readOnly = false }) => {
  const { parties, fetchParties, updateParty } = useStore();
  const [edits, setEdits] = useState({});
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchParties();
      setEdits({});
      setSearch('');
      setGroupFilter('');
    }
  }, [isOpen, fetchParties]);

  const rows = useMemo(() => (parties || [])
    .map((p) => {
      const id = String(p._id || p.id);
      const e = edits[id] || {};
      return {
        id,
        group: p.group || '',
        acCode: p.accd ?? '',
        acId: p.connectedCode || '',
        name: p.name || '',
        station: p.city || '',
        opBal: e.opBal ?? String(p.openingBalance ?? 0),
        opType: e.opType ?? drCr(p.openingBalanceType),
        changed: !!edits[id],
      };
    })
    .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name)), [parties, edits]);

  const groups = useMemo(() => [...new Set(rows.map((r) => r.group).filter(Boolean))].sort(), [rows]);
  const q = search.trim().toLowerCase();
  const visible = rows.filter((r) =>
    (!groupFilter || r.group === groupFilter) &&
    (!q || r.name.toLowerCase().includes(q) || String(r.acCode).includes(q) || r.station.toLowerCase().includes(q)));

  // Totals over ALL accounts (not only the filtered view) — that is what must tally.
  const totals = useMemo(() => rows.reduce((t, r) => {
    const amt = Number(r.opBal) || 0;
    if (r.opType === 'Cr') t.cr += amt; else t.dr += amt;
    return t;
  }, { dr: 0, cr: 0 }), [rows]);
  const diff = Number((totals.dr - totals.cr).toFixed(2));

  const setRow = (id, patch) => setEdits((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
  const changedIds = Object.keys(edits);

  const handleSave = async () => {
    if (!changedIds.length) return notifyWarning('No opening balance changed');
    setSaving(true);
    let done = 0;
    try {
      for (const id of changedIds) {
        const r = rows.find((x) => x.id === id);
        if (!r) continue;
        await updateParty(id, { openingBalance: Number(r.opBal) || 0, openingBalanceType: r.opType });
        done += 1;
      }
      notifySuccess(`Opening balance saved for ${done} account${done === 1 ? '' : 's'}`);
      setEdits({});
      fetchParties();
    } catch (err) {
      notifyError(err, `Saved ${done} of ${changedIds.length}; the rest failed`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Opening Balance" className="max-w-5xl">
      <div className="p-3 flex flex-col gap-2" data-enter-nav="off">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="classic-erp-input w-64"
            placeholder="Find account / code / station"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-master-find="true"
          />
          <select className="classic-erp-select w-56" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
            <option value="">All groups</option>
            {groups.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <span className="text-[11px] text-[var(--text-muted)]">{visible.length} of {rows.length} accounts</span>
        </div>

        <div className="border border-[#808080] max-h-[56vh] overflow-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead className="sticky top-0 bg-[#e2e8f0] text-slate-800">
              <tr>
                {['GROUP', 'AC CODE', 'AC ID', 'ACCOUNT', 'STATION', 'OP.BAL', 'DR/CR'].map((h) => (
                  <th key={h} className={`border border-[#9aa4b8] px-1.5 py-1 ${h === 'OP.BAL' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className={r.changed ? 'bg-amber-50' : 'hover:bg-slate-50'}>
                  <td className="border border-slate-200 px-1.5">{r.group}</td>
                  <td className="border border-slate-200 px-1.5 font-mono">{r.acCode}</td>
                  <td className="border border-slate-200 px-1.5 font-mono">{r.acId}</td>
                  <td className="border border-slate-200 px-1.5 font-semibold uppercase">{r.name}</td>
                  <td className="border border-slate-200 px-1.5">{r.station}</td>
                  <td className="border border-slate-200 p-0 w-32">
                    <input
                      type="number"
                      step="0.01"
                      className="w-full h-6 px-1 text-right border-0 bg-transparent font-mono"
                      value={r.opBal}
                      onChange={(e) => setRow(r.id, { opBal: e.target.value })}
                      disabled={readOnly}
                    />
                  </td>
                  <td className="border border-slate-200 p-0 w-16">
                    <select
                      className="w-full h-6 border-0 bg-transparent font-bold"
                      value={r.opType}
                      onChange={(e) => setRow(r.id, { opType: e.target.value })}
                      disabled={readOnly}
                    >
                      <option value="Dr">DR</option>
                      <option value="Cr">CR</option>
                    </select>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={7} className="text-center py-6 text-[var(--text-muted)]">No accounts</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-[12px] font-bold">
            <span>DEBIT <span className="font-mono text-blue-800">{fmt(totals.dr)}</span></span>
            <span>CREDIT <span className="font-mono text-blue-800">{fmt(totals.cr)}</span></span>
            <span className={diff === 0 ? 'text-emerald-700' : 'text-rose-700'}>
              DIFF <span className="font-mono">{fmt(Math.abs(diff))}{diff === 0 ? '' : diff > 0 ? ' Dr' : ' Cr'}</span>
            </span>
          </div>
          <div className="flex gap-2">
            {changedIds.length > 0 && <span className="text-[11px] text-amber-700 self-center">{changedIds.length} changed</span>}
            {!readOnly && (
              <button type="button" className="classic-erp-btn btn-blue font-bold" onClick={handleSave} disabled={saving || !changedIds.length}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            )}
            <button type="button" className="classic-erp-btn" onClick={onClose}>Exit</button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default OpeningBalanceModal;
