import React, { useState, useEffect, useMemo } from 'react';
import ErpWindowedModal from '../../components/erp/ErpWindowedModal';
import useStore from '../../store/useStore';
import { notifyWarning } from '../../utils/notify';
import { downloadCsv, fmtAmt, fmtDate } from '../../utils/reportExport';
import { ErpBusyOverlay } from '../../components/ui/loaders';

const todayISO = () => new Date().toISOString().split('T')[0];

/** Dimension tabs — only ones with real, stored data. Legacy screenshot also had
 * MainGroup / SalesMan / Area / Discount / Remark tabs, but those fields don't
 * exist anywhere in this system yet (no schema, no data) — omitted rather than faked. */
const TABS = [
  { key: 'parties', label: 'Party' },
  { key: 'brokers', label: 'Broker' },
  { key: 'stations', label: 'Station' },
  { key: 'hastes', label: 'Haste' },
  { key: 'books', label: 'Book' },
  { key: 'states', label: 'State' },
  { key: 'msmeTypes', label: 'MSME Type' },
];

const emptySelected = () => ({
  parties: new Set(),
  brokers: new Set(),
  stations: new Set(),
  hastes: new Set(),
  books: new Set(),
  states: new Set(),
  msmeTypes: new Set(),
});

const emptyOptions = () => ({
  parties: [], brokers: [], stations: [], hastes: [], books: [], states: [], msmeTypes: [],
});

/**
 * Outstanding report — Bill Date range + multi-dimension filter tabs (Party/Broker/
 * Station/Haste/Book/State/MSME Type), each backed by real distinct values from the DB.
 * type: 'receivable' (Sales/Outstanding-Sales) | 'payable' (Purchase/Outstanding-Purchase)
 */
const OutstandingReportModal = ({ isOpen, onClose, type = 'receivable' }) => {
  const { fetchOutstandingReportFiltered, fetchOutstandingFilterOptions } = useStore();

  const [billDateFrom, setBillDateFrom] = useState('2000-04-01');
  const [billDateTo, setBillDateTo] = useState(todayISO());
  const [status, setStatus] = useState('Pending');
  const [activeTab, setActiveTab] = useState('parties');
  const [tabSearch, setTabSearch] = useState('');
  const [options, setOptions] = useState(emptyOptions());
  const [selected, setSelected] = useState(emptySelected());
  const [grandTotal, setGrandTotal] = useState(true);
  const [summaryOnly, setSummaryOnly] = useState(false);
  const [rows, setRows] = useState(null);
  const [expandedId, setExpandedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(false);

  const title = `Outstanding (${type === 'receivable' ? 'SALES' : 'PURCHASE'})`;

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setBootLoading(true);
    setRows(null);
    setSelected(emptySelected());
    fetchOutstandingFilterOptions(type)
      .then((data) => { if (!cancelled) setOptions(data); })
      .finally(() => { if (!cancelled) setBootLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, type, fetchOutstandingFilterOptions]);

  const activeList = useMemo(() => {
    const list = options[activeTab] || [];
    const q = tabSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((item) => {
      const label = typeof item === 'string' ? item : item.name;
      return String(label || '').toLowerCase().includes(q);
    });
  }, [options, activeTab, tabSearch]);

  const rowKey = (item) => (typeof item === 'string' ? item : item._id);
  const rowLabel = (item) => (typeof item === 'string' ? item : item.name);

  const toggleRow = (key) => {
    setSelected((prev) => {
      const next = new Set(prev[activeTab]);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...prev, [activeTab]: next };
    });
  };

  const selectAllActive = () => {
    setSelected((prev) => ({ ...prev, [activeTab]: new Set(activeList.map(rowKey)) }));
  };
  const unselectAllActive = () => {
    setSelected((prev) => ({ ...prev, [activeTab]: new Set() }));
  };

  const generate = async () => {
    setLoading(true);
    setExpandedId('');
    try {
      const filters = {
        billDateFrom,
        billDateTo,
        status,
        partyIds: [...selected.parties],
        brokerIds: [...selected.brokers],
        stations: [...selected.stations],
        hastes: [...selected.hastes],
        bookIds: [...selected.books],
        states: [...selected.states],
        msmeTypes: [...selected.msmeTypes],
      };
      const data = await fetchOutstandingReportFiltered(type, filters);
      setRows(data || []);
      if (!data || data.length === 0) notifyWarning('No outstanding bills match this filter');
    } finally {
      setLoading(false);
    }
  };

  const grandTotalAmt = useMemo(
    () => (rows || []).reduce((s, r) => s + (Number(r.totalOutstanding) || 0), 0),
    [rows]
  );

  const exportCsv = () => {
    if (!rows || !rows.length) return notifyWarning('Generate the report first');
    downloadCsv(
      `outstanding-${type}-${todayISO()}.csv`,
      ['Party', 'Address', 'State', 'MSME Type', 'Total Outstanding', '0-30', '31-60', '61-90', '90+'],
      rows.map((r) => [
        r.partyName, r.address, r.state, r.msmeType,
        r.totalOutstanding, r.aging?.bucket30, r.aging?.bucket60, r.aging?.bucket90, r.aging?.bucket90Plus,
      ])
    );
  };

  if (!isOpen) return null;

  return (
    <ErpWindowedModal isOpen={isOpen} onClose={onClose} title={title} windowId={`outstanding-${type}`} bare>
      {({ WindowControls }) => (
        <div className="classic-erp-window erp-density flex flex-col h-full min-h-0 !max-h-none">
          <ErpBusyOverlay show={bootLoading} message="Loading filter options…" />
          <ErpBusyOverlay show={loading} message="Generating report…" />

          <div className="classic-erp-header shrink-0">
            <span className="erp-window-title truncate">{title}</span>
            <WindowControls />
          </div>

          <div className="classic-erp-body flex-1 overflow-y-auto min-h-0 flex flex-col gap-2 p-2">
            {/* Top filter bar */}
            <div className="classic-erp-frame flex flex-wrap items-center gap-3">
              <div className="classic-erp-field">
                <span className="classic-erp-label">BillDate From</span>
                <input type="date" className="classic-erp-input" value={billDateFrom} onChange={(e) => setBillDateFrom(e.target.value)} />
              </div>
              <div className="classic-erp-field">
                <span className="classic-erp-label">To</span>
                <input type="date" className="classic-erp-input" value={billDateTo} onChange={(e) => setBillDateTo(e.target.value)} />
              </div>
              <div className="classic-erp-field">
                <span className="classic-erp-label">Status</span>
                <select className="classic-erp-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="Pending">Pending</option>
                  <option value="All">All</option>
                </select>
              </div>
              <label className="classic-erp-label flex items-center gap-1 ml-auto">
                <input type="checkbox" checked={grandTotal} onChange={(e) => setGrandTotal(e.target.checked)} /> Grand Total
              </label>
              <label className="classic-erp-label flex items-center gap-1">
                <input type="checkbox" checked={summaryOnly} onChange={(e) => setSummaryOnly(e.target.checked)} /> Summary
              </label>
            </div>

            {/* Dimension tabs */}
            <div className="classic-erp-frame flex flex-col gap-2 flex-1 min-h-[220px]">
              <div className="flex items-center gap-1 border-b border-slate-300 flex-wrap">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={`px-3 py-1 text-[11px] font-bold border-b-2 -mb-px ${activeTab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}
                    onClick={() => { setActiveTab(t.key); setTabSearch(''); }}
                  >
                    {t.label}
                    {selected[t.key].size > 0 && (
                      <span className="ml-1 text-[9px] bg-blue-600 text-white rounded-full px-1.5">{selected[t.key].size}</span>
                    )}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-2 pb-1">
                  <button type="button" className="classic-erp-btn text-[10px] h-6 px-2" onClick={selectAllActive}>Select All</button>
                  <button type="button" className="classic-erp-btn text-[10px] h-6 px-2" onClick={unselectAllActive}>UnSelect All</button>
                </div>
              </div>

              <input
                type="text"
                className="classic-erp-input h-7 max-w-xs"
                placeholder={`Filter ${TABS.find((t) => t.key === activeTab)?.label}…`}
                value={tabSearch}
                onChange={(e) => setTabSearch(e.target.value)}
              />

              <div className="flex-1 overflow-auto border border-slate-300 rounded-sm">
                <table className="w-full text-[11px] border-collapse">
                  <thead className="sticky top-0 bg-slate-200">
                    <tr>
                      <th className="w-6 border px-1 py-1" />
                      <th className="border px-1 py-1 text-left">Name</th>
                      {activeTab === 'parties' && <th className="border px-1 py-1 text-left">Address / State</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {activeList.length === 0 ? (
                      <tr><td colSpan={3} className="text-center py-4 text-slate-400">No {TABS.find((t) => t.key === activeTab)?.label.toLowerCase()} data</td></tr>
                    ) : (
                      activeList.map((item) => {
                        const key = rowKey(item);
                        const checked = selected[activeTab].has(key);
                        return (
                          <tr key={key} className="cursor-pointer hover:bg-blue-50" onClick={() => toggleRow(key)}>
                            <td className="border px-1 py-0.5 text-center">
                              <input type="checkbox" checked={checked} onChange={() => toggleRow(key)} onClick={(e) => e.stopPropagation()} />
                            </td>
                            <td className="border px-1 py-0.5 font-bold">{rowLabel(item)}</td>
                            {activeTab === 'parties' && (
                              <td className="border px-1 py-0.5 text-slate-600">{[item.address, item.state].filter(Boolean).join(', ')}</td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="button" className="classic-erp-btn btn-blue" onClick={generate} disabled={loading}>
                {loading ? 'Generating…' : 'Show Report'}
              </button>
            </div>

            {/* Result grid */}
            {rows !== null && (
              <div className="classic-erp-frame flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">{rows.length} part{rows.length === 1 ? 'y' : 'ies'}</span>
                  <button type="button" className="classic-erp-btn text-[11px] h-7 px-3" onClick={exportCsv}>Export CSV</button>
                </div>
                <div className="overflow-auto border border-slate-300 rounded-sm max-h-[320px]">
                  <table className="w-full text-[11px] border-collapse">
                    <thead className="sticky top-0 bg-slate-200">
                      <tr>
                        <th className="border px-1 py-1 text-left">Party</th>
                        <th className="border px-1 py-1 text-left">State</th>
                        <th className="border px-1 py-1 text-left">MSME</th>
                        <th className="border px-1 py-1 text-right">Total O/s</th>
                        <th className="border px-1 py-1 text-right">0-30</th>
                        <th className="border px-1 py-1 text-right">31-60</th>
                        <th className="border px-1 py-1 text-right">61-90</th>
                        <th className="border px-1 py-1 text-right">90+</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <React.Fragment key={r.partyId}>
                          <tr
                            className="cursor-pointer hover:bg-blue-50"
                            onClick={() => !summaryOnly && setExpandedId((id) => (id === r.partyId ? '' : r.partyId))}
                          >
                            <td className="border px-1 py-0.5 font-bold">{r.partyName}</td>
                            <td className="border px-1 py-0.5">{r.state}</td>
                            <td className="border px-1 py-0.5">{r.msmeType}</td>
                            <td className="border px-1 py-0.5 text-right font-mono font-bold">{fmtAmt(r.totalOutstanding)}</td>
                            <td className="border px-1 py-0.5 text-right font-mono">{fmtAmt(r.aging?.bucket30)}</td>
                            <td className="border px-1 py-0.5 text-right font-mono">{fmtAmt(r.aging?.bucket60)}</td>
                            <td className="border px-1 py-0.5 text-right font-mono">{fmtAmt(r.aging?.bucket90)}</td>
                            <td className="border px-1 py-0.5 text-right font-mono text-red-700">{fmtAmt(r.aging?.bucket90Plus)}</td>
                          </tr>
                          {!summaryOnly && expandedId === r.partyId && (r.invoices || []).map((inv, i) => (
                            <tr key={i} className="bg-slate-50 text-slate-600">
                              <td className="border px-1 py-0.5 pl-4" colSpan={2}>{inv.docNo}</td>
                              <td className="border px-1 py-0.5">{fmtDate(inv.date)}</td>
                              <td className="border px-1 py-0.5 text-right font-mono">{fmtAmt(inv.outstanding)}</td>
                              <td className="border px-1 py-0.5 text-right font-mono" colSpan={3}>{inv.ageDays}d</td>
                              <td className="border px-1 py-0.5" />
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                    {grandTotal && rows.length > 0 && (
                      <tfoot>
                        <tr className="bg-slate-100 font-bold">
                          <td className="border px-1 py-1" colSpan={3}>Grand Total</td>
                          <td className="border px-1 py-1 text-right font-mono">{fmtAmt(grandTotalAmt)}</td>
                          <td className="border px-1 py-1" colSpan={4} />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="classic-erp-form-footer flex-wrap">
            <button type="button" className="classic-erp-btn" onClick={onClose}>Exit</button>
          </div>
        </div>
      )}
    </ErpWindowedModal>
  );
};

export default OutstandingReportModal;
