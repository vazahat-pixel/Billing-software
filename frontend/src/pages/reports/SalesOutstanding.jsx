import React, { useState, useEffect, useMemo } from 'react';
import useStore from '../../store/useStore';
import { Layout, Printer, X, Monitor, ChevronLeft, ChevronDown, ChevronRight, Download } from 'lucide-react';
import { toast } from '../../store/useToastStore';
import { SkeletonTable } from '../../components/ui/loaders';
import useConfigStore from '../../store/useConfigStore';
import { downloadCsv, fmtDate } from '../../utils/reportExport';

const todayISO = () => new Date().toISOString().split('T')[0];

const money = (n) =>
  `₹ ${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SalesOutstanding = ({ isOpen, onClose }) => {
  const { parties, fetchOutstanding, fetchParties } = useStore();
  const companyName = useConfigStore(
    (s) => s.companySettings?.legalName || s.company?.name || 'Company'
  );

  const [showPreview, setShowPreview] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [osType, setOsType] = useState('receivable');
  const [asOn, setAsOn] = useState(todayISO);
  const [partyId, setPartyId] = useState('');
  const [minDays, setMinDays] = useState('');
  const [showZero, setShowZero] = useState(false);

  useEffect(() => {
    if (isOpen) fetchParties?.();
  }, [isOpen, fetchParties]);

  const handleGeneratePreview = async () => {
    setLoading(true);
    setExpanded({});
    try {
      const data = await fetchOutstanding(osType, asOn);
      let rows = Array.isArray(data) ? data : [];
      if (partyId) {
        rows = rows.filter((r) => String(r.partyId) === String(partyId));
      }
      if (!showZero) {
        rows = rows.filter((r) => Number(r.totalOutstanding || 0) > 0.01);
      }
      if (minDays !== '' && Number(minDays) > 0) {
        const min = Number(minDays);
        rows = rows
          .map((r) => ({
            ...r,
            bills: (r.bills || []).filter((b) => Number(b.ageDays || 0) >= min),
          }))
          .filter((r) => (r.bills || []).length > 0)
          .map((r) => {
            const total = (r.bills || []).reduce((s, b) => s + Number(b.outstanding || 0), 0);
            return { ...r, totalOutstanding: total };
          });
      }
      setReportData(rows);
      setShowPreview(true);
    } catch (err) {
      toast.error(err, { fallback: 'Failed to generate report' });
    } finally {
      setLoading(false);
    }
  };

  const grandTotals = useMemo(
    () =>
      reportData.reduce(
        (acc, curr) => {
          acc.total += curr.totalOutstanding || 0;
          acc.b30 += curr.aging?.bucket30 || 0;
          acc.b60 += curr.aging?.bucket60 || 0;
          acc.b90 += curr.aging?.bucket90 || 0;
          acc.b90Plus += curr.aging?.bucket90Plus || 0;
          return acc;
        },
        { total: 0, b30: 0, b60: 0, b90: 0, b90Plus: 0 }
      ),
    [reportData]
  );

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExportCsv = () => {
    const headers = [
      'Party',
      'Mobile',
      'Bill No',
      'Bill Date',
      'Due Date',
      'Age Days',
      'Outstanding',
      'Follow-up',
      '0-30',
      '31-60',
      '61-90',
      '90+',
    ];
    const rows = [];
    reportData.forEach((r) => {
      const bills = r.bills || [];
      if (!bills.length) {
        rows.push([
          r.partyName,
          r.phone || '',
          '',
          '',
          '',
          '',
          r.totalOutstanding,
          '',
          r.aging?.bucket30,
          r.aging?.bucket60,
          r.aging?.bucket90,
          r.aging?.bucket90Plus,
        ]);
        return;
      }
      bills.forEach((b, i) => {
        rows.push([
          i === 0 ? r.partyName : '',
          i === 0 ? r.phone || '' : '',
          b.billNo,
          fmtDate(b.billDate),
          fmtDate(b.dueDate),
          b.ageDays,
          b.outstanding,
          b.followUpStatus || '',
          i === 0 ? r.aging?.bucket30 : '',
          i === 0 ? r.aging?.bucket60 : '',
          i === 0 ? r.aging?.bucket90 : '',
          i === 0 ? r.aging?.bucket90Plus : '',
        ]);
      });
    });
    downloadCsv(`${osType}-outstanding-${asOn}.csv`, headers, rows);
    toast.success('CSV downloaded');
  };

  if (!isOpen) return null;

  const titleType = osType === 'receivable' ? 'Receivables' : 'Payables';

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-5xl border-4 border-black shadow-[20px_20px_0px_0px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-black text-white px-8 py-5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-5">
            <div className="p-3 bg-white text-black">
              <Layout size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-[0.25em]">
                {showPreview ? `Outstanding ${titleType}` : 'Sales Outstanding'}
              </h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">
                {companyName} · Daily chase · Bill-wise aging
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-white/10 border-2 border-white/20">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-white min-h-[360px]">
          {loading ? (
            <SkeletonTable rows={12} cols={6} className="mx-4" />
          ) : showPreview ? (
            <div className="space-y-5">
              <div className="flex flex-wrap justify-between items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 border-2 border-black text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 flex items-center gap-2"
                >
                  <ChevronLeft size={14} /> Parameters
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    As On: {fmtDate(asOn)} · {reportData.length} parties
                  </span>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="px-4 py-2 bg-black text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                  >
                    <Download size={14} /> CSV
                  </button>
                </div>
              </div>

              <div className="border-2 border-black overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-black text-white text-[9px] font-black uppercase tracking-widest">
                      <th className="px-3 py-3 w-8" />
                      <th className="px-4 py-3">Party</th>
                      <th className="px-4 py-3 text-right">0-30</th>
                      <th className="px-4 py-3 text-right">31-60</th>
                      <th className="px-4 py-3 text-right">61-90</th>
                      <th className="px-4 py-3 text-right">90+</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {reportData.map((row) => {
                      const id = String(row.partyId);
                      const open = !!expanded[id];
                      const bills = row.bills || [];
                      return (
                        <React.Fragment key={id}>
                          <tr
                            className="hover:bg-slate-50 text-[10px] font-bold text-black cursor-pointer"
                            onClick={() => toggleExpand(id)}
                          >
                            <td className="px-3 py-3 text-slate-400">
                              {bills.length ? (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-black uppercase tracking-wider">{row.partyName}</p>
                              <p className="text-[8px] text-slate-400 mt-0.5">
                                {row.phone || '—'}
                                {bills.length ? ` · ${bills.length} bill(s)` : ''}
                                {row.overCreditLimit ? ' · OVER CREDIT' : ''}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-right font-mono">{money(row.aging?.bucket30)}</td>
                            <td className="px-4 py-3 text-right font-mono">{money(row.aging?.bucket60)}</td>
                            <td className="px-4 py-3 text-right font-mono">{money(row.aging?.bucket90)}</td>
                            <td className="px-4 py-3 text-right font-mono text-red-600">{money(row.aging?.bucket90Plus)}</td>
                            <td className="px-4 py-3 text-right font-black font-mono">{money(row.totalOutstanding)}</td>
                          </tr>
                          {open && bills.length > 0 && (
                            <tr className="bg-slate-50">
                              <td colSpan={7} className="px-6 py-3">
                                <table className="w-full text-[10px]">
                                  <thead>
                                    <tr className="text-slate-500 uppercase tracking-wider border-b border-slate-200">
                                      <th className="py-2 text-left">Bill No</th>
                                      <th className="py-2 text-left">Date</th>
                                      <th className="py-2 text-left">Due</th>
                                      <th className="py-2 text-right">Age</th>
                                      <th className="py-2 text-right">OS Amt</th>
                                      <th className="py-2 text-left">Follow-up</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {bills.map((b) => (
                                      <tr key={`${b.billId || b.billNo}-${b.billDate}`} className="border-b border-slate-100">
                                        <td className="py-1.5 font-black">{b.billNo}</td>
                                        <td className="py-1.5">{fmtDate(b.billDate)}</td>
                                        <td className="py-1.5">{fmtDate(b.dueDate)}</td>
                                        <td className={`py-1.5 text-right font-mono ${Number(b.ageDays) > 90 ? 'text-red-600' : ''}`}>
                                          {b.ageDays}d
                                        </td>
                                        <td className="py-1.5 text-right font-mono font-bold">{money(b.outstanding)}</td>
                                        <td className="py-1.5 uppercase text-slate-500">{b.followUpStatus || '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {reportData.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-slate-400 uppercase tracking-widest text-[10px]">
                          No outstanding {titleType.toLowerCase()} found
                        </td>
                      </tr>
                    )}
                    {reportData.length > 0 && (
                      <tr className="bg-slate-100 border-t-2 border-black text-[10px] font-black">
                        <td />
                        <td className="px-4 py-3 uppercase">Grand Total</td>
                        <td className="px-4 py-3 text-right font-mono">{money(grandTotals.b30)}</td>
                        <td className="px-4 py-3 text-right font-mono">{money(grandTotals.b60)}</td>
                        <td className="px-4 py-3 text-right font-mono">{money(grandTotals.b90)}</td>
                        <td className="px-4 py-3 text-right font-mono text-red-600">{money(grandTotals.b90Plus)}</td>
                        <td className="px-4 py-3 text-right font-mono">{money(grandTotals.total)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="flex gap-2">
                {[
                  { id: 'receivable', label: 'Sales Outstanding (Receivable)' },
                  { id: 'payable', label: 'Purchase Outstanding (Payable)' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setOsType(t.id)}
                    className={`flex-1 px-4 py-3 text-[10px] font-black uppercase tracking-widest border-2 border-black ${
                      osType === t.id ? 'bg-black text-white' : 'bg-white text-black hover:bg-slate-50'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="space-y-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">As On Date</span>
                  <input
                    type="date"
                    className="w-full h-11 px-3 border-2 border-black font-bold text-[11px]"
                    value={asOn}
                    onChange={(e) => setAsOn(e.target.value)}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Min Age (days)</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0 = all"
                    className="w-full h-11 px-3 border-2 border-black font-bold text-[11px]"
                    value={minDays}
                    onChange={(e) => setMinDays(e.target.value)}
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Party</span>
                <select
                  className="w-full h-11 px-3 border-2 border-black font-bold text-[11px] uppercase"
                  value={partyId}
                  onChange={(e) => setPartyId(e.target.value)}
                >
                  <option value="">All parties</option>
                  {(parties || []).map((p) => (
                    <option key={p._id || p.id} value={p._id || p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 border-2 border-black"
                  checked={showZero}
                  onChange={(e) => setShowZero(e.target.checked)}
                />
                <span className="text-[10px] font-black uppercase tracking-widest">Show zero balance parties</span>
              </label>

              <p className="text-[10px] text-slate-500 font-medium">
                Click a party row in preview to expand <strong>bill-wise</strong> outstanding for collection follow-up.
              </p>
            </div>
          )}
        </div>

        <div className="bg-black p-6 flex flex-wrap justify-end gap-3 border-t-4 border-black shrink-0">
          {!showPreview ? (
            <button
              type="button"
              onClick={handleGeneratePreview}
              className="px-10 py-3 bg-white text-black text-[10px] font-black uppercase tracking-[0.25em] hover:bg-slate-200 flex items-center gap-3"
            >
              <Monitor size={16} /> Generate Preview
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleExportCsv}
                className="px-8 py-3 bg-white text-black text-[10px] font-black uppercase tracking-[0.25em] hover:bg-slate-200 flex items-center gap-3"
              >
                <Download size={16} /> Export CSV
              </button>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="px-8 py-3 bg-transparent border-2 border-white/40 text-white text-[10px] font-black uppercase tracking-[0.25em] hover:border-white"
              >
                Change Parameters
              </button>
            </>
          )}
          <button
            type="button"
            className="px-8 py-3 bg-transparent border-2 border-white/30 text-white text-[10px] font-black uppercase tracking-[0.25em] hover:border-white"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="px-8 py-3 bg-white text-black text-[10px] font-black uppercase tracking-[0.25em] hover:bg-slate-200 flex items-center gap-3"
            onClick={() => window.print()}
          >
            <Printer size={16} /> Print
          </button>
        </div>
      </div>
    </div>
  );
};

export default SalesOutstanding;
