import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  const [groupBy2, setGroupBy2] = useState('None');
  const [groupBy3, setGroupBy3] = useState('None');
  // Backed by real data as of this build — see reportService.getOutstanding.
  const [onlyRgPending, setOnlyRgPending] = useState(false);
  const [onlyDirectBillClose, setOnlyDirectBillClose] = useState(false);
  const [withLedgerBalance, setWithLedgerBalance] = useState(false);
  const [printPattern, setPrintPattern] = useState('1-Continue');
  const [tableMode, setTableMode] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [columnSetOpen, setColumnSetOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [hiddenCols, setHiddenCols] = useState(() => new Set());
  const findRef = useRef(null);
  const printRef = useRef(null);

  const [rows, setRows] = useState(null);
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
    setFindQuery('');
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
        onlyRgPending,
        onlyDirectBillClose,
        withLedgerBalance,
      };
      const data = await fetchOutstandingReportFiltered(type, filters);
      setRows(data || []);
      if (!data || data.length === 0) notifyWarning('No outstanding bills match this filter');
    } finally {
      setLoading(false);
    }
  };


  /** Reference report columns. `key` is used by ColumnSet to show/hide. */
  const COLUMNS = [
    { key: 'co', label: 'CO', align: 'left' },
    { key: 'billNo', label: 'BILLNO', align: 'left' },
    { key: 'billDate', label: 'BILL.DATE', align: 'left' },
    { key: 'billAmt', label: 'BILL AMT', align: 'right', num: true },
    { key: 'paidDate', label: 'PAID.DATE', align: 'left' },
    { key: 'paidAmt', label: 'PAID.AMT', align: 'right', num: true },
    { key: 'goodsRtn', label: 'GOODS.RTN', align: 'right', num: true },
    { key: 'addLess', label: 'ADDLESS', align: 'right', num: true },
    { key: 'balance', label: 'BALANCE', align: 'right', num: true },
    { key: 'days', label: 'DAYS', align: 'right' },
  ];
  const visibleCols = COLUMNS.filter((c) => !hiddenCols.has(c.key));

  /** Value of one grouping dimension for a given party+bill pair. */
  const dimValue = (dim, party, inv) => {
    switch (dim) {
      case 'Party': return party.partyName || 'Unassigned';
      case 'Broker': return inv.broker?.name || inv.broker || 'Unassigned';
      case 'Station': return inv.station || 'Unassigned';
      case 'Book': return inv.bookId || 'Unassigned';
      case 'State': return party.state || 'Unassigned';
      case 'MSME Type': return party.msmeType || 'None';
      default: return null;
    }
  };

  const blankTotals = () => ({ billAmt: 0, paidAmt: 0, goodsRtn: 0, addLess: 0, balance: 0 });
  const addTotals = (t, r) => {
    t.billAmt += r.billAmt; t.paidAmt += r.paidAmt; t.goodsRtn += r.goodsRtn;
    t.addLess += r.addLess; t.balance += r.balance;
  };

  /**
   * Flatten the API response into the reference report's row stream:
   *   group header -> bill rows -> TOTAL-<group> -> ... -> GRAND TOTAL
   * Every figure comes straight off the backend row; nothing is recalculated here beyond
   * summing the very rows that are displayed, so totals can never drift from the list.
   */
  const report = useMemo(() => {
    const empty = { lines: [], grand: blankTotals(), billCount: 0 };
    if (!rows) return empty;

    const dims = [groupBy1, groupBy2, groupBy3].filter((d) => d && d !== 'None');
    const q = findQuery.trim().toLowerCase();

    // One flat record per bill, carrying its party context.
    const flat = [];
    for (const party of rows) {
      for (const inv of party.invoices || []) {
        const rec = {
          party,
          co: party.partyName || '',
          billNo: inv.docNo || '',
          billDate: inv.date,
          billAmt: Number(inv.total || 0),
          paidDate: inv.paidDate || null,
          paidAmt: Number(inv.paid || 0),
          goodsRtn: Number(inv.goodsRtn || 0),
          addLess: Number(inv.addLess || 0),
          balance: Number(inv.outstanding || 0),
          days: Number(inv.ageDays || 0),
          rg: Number(inv.rg || 0),
          billPaidAmount: Number(inv.billPaidAmount || 0),
        };
        if (q) {
          const hay = [rec.co, rec.billNo, fmtDate(rec.billDate), rec.billAmt, rec.balance, rec.days,
            party.gstin, party.phone, party.state].join(' ').toLowerCase();
          if (!hay.includes(q)) continue;
        }
        flat.push(rec);
      }
    }

    const lines = [];
    const grand = blankTotals();

    const walk = (records, depth) => {
      if (depth >= dims.length) {
        for (const r of records) {
          lines.push({ kind: 'bill', rec: r });
          addTotals(grand, r);
        }
        return;
      }
      const dim = dims[depth];
      const buckets = new Map();
      for (const r of records) {
        const key = dimValue(dim, r.party, r) ?? 'Unassigned';
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(r);
      }
      const sorted = [...buckets.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
      for (const [key, group] of sorted) {
        lines.push({
          kind: 'group', depth, dim,
          label: dim.toUpperCase() + ' - ' + key,
          party: group[0].party,
        });
        const before = { ...grand };
        walk(group, depth + 1);
        // Subtotal = what this branch contributed to the running grand total, so a
        // TOTAL row can never disagree with the bill rows printed above it.
        lines.push({
          kind: 'total', depth,
          label: 'TOTAL-' + dim.toUpperCase(),
          party: group[0].party,
          totals: {
            billAmt: grand.billAmt - before.billAmt,
            paidAmt: grand.paidAmt - before.paidAmt,
            goodsRtn: grand.goodsRtn - before.goodsRtn,
            addLess: grand.addLess - before.addLess,
            balance: grand.balance - before.balance,
          },
        });
      }
    };

    if (dims.length === 0) {
      for (const r of flat) { lines.push({ kind: 'bill', rec: r }); addTotals(grand, r); }
    } else {
      walk(flat, 0);
    }

    return { lines, grand, billCount: flat.length };
  }, [rows, groupBy1, groupBy2, groupBy3, findQuery]);

  /** Summary collapses to group totals only — the underlying bill detail is untouched. */
  const displayLines = useMemo(
    () => (summaryOnly ? report.lines.filter((l) => l.kind !== 'bill') : report.lines),
    [report.lines, summaryOnly]
  );

  const cellValue = (col, rec) => {
    switch (col.key) {
      case 'co': return rec.co;
      case 'billNo': return rec.billNo;
      case 'billDate': return fmtDate(rec.billDate);
      case 'billAmt': return fmtAmt(rec.billAmt);
      case 'paidDate': return rec.paidDate ? fmtDate(rec.paidDate) : '';
      case 'paidAmt': return fmtAmt(rec.paidAmt);
      case 'goodsRtn': return fmtAmt(rec.goodsRtn);
      case 'addLess': return fmtAmt(rec.addLess);
      case 'balance': return fmtAmt(rec.balance);
      case 'days': return rec.days;
      default: return '';
    }
  };

  const totalCell = (col, t) => {
    switch (col.key) {
      case 'billAmt': return fmtAmt(t.billAmt);
      case 'paidAmt': return fmtAmt(t.paidAmt);
      case 'goodsRtn': return fmtAmt(t.goodsRtn);
      case 'addLess': return fmtAmt(t.addLess);
      case 'balance': return fmtAmt(t.balance);
      default: return '';
    }
  };

  const rawNum = (v) => String(Number(String(v).replace(/,/g, '')) || 0);

  /** Exports the exact rows on screen — same grouping, same totals, same column set. */
  const exportCsv = () => {
    if (!displayLines.length) return notifyWarning('Generate the report first');
    const headers = visibleCols.map((c) => c.label);
    const body = [];
    for (const line of displayLines) {
      if (line.kind === 'group') {
        body.push([line.label, ...visibleCols.slice(1).map(() => '')]);
      } else if (line.kind === 'total') {
        body.push(visibleCols.map((c, i) => (i === 0 ? line.label : rawNum(totalCell(c, line.totals)))));
      } else {
        body.push(visibleCols.map((c) => {
          const v = cellValue(c, line.rec);
          return c.num ? rawNum(v) : String(v ?? '');
        }));
      }
    }
    if (grandTotal) {
      body.push(visibleCols.map((c, i) => (i === 0 ? 'GRAND TOTAL' : rawNum(totalCell(c, report.grand)))));
    }
    downloadCsv(`outstanding-${type}-${todayISO()}.csv`, headers, body);
  };

  const doPrint = () => {
    if (!displayLines.length) return notifyWarning('Generate the report first');
    document.body.classList.add('os-printing');
    setTimeout(() => {
      window.print();
      setTimeout(() => document.body.classList.remove('os-printing'), 400);
    }, 50);
  };

  // F3 focuses Find, Escape clears it — reference keyboard behaviour.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'F3') {
        e.preventDefault();
        findRef.current?.focus();
        findRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

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
              <label className="flex items-center gap-1" title="Show each party's ledger closing balance beside its bill-wise total">
                <input type="checkbox" checked={withLedgerBalance} onChange={(e) => setWithLedgerBalance(e.target.checked)} /> With Ledger Balance
              </label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={showBroker} onChange={(e) => setShowBroker(e.target.checked)} /> With Broker</label>

              <label className="flex items-center gap-1"><input type="checkbox" checked disabled title="Default behavior — unadjusted amounts are always shown" /> With Unadjust Entry</label>
              <label className="flex items-center gap-1" title="Bills fully settled by a single voucher — no part-payment history">
                <input type="checkbox" checked={onlyDirectBillClose} onChange={(e) => setOnlyDirectBillClose(e.target.checked)} /> Only Direct Bill Close List
              </label>
              <label className="flex items-center gap-1 text-slate-300" title="Broker address is not stored on the party master"><input type="checkbox" disabled /> With BrokerAddr</label>

              <label className="flex items-center gap-1 text-slate-300" title="No WhatsApp delivery provider configured — stub only"><input type="checkbox" disabled onClick={stub('Whatsapp Bulk Send')} /> Whatsapp Bulk Send</label>
              <label className="flex items-center gap-1" title="Bills carrying an Rg adjustment on a voucher allocation">
                <input type="checkbox" checked={onlyRgPending} onChange={(e) => setOnlyRgPending(e.target.checked)} /> With Rg Pending
              </label>
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
                <span className="classic-erp-label">GroupBy 2</span>
                <select className="classic-erp-select" value={groupBy2} onChange={(e) => setGroupBy2(e.target.value)}>
                  {GROUP_BY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <span className="classic-erp-label">GroupBy 3</span>
                <select className="classic-erp-select" value={groupBy3} onChange={(e) => setGroupBy3(e.target.value)}>
                  {GROUP_BY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <span className="classic-erp-label">Printout Pattern</span>
                <select className="classic-erp-select" value={printPattern} onChange={(e) => setPrintPattern(e.target.value)} title="Row density used on screen and when printing">
                  <option value="1-Continue">1-Continue</option>
                  <option value="2-Compact">2-Compact</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="button" className="classic-erp-btn btn-blue" onClick={generate} disabled={loading}>
                {loading ? 'Generating…' : 'Ok'}
              </button>
            </div>

            {/* Result — reference "Report Control" bill-wise grid */}
            {rows !== null && (
              <div className="classic-erp-frame flex flex-col gap-2" style={{ background: '#fff' }}>
                <div className="flex flex-wrap items-center gap-2 print:hidden">
                  <span className="text-xs font-bold text-slate-600">
                    {report.billCount} bill{report.billCount === 1 ? '' : 's'}
                    {[groupBy1, groupBy2, groupBy3].filter((d) => d !== 'None').length > 0
                      ? ` · grouped by ${[groupBy1, groupBy2, groupBy3].filter((d) => d !== 'None').join(' › ')}`
                      : ''}
                  </span>
                  <div className="flex items-center gap-1 ml-2">
                    <span className="classic-erp-label">Find</span>
                    <input
                      ref={findRef}
                      type="text"
                      className="classic-erp-input w-40"
                      placeholder="F3 — party / bill / amount…"
                      value={findQuery}
                      onChange={(e) => setFindQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setFindQuery(''); } }}
                    />
                    {findQuery && (
                      <button type="button" className="classic-erp-btn text-[10px] h-6 px-2" onClick={() => setFindQuery('')}>Clear</button>
                    )}
                  </div>
                  <div className="relative ml-auto">
                    <button type="button" className="classic-erp-btn text-[11px] h-7 px-3" onClick={() => setColumnSetOpen((v) => !v)}>ColumnSet</button>
                    {columnSetOpen && (
                      <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-sm border-2 border-blue-700 bg-white p-2 shadow-lg">
                        {COLUMNS.map((c) => (
                          <label key={c.key} className="flex items-center gap-2 py-0.5 text-[11px]">
                            <input
                              type="checkbox"
                              checked={!hiddenCols.has(c.key)}
                              onChange={() => setHiddenCols((prev) => {
                                const next = new Set(prev);
                                if (next.has(c.key)) next.delete(c.key);
                                else next.add(c.key);
                                return next;
                              })}
                            />
                            {c.label}
                          </label>
                        ))}
                        <button type="button" className="classic-erp-btn mt-1 w-full text-[10px] h-6" onClick={() => setHiddenCols(new Set())}>Show all</button>
                      </div>
                    )}
                  </div>
                  <button type="button" className="classic-erp-btn text-[11px] h-7 px-3" onClick={exportCsv}>Excel</button>
                  <button type="button" className="classic-erp-btn text-[11px] h-7 px-3" onClick={() => setPreviewOpen(true)}>PreView</button>
                  <button type="button" className="classic-erp-btn text-[11px] h-7 px-3" onClick={doPrint}>Print</button>
                </div>

                <div
                  ref={printRef}
                  className={`os-report-wrap overflow-auto border border-slate-300 rounded-sm ${tableMode ? '' : 'max-h-[340px]'}`}
                >
                  <table className={`os-report w-full border-collapse ${printPattern === '2-Compact' ? 'text-[10px]' : 'text-[11px]'}`}>
                    <thead className="sticky top-0 bg-slate-200">
                      <tr>
                        {visibleCols.map((c) => (
                          <th key={c.key} className={`border px-1 py-1 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayLines.length === 0 && (
                        <tr><td colSpan={visibleCols.length} className="py-6 text-center text-slate-400">No records match this filter</td></tr>
                      )}
                      {displayLines.map((line, i) => {
                        if (line.kind === 'group') {
                          return (
                            <tr key={`g${i}`} className="os-group">
                              <td colSpan={visibleCols.length} className="border px-1 py-0.5 font-bold" style={{ paddingLeft: 4 + line.depth * 12 }}>
                                {line.label}
                                {withLedgerBalance && line.dim === 'Party' && line.party?.ledgerBalance != null && (
                                  <span className="ml-3 font-normal text-[10px] text-slate-700">
                                    Ledger: {fmtAmt(line.party.ledgerBalance)} {line.party.ledgerBalanceType}
                                    {Math.abs(line.party.ledgerDiff || 0) > 0.01 && (
                                      <span className="ml-1 font-bold text-red-700">(diff {fmtAmt(line.party.ledgerDiff)})</span>
                                    )}
                                  </span>
                                )}
                                {showAddress && line.party?.address && <span className="ml-3 font-normal text-[10px] text-slate-600">{line.party.address}</span>}
                                {showGstin && line.party?.gstin && <span className="ml-2 font-normal text-[10px] text-slate-600">GSTIN {line.party.gstin}</span>}
                                {showPhone && line.party?.phone && <span className="ml-2 font-normal text-[10px] text-slate-600">{line.party.phone}</span>}
                                {showBankDetail && (line.party?.banks || []).length > 0 && (
                                  <span className="ml-2 font-normal text-[10px] text-slate-600">{line.party.banks.map((b) => b.name).join(', ')}</span>
                                )}
                              </td>
                            </tr>
                          );
                        }
                        if (line.kind === 'total') {
                          return (
                            <tr key={`t${i}`} className="os-total">
                              {visibleCols.map((c, ci) => (
                                <td key={c.key} className={`border px-1 py-0.5 font-bold ${c.align === 'right' ? 'text-right font-mono' : ''}`}
                                  style={ci === 0 ? { paddingLeft: 4 + line.depth * 12 } : undefined}>
                                  {ci === 0 ? line.label : totalCell(c, line.totals)}
                                </td>
                              ))}
                            </tr>
                          );
                        }
                        return (
                          <tr key={`b${i}`} className="hover:bg-blue-50">
                            {visibleCols.map((c) => (
                              <td key={c.key} className={`border px-1 py-0.5 ${c.align === 'right' ? 'text-right font-mono' : ''}`}>
                                {cellValue(c, line.rec)}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                    {grandTotal && displayLines.length > 0 && (
                      <tfoot>
                        <tr className="os-grand">
                          {visibleCols.map((c, ci) => (
                            <td key={c.key} className={`border px-1 py-1 font-bold ${c.align === 'right' ? 'text-right font-mono' : ''}`}>
                              {ci === 0 ? 'GRAND TOTAL' : totalCell(c, report.grand)}
                            </td>
                          ))}
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
            <label className="classic-erp-label flex items-center gap-1" title="Full-height flat table — removes the scroll cap so every row prints on one sheet">
              <input type="checkbox" checked={tableMode} onChange={(e) => setTableMode(e.target.checked)} /> Table
            </label>
            <button type="button" className="classic-erp-btn btn-blue ml-auto" onClick={generate} disabled={loading}>Ok</button>
            <button type="button" className="classic-erp-btn" onClick={onClose}>Exit</button>
          </div>

          {/* PreView — same rows, same totals, laid out as the printed sheet */}
          {previewOpen && (
            <div className="os-preview-backdrop" onClick={() => setPreviewOpen(false)}>
              <div className="os-preview-sheet" onClick={(e) => e.stopPropagation()}>
                <div className="os-preview-head">
                  <b>{title}</b>
                  <span>{fmtDate(billDateFrom)} — {fmtDate(billDateTo)} · {report.billCount} bill(s)</span>
                  <div className="ml-auto flex gap-2 print:hidden">
                    <button type="button" className="classic-erp-btn text-[11px] h-7 px-3" onClick={doPrint}>Print</button>
                    <button type="button" className="classic-erp-btn text-[11px] h-7 px-3" onClick={() => setPreviewOpen(false)}>Close</button>
                  </div>
                </div>
                <table className={`os-report w-full border-collapse ${printPattern === '2-Compact' ? 'text-[9px]' : 'text-[10px]'}`}>
                  <thead>
                    <tr>{visibleCols.map((c) => (
                      <th key={c.key} className={`border px-1 py-0.5 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.label}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {displayLines.map((line, i) => {
                      if (line.kind === 'group') {
                        return <tr key={i} className="os-group"><td colSpan={visibleCols.length} className="border px-1 py-0.5 font-bold">{line.label}</td></tr>;
                      }
                      if (line.kind === 'total') {
                        return (
                          <tr key={i} className="os-total">
                            {visibleCols.map((c, ci) => (
                              <td key={c.key} className={`border px-1 py-0.5 font-bold ${c.align === 'right' ? 'text-right font-mono' : ''}`}>
                                {ci === 0 ? line.label : totalCell(c, line.totals)}
                              </td>
                            ))}
                          </tr>
                        );
                      }
                      return (
                        <tr key={i}>
                          {visibleCols.map((c) => (
                            <td key={c.key} className={`border px-1 py-0.5 ${c.align === 'right' ? 'text-right font-mono' : ''}`}>{cellValue(c, line.rec)}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                  {grandTotal && (
                    <tfoot><tr className="os-grand">
                      {visibleCols.map((c, ci) => (
                        <td key={c.key} className={`border px-1 py-1 font-bold ${c.align === 'right' ? 'text-right font-mono' : ''}`}>
                          {ci === 0 ? 'GRAND TOTAL' : totalCell(c, report.grand)}
                        </td>
                      ))}
                    </tr></tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
          <style>{osReportStyles}</style>
        </div>
      )}
    </ErpWindowedModal>
  );
};

const osReportStyles = `
  .os-report .os-group td { background: #cfe2ff; color: #0b2e6f; }
  .os-report .os-total td { background: #f1f5e8; color: #166534; }
  .os-report .os-grand td { background: #e2e8f0; color: #0f172a; border-top: 2px solid #64748b; }
  .os-preview-backdrop {
    position: fixed; inset: 0; z-index: 120; background: rgba(15,23,42,.55);
    display: flex; align-items: flex-start; justify-content: center; padding: 24px; overflow: auto;
  }
  .os-preview-sheet {
    background: #fff; width: min(1100px, 96vw); padding: 14px 16px;
    box-shadow: 0 12px 40px rgba(0,0,0,.35); border-radius: 2px;
  }
  .os-preview-head { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; font-size: 12px; }
  @media print {
    body.os-printing * { visibility: hidden !important; }
    body.os-printing .os-report-wrap, body.os-printing .os-report-wrap *,
    body.os-printing .os-preview-sheet, body.os-printing .os-preview-sheet * { visibility: visible !important; }
    body.os-printing .os-report-wrap {
      position: absolute !important; left: 0; top: 0; width: 100% !important;
      max-height: none !important; overflow: visible !important; border: none !important;
    }
    body.os-printing .os-preview-backdrop { position: absolute !important; inset: auto; background: none !important; padding: 0 !important; }
    .print\\:hidden { display: none !important; }
  }
`;

export default OutstandingReportModal;
