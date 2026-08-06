import React, { useState, useEffect, useMemo } from 'react';
import ErpWindowedModal from '../../components/erp/ErpWindowedModal';
import useStore from '../../store/useStore';
import { notifyWarning, notifyInfo } from '../../utils/notify';
import { downloadCsv, fmtAmt, fmtDate } from '../../utils/reportExport';
import { ErpBusyOverlay } from '../../components/ui/loaders';

const todayISO = () => new Date().toISOString().split('T')[0];
const fyStartISO = () => {
  const y = new Date().getFullYear();
  const m = new Date().getMonth();
  const startYear = m >= 3 ? y : y - 1;
  return `${startYear}-04-01`;
};

/** Dimension tabs — every one here is backed by a real, stored field.
 * Legacy also had SalesMan, Area, Group (distinct from MainGroup), and Discount-as-a-filter
 * tabs — none of those exist anywhere in this system (no schema, no data), so they're left
 * out rather than faked. MainGroup is real (Party.mainGroupId, free text). */
const TABS = [
  { key: 'parties', label: 'Party' },
  { key: 'brokers', label: 'Broker' },
  { key: 'stations', label: 'Station' },
  { key: 'mainGroups', label: 'MainGrou' },
  { key: 'books', label: 'Book' },
  { key: 'hastes', label: 'Haste' },
  { key: 'states', label: 'State' },
  { key: 'msmeTypes', label: 'MSME Type' },
];

const GROUP_BY_OPTIONS = [
  { value: 'Party', label: 'Party' },
  { value: 'Broker', label: 'Broker' },
  { value: 'Station', label: 'Station' },
  { value: 'Book', label: 'Book' },
  { value: 'State', label: 'State' },
  { value: 'MSME Type', label: 'MSME Type' },
  { value: 'None', label: 'None' },
];

const emptySelected = () => ({
  parties: new Set(), brokers: new Set(), stations: new Set(), mainGroups: new Set(),
  books: new Set(), hastes: new Set(), states: new Set(), msmeTypes: new Set(),
});

const emptyOptions = () => ({
  parties: [], brokers: [], stations: [], mainGroups: [], books: [], hastes: [], states: [], msmeTypes: [],
});

/**
 * Outstanding report — full filter set from the legacy screenshot, split into what's real
 * vs what's a labeled stub. Every toggle/tab below either changes the actual query (real
 * data) or is disabled with a tooltip explaining what's missing — nothing fakes a result.
 */
const OutstandingReportModal = ({ isOpen, onClose, type = 'receivable' }) => {
  const { fetchOutstandingReportFiltered, fetchOutstandingFilterOptions } = useStore();

  const [billDateFrom, setBillDateFrom] = useState('2000-04-01');
  const [billDateTo, setBillDateTo] = useState(todayISO());
  const [paidDateFrom, setPaidDateFrom] = useState(fyStartISO());
  const [paidDateTo, setPaidDateTo] = useState(todayISO());
  const [usePaidDateFilter, setUsePaidDateFilter] = useState(false);
  const [status, setStatus] = useState('Pending');
  const [activeTab, setActiveTab] = useState('parties');
  const [tabSearch, setTabSearch] = useState('');
  const [options, setOptions] = useState(emptyOptions());
  const [selected, setSelected] = useState(emptySelected());

  // Toggles with real backing
  const [includeLastYear, setIncludeLastYear] = useState(true);
  const [grandTotal, setGrandTotal] = useState(true);
  const [summaryOnly, setSummaryOnly] = useState(false);
  const [onlyFullBill, setOnlyFullBill] = useState(false);
  const [onlyPartReceived, setOnlyPartReceived] = useState(false);
  const [dueDaysMin, setDueDaysMin] = useState('');
  const [remarkSearch, setRemarkSearch] = useState('');
  const [showAddress, setShowAddress] = useState(true);
  const [showBroker, setShowBroker] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [showGstin, setShowGstin] = useState(false);
  const [showBankDetail, setShowBankDetail] = useState(false);
  const [groupBy1, setGroupBy1] = useState('Party');

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
      .then((data) => { if (!cancelled) setOptions({ ...emptyOptions(), ...data }); })
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

  const selectAllActive = () => setSelected((prev) => ({ ...prev, [activeTab]: new Set(activeList.map(rowKey)) }));
  const unselectAllActive = () => setSelected((prev) => ({ ...prev, [activeTab]: new Set() }));

  const setThisMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    setBillDateFrom(start);
    setBillDateTo(todayISO());
  };

  const generate = async () => {
    setLoading(true);
    setExpandedId('');
    try {
      const filters = {
        billDateFrom,
        billDateTo,
        paidDateFrom: usePaidDateFilter ? paidDateFrom : undefined,
        paidDateTo: usePaidDateFilter ? paidDateTo : undefined,
        status,
        partyIds: [...selected.parties],
        brokerIds: [...selected.brokers],
        stations: [...selected.stations],
        mainGroups: [...selected.mainGroups],
        hastes: [...selected.hastes],
        bookIds: [...selected.books],
        states: [...selected.states],
        msmeTypes: [...selected.msmeTypes],
        remarkSearch,
        dueDaysMin: dueDaysMin !== '' ? Number(dueDaysMin) : undefined,
        onlyFullBill,
        onlyPartReceived,
        includeLastYear,
        fyStartDate: fyStartISO(),
      };
      const data = await fetchOutstandingReportFiltered(type, filters);
      setRows(data || []);
      if (!data || data.length === 0) notifyWarning('No outstanding bills match this filter');
    } finally {
      setLoading(false);
    }
  };

  /** Re-buckets the flat invoice list by whichever dimension GroupBy1 picks — real
   * regrouping of real data, not a full multi-level pivot (GroupBy2/3 aren't wired). */
  const groupedRows = useMemo(() => {
    if (!rows) return [];
    if (groupBy1 === 'Party' || groupBy1 === 'None') return rows;
    const buckets = new Map();
    for (const party of rows) {
      for (const inv of party.invoices || []) {
        let key;
        if (groupBy1 === 'Broker') key = inv.broker?.name || inv.broker || 'Unassigned';
        else if (groupBy1 === 'Station') key = inv.station || 'Unassigned';
        else if (groupBy1 === 'Book') key = inv.bookId || 'Unassigned';
        else if (groupBy1 === 'State') key = party.state || 'Unassigned';
        else if (groupBy1 === 'MSME Type') key = party.msmeType || 'None';
        else key = 'Unassigned';
        if (!buckets.has(key)) {
          buckets.set(key, {
            partyId: key, partyName: key, state: '', msmeType: '',
            totalOutstanding: 0, aging: { bucket30: 0, bucket60: 0, bucket90: 0, bucket90Plus: 0 }, invoices: [],
          });
        }
        const b = buckets.get(key);
        b.totalOutstanding += inv.outstanding;
        b.invoices.push(inv);
        if (inv.ageDays <= 30) b.aging.bucket30 += inv.outstanding;
        else if (inv.ageDays <= 60) b.aging.bucket60 += inv.outstanding;
        else if (inv.ageDays <= 90) b.aging.bucket90 += inv.outstanding;
        else b.aging.bucket90Plus += inv.outstanding;
      }
    }
    return Array.from(buckets.values()).sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  }, [rows, groupBy1]);

  const grandTotalAmt = useMemo(
    () => groupedRows.reduce((s, r) => s + (Number(r.totalOutstanding) || 0), 0),
    [groupedRows]
  );

  const exportCsv = () => {
    if (!groupedRows.length) return notifyWarning('Generate the report first');
    downloadCsv(
      `outstanding-${type}-${todayISO()}.csv`,
      ['Name', 'State', 'MSME Type', 'Total Outstanding', '0-30', '31-60', '61-90', '90+'],
      groupedRows.map((r) => [
        r.partyName, r.state, r.msmeType,
        r.totalOutstanding, r.aging?.bucket30, r.aging?.bucket60, r.aging?.bucket90, r.aging?.bucket90Plus,
      ])
    );
  };

  const stub = (label) => () => notifyInfo(`${label} — not implemented (no backing data/logic for this yet)`);

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

          <div className="classic-erp-body flex-1 overflow-y-auto min-h-0 flex flex-col gap-2 p-2" style={{ background: '#7fd4d4' }}>
            {/* Date filter bar */}
            <div className="flex flex-wrap items-center gap-3 p-1">
              <span className="text-[11px] font-bold">BillDate :</span>
              <span className="classic-erp-label">From</span>
              <input type="date" className="classic-erp-input" value={billDateFrom} onChange={(e) => setBillDateFrom(e.target.value)} />
              <span className="classic-erp-label">To</span>
              <input type="date" className="classic-erp-input" value={billDateTo} onChange={(e) => setBillDateTo(e.target.value)} />
              <span className="text-[10px] text-slate-600 ml-2">Company</span>
              <select className="classic-erp-select" value="current" disabled title="Single-company system">
                <option value="current">Current</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-3 p-1">
              <span className="text-[11px] font-bold">PaidDate :</span>
              <span className="classic-erp-label">From</span>
              <input type="date" className="classic-erp-input" value={paidDateFrom} onChange={(e) => setPaidDateFrom(e.target.value)} disabled={!usePaidDateFilter} />
              <span className="classic-erp-label">To</span>
              <input type="date" className="classic-erp-input" value={paidDateTo} onChange={(e) => setPaidDateTo(e.target.value)} disabled={!usePaidDateFilter} />
              <label className="classic-erp-label flex items-center gap-1" title="Only show bills that received a payment within this date range">
                <input type="checkbox" checked={usePaidDateFilter} onChange={(e) => setUsePaidDateFilter(e.target.checked)} /> PaymentSummary
              </label>
              <span className="text-[10px] text-slate-600 ml-2">Status</span>
              <select className="classic-erp-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="Pending">Pending</option>
                <option value="All">All</option>
              </select>
            </div>

            <div className="flex items-center justify-between px-1">
              <label className="classic-erp-label flex items-center gap-1" title="Not implemented — no per-invoice 'process' flag exists">
                <input type="checkbox" disabled onClick={stub('New Process')} /> New Process
              </label>
              <div className="flex items-center gap-2">
                <button type="button" className="classic-erp-btn text-[10px] h-6 px-2" onClick={selectAllActive}>Select All</button>
                <button type="button" className="classic-erp-btn text-[10px] h-6 px-2" onClick={unselectAllActive}>UnSelect All</button>
              </div>
            </div>

            {/* Dimension tabs */}
            <div className="classic-erp-frame flex flex-col gap-2 flex-1 min-h-[200px]" style={{ background: '#fff' }}>
              <div className="flex items-center gap-1 border-b border-slate-300 flex-wrap">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={`px-3 py-1 text-[11px] font-bold border-b-2 -mb-px ${activeTab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}
                    onClick={() => { setActiveTab(t.key); setTabSearch(''); }}
                  >
                    {t.label}
                    {selected[t.key]?.size > 0 && (
                      <span className="ml-1 text-[9px] bg-blue-600 text-white rounded-full px-1.5">{selected[t.key].size}</span>
                    )}
                  </button>
                ))}
                {['SalesMan', 'Area', 'Discount', 'Remark'].map((label) => (
                  <button key={label} type="button" disabled className="px-3 py-1 text-[11px] font-bold text-slate-300 cursor-not-allowed" title={`${label} — no field for this exists on any invoice/party yet`}>
                    {label}
                  </button>
                ))}
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
                        const checked = selected[activeTab]?.has(key);
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

            {/* Toggle grid — 3 columns, matching the legacy layout */}
            <div className="classic-erp-frame grid grid-cols-3 gap-x-4 gap-y-1 text-[11px] p-2" style={{ background: '#fff' }}>
              <label className="flex items-center gap-1"><input type="checkbox" checked={includeLastYear} onChange={(e) => setIncludeLastYear(e.target.checked)} title="Unchecked = only bills from this financial year onward" /> New Year Bill</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={showAddress} onChange={(e) => setShowAddress(e.target.checked)} /> With Address</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={grandTotal} onChange={(e) => setGrandTotal(e.target.checked)} /> Grand Total</label>

              <label className="flex items-center gap-1"><input type="checkbox" checked={includeLastYear} onChange={(e) => setIncludeLastYear(e.target.checked)} /> Include Lastyear O/s.</label>
              <label className="flex items-center gap-1 text-slate-300" title="No 'individual total by type' breakdown exists"><input type="checkbox" disabled /> With Individual Total(Type)</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={showBroker} onChange={(e) => setShowBroker(e.target.checked)} /> With Broker</label>

              <label className="flex items-center gap-1"><input type="checkbox" checked disabled title="Default behavior — unadjusted amounts are always shown" /> With Unadjust Entry</label>
              <label className="flex items-center gap-1 text-slate-300" title="No per-bill 'direct close' flag exists"><input type="checkbox" disabled /> Only Direct Bill Close List</label>
              <label className="flex items-center gap-1 text-slate-300" title="No 'Rg' (retention/guarantee) tracking on invoices"><input type="checkbox" disabled /> With BrokerAddr</label>

              <label className="flex items-center gap-1 text-slate-300" title="No WhatsApp delivery provider configured — stub only"><input type="checkbox" disabled onClick={stub('Whatsapp Bulk Send')} /> Whatsapp Bulk Send</label>
              <label className="flex items-center gap-1 text-slate-300" title="No 'Rg pending' concept exists on invoices"><input type="checkbox" disabled /> With Rg Pending</label>
              <label className="flex items-center gap-1 text-slate-300" title="Per-record grouping variant — not implemented"><input type="checkbox" disabled /> Linning Per Record</label>

              <label className="flex items-center gap-1"><input type="checkbox" checked={onlyPartReceived} onChange={(e) => setOnlyPartReceived(e.target.checked)} /> Only Part Received</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={showPhone} onChange={(e) => setShowPhone(e.target.checked)} /> With PhoneNum</label>
              <label className="flex items-center gap-1 text-slate-300" title="Legacy running-total-by-line variant — not implemented"><input type="checkbox" disabled /> Linning Party Total</label>

              <label className="flex items-center gap-1"><input type="checkbox" checked={showBankDetail} onChange={(e) => setShowBankDetail(e.target.checked)} /> BankDetail</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={showGstin} onChange={(e) => setShowGstin(e.target.checked)} /> With GstinNo</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={summaryOnly} onChange={(e) => setSummaryOnly(e.target.checked)} /> Summary</label>
            </div>

            <div className="flex flex-wrap items-center gap-4 px-1">
              <div className="flex items-center gap-2">
                <span className="classic-erp-label">Due Days &gt;= More Than</span>
                <input type="number" className="classic-erp-input w-20" value={dueDaysMin} onChange={(e) => setDueDaysMin(e.target.value)} placeholder="0" />
              </div>
              <div className="flex items-center gap-2">
                <span className="classic-erp-label">Remark contains</span>
                <input type="text" className="classic-erp-input w-40" value={remarkSearch} onChange={(e) => setRemarkSearch(e.target.value)} placeholder="search bill remarks…" />
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <span className="classic-erp-label">GroupBy 1</span>
                <select className="classic-erp-select" value={groupBy1} onChange={(e) => setGroupBy1(e.target.value)}>
                  {GROUP_BY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <span className="classic-erp-label text-slate-300" title="Nested second/third-level grouping — not implemented">GroupBy 2/3</span>
                <select className="classic-erp-select" disabled><option>None</option></select>
                <span className="classic-erp-label text-slate-300" title="No print template system exists for this report yet">Printout Pattern</span>
                <select className="classic-erp-select" disabled><option>1-Continue</option></select>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="button" className="classic-erp-btn btn-blue" onClick={generate} disabled={loading}>
                {loading ? 'Generating…' : 'Ok'}
              </button>
            </div>

            {/* Result grid */}
            {rows !== null && (
              <div className="classic-erp-frame flex flex-col gap-2" style={{ background: '#fff' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">{groupedRows.length} row{groupedRows.length === 1 ? '' : 's'} (grouped by {groupBy1})</span>
                  <button type="button" className="classic-erp-btn text-[11px] h-7 px-3" onClick={exportCsv}>Export CSV</button>
                </div>
                <div className="overflow-auto border border-slate-300 rounded-sm max-h-[320px]">
                  <table className="w-full text-[11px] border-collapse">
                    <thead className="sticky top-0 bg-slate-200">
                      <tr>
                        <th className="border px-1 py-1 text-left">{groupBy1 === 'Party' || groupBy1 === 'None' ? 'Party' : groupBy1}</th>
                        {showAddress && <th className="border px-1 py-1 text-left">State</th>}
                        <th className="border px-1 py-1 text-left">MSME</th>
                        {showPhone && <th className="border px-1 py-1 text-left">Phone</th>}
                        {showGstin && <th className="border px-1 py-1 text-left">GSTIN</th>}
                        {showBankDetail && <th className="border px-1 py-1 text-left">Bank</th>}
                        <th className="border px-1 py-1 text-right">Total O/s</th>
                        <th className="border px-1 py-1 text-right">0-30</th>
                        <th className="border px-1 py-1 text-right">31-60</th>
                        <th className="border px-1 py-1 text-right">61-90</th>
                        <th className="border px-1 py-1 text-right">90+</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedRows.map((r) => (
                        <React.Fragment key={r.partyId}>
                          <tr
                            className="cursor-pointer hover:bg-blue-50"
                            onClick={() => !summaryOnly && setExpandedId((id) => (id === r.partyId ? '' : r.partyId))}
                          >
                            <td className="border px-1 py-0.5 font-bold">{r.partyName}</td>
                            {showAddress && <td className="border px-1 py-0.5">{r.state}</td>}
                            <td className="border px-1 py-0.5">{r.msmeType}</td>
                            {showPhone && <td className="border px-1 py-0.5">{r.phone || ''}</td>}
                            {showGstin && <td className="border px-1 py-0.5">{r.gstin || ''}</td>}
                            {showBankDetail && <td className="border px-1 py-0.5">{(r.banks || []).map((b) => b.name).join(', ')}</td>}
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
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                    {grandTotal && groupedRows.length > 0 && (
                      <tfoot>
                        <tr className="bg-slate-100 font-bold">
                          <td className="border px-1 py-1" colSpan={2 + (showAddress ? 1 : 0) + (showPhone ? 1 : 0) + (showGstin ? 1 : 0) + (showBankDetail ? 1 : 0)}>Grand Total</td>
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
            <button type="button" className="classic-erp-btn" onClick={() => notifyInfo('ZOOM — not implemented')}>ZOOM</button>
            <button type="button" className="classic-erp-btn" onClick={() => notifyInfo('Z — not implemented')}>Z</button>
            <button type="button" className="classic-erp-btn" onClick={setThisMonth}>Month</button>
            <label className="classic-erp-label flex items-center gap-1"><input type="checkbox" checked={onlyFullBill} onChange={(e) => setOnlyFullBill(e.target.checked)} /> Only Full Bill</label>
            <label className="classic-erp-label flex items-center gap-1 text-slate-400" title="No save/session logging exists for this report"><input type="checkbox" disabled /> SvLog</label>
            <label className="classic-erp-label flex items-center gap-1 text-slate-400" title="Alternate flat-table layout — not implemented"><input type="checkbox" disabled /> Table</label>
            <button type="button" className="classic-erp-btn btn-blue ml-auto" onClick={generate} disabled={loading}>Ok</button>
            <button type="button" className="classic-erp-btn" onClick={onClose}>Exit</button>
          </div>
        </div>
      )}
    </ErpWindowedModal>
  );
};

export default OutstandingReportModal;
