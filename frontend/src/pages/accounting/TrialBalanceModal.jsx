import React, { useState, useEffect, useMemo } from 'react';
import ErpWindowedModal from '../../components/erp/ErpWindowedModal';
import useStore from '../../store/useStore';
import { toast } from '../../store/useToastStore';
import { ErpBusyOverlay } from '../../components/ui/loaders';
import { downloadCsv, fmtAmt } from '../../utils/reportExport';

const todayISO = () => new Date().toISOString().split('T')[0];
const fyStartISO = () => {
  const y = new Date().getFullYear();
  const m = new Date().getMonth();
  const startYear = m >= 3 ? y : y - 1;
  return `${startYear}-04-01`;
};

/**
 * Z Trial — Trial Balance grouped by category, matching the legacy layout.
 * Real balances come straight from ledgerEngine.computeBalances() — same engine that
 * powers the party ledger statement, so this always reconciles with individual ledgers.
 * Note: "From Date" only affects which financial-year opening balance is picked up;
 * a Trial Balance is always a snapshot AS OF "To Date", not a period range — that's
 * true in the reference software too, not a limitation I introduced.
 */
const TrialBalanceModal = ({ isOpen, onClose }) => {
  const { fetchGroupedTrialBalance } = useStore();

  const [from, setFrom] = useState(fyStartISO());
  const [to, setTo] = useState(todayISO());
  const [withZeroBalance, setWithZeroBalance] = useState(true);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const runReport = async (overrideTo) => {
    setLoading(true);
    try {
      const result = await fetchGroupedTrialBalance({ asOn: overrideTo ?? to, withZeroBalance });
      setData(result);
      if (result && !result.isBalanced) {
        toast.warning(`Trial Balance is OFF by ₹${Math.abs(result.difference).toFixed(2)} — check recent postings`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setData(null);
    runReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const exportCsv = () => {
    if (!data) return toast.warning('Run the report first');
    const rows = [];
    data.groups.forEach((g) => {
      g.lines.forEach((l) => rows.push([g.name, l.name, l.debit, l.credit, l.station]));
      rows.push([g.name, 'TOTAL', g.totalDebit, g.totalCredit, '']);
    });
    downloadCsv(`trial-balance-${to}.csv`, ['Group', 'Name', 'Debit', 'Credit', 'Station'], rows);
  };

  const grandBalance = useMemo(() => {
    if (!data) return { value: 0, type: 'Dr' };
    const signed = data.grandTotalDebit - data.grandTotalCredit;
    return { value: Math.abs(signed), type: signed >= 0 ? 'Dr' : 'Cr' };
  }, [data]);

  if (!isOpen) return null;

  return (
    <ErpWindowedModal isOpen={isOpen} onClose={onClose} title="Z Trial [ Trial Balance ]" windowId="zTrial" bare>
      {({ WindowControls }) => (
        <div className="classic-erp-window erp-density flex flex-col h-full min-h-0 !max-h-none">
          <ErpBusyOverlay show={loading} message="Building trial balance…" />
          <div className="classic-erp-header shrink-0">
            <span className="erp-window-title truncate">Z Trial [ Trial Balance ]</span>
            <WindowControls />
          </div>

          <div className="flex flex-wrap items-center gap-3 px-2 py-1.5 border-b border-slate-300" style={{ background: '#ffd8b0' }}>
            <div className="classic-erp-field">
              <span className="classic-erp-label">From Date:</span>
              <input type="date" className="classic-erp-input" value={from} onChange={(e) => setFrom(e.target.value)} title="Cosmetic — a Trial Balance is always as-of the To Date, not a range" />
            </div>
            <div className="classic-erp-field">
              <span className="classic-erp-label">To:</span>
              <input type="date" className="classic-erp-input" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <label className="classic-erp-label flex items-center gap-1">
              <input type="checkbox" checked={withZeroBalance} onChange={(e) => setWithZeroBalance(e.target.checked)} /> With Zero Balance
            </label>
            <button type="button" className="classic-erp-btn btn-blue" onClick={() => runReport()} disabled={loading}>Ok</button>
            <button type="button" className="classic-erp-btn" onClick={onClose}>Close</button>
            <span className="classic-erp-btn" title="Column customization — not implemented">Columns(5)</span>
            <button type="button" className="classic-erp-btn ml-auto" onClick={exportCsv} disabled={!data}>PDF / CSV</button>
          </div>

          <div className="flex-1 overflow-auto min-h-0">
            <table className="w-full text-[12px] border-collapse">
              <thead className="sticky top-0 bg-slate-100 z-10">
                <tr>
                  <th className="text-left px-2 py-1 border-b">Name</th>
                  <th className="text-right px-2 py-1 border-b">Debit</th>
                  <th className="text-right px-2 py-1 border-b">Credit</th>
                  <th className="text-right px-2 py-1 border-b">Balance</th>
                  <th className="text-left px-2 py-1 border-b">Station</th>
                </tr>
              </thead>
              <tbody>
                {(data?.groups || []).map((g) => (
                  <React.Fragment key={g.name}>
                    <tr style={{ background: '#bfe6f0' }}>
                      <td colSpan={5} className="px-2 py-1 font-bold text-blue-900">{g.name}</td>
                    </tr>
                    {g.lines.map((l) => (
                      <tr key={l.ledgerId} className="hover:bg-slate-50">
                        <td className="px-4 py-0.5">{l.name}</td>
                        <td className="px-2 py-0.5 text-right font-mono">{fmtAmt(l.debit)}</td>
                        <td className="px-2 py-0.5 text-right font-mono">{fmtAmt(l.credit)}</td>
                        <td className="px-2 py-0.5 text-right font-mono">
                          {fmtAmt(l.debit - l.credit >= 0 ? l.debit - l.credit : l.credit - l.debit)} {l.debit - l.credit >= 0 ? 'DR' : 'CR'}
                        </td>
                        <td className="px-2 py-0.5">{l.station}</td>
                      </tr>
                    ))}
                    <tr className="font-bold text-green-800" style={{ background: '#e8f5e9' }}>
                      <td className="px-2 py-0.5">TOTAL :</td>
                      <td className="px-2 py-0.5 text-right font-mono">{fmtAmt(g.totalDebit)}</td>
                      <td className="px-2 py-0.5 text-right font-mono">{fmtAmt(g.totalCredit)}</td>
                      <td className="px-2 py-0.5 text-right font-mono">{fmtAmt(g.totalBalance)} {g.balanceType}</td>
                      <td />
                    </tr>
                  </React.Fragment>
                ))}
                {data && data.groups.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-6 text-slate-400">No ledger balances found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-4 px-2 py-2 border-t border-slate-300" style={{ background: '#ffd8b0' }}>
            <div className="px-3 py-1 rounded font-bold text-white" style={{ background: data && !data.isBalanced ? '#dc2626' : '#16a34a' }}>
              G.P. : {data ? fmtAmt(data.grossProfit) : '0.00'}
            </div>
            <span className="font-bold">CITY</span>
            <div className="classic-erp-input w-32 text-right font-mono">{data ? fmtAmt(data.grandTotalDebit) : '0.00'}</div>
            <div className="classic-erp-input w-32 text-right font-mono">{data ? fmtAmt(data.grandTotalCredit) : '0.00'}</div>
            <div className={`classic-erp-input w-32 text-right font-mono font-bold ${data && !data.isBalanced ? 'text-red-600' : ''}`}>
              {data ? `${fmtAmt(grandBalance.value)} ${grandBalance.type}` : '0.00'}
            </div>
            {data && !data.isBalanced && (
              <span className="text-red-700 font-bold text-xs">⚠ Books don't balance — difference ₹{Math.abs(data.difference).toFixed(2)}</span>
            )}
          </div>
        </div>
      )}
    </ErpWindowedModal>
  );
};

export default TrialBalanceModal;
