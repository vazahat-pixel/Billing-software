import React, { useState, useEffect, useMemo, useRef } from 'react';
import ErpWindowedModal from '../../components/erp/ErpWindowedModal';
import useStore from '../../store/useStore';
import { notifyWarning, notifyInfo, notifySuccess } from '../../utils/notify';
import { downloadCsv, fmtAmt, fmtDate } from '../../utils/reportExport';
import { ErpBusyOverlay } from '../../components/ui/loaders';
import { openWhatsAppShare } from '../../utils/invoiceHelpers';

const todayISO = () => new Date().toISOString().split('T')[0];
const todayDMY = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};
const fyStartISO = () => {
  const y = new Date().getFullYear();
  const m = new Date().getMonth();
  return `${m >= 3 ? y : y - 1}-04-01`;
};
const dmy = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
};
const n2 = (v) => (Number(v) || 0).toFixed(2);

// All 13 tabs from JSM reference software
const TABS = [
  { key: 'parties', label: 'Party' },
  { key: 'brokers', label: 'Broker' },
  { key: 'stations', label: 'Station' },
  { key: 'mainGroups', label: 'MainGrou' },
  { key: 'books', label: 'Book' },
  { key: 'groups', label: 'Group' },
  { key: 'hastes', label: 'Haste' },
  { key: 'salesmen', label: 'SalesMan' },
  { key: 'areas', label: 'Area' },
  { key: 'discounts', label: 'Discount' },
  { key: 'states', label: 'State' },
  { key: 'remarks', label: 'Remark' },
  { key: 'msmeTypes', label: 'MSME Type' },
];

const GROUP_BY_OPTIONS = [
  { v: 'Party', l: 'Party' },
  { v: 'Broker', l: 'Broker' },
  { v: 'Station', l: 'Station' },
  { v: 'Book', l: 'Book' },
  { v: 'State', l: 'State' },
  { v: 'MSME Type', l: 'MSME Type' },
  { v: 'None', l: 'None' },
];

const PRINTOUT_PATTERNS = [
  { v: '1-Continue', l: '1-Continue' },
  { v: '2-New Page', l: '2-New Page' },
  { v: '3-Party-wise', l: '3-Party-wise' },
];

const emptySelected = () => ({
  parties: new Set(),
  brokers: new Set(),
  stations: new Set(),
  mainGroups: new Set(),
  books: new Set(),
  groups: new Set(),
  hastes: new Set(),
  salesmen: new Set(),
  areas: new Set(),
  discounts: new Set(),
  states: new Set(),
  remarks: new Set(),
  msmeTypes: new Set(),
});

const emptyOptions = () => ({
  parties: [],
  brokers: [],
  stations: [],
  mainGroups: [],
  books: [],
  groups: [],
  hastes: [],
  salesmen: [],
  areas: [],
  discounts: [],
  states: [],
  remarks: [],
  msmeTypes: ['None', 'Micro', 'Small', 'Medium'],
});

/* ── Columns: exact match to reference ── */
const COLUMNS = [
  { key: 'co', label: 'CO', w: '40px' },
  { key: 'billNo', label: 'BILLNO', w: '120px' },
  { key: 'billDate', label: 'BILL.DATE', w: '82px' },
  { key: 'billAmt', label: 'BILL AMT', w: '90px', num: true },
  { key: 'paidDate', label: 'PAID.DATE', w: '82px' },
  { key: 'paidAmt', label: 'PAID.AMT', w: '80px', num: true },
  { key: 'goodsRtn', label: 'GOODS.RTN', w: '80px', num: true },
  { key: 'addLess', label: 'ADDLESS', w: '70px', num: true },
  { key: 'balance', label: 'BALANCE', w: '90px', num: true },
  { key: 'days', label: 'DAYS', w: '42px', num: true },
];

const OutstandingReportModal = ({
  isOpen,
  onClose,
  type = 'receivable',
  directPartyId = '',
  directPartyName = '',
}) => {
  const { fetchOutstandingReportFiltered, fetchOutstandingFilterOptions } = useStore();
  const partyDirect = Boolean(directPartyId);
  const companyCode = 'SCC';

  /* ── active type (Sales vs Purchase) ── */
  const [curType, setCurType] = useState(type || 'receivable');

  useEffect(() => {
    if (type) setCurType(type);
  }, [type]);

  /* ── dates & top controls ── */
  const [billDateFrom, setBillDateFrom] = useState('2000-04-01');
  const [billDateTo, setBillDateTo] = useState(todayISO());
  const [paidDateFrom, setPaidDateFrom] = useState(fyStartISO());
  const [paidDateTo, setPaidDateTo] = useState(todayISO());
  const [usePaidDate, setUsePaidDate] = useState(false);
  const [companyOption, setCompanyOption] = useState('Current');
  const [status, setStatus] = useState('Pending');
  const [newProcess, setNewProcess] = useState(false);

  /* ── active tab & selection ── */
  const [activeTab, setActiveTab] = useState('parties');
  const [quickFilter, setQuickFilter] = useState('');
  const [focusedRowIndex, setFocusedRowIndex] = useState(0);
  const [options, setOptions] = useState(emptyOptions());
  const [selected, setSelected] = useState(emptySelected());

  /* ── options checkboxes (exact JSM fields) ── */
  const [newYearBill, setNewYearBill] = useState(true);
  const [includeLastYear, setIncludeLastYear] = useState(true);
  const [withUnadjustEntry, setWithUnadjustEntry] = useState(true);
  const [whatsappBulkSend, setWhatsappBulkSend] = useState(false);
  const [grandTotal, setGrandTotal] = useState(true);
  const [linningPartyTotal, setLinningPartyTotal] = useState(false);

  const [withLedgerBalance, setWithLedgerBalance] = useState(true);
  const [withIndividualTotal, setWithIndividualTotal] = useState(false);
  const [onlyDirectBillClose, setOnlyDirectBillClose] = useState(false);
  const [onlyRgPending, setOnlyRgPending] = useState(false);
  const [onlyPartReceived, setOnlyPartReceived] = useState(false);
  const [showBankDetail, setShowBankDetail] = useState(false);

  const [showAddress, setShowAddress] = useState(true);
  const [showBroker, setShowBroker] = useState(false);
  const [showBrokerAddr, setShowBrokerAddr] = useState(false);
  const [linningPerRecord, setLinningPerRecord] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [showGstin, setShowGstin] = useState(false);

  /* ── Right side controls ── */
  const [groupBy1, setGroupBy1] = useState('Party');
  const [groupBy2, setGroupBy2] = useState('None');
  const [groupBy3, setGroupBy3] = useState('None');
  const [printoutPattern, setPrintoutPattern] = useState('1-Continue');
  const [dueDaysOp, setDueDaysOp] = useState('>= More Than');
  const [dueDaysMin, setDueDaysMin] = useState('');
  const [summaryOnly, setSummaryOnly] = useState(false);

  /* ── Footer controls ── */
  const [onlyFullBill, setOnlyFullBill] = useState(false);
  const [svLog, setSvLog] = useState(false);
  const [tableMode, setTableMode] = useState(false);

  /* ── Result & Grid State ── */
  const [hiddenCols, setHiddenCols] = useState(() => new Set());
  const [colSetOpen, setColSetOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const findRef = useRef(null);
  const tableRef = useRef(null);

  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(false);
  const [stage, setStage] = useState(() => (directPartyId ? 'result' : 'filter'));

  const getDisplayType = () => {
    if (curType === 'process' || curType === 'mill') return 'PROCESS';
    if (curType === 'jobwork') return 'JOBWORK';
    if (curType === 'payable') return 'PURCHASE';
    return 'SALES';
  };
  const title = `Outstanding(${getDisplayType()})`;

  /* ── generate helper ── */
  const runFetch = async (targetType = curType, customFilters = {}) => {
    setLoading(true);
    setFindQuery('');
    try {
      const pIds = customFilters.partyIds !== undefined ? customFilters.partyIds : [...selected.parties];
      const data = await fetchOutstandingReportFiltered(targetType, {
        billDateFrom,
        billDateTo,
        paidDateFrom: usePaidDate ? paidDateFrom : undefined,
        paidDateTo: usePaidDate ? paidDateTo : undefined,
        status,
        partyIds: pIds,
        brokerIds: [...selected.brokers],
        stations: [...selected.stations],
        mainGroups: [...selected.mainGroups],
        hastes: [...selected.hastes],
        bookIds: [...selected.books],
        states: [...selected.states],
        msmeTypes: [...selected.msmeTypes],
        dueDaysMin: dueDaysMin !== '' ? Number(dueDaysMin) : undefined,
        onlyFullBill,
        onlyPartReceived,
        includeLastYear,
        fyStartDate: fyStartISO(),
        onlyRgPending,
        onlyDirectBillClose,
        withLedgerBalance,
        ...customFilters,
      });
      setRows(data || []);
      setStage('result');
      return data || [];
    } catch (err) {
      console.error('[OutstandingReport] runFetch error:', err);
      notifyWarning('Failed to fetch outstanding report');
      return [];
    } finally {
      setLoading(false);
    }
  };

  /* ── boot options ── */
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    if (partyDirect) {
      setLoading(true);
      setRows(null);
      setStage('result');
      fetchOutstandingReportFiltered(curType, {
        billDateFrom: '2000-04-01',
        billDateTo: todayISO(),
        status: 'Pending',
        partyIds: [directPartyId],
        includeLastYear: true,
      })
        .then((d) => {
          if (!cancelled) {
            setRows(d || []);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      setRows(null);
      setStage('filter');
      setSelected(emptySelected());
      setBootLoading(true);
      fetchOutstandingFilterOptions(curType)
        .then((opts) => {
          if (!cancelled) {
            setOptions({ ...emptyOptions(), ...(opts || {}) });
          }
        })
        .catch((err) => console.error('[Outstanding] error loading filters:', err))
        .finally(() => {
          if (!cancelled) setBootLoading(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [isOpen, curType, partyDirect, directPartyId, fetchOutstandingFilterOptions, fetchOutstandingReportFiltered]);

  const switchType = (newType) => {
    if (newType === curType) return;
    setCurType(newType);
    setSelected(emptySelected());
    setRows(null);
    setStage('filter');
  };

  /* ── Active list calculation ── */
  const activeList = useMemo(() => {
    const list = options[activeTab] || [];
    const q = quickFilter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((item) => {
      if (typeof item === 'string') return item.toLowerCase().includes(q);
      const name = item.name || '';
      const addr = item.address || '';
      const city = item.city || '';
      const code = String(item.accd || item.code || '');
      return (
        name.toLowerCase().includes(q) ||
        addr.toLowerCase().includes(q) ||
        city.toLowerCase().includes(q) ||
        code.includes(q)
      );
    });
  }, [options, activeTab, quickFilter]);

  const rk = (item) => (typeof item === 'string' ? item : item._id || item.name);
  const rl = (item) => (typeof item === 'string' ? item : item.name);

  const toggleRow = (key) => {
    setSelected((prev) => {
      const s = new Set(prev[activeTab]);
      if (s.has(key)) s.delete(key);
      else s.add(key);
      return { ...prev, [activeTab]: s };
    });
  };

  /* ── Select / UnSelect All toggle ── */
  const currentTabKeys = useMemo(() => activeList.map(rk), [activeList]);
  const allCurrentTabSelected = useMemo(() => {
    if (!currentTabKeys.length) return false;
    const s = selected[activeTab] || new Set();
    return currentTabKeys.every((k) => s.has(k));
  }, [currentTabKeys, selected, activeTab]);

  const toggleSelectUnselectAll = () => {
    setSelected((prev) => {
      const s = new Set(prev[activeTab]);
      if (allCurrentTabSelected) {
        currentTabKeys.forEach((k) => s.delete(k));
      } else {
        currentTabKeys.forEach((k) => s.add(k));
      }
      return { ...prev, [activeTab]: s };
    });
  };

  /* ── Month click ── */
  const handleMonthClick = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    setBillDateFrom(firstDay);
    setBillDateTo(todayISO());
    notifyInfo(`Date set to current month (${firstDay} to ${todayISO()})`);
  };

  /* ── generate ── */
  const generate = () => runFetch(curType);
  const generateRef = useRef(generate);
  generateRef.current = generate;

  /* ── Keyboard navigation on table ── */
  const handleTableKeyDown = (e) => {
    if (!activeList.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedRowIndex((prev) => Math.min(prev + 1, activeList.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedRowIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      const currentItem = activeList[focusedRowIndex];
      if (currentItem) toggleRow(rk(currentItem));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      generate();
    }
  };

  /* ── Global hotkeys ── */
  useEffect(() => {
    if (!isOpen) return undefined;
    const fn = (e) => {
      if (e.key === 'F3') {
        e.preventDefault();
        findRef.current?.focus();
        findRef.current?.select();
        return;
      }
      if (e.key === 'Escape') {
        if (stage === 'result' && !partyDirect) {
          e.preventDefault();
          setStage('filter');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [isOpen, stage, partyDirect, onClose]);

  /* ── report computation ── */
  const dimVal = (dim, party, inv) => {
    switch (dim) {
      case 'Party':
        return party?.partyName || party?.name || '—';
      case 'Broker':
        return inv?.broker?.name || inv?.broker || '—';
      case 'Station':
        return inv?.station || party?.city || party?.station || '—';
      case 'Book':
        return inv?.bookId || '—';
      case 'State':
        return party?.state || '—';
      case 'MSME Type':
        return party?.msmeType || 'None';
      default:
        return null;
    }
  };

  const report = useMemo(() => {
    const empty = { groups: new Map(), grand: { billAmt: 0, paidAmt: 0, goodsRtn: 0, addLess: 0, balance: 0 }, count: 0 };
    if (!rows) return empty;
    const dims = [groupBy1, groupBy2, groupBy3].filter((d) => d && d !== 'None');
    const q = findQuery.trim().toLowerCase();

    const flat = [];
    for (const party of rows) {
      for (const inv of party.invoices || party.bills || []) {
        const rec = {
          ...inv,
          party,
          co: companyCode,
          billNo: inv.docNo || inv.billNo || '',
          billDate: inv.date || inv.billDate,
          billAmt: Number(inv.total || inv.billAmt || 0),
          paidDate: inv.paidDate || null,
          paidAmt: Number(inv.paid || inv.paidAmt || 0),
          goodsRtn: Number(inv.goodsRtn || 0),
          addLess: Number(inv.addLess || 0),
          balance: Number(inv.outstanding || inv.balance || 0),
          days: Number(inv.ageDays || inv.days || 0),
        };
        if (q) {
          const hay = [rec.co, rec.billNo, rec.billAmt, rec.balance, rec.days, party.partyName, party.name].join(' ').toLowerCase();
          if (!hay.includes(q)) continue;
        }
        flat.push(rec);
      }
    }

    const groups = new Map();
    const grand = { billAmt: 0, paidAmt: 0, goodsRtn: 0, addLess: 0, balance: 0 };

    if (!dims.length) {
      groups.set('ALL', flat);
    } else {
      for (const rec of flat) {
        const key = dims.map((d) => dimVal(d, rec.party, rec)).join(' › ');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(rec);
      }
    }

    const sorted = new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])));
    for (const recs of sorted.values()) {
      for (const r of recs) {
        grand.billAmt += r.billAmt;
        grand.paidAmt += r.paidAmt;
        grand.goodsRtn += r.goodsRtn;
        grand.addLess += r.addLess;
        grand.balance += r.balance;
      }
    }

    return { groups: sorted, grand, count: flat.length };
  }, [rows, groupBy1, groupBy2, groupBy3, findQuery, companyCode]);

  const sumGroup = (recs) =>
    recs.reduce(
      (t, r) => ({
        billAmt: t.billAmt + r.billAmt,
        paidAmt: t.paidAmt + r.paidAmt,
        goodsRtn: t.goodsRtn + r.goodsRtn,
        addLess: t.addLess + r.addLess,
        balance: t.balance + r.balance,
      }),
      { billAmt: 0, paidAmt: 0, goodsRtn: 0, addLess: 0, balance: 0 }
    );

  const visCols = COLUMNS.filter((c) => !hiddenCols.has(c.key));

  const cellVal = (col, rec) => {
    switch (col.key) {
      case 'co':
        return rec.co;
      case 'billNo':
        return rec.billNo;
      case 'billDate':
        return dmy(rec.billDate);
      case 'billAmt':
        return n2(rec.billAmt);
      case 'paidDate':
        return rec.paidDate ? dmy(rec.paidDate) : '';
      case 'paidAmt':
        return n2(rec.paidAmt);
      case 'goodsRtn':
        return n2(rec.goodsRtn);
      case 'addLess':
        return n2(rec.addLess);
      case 'balance':
        return n2(rec.balance);
      case 'days':
        return rec.days;
      default:
        return '';
    }
  };

  const totVal = (col, t) => {
    if (['billAmt', 'paidAmt', 'goodsRtn', 'addLess', 'balance'].includes(col.key)) return n2(t[col.key]);
    return '';
  };

  const exportCsv = () => {
    if (!report.count) return notifyWarning('Generate first');
    const hdr = visCols.map((c) => c.label);
    const body = [];
    report.groups.forEach((recs, key) => {
      if (key !== 'ALL') body.push([`PARTY - ${key}`]);
      recs.forEach((r) => body.push(visCols.map((c) => cellVal(c, r))));
      const t = sumGroup(recs);
      body.push(visCols.map((c, i) => (i === 0 ? 'TOTAL-PARTY' : totVal(c, t))));
    });
    if (grandTotal) body.push(visCols.map((c, i) => (i === 0 ? 'GRAND TOTAL' : totVal(c, report.grand))));
    downloadCsv(`outstanding-${curType}-${todayISO()}.csv`, hdr, body);
  };

  if (!isOpen) return null;

  return (
    <ErpWindowedModal isOpen onClose={onClose} title={title} windowId={`os-${curType}`} bare>
      {({ WindowControls }) => (
        <div className="jsm-os-window">
          <ErpBusyOverlay show={bootLoading || loading} message={loading ? 'Generating…' : 'Loading…'} />
          <style>{jsmCss}</style>

          {/* ══════ WINDOW TITLE BAR ══════ */}
          <div className="jsm-titlebar">
            <div className="jsm-title-icon">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 2h12v2H2V2zm0 4h12v2H2V6zm0 4h8v2H2v-2zm0 4h5v2H2v-2z" />
              </svg>
            </div>
            <span className="jsm-titlebar-title">{title}</span>

            {/* Quick type toggle between Sales and Purchase */}
            {!partyDirect && (
              <div className="jsm-type-switch">
                <button
                  type="button"
                  className={`jsm-type-toggle-btn ${curType === 'receivable' ? 'active' : ''}`}
                  onClick={() => switchType('receivable')}
                  title="Sales Outstanding (Debitors)"
                >
                  SALES
                </button>
                <button
                  type="button"
                  className={`jsm-type-toggle-btn ${curType === 'payable' ? 'active' : ''}`}
                  onClick={() => switchType('payable')}
                  title="Purchase Outstanding (Creditors)"
                >
                  PURCHASE
                </button>
                <button
                  type="button"
                  className={`jsm-type-toggle-btn ${curType === 'process' ? 'active' : ''}`}
                  onClick={() => switchType('process')}
                  title="Process Outstanding (Mill)"
                >
                  PROCESS
                </button>
                <button
                  type="button"
                  className={`jsm-type-toggle-btn ${curType === 'jobwork' ? 'active' : ''}`}
                  onClick={() => switchType('jobwork')}
                  title="JobWork Outstanding"
                >
                  JOBWORK
                </button>
              </div>
            )}

            <div className="jsm-window-controls">
              <WindowControls />
            </div>
          </div>

          {/* ══════ FILTER VIEW (EXACT JSM REFERENCE UI) ══════ */}
          {stage === 'filter' && !partyDirect && (
            <div className="jsm-dialog-body">
              {/* TOP ROW 1: BillDate From/To + Today + Search + Company */}
              <div className="jsm-filter-row">
                <span className="jsm-label-bold">BillDate :</span>
                <span className="jsm-label">From</span>
                <input
                  type="date"
                  value={billDateFrom}
                  onChange={(e) => setBillDateFrom(e.target.value)}
                  className="jsm-input jsm-date-input"
                />
                <span className="jsm-label">To</span>
                <input
                  type="date"
                  value={billDateTo}
                  onChange={(e) => setBillDateTo(e.target.value)}
                  className="jsm-input jsm-date-input"
                />
                <input
                  type="text"
                  value={todayDMY()}
                  readOnly
                  className="jsm-input jsm-date-display"
                  title="Current Date"
                />
                <input
                  type="text"
                  placeholder="Filter name..."
                  value={quickFilter}
                  onChange={(e) => setQuickFilter(e.target.value)}
                  className="jsm-input jsm-quick-search"
                />

                <div className="jsm-spacer" />

                <span className="jsm-label">Company</span>
                <select
                  value={companyOption}
                  onChange={(e) => setCompanyOption(e.target.value)}
                  className="jsm-select jsm-company-select"
                >
                  <option value="Current">Current</option>
                  <option value="All">All Companies</option>
                </select>
              </div>

              {/* TOP ROW 2: PaidDate From/To + PaymentSummary + Status */}
              <div className="jsm-filter-row">
                <span className="jsm-label-bold">PaidDate :</span>
                <span className="jsm-label">From</span>
                <input
                  type="date"
                  value={paidDateFrom}
                  onChange={(e) => setPaidDateFrom(e.target.value)}
                  disabled={!usePaidDate}
                  className="jsm-input jsm-date-input"
                />
                <span className="jsm-label">To</span>
                <input
                  type="date"
                  value={paidDateTo}
                  onChange={(e) => setPaidDateTo(e.target.value)}
                  disabled={!usePaidDate}
                  className="jsm-input jsm-date-input"
                />
                <label className="jsm-checkbox-label">
                  <input
                    type="checkbox"
                    checked={usePaidDate}
                    onChange={(e) => setUsePaidDate(e.target.checked)}
                    className="jsm-checkbox"
                  />
                  <span>PaymentSummary</span>
                </label>

                <div className="jsm-spacer" />

                <span className="jsm-label">Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="jsm-select jsm-status-select"
                >
                  <option value="Pending">Pending</option>
                  <option value="All">All</option>
                  <option value="Cleared">Cleared</option>
                </select>
              </div>

              {/* SUBHEADER: New Process + Select/UnSelect All */}
              <div className="jsm-subheader-row">
                <label className="jsm-checkbox-label">
                  <input
                    type="checkbox"
                    checked={newProcess}
                    onChange={(e) => setNewProcess(e.target.checked)}
                    className="jsm-checkbox"
                  />
                  <span>New Process</span>
                </label>

                <div className="jsm-spacer" />

                <label className="jsm-checkbox-label jsm-select-all-label">
                  <input
                    type="checkbox"
                    checked={allCurrentTabSelected}
                    onChange={toggleSelectUnselectAll}
                    className="jsm-checkbox"
                  />
                  <span>Select/UnSelect All</span>
                </label>
              </div>

              {/* 13 TABS: Party | Broker | Station | MainGrou | Book | Group | Haste | SalesMan | Area | Discount | State | Remark | MSME Type */}
              <div className="jsm-tabs-container">
                {TABS.map((tab) => {
                  const isActive = activeTab === tab.key;
                  const count = selected[tab.key]?.size || 0;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      className={`jsm-tab-btn ${isActive ? 'jsm-tab-active' : ''}`}
                      onClick={() => {
                        setActiveTab(tab.key);
                        setFocusedRowIndex(0);
                      }}
                    >
                      {tab.label}
                      {count > 0 && <span className="jsm-tab-badge">({count})</span>}
                    </button>
                  );
                })}
              </div>

              {/* SELECTION TABLE */}
              <div
                className="jsm-table-container"
                tabIndex={0}
                ref={tableRef}
                onKeyDown={handleTableKeyDown}
              >
                <table className="jsm-table">
                  <thead>
                    <tr>
                      <th style={{ width: 28, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={allCurrentTabSelected}
                          onChange={toggleSelectUnselectAll}
                          className="jsm-checkbox"
                        />
                      </th>
                      <th>{activeTab === 'parties' ? 'AC_NAME' : 'NAME'}</th>
                      {activeTab === 'parties' && <th>ADD_1</th>}
                      {activeTab === 'parties' && <th>ST_NAME</th>}
                      <th style={{ width: 90, textAlign: 'right' }}>
                        {activeTab === 'parties' ? 'AC_CODE' : 'CODE'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="jsm-no-data-cell">
                          No {TABS.find((t) => t.key === activeTab)?.label} records found
                        </td>
                      </tr>
                    ) : (
                      activeList.map((item, idx) => {
                        const key = rk(item);
                        const isChecked = selected[activeTab]?.has(key);
                        const isFocused = idx === focusedRowIndex;
                        const isParty = activeTab === 'parties';

                        return (
                          <tr
                            key={key}
                            className={`jsm-table-row ${isFocused ? 'jsm-row-focused' : ''} ${
                              isChecked ? 'jsm-row-checked' : ''
                            }`}
                            onClick={() => {
                              setFocusedRowIndex(idx);
                              toggleRow(key);
                            }}
                          >
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleRow(key)}
                                onClick={(e) => e.stopPropagation()}
                                className="jsm-checkbox"
                              />
                            </td>
                            <td className="jsm-cell-bold">{rl(item)}</td>
                            {isParty && <td className="jsm-cell-subtle">{item.address || ''}</td>}
                            {isParty && <td className="jsm-cell-subtle">{item.city || item.station || ''}</td>}
                            <td style={{ textAlign: 'right' }} className="jsm-cell-mono">
                              {item.accd != null ? item.accd : idx + 1}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* BOTTOM OPTIONS SECTION (3 COLUMNS OF BADGES + RIGHT CONTROLS) */}
              <div className="jsm-options-grid-wrap">
                {/* 3 Columns of Option Checkboxes */}
                <div className="jsm-options-columns">
                  {/* Column 1 */}
                  <div className="jsm-opt-col">
                    <label className="jsm-badge-chk jsm-badge-blue">
                      <input
                        type="checkbox"
                        checked={newYearBill}
                        onChange={(e) => setNewYearBill(e.target.checked)}
                      />
                      <span>New Year Bill</span>
                    </label>

                    <label className="jsm-badge-chk jsm-badge-blue">
                      <input
                        type="checkbox"
                        checked={includeLastYear}
                        onChange={(e) => setIncludeLastYear(e.target.checked)}
                      />
                      <span>Include Lastyear O/s.</span>
                    </label>

                    <label className="jsm-badge-chk jsm-badge-blue">
                      <input
                        type="checkbox"
                        checked={withUnadjustEntry}
                        onChange={(e) => setWithUnadjustEntry(e.target.checked)}
                      />
                      <span>With Unadjust Entry</span>
                    </label>

                    <label className="jsm-badge-chk jsm-badge-green">
                      <input
                        type="checkbox"
                        checked={whatsappBulkSend}
                        onChange={(e) => setWhatsappBulkSend(e.target.checked)}
                      />
                      <span>Whatsapp Bulk Send</span>
                    </label>

                    <label className="jsm-badge-chk jsm-badge-blue">
                      <input
                        type="checkbox"
                        checked={grandTotal}
                        onChange={(e) => setGrandTotal(e.target.checked)}
                      />
                      <span>Grand Total</span>
                    </label>

                    <label className="jsm-plain-chk">
                      <input
                        type="checkbox"
                        checked={linningPartyTotal}
                        onChange={(e) => setLinningPartyTotal(e.target.checked)}
                      />
                      <span>Linning Party Total</span>
                    </label>
                  </div>

                  {/* Column 2 */}
                  <div className="jsm-opt-col">
                    <label className="jsm-badge-chk jsm-badge-blue">
                      <input
                        type="checkbox"
                        checked={withLedgerBalance}
                        onChange={(e) => setWithLedgerBalance(e.target.checked)}
                      />
                      <span>With Ledger Balance</span>
                    </label>

                    <label className="jsm-plain-chk">
                      <input
                        type="checkbox"
                        checked={withIndividualTotal}
                        onChange={(e) => setWithIndividualTotal(e.target.checked)}
                      />
                      <span>With Individual Total(Type)</span>
                    </label>

                    <label className="jsm-plain-chk">
                      <input
                        type="checkbox"
                        checked={onlyDirectBillClose}
                        onChange={(e) => setOnlyDirectBillClose(e.target.checked)}
                      />
                      <span>Only Direct Bill Close List</span>
                    </label>

                    <label className="jsm-plain-chk">
                      <input
                        type="checkbox"
                        checked={onlyRgPending}
                        onChange={(e) => setOnlyRgPending(e.target.checked)}
                      />
                      <span>With Rg Pending</span>
                    </label>

                    <label className="jsm-plain-chk">
                      <input
                        type="checkbox"
                        checked={onlyPartReceived}
                        onChange={(e) => setOnlyPartReceived(e.target.checked)}
                      />
                      <span>Only Part Received</span>
                    </label>

                    <label className="jsm-plain-chk">
                      <input
                        type="checkbox"
                        checked={showBankDetail}
                        onChange={(e) => setShowBankDetail(e.target.checked)}
                      />
                      <span>BankDetail</span>
                    </label>
                  </div>

                  {/* Column 3 */}
                  <div className="jsm-opt-col">
                    <label className="jsm-badge-chk jsm-badge-blue">
                      <input
                        type="checkbox"
                        checked={showAddress}
                        onChange={(e) => setShowAddress(e.target.checked)}
                      />
                      <span>With Address</span>
                    </label>

                    <label className="jsm-plain-chk">
                      <input
                        type="checkbox"
                        checked={showBroker}
                        onChange={(e) => setShowBroker(e.target.checked)}
                      />
                      <span>With Broker</span>
                    </label>

                    <label className="jsm-plain-chk">
                      <input
                        type="checkbox"
                        checked={showBrokerAddr}
                        onChange={(e) => setShowBrokerAddr(e.target.checked)}
                      />
                      <span>With BrokerAddr</span>
                    </label>

                    <label className="jsm-plain-chk">
                      <input
                        type="checkbox"
                        checked={linningPerRecord}
                        onChange={(e) => setLinningPerRecord(e.target.checked)}
                      />
                      <span>Linning Per Record</span>
                    </label>

                    <label className="jsm-plain-chk">
                      <input
                        type="checkbox"
                        checked={showPhone}
                        onChange={(e) => setShowPhone(e.target.checked)}
                      />
                      <span>With PhoneNum</span>
                    </label>

                    <label className="jsm-plain-chk">
                      <input
                        type="checkbox"
                        checked={showGstin}
                        onChange={(e) => setShowGstin(e.target.checked)}
                      />
                      <span>With GstinNo</span>
                    </label>
                  </div>
                </div>

                {/* Right Side Controls Block */}
                <div className="jsm-right-controls-panel">
                  <div className="jsm-ctrl-row">
                    <span className="jsm-ctrl-label">GroupBy 1</span>
                    <select
                      value={groupBy1}
                      onChange={(e) => setGroupBy1(e.target.value)}
                      className="jsm-select jsm-ctrl-select"
                    >
                      {GROUP_BY_OPTIONS.map((o) => (
                        <option key={o.v} value={o.v}>
                          {o.l}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="jsm-ctrl-row">
                    <span className="jsm-ctrl-label">GroupBy 2</span>
                    <select
                      value={groupBy2}
                      onChange={(e) => setGroupBy2(e.target.value)}
                      className="jsm-select jsm-ctrl-select"
                    >
                      {GROUP_BY_OPTIONS.map((o) => (
                        <option key={o.v} value={o.v}>
                          {o.l}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="jsm-ctrl-row">
                    <span className="jsm-ctrl-label">GroupBy 3</span>
                    <select
                      value={groupBy3}
                      onChange={(e) => setGroupBy3(e.target.value)}
                      className="jsm-select jsm-ctrl-select"
                    >
                      {GROUP_BY_OPTIONS.map((o) => (
                        <option key={o.v} value={o.v}>
                          {o.l}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="jsm-ctrl-row">
                    <span className="jsm-ctrl-label">Printout Pattern</span>
                    <select
                      value={printoutPattern}
                      onChange={(e) => setPrintoutPattern(e.target.value)}
                      className="jsm-select jsm-ctrl-select"
                    >
                      {PRINTOUT_PATTERNS.map((p) => (
                        <option key={p.v} value={p.v}>
                          {p.l}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="jsm-ctrl-row jsm-due-days-row">
                    <span className="jsm-ctrl-label">Due Days</span>
                    <select
                      value={dueDaysOp}
                      onChange={(e) => setDueDaysOp(e.target.value)}
                      className="jsm-select jsm-due-op-select"
                    >
                      <option value=">= More Than">&gt;= More Than</option>
                      <option value="<= Less Than">&lt;= Less Than</option>
                      <option value="= Equal To">= Equal To</option>
                    </select>
                    <input
                      type="number"
                      value={dueDaysMin}
                      onChange={(e) => setDueDaysMin(e.target.value)}
                      className="jsm-input jsm-due-input"
                    />
                    <label className="jsm-plain-chk jsm-summary-chk">
                      <input
                        type="checkbox"
                        checked={summaryOnly}
                        onChange={(e) => setSummaryOnly(e.target.checked)}
                      />
                      <span>Summary</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════ RESULT VIEW ══════ */}
          {stage === 'result' && (
            <div className="jsm-result-view">
              {/* Toolbar */}
              <div className="jsm-result-toolbar">
                <button
                  type="button"
                  className="jsm-btn jsm-btn-back"
                  onClick={() => setStage('filter')}
                >
                  ⚙️ Filter Options
                </button>
                <button type="button" className="jsm-btn" onClick={() => runFetch(curType)}>
                  🔄 Refresh
                </button>
                <span className="jsm-result-count">
                  {report.count} bill{report.count !== 1 ? 's' : ''} · grouped by{' '}
                  {[groupBy1, groupBy2, groupBy3].filter((d) => d !== 'None').join(' › ') || 'None'}
                </span>

                <div className="jsm-tree-buttons">
                  <span className="jsm-tree-label">Tree:</span>
                  <button
                    type="button"
                    className={`jsm-tree-btn ${
                      groupBy1 === 'Party' && groupBy2 === 'None' ? 'active' : ''
                    }`}
                    onClick={() => {
                      setGroupBy1('Party');
                      setGroupBy2('None');
                      setGroupBy3('None');
                    }}
                  >
                    Party
                  </button>
                  <button
                    type="button"
                    className={`jsm-tree-btn ${
                      groupBy1 === 'Broker' && groupBy2 === 'Station' && groupBy3 === 'Party'
                        ? 'active'
                        : ''
                    }`}
                    onClick={() => {
                      setGroupBy1('Broker');
                      setGroupBy2('Station');
                      setGroupBy3('Party');
                    }}
                  >
                    Broker › Station › Party
                  </button>
                  <button
                    type="button"
                    className={`jsm-tree-btn ${
                      groupBy1 === 'Broker' && groupBy2 === 'None' ? 'active' : ''
                    }`}
                    onClick={() => {
                      setGroupBy1('Broker');
                      setGroupBy2('None');
                      setGroupBy3('None');
                    }}
                  >
                    Broker
                  </button>
                  <button
                    type="button"
                    className={`jsm-tree-btn ${
                      groupBy1 === 'Station' && groupBy2 === 'None' ? 'active' : ''
                    }`}
                    onClick={() => {
                      setGroupBy1('Station');
                      setGroupBy2('None');
                      setGroupBy3('None');
                    }}
                  >
                    Station
                  </button>
                </div>

                <div className="jsm-spacer" />

                <span className="jsm-label">Find:</span>
                <input
                  ref={findRef}
                  type="text"
                  placeholder="F3 — party / bill / amount…"
                  value={findQuery}
                  onChange={(e) => setFindQuery(e.target.value)}
                  className="jsm-input jsm-find-input"
                />

                <div className="jsm-colset-wrap">
                  <button
                    type="button"
                    className="jsm-btn"
                    onClick={() => setColSetOpen((v) => !v)}
                  >
                    ColumnSet
                  </button>
                  {colSetOpen && (
                    <div className="jsm-colset-pop">
                      {COLUMNS.map((c) => (
                        <label key={c.key} className="jsm-colset-label">
                          <input
                            type="checkbox"
                            checked={!hiddenCols.has(c.key)}
                            onChange={() =>
                              setHiddenCols((p) => {
                                const n = new Set(p);
                                n.has(c.key) ? n.delete(c.key) : n.add(c.key);
                                return n;
                              })
                            }
                          />{' '}
                          {c.label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <button type="button" className="jsm-btn" onClick={exportCsv}>
                  Excel
                </button>
                <button type="button" className="jsm-btn" onClick={() => window.print()}>
                  PreView
                </button>
                <button type="button" className="jsm-btn" onClick={() => window.print()}>
                  Print
                </button>
              </div>

              {/* Grid Output */}
              <div className={`jsm-grid-container ${tableMode ? 'jsm-no-maxh' : ''}`}>
                <table className="jsm-grid-table">
                  <thead>
                    <tr>
                      {visCols.map((c) => (
                        <th key={c.key} className={c.num ? 'num' : ''} style={{ width: c.w }}>
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...report.groups.entries()].map(([key, recs]) => {
                      const t = sumGroup(recs);
                      const isAll = key === 'ALL';
                      return (
                        <React.Fragment key={key}>
                          {!isAll && (
                            <tr className="jsm-party-header-row">
                              <td colSpan={visCols.length}>
                                <span className="jsm-party-header-title">PARTY - {key}</span>
                                {showAddress && recs[0]?.party?.address && (
                                  <span className="jsm-party-header-addr">
                                    {recs[0].party.address}
                                  </span>
                                )}
                              </td>
                            </tr>
                          )}
                          {!summaryOnly &&
                            recs.map((r, i) => (
                              <tr key={`${key}-${i}`} className="jsm-bill-data-row">
                                {visCols.map((c) => (
                                  <td key={c.key} className={c.num ? 'num' : ''}>
                                    {cellVal(c, r)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          <tr className="jsm-party-total-row">
                            {visCols.map((c, i) => (
                              <td key={c.key} className={c.num ? 'num' : ''}>
                                {i === 0 ? 'TOTAL-PARTY' : totVal(c, t)}
                              </td>
                            ))}
                          </tr>
                        </React.Fragment>
                      );
                    })}
                    {report.count === 0 && (
                      <tr>
                        <td colSpan={visCols.length} className="jsm-no-data-cell">
                          No records found matching filters
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {grandTotal && report.count > 0 && (
                    <tfoot>
                      <tr className="jsm-grand-total-row">
                        {visCols.map((c, i) => (
                          <td key={c.key} className={c.num ? 'num' : ''}>
                            {i === 0 ? 'GRAND TOTAL' : totVal(c, report.grand)}
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* ══════ FOOTER BAR (EXACT JSM BUTTONS) ══════ */}
          <div className="jsm-footer-bar">
            <button
              type="button"
              className="jsm-btn jsm-footer-btn"
              onClick={stage === 'filter' ? generate : () => notifyInfo('ZOOM')}
            >
              ZOOM
            </button>
            <button
              type="button"
              className="jsm-btn jsm-footer-btn"
              onClick={() => notifyInfo('Z')}
            >
              Z
            </button>
            <button
              type="button"
              className="jsm-btn jsm-footer-btn jsm-dot-btn"
              onClick={() => notifyInfo('.')}
            >
              .
            </button>
            <button
              type="button"
              className="jsm-btn jsm-footer-btn"
              onClick={handleMonthClick}
            >
              Month
            </button>

            <label className="jsm-footer-checkbox-label">
              <input
                type="checkbox"
                checked={onlyFullBill}
                onChange={(e) => setOnlyFullBill(e.target.checked)}
                className="jsm-checkbox"
              />
              <span>Only Full Bill</span>
            </label>

            <label className="jsm-footer-checkbox-label">
              <input
                type="checkbox"
                checked={svLog}
                onChange={(e) => setSvLog(e.target.checked)}
                className="jsm-checkbox"
              />
              <span>SvLog</span>
            </label>

            <label className="jsm-footer-checkbox-label">
              <input
                type="checkbox"
                checked={tableMode}
                onChange={(e) => setTableMode(e.target.checked)}
                className="jsm-checkbox"
              />
              <span>Table</span>
            </label>

            <div className="jsm-spacer" />

            <button
              type="button"
              className="jsm-btn jsm-btn-primary jsm-footer-action-btn"
              onClick={stage === 'filter' ? generate : () => setStage('filter')}
            >
              {stage === 'filter' ? 'Ok' : 'Filter'}
            </button>
            <button
              type="button"
              className="jsm-btn jsm-footer-action-btn"
              onClick={onClose}
            >
              Exit
            </button>
          </div>
        </div>
      )}
    </ErpWindowedModal>
  );
};

/* ══════════════════════════════════════════════════════
   EXACT JSM RETRO-CLASSIC WINDOWS CSS STYLING
   Matching the user's reference software screenshot
   ══════════════════════════════════════════════════════ */
const jsmCss = `
/* Window shell */
.jsm-os-window {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  min-height: 0;
  background-color: #3fbaba;
  font-family: Tahoma, 'Segoe UI', Arial, sans-serif;
  font-size: 11px;
  color: #000;
  user-select: none;
}

/* Title Bar */
.jsm-titlebar {
  display: flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(180deg, #1e5799 0%, #2989d8 50%, #207cca 51%, #7db9e8 100%);
  color: #fff;
  padding: 3px 6px;
  min-height: 26px;
  border-bottom: 1px solid #104e8b;
}
.jsm-title-icon {
  display: flex;
  align-items: center;
  opacity: 0.9;
}
.jsm-titlebar-title {
  font-weight: 700;
  font-size: 12px;
  text-shadow: 1px 1px 1px rgba(0,0,0,0.4);
}
.jsm-type-switch {
  display: flex;
  gap: 3px;
  margin-left: 10px;
}
.jsm-type-toggle-btn {
  background: #0d3b66;
  color: #bfdbfe;
  border: 1px solid #60a5fa;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  border-radius: 2px;
}
.jsm-type-toggle-btn.active {
  background: #f59e0b;
  color: #000;
  border-color: #fff;
}
.jsm-window-controls {
  margin-left: auto;
}

/* Dialog Body */
.jsm-dialog-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 4px 6px;
  gap: 3px;
  overflow-y: auto;
}

/* Filter Rows */
.jsm-filter-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 700;
  white-space: nowrap;
}
.jsm-label-bold {
  font-size: 12px;
  font-weight: 800;
  color: #000;
  min-width: 68px;
}
.jsm-label {
  font-size: 11.5px;
  font-weight: 700;
  color: #000;
}
.jsm-spacer {
  flex: 1;
}

/* Inputs & Selects */
.jsm-input {
  height: 20px;
  font-size: 11px;
  font-weight: 600;
  padding: 0 4px;
  border: 1px solid #7f9db9;
  background-color: #fff;
  border-radius: 1px;
  box-sizing: border-box;
}
.jsm-date-input {
  width: 110px;
}
.jsm-date-display {
  width: 90px;
  text-align: center;
  background-color: #ffffff;
}
.jsm-quick-search {
  width: 110px;
}
.jsm-select {
  height: 20px;
  font-size: 11px;
  font-weight: 600;
  padding: 0 2px;
  border: 1px solid #7f9db9;
  background-color: #fff;
  border-radius: 1px;
}
.jsm-company-select {
  width: 95px;
}
.jsm-status-select {
  width: 95px;
}

/* Checkboxes */
.jsm-checkbox-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}
.jsm-checkbox {
  width: 13px;
  height: 13px;
  margin: 0;
  cursor: pointer;
}

/* Subheader */
.jsm-subheader-row {
  display: flex;
  align-items: center;
  padding: 2px 0;
}
.jsm-select-all-label {
  font-weight: 700;
}

/* Tabs */
.jsm-tabs-container {
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  gap: 1px;
  background-color: #2b9898;
  padding: 1px 1px 0 1px;
  border: 1px solid #207a7a;
  border-bottom: none;
}
.jsm-tab-btn {
  background-color: #f0f0f0;
  color: #000;
  border: 1px solid #555;
  border-bottom: none;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  outline: none;
  transition: background-color 0.1s;
}
.jsm-tab-btn:hover {
  background-color: #ffffff;
}
.jsm-tab-active {
  background-color: #0000ff !important;
  color: #ffffff !important;
  border-color: #0000aa !important;
}
.jsm-tab-badge {
  font-size: 9px;
  margin-left: 2px;
  opacity: 0.9;
}

/* Table */
.jsm-table-container {
  flex: 1;
  min-height: 140px;
  max-height: 280px;
  background-color: #fff;
  border: 1px solid #555;
  overflow-y: auto;
  overflow-x: auto;
  outline: none;
}
.jsm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}
.jsm-table thead th {
  position: sticky;
  top: 0;
  background: #ece9d8;
  border-bottom: 1px solid #999;
  border-right: 1px solid #ccc;
  padding: 2px 4px;
  font-weight: 700;
  font-size: 11px;
  text-align: left;
  z-index: 2;
  box-shadow: inset 0 -1px 0 #999;
}
.jsm-table-row {
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
}
.jsm-table-row td {
  padding: 2px 4px;
  white-space: nowrap;
  border-right: 1px solid #f0f0f0;
}
.jsm-table-row:hover td {
  background-color: #e8f4fc;
}
.jsm-row-focused td {
  background-color: #0078d7 !important;
  color: #ffffff !important;
}
.jsm-row-focused td input[type="checkbox"] {
  outline: 1px solid #fff;
}
.jsm-cell-bold {
  font-weight: 700;
}
.jsm-cell-subtle {
  color: inherit;
}
.jsm-cell-mono {
  font-family: Consolas, monospace;
  font-weight: 600;
}
.jsm-no-data-cell {
  text-align: center;
  padding: 20px;
  color: #666;
  font-style: italic;
}

/* Bottom Options Section */
.jsm-options-grid-wrap {
  display: flex;
  gap: 12px;
  padding: 4px 6px;
  background-color: #3fbaba;
  align-items: flex-start;
  flex-wrap: wrap;
}

/* Columns */
.jsm-options-columns {
  display: flex;
  gap: 12px;
  flex: 1;
}
.jsm-opt-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 165px;
}

/* Badges */
.jsm-badge-chk {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 1px 4px;
  font-size: 11px;
  font-weight: 700;
  color: #ffffff;
  cursor: pointer;
  white-space: nowrap;
  border-radius: 1px;
}
.jsm-badge-blue {
  background-color: #0000ff;
}
.jsm-badge-green {
  background-color: #008000;
}
.jsm-plain-chk {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 1px 4px;
  font-size: 11px;
  font-weight: 600;
  color: #000;
  cursor: pointer;
  white-space: nowrap;
}
.jsm-plain-chk:hover, .jsm-badge-chk:hover {
  filter: brightness(1.1);
}

/* Right Controls Block */
.jsm-right-controls-panel {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 230px;
}
.jsm-ctrl-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
}
.jsm-ctrl-label {
  width: 90px;
  font-weight: 700;
  white-space: nowrap;
}
.jsm-ctrl-select {
  flex: 1;
  height: 20px;
}
.jsm-due-days-row {
  display: flex;
  align-items: center;
  gap: 3px;
}
.jsm-due-op-select {
  width: 85px;
  height: 20px;
  font-size: 10px;
}
.jsm-due-input {
  width: 35px;
  height: 20px;
}
.jsm-summary-chk {
  margin-left: 2px;
}

/* Footer Bar */
.jsm-footer-bar {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  background-color: #e4e4e4;
  border-top: 1px solid #777;
  min-height: 32px;
}
.jsm-btn {
  height: 24px;
  padding: 0 10px;
  font-size: 11px;
  font-weight: 700;
  color: #000;
  background: linear-gradient(180deg, #f8f8f8 0%, #ece9d8 50%, #d8d4c4 100%);
  border: 1px solid #707070;
  border-radius: 2px;
  cursor: pointer;
  outline: none;
  box-shadow: inset 1px 1px 0 #fff;
  white-space: nowrap;
}
.jsm-btn:hover {
  background: linear-gradient(180deg, #ffffff 0%, #f4f2e8 50%, #e8e4d4 100%);
  border-color: #3c7fb1;
}
.jsm-btn:active {
  background: #d8d4c4;
  box-shadow: inset 1px 1px 2px rgba(0,0,0,0.3);
}
.jsm-footer-btn {
  min-width: 48px;
}
.jsm-dot-btn {
  min-width: 24px;
  padding: 0 4px;
}
.jsm-footer-action-btn {
  min-width: 65px;
}
.jsm-btn-primary {
  background: linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%) !important;
  color: #fff !important;
  border-color: #1e40af !important;
  box-shadow: inset 1px 1px 0 rgba(255,255,255,0.4) !important;
}
.jsm-btn-primary:hover {
  background: linear-gradient(180deg, #60a5fa 0%, #2563eb 100%) !important;
}
.jsm-btn-back {
  background: linear-gradient(180deg, #0284c7 0%, #0369a1 100%) !important;
  color: #fff !important;
  border-color: #075985 !important;
}
.jsm-footer-checkbox-label {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  margin-left: 4px;
}

/* ══════ RESULT VIEW STYLES ══════ */
.jsm-result-view {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background-color: #c0c0c0;
}
.jsm-result-toolbar {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 6px;
  background-color: #ece9d8;
  border-bottom: 1px solid #777;
  flex-wrap: wrap;
}
.jsm-result-count {
  font-size: 11px;
  font-weight: 700;
  color: #333;
}
.jsm-tree-buttons {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-left: 6px;
}
.jsm-tree-label {
  font-size: 10px;
  font-weight: 800;
  color: #555;
}
.jsm-tree-btn {
  height: 20px;
  padding: 0 6px;
  font-size: 10px;
  font-weight: 700;
  background: #fff;
  border: 1px solid #888;
  cursor: pointer;
  border-radius: 2px;
}
.jsm-tree-btn.active {
  background: #0000ff;
  color: #fff;
  border-color: #000088;
}
.jsm-find-input {
  width: 150px;
}
.jsm-colset-wrap {
  position: relative;
}
.jsm-colset-pop {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 50;
  background: #fff;
  border: 2px solid #0000ff;
  padding: 6px;
  width: 150px;
  box-shadow: 2px 2px 8px rgba(0,0,0,0.3);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.jsm-colset-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
}

/* Result Grid */
.jsm-grid-container {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background-color: #fff;
}
.jsm-no-maxh {
  max-height: none !important;
}
.jsm-grid-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}
.jsm-grid-table th {
  background-color: #0000ff;
  color: #ffffff;
  border: 1px solid #0000aa;
  padding: 3px 5px;
  font-weight: 700;
  font-size: 11px;
  text-align: left;
  white-space: nowrap;
  position: sticky;
  top: 0;
  z-index: 2;
}
.jsm-grid-table td {
  border: 1px solid #dcdcdc;
  padding: 2px 5px;
  white-space: nowrap;
}
.jsm-grid-table .num {
  text-align: right;
  font-family: Consolas, monospace;
}
.jsm-party-header-row td {
  background-color: #0000aa;
  color: #ffffff;
  font-weight: 700;
  padding: 3px 6px;
}
.jsm-party-header-title {
  font-size: 11.5px;
  font-weight: 800;
}
.jsm-party-header-addr {
  margin-left: 14px;
  font-weight: 400;
  font-size: 10px;
  opacity: 0.9;
}
.jsm-bill-data-row:hover td {
  background-color: #eff6ff;
}
.jsm-party-total-row td {
  background-color: #f8fafc;
  font-weight: 700;
  color: #008000;
  border-top: 1px solid #888;
}
.jsm-grand-total-row td {
  background-color: #e2e8f0;
  font-weight: 800;
  color: #000;
  border-top: 2px solid #333;
}

@media print {
  .jsm-titlebar, .jsm-footer-bar, .jsm-result-toolbar {
    display: none !important;
  }
  .jsm-grid-container {
    overflow: visible !important;
    max-height: none !important;
  }
}
`;

export default OutstandingReportModal;
