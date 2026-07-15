import React, { useEffect, useMemo, useState } from 'react';
import useStore from '../store/useStore';
import useConfigStore from '../store/useConfigStore';
import { toast } from '../store/useToastStore';
import { ERPInput, ERPSelect } from '../components/forms/FormElements';
import Modal from '../components/ui/Modal';
import { fmtDate, fmtMoney } from '../utils/invoiceHelpers';

const todayISO = () => new Date().toISOString().slice(0, 10);
const fyStartISO = () => {
  const y = new Date().getFullYear();
  const m = new Date().getMonth();
  // Indian FY Apr–Mar
  const startYear = m >= 3 ? y : y - 1;
  return `${startYear}-04-01`;
};

/**
 * Ledger Statement — API-driven (AccountingEntry + LedgerMaster).
 * Replaces previous hardcoded MAHAVEER IMPEX mock.
 */
const LedgerModal = ({ isOpen, onClose }) => {
  const {
    ledgers,
    parties,
    fetchLedgers,
    fetchLedgerStatement,
    currentLedgerStatement,
    loading,
  } = useStore();
  const companyName = useConfigStore(
    (s) => s.companySettings?.legalName || s.company?.name || 'Company'
  );
  const financialYear = useConfigStore((s) => s.financialYear);

  const [ledgerId, setLedgerId] = useState('');
  const [from, setFrom] = useState(fyStartISO());
  const [to, setTo] = useState(todayISO());
  const [showRemark, setShowRemark] = useState(true);
  const [showAddress, setShowAddress] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    fetchLedgers().catch(() => {});
  }, [isOpen, fetchLedgers]);

  const ledgerOptions = useMemo(() => {
    const fromLedgers = (ledgers || []).map((l) => ({
      value: String(l._id || l.id),
      label: l.name,
    }));
    if (fromLedgers.length) return fromLedgers;
    // Fallback: party names until ledger master hydrated
    return (parties || []).map((p) => ({
      value: String(p.ledgerId || p._id || p.id),
      label: p.name,
    }));
  }, [ledgers, parties]);

  const runLedger = async () => {
    if (!ledgerId) {
      toast.warning('Select an account / ledger');
      return;
    }
    try {
      await fetchLedgerStatement({ ledgerId, from, to });
      toast.success('Ledger statement loaded');
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to load ledger');
    }
  };

  const statement = currentLedgerStatement;
  const rows = statement?.entries || statement?.lines || statement?.transactions || [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ledger Statement" className="max-w-3xl bg-white overflow-hidden shadow-xl">
      <div className="p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">Report Parameters</span>
          <div className="h-[1px] flex-1 bg-slate-200/80" />
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <label className="sm:text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Company</label>
            <div className="sm:col-span-2">
              <ERPInput className="w-full" value={companyName} readOnly disabled />
              {financialYear && (
                <p className="mt-1 text-[10px] text-slate-400 uppercase tracking-wide">FY {financialYear}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <label className="sm:text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Select Account</label>
            <div className="sm:col-span-2">
              <ERPSelect
                className="w-full"
                value={ledgerId}
                onChange={(e) => setLedgerId(e.target.value)}
                options={[{ value: '', label: '— Select ledger —' }, ...ledgerOptions]}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <label className="sm:text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Statement Period</label>
            <div className="sm:col-span-2 flex items-center gap-3">
              <ERPInput
                type="date"
                className="w-full text-center font-semibold text-xs"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">To</label>
              <ERPInput
                type="date"
                className="w-full text-center font-semibold text-xs"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6 border-t border-slate-100 pt-6">
          <div className="flex-1 space-y-3">
            {[
              { label: 'Show Remark in Print', checked: showRemark, set: setShowRemark },
              { label: 'Show Party Address in Print', checked: showAddress, set: setShowAddress },
            ].map((cb) => (
              <label key={cb.label} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 transition-all cursor-pointer"
                  checked={cb.checked}
                  onChange={(e) => cb.set(e.target.checked)}
                />
                <span className="text-[11px] font-medium text-slate-600 group-hover:text-slate-900 transition-all">{cb.label}</span>
              </label>
            ))}
          </div>
        </div>

        {statement && (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-600 flex justify-between">
              <span>{statement.ledgerName || statement.ledger?.name || 'Ledger'}</span>
              <span>
                Opening: {fmtMoney(statement.openingBalance || statement.opening || 0)}
                {' · '}
                Closing: {fmtMoney(statement.closingBalance || statement.closing || 0)}
              </span>
            </div>
            <div className="max-h-56 overflow-y-auto">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-white border-b">
                  <tr className="text-left text-slate-500 uppercase tracking-wide">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Particulars</th>
                    <th className="px-3 py-2 text-right">Debit</th>
                    <th className="px-3 py-2 text-right">Credit</th>
                    <th className="px-3 py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                        No entries in this period
                      </td>
                    </tr>
                  )}
                  {rows.map((row, i) => (
                    <tr key={row._id || row.entryNo || i} className="border-t border-slate-100">
                      <td className="px-3 py-1.5 whitespace-nowrap">{fmtDate(row.date || row.entryDate)}</td>
                      <td className="px-3 py-1.5">
                        {row.narration || row.particulars || row.voucherType || '—'}
                        {showRemark && row.remarks ? ` — ${row.remarks}` : ''}
                      </td>
                      <td className="px-3 py-1.5 text-right">{(row.debit || row.type === 'Dr') ? fmtMoney(row.debit || row.amount || 0) : '—'}</td>
                      <td className="px-3 py-1.5 text-right">{(row.credit || row.type === 'Cr') ? fmtMoney(row.credit || row.amount || 0) : '—'}</td>
                      <td className="px-3 py-1.5 text-right font-semibold">{fmtMoney(row.balance || row.runningBalance || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-slate-50 border-t border-slate-150 -mx-6 md:-mx-8 -mb-6 md:-mb-8 p-4 flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={runLedger}
            disabled={loading}
            className="px-4 py-2 text-[11px] font-semibold tracking-wide rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm disabled:opacity-60"
          >
            {loading ? 'Loading…' : 'Ledger'}
          </button>
          <button
            type="button"
            onClick={() => toast.unavailable('Interest Report')}
            className="px-4 py-2 text-[11px] font-semibold tracking-wide rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-200"
          >
            Interest Report
          </button>
          <button
            type="button"
            onClick={() => toast.unavailable('Bank Reconciliation')}
            className="px-4 py-2 text-[11px] font-semibold tracking-wide rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-200"
          >
            Bank Recon.
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-[11px] font-semibold tracking-wide rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200"
          >
            Exit
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default LedgerModal;
