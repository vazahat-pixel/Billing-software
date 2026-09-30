import React, { useState, useEffect, useMemo, useRef } from 'react';
import ErpWindowedModal from '../../components/erp/ErpWindowedModal';
import useStore from '../../store/useStore';
import { notifyWarning, notifyInfo } from '../../utils/notify';
import { downloadCsv, fmtAmt, fmtDate } from '../../utils/reportExport';
import { ErpBusyOverlay } from '../../components/ui/loaders';
import { openWhatsAppShare } from '../../utils/invoiceHelpers';

const todayISO = () => new Date().toISOString().split('T')[0];
const fyStartISO = () => {
  const y = new Date().getFullYear();
  const m = new Date().getMonth();
  return `${m >= 3 ? y : y - 1}-04-01`;
};
const dmy = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
};
const n2 = (v) => (Number(v)||0).toFixed(2);

const TABS = [
  { key:'parties', label:'Party' },
  { key:'brokers', label:'Broker' },
  { key:'stations', label:'Station' },
  { key:'mainGroups', label:'MainGrou' },
  { key:'books', label:'Book' },
  { key:'hastes', label:'Haste' },
  { key:'states', label:'State' },
  { key:'msmeTypes', label:'MSME Type' },
];
const DISABLED_TABS = ['SalesMan','Area','Discount','Remark'];

const GROUP_BY = [
  { v:'Party',l:'Party' },{ v:'Broker',l:'Broker' },{ v:'Station',l:'Station' },
  { v:'Book',l:'Book' },{ v:'State',l:'State' },{ v:'MSME Type',l:'MSME Type' },{ v:'None',l:'None' },
];

const emptySelected = () => ({
  parties:new Set(), brokers:new Set(), stations:new Set(), mainGroups:new Set(),
  books:new Set(), hastes:new Set(), states:new Set(), msmeTypes:new Set(),
});
const emptyOptions = () => ({
  parties:[], brokers:[], stations:[], mainGroups:[], books:[], hastes:[], states:[], msmeTypes:[],
});

/* ── Columns: exact match to reference ── */
const COLUMNS = [
  { key:'co',      label:'CO',        w:'40px' },
  { key:'billNo',  label:'BILLNO',    w:'130px' },
  { key:'billDate',label:'BILL.DATE', w:'82px' },
  { key:'billAmt', label:'BILL AMT',  w:'90px', num:true },
  { key:'paidDate',label:'PAID.DATE', w:'82px' },
  { key:'paidAmt', label:'PAID.AMT',  w:'80px', num:true },
  { key:'goodsRtn',label:'GOODS.RTN', w:'80px', num:true },
  { key:'addLess', label:'ADDLESS',   w:'70px', num:true },
  { key:'balance', label:'BALANCE',   w:'90px', num:true },
  { key:'days',    label:'DAYS',      w:'40px', num:true },
];

const OutstandingReportModal = ({
  isOpen, onClose,
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

  /* ── state ── */
  const [billDateFrom, setBillDateFrom] = useState('2000-04-01');
  const [billDateTo, setBillDateTo]     = useState(todayISO());
  const [paidDateFrom, setPaidDateFrom] = useState(fyStartISO());
  const [paidDateTo, setPaidDateTo]     = useState(todayISO());
  const [usePaidDate, setUsePaidDate]   = useState(false);
  const [status, setStatus]             = useState('Pending');

  const [activeTab, setActiveTab]   = useState('parties');
  const [tabSearch, setTabSearch]   = useState('');
  const [options, setOptions]       = useState(emptyOptions());
  const [selected, setSelected]     = useState(emptySelected());

  const [includeLastYear, setIncludeLastYear] = useState(true);
  const [grandTotal, setGrandTotal]           = useState(true);
  const [summaryOnly, setSummaryOnly]         = useState(false);
  const [onlyFullBill, setOnlyFullBill]       = useState(false);
  const [onlyPartReceived, setOnlyPartReceived] = useState(false);
  const [showAddress, setShowAddress]         = useState(true);
  const [showBroker, setShowBroker]           = useState(false);
  const [showPhone, setShowPhone]             = useState(false);
  const [showGstin, setShowGstin]             = useState(false);
  const [showBankDetail, setShowBankDetail]   = useState(false);
  const [withLedgerBalance, setWithLedgerBalance] = useState(false);
  const [onlyRgPending, setOnlyRgPending]     = useState(false);
  const [onlyDirectBillClose, setOnlyDirectBillClose] = useState(false);
  const [dueDaysMin, setDueDaysMin]           = useState('');
  const [remarkSearch, setRemarkSearch]       = useState('');
  const [groupBy1, setGroupBy1]   = useState('Party');
  const [groupBy2, setGroupBy2]   = useState('None');
  const [groupBy3, setGroupBy3]   = useState('None');

  const [tableMode, setTableMode]       = useState(false);
  const [hiddenCols, setHiddenCols]     = useState(() => new Set());
  const [colSetOpen, setColSetOpen]     = useState(false);
  const [findQuery, setFindQuery]       = useState('');
  const findRef = useRef(null);

  const [rows, setRows]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(false);
  const [stage, setStage]     = useState(() => (directPartyId ? 'result' : 'filter'));

  const title = `Outstanding (${curType === 'receivable' ? 'SALES' : 'PURCHASE'})`;

  /* ── generate helper ── */
  const runFetch = async (targetType = curType, customFilters = {}) => {
    setLoading(true); setFindQuery('');
    try {
      const pIds = customFilters.partyIds !== undefined ? customFilters.partyIds : [...selected.parties];
      const data = await fetchOutstandingReportFiltered(targetType, {
        billDateFrom, billDateTo,
        paidDateFrom: usePaidDate ? paidDateFrom : undefined,
        paidDateTo:   usePaidDate ? paidDateTo   : undefined,
        status,
        partyIds: pIds,
        brokerIds: [...selected.brokers],
        stations: [...selected.stations],
        mainGroups: [...selected.mainGroups],
        hastes: [...selected.hastes],
        bookIds: [...selected.books],
        states: [...selected.states],
        msmeTypes: [...selected.msmeTypes],
        remarkSearch,
        dueDaysMin: dueDaysMin !== '' ? Number(dueDaysMin) : undefined,
        onlyFullBill, onlyPartReceived, includeLastYear,
        fyStartDate: fyStartISO(),
        onlyRgPending, onlyDirectBillClose, withLedgerBalance,
        ...customFilters,
      });
      setRows(data || []);
      setStage('result');
      return data || [];
    } finally {
      setLoading(false);
    }
  };

  /* ── boot: filter first. A chosen party opens only from OK or Enter. ── */
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    if (partyDirect) {
      setLoading(true); setRows(null); setStage('result');
      fetchOutstandingReportFiltered(curType, {
        billDateFrom: '2000-04-01', billDateTo: todayISO(),
        status: 'Pending', partyIds: [directPartyId], includeLastYear: true,
      }).then(d => { if (!cancelled) { setRows(d || []); setLoading(false); } })
        .catch(() => { if (!cancelled) setLoading(false); });
    } else {
      setRows(null);
      setStage('filter');
      setSelected(emptySelected());
      setBootLoading(true);
      fetchOutstandingFilterOptions(curType)
        .then((opts) => {
          if (!cancelled) setOptions({ ...emptyOptions(), ...(opts || {}) });
        })
        .catch(err => console.error('[Outstanding] error loading filters:', err))
        .finally(() => { if (!cancelled) setBootLoading(false); });
    }
    return () => { cancelled = true; };
  }, [isOpen, curType, partyDirect, directPartyId, fetchOutstandingFilterOptions, fetchOutstandingReportFiltered]);

  const switchType = (newType) => {
    if (newType === curType) return;
    setCurType(newType);
    setSelected(emptySelected());
    setRows(null);
    setStage('filter');
  };

  /* ── tab list ── */
  const activeList = useMemo(() => {
    const list = options[activeTab] || [];
    const q = tabSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(item => String(typeof item === 'string' ? item : item.name || '').toLowerCase().includes(q));
  }, [options, activeTab, tabSearch]);

  const rk = item => typeof item === 'string' ? item : item._id;
  const rl = item => typeof item === 'string' ? item : item.name;
  const toggleRow = key => setSelected(p => {
    const s = new Set(p[activeTab]); s.has(key) ? s.delete(key) : s.add(key);
    return {...p, [activeTab]:s};
  });
  const selectAll   = () => setSelected(p => ({...p, [activeTab]:new Set(activeList.map(rk))}));
  const unselectAll = () => setSelected(p => ({...p, [activeTab]:new Set()}));

  /* ── generate ── */
  const generate = () => runFetch(curType);
  const generateRef = useRef(generate);
  generateRef.current = generate;

  /* ── report computation ── */
  const dimVal = (dim, party, inv) => {
    switch(dim){
      case 'Party': return party?.partyName || party?.name || '—';
      case 'Broker': return inv?.broker?.name || inv?.broker || '—';
      case 'Station': return inv?.station || party?.city || party?.station || '—';
      case 'Book': return inv?.bookId || '—';
      case 'State': return party?.state || '—';
      case 'MSME Type': return party?.msmeType || 'None';
      default: return null;
    }
  };

  const report = useMemo(() => {
    const empty = { groups:new Map(), grand:{ billAmt:0,paidAmt:0,goodsRtn:0,addLess:0,balance:0 }, count:0 };
    if (!rows) return empty;
    const dims = [groupBy1,groupBy2,groupBy3].filter(d => d && d!=='None');
    const q = findQuery.trim().toLowerCase();

    const flat = [];
    for (const party of rows) {
      for (const inv of (party.invoices || party.bills || [])) {
        const rec = {
          ...inv,
          party, co:companyCode,
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
    const grand = { billAmt:0,paidAmt:0,goodsRtn:0,addLess:0,balance:0 };

    if (!dims.length) {
      groups.set('ALL', flat);
    } else {
      for (const rec of flat) {
        const key = dims.map(d => dimVal(d, rec.party, rec)).join(' › ');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(rec);
      }
    }

    const sorted = new Map([...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0])));
    for (const recs of sorted.values())
      for (const r of recs) {
        grand.billAmt += r.billAmt; grand.paidAmt += r.paidAmt;
        grand.goodsRtn += r.goodsRtn; grand.addLess += r.addLess; grand.balance += r.balance;
      }

    return { groups:sorted, grand, count:flat.length };
  }, [rows, groupBy1, groupBy2, groupBy3, findQuery, companyCode]);

  const sumGroup = recs => recs.reduce((t,r)=>({
    billAmt:t.billAmt+r.billAmt, paidAmt:t.paidAmt+r.paidAmt,
    goodsRtn:t.goodsRtn+r.goodsRtn, addLess:t.addLess+r.addLess, balance:t.balance+r.balance
  }),{billAmt:0,paidAmt:0,goodsRtn:0,addLess:0,balance:0});

  const visCols = COLUMNS.filter(c => !hiddenCols.has(c.key));

  const cellVal = (col, rec) => {
    switch(col.key){
      case 'co': return rec.co;
      case 'billNo': return rec.billNo;
      case 'billDate': return dmy(rec.billDate);
      case 'billAmt': return n2(rec.billAmt);
      case 'paidDate': return rec.paidDate ? dmy(rec.paidDate) : '';
      case 'paidAmt': return n2(rec.paidAmt);
      case 'goodsRtn': return n2(rec.goodsRtn);
      case 'addLess': return n2(rec.addLess);
      case 'balance': return n2(rec.balance);
      case 'days': return rec.days;
      default: return '';
    }
  };
  const totVal = (col, t) => {
    if (['billAmt','paidAmt','goodsRtn','addLess','balance'].includes(col.key)) return n2(t[col.key]);
    return '';
  };

  const exportCsv = () => {
    if (!report.count) return notifyWarning('Generate first');
    const hdr = visCols.map(c=>c.label);
    const body = [];
    report.groups.forEach((recs,key) => {
      if (key!=='ALL') body.push([`PARTY - ${key}`]);
      recs.forEach(r => body.push(visCols.map(c => cellVal(c,r))));
      const t = sumGroup(recs);
      body.push(visCols.map((c,i)=> i===0 ? 'TOTAL-PARTY' : totVal(c,t)));
    });
    if (grandTotal) body.push(visCols.map((c,i)=> i===0 ? 'GRAND TOTAL' : totVal(c,report.grand)));
    downloadCsv(`outstanding-${type}-${todayISO()}.csv`, hdr, body);
  };

  /* ── F3 for Find. On the filter, Enter is OK once a party is selected. ── */
  useEffect(() => {
    if (!isOpen) return undefined;
    const fn = (e) => {
      if (e.key === 'F3') {
        e.preventDefault();
        findRef.current?.focus();
        findRef.current?.select();
        return;
      }
      if (stage !== 'filter' || partyDirect) return;
      if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
      const tag = String(e.target?.tagName || '').toUpperCase();
      if (tag === 'BUTTON' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!selected.parties.size) return;
      e.preventDefault();
      e.stopPropagation();
      generateRef.current();
    };
    window.addEventListener('keydown', fn, true);
    return () => window.removeEventListener('keydown', fn, true);
  }, [isOpen, stage, partyDirect, selected]);

  if (!isOpen) return null;

  /* ═══════════════════════════════════════════════
     RENDER — everything inside ONE ErpWindowedModal
     ═══════════════════════════════════════════════ */
  return (
    <ErpWindowedModal isOpen onClose={onClose} title={title} windowId={`os-${type}`} bare>
      {({ WindowControls }) => (
        <div className="os-root">
          <ErpBusyOverlay show={bootLoading||loading} message={loading?'Generating…':'Loading…'} />
          <style>{css}</style>

          {/* ─── Title bar ─── */}
          <div className="os-titlebar">
            <span className="os-title-text">{title}</span>
            {!partyDirect && (
              <div className="os-type-toggle">
                <button
                  type="button"
                  className={`os-type-btn ${curType === 'receivable' ? 'active' : ''}`}
                  onClick={() => switchType('receivable')}
                >
                  Sales Outstanding (Receivable)
                </button>
                <button
                  type="button"
                  className={`os-type-btn ${curType === 'payable' ? 'active' : ''}`}
                  onClick={() => switchType('payable')}
                >
                  Purchase Outstanding (Payable)
                </button>
              </div>
            )}
            <WindowControls />
          </div>

          {/* ═══ FILTER VIEW ═══ */}
          {stage === 'filter' && !partyDirect && (
            <div className="os-filter-body">
              {/* Date bar row 1 */}
              <div className="os-daterow">
                <b>BillDate :</b>
                <span>From</span>
                <input type="date" value={billDateFrom} onChange={e=>setBillDateFrom(e.target.value)} />
                <span>To</span>
                <input type="date" value={billDateTo} onChange={e=>setBillDateTo(e.target.value)} />
                <input type="date" value={todayISO()} readOnly className="os-date-today" />
                <span className="os-ml">Company</span>
                <select disabled className="os-sel-sm"><option>Current</option></select>
              </div>
              {/* Date bar row 2 */}
              <div className="os-daterow">
                <b>PaidDate :</b>
                <span>From</span>
                <input type="date" value={paidDateFrom} onChange={e=>setPaidDateFrom(e.target.value)} disabled={!usePaidDate} />
                <span>To</span>
                <input type="date" value={paidDateTo} onChange={e=>setPaidDateTo(e.target.value)} disabled={!usePaidDate} />
                <label className="os-chk"><input type="checkbox" checked={usePaidDate} onChange={e=>setUsePaidDate(e.target.checked)} /> PaymentSummary</label>
                <span className="os-ml">Status</span>
                <select value={status} onChange={e=>setStatus(e.target.value)} className="os-sel-sm">
                  <option value="Pending">Pending</option><option value="All">All</option>
                </select>
              </div>

              {/* New Process + Select */}
              <div className="os-row-between">
                <label className="os-chk os-dis"><input type="checkbox" disabled /> New Process</label>
                <div className="os-row-gap4">
                  <button type="button" className="os-btn-sm" onClick={selectAll}>Select All</button>
                  <button type="button" className="os-btn-sm" onClick={unselectAll}>UnSelect All</button>
                </div>
              </div>

              {/* Tabs */}
              <div className="os-tabs">
                {TABS.map(t=>(
                  <button key={t.key} type="button" className={activeTab===t.key?'on':''} onClick={()=>{setActiveTab(t.key);setTabSearch('');}}>
                    {t.label}
                  </button>
                ))}
                {DISABLED_TABS.map(l=>(
                  <button key={l} type="button" disabled>{l}</button>
                ))}
              </div>

              {/* Filter + list */}
              <div className="os-list-wrap">
                <input className="os-filter-input" placeholder={`Filter ${TABS.find(t=>t.key===activeTab)?.label}...`}
                  value={tabSearch} onChange={e=>setTabSearch(e.target.value)} />
                <div className="os-list-scroll">
                  <table className="os-list-table">
                    <thead><tr>
                      <th style={{width:28}} />
                      <th>Name</th>
                      {activeTab==='parties' && <th>Address / State</th>}
                    </tr></thead>
                    <tbody>
                      {activeList.length===0 ? (
                        <tr><td colSpan={3} className="os-empty-cell">No data</td></tr>
                      ) : activeList.map(item => {
                        const k = rk(item), on = selected[activeTab]?.has(k);
                        return (
                          <tr key={k} className={on?'on':''} onClick={()=>toggleRow(k)}>
                            <td><input type="checkbox" checked={on} readOnly /></td>
                            <td>{rl(item)}</td>
                            {activeTab==='parties' && <td>{[item.address,item.state].filter(Boolean).join(', ')}</td>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Checkbox grid — 3 col compact */}
              <div className="os-checks-grid">
                <label className="os-hl"><input type="checkbox" checked={includeLastYear} onChange={e=>setIncludeLastYear(e.target.checked)} /> New Year Bill</label>
                <label className="os-hl"><input type="checkbox" checked={showAddress} onChange={e=>setShowAddress(e.target.checked)} /> With Address</label>
                <label className="os-hl"><input type="checkbox" checked={grandTotal} onChange={e=>setGrandTotal(e.target.checked)} /> Grand Total</label>

                <label className="os-hl"><input type="checkbox" checked={includeLastYear} onChange={e=>setIncludeLastYear(e.target.checked)} /> Include Lastyear O/s.</label>
                <label><input type="checkbox" checked={withLedgerBalance} onChange={e=>setWithLedgerBalance(e.target.checked)} /> With Ledger Balance</label>
                <label><input type="checkbox" checked={showBroker} onChange={e=>setShowBroker(e.target.checked)} /> With Broker</label>

                <label><input type="checkbox" checked disabled /> With Unadjust Entry</label>
                <label><input type="checkbox" checked={onlyDirectBillClose} onChange={e=>setOnlyDirectBillClose(e.target.checked)} /> Only Direct Bill Close List</label>
                <label className="os-dis"><input type="checkbox" disabled /> With BrokerAddr</label>

                <label className="os-dis"><input type="checkbox" disabled /> Whatsapp Bulk Send</label>
                <label><input type="checkbox" checked={onlyRgPending} onChange={e=>setOnlyRgPending(e.target.checked)} /> With Rg Pending</label>
                <label className="os-dis"><input type="checkbox" disabled /> Linning Per Record</label>

                <label><input type="checkbox" checked={onlyPartReceived} onChange={e=>setOnlyPartReceived(e.target.checked)} /> Only Part Received</label>
                <label><input type="checkbox" checked={showPhone} onChange={e=>setShowPhone(e.target.checked)} /> With PhoneNum</label>
                <label className="os-dis"><input type="checkbox" disabled /> Linning Party Total</label>

                <label><input type="checkbox" checked={showBankDetail} onChange={e=>setShowBankDetail(e.target.checked)} /> BankDetail</label>
                <label><input type="checkbox" checked={showGstin} onChange={e=>setShowGstin(e.target.checked)} /> With GstinNo</label>
                <label><input type="checkbox" checked={summaryOnly} onChange={e=>setSummaryOnly(e.target.checked)} /> Summary</label>
              </div>

              {/* GroupBy + Due Days row */}
              <div className="os-groupby-bar">
                <span>Due Days</span>
                <select className="os-sel-sm"><option>{'>= More Than'}</option></select>
                <input type="number" value={dueDaysMin} onChange={e=>setDueDaysMin(e.target.value)} className="os-num-sm" />
                <div className="os-ml" />
                <span>GroupBy 1</span>
                <select className="os-sel-sm" value={groupBy1} onChange={e=>setGroupBy1(e.target.value)}>{GROUP_BY.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select>
                <span>GroupBy 2</span>
                <select className="os-sel-sm" value={groupBy2} onChange={e=>setGroupBy2(e.target.value)}>{GROUP_BY.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select>
                <span>GroupBy 3</span>
                <select className="os-sel-sm" value={groupBy3} onChange={e=>setGroupBy3(e.target.value)}>{GROUP_BY.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select>
              </div>
            </div>
          )}

          {/* ═══ RESULT VIEW ═══ */}
          {stage === 'result' && (
            <div className="os-result-body">
              {/* Toolbar */}
              <div className="os-result-toolbar">
                <button
                  type="button"
                  className="os-tbtn os-tbtn-filter"
                  onClick={() => setStage(s => s === 'result' ? 'filter' : 'result')}
                >
                  ⚙️ Filter Options
                </button>
                <button
                  type="button"
                  className="os-tbtn"
                  onClick={() => runFetch(curType)}
                >
                  🔄 Refresh
                </button>
                <span className="os-bill-count">{report.count} bill{report.count!==1?'s':''} · grouped by {[groupBy1,groupBy2,groupBy3].filter(d=>d!=='None').join(' › ')||'None'}</span>
                <span className="os-find-label">Find</span>
                <input ref={findRef} className="os-find-input" placeholder="F3 — party / bill / amount…"
                  value={findQuery} onChange={e=>setFindQuery(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();setFindQuery('');}}} />
                <div className="os-toolbar-right">
                  <div className="os-colset-wrap">
                    <button type="button" className="os-tbtn" onClick={()=>setColSetOpen(v=>!v)}>ColumnSet</button>
                    {colSetOpen && (
                      <div className="os-colset-pop">
                        {COLUMNS.map(c=>(
                          <label key={c.key}><input type="checkbox" checked={!hiddenCols.has(c.key)}
                            onChange={()=>setHiddenCols(p=>{const n=new Set(p);n.has(c.key)?n.delete(c.key):n.add(c.key);return n;})} /> {c.label}</label>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="button" className="os-tbtn" onClick={exportCsv}>Excel</button>
                  <button type="button" className="os-tbtn" onClick={()=>window.print()}>PreView</button>
                  <button type="button" className="os-tbtn" onClick={()=>window.print()}>Print</button>
                </div>
              </div>

              {/* Grid */}
              <div className={`os-grid-scroll ${tableMode ? 'os-no-maxh' : ''}`}>
                <table className="os-grid">
                  <thead><tr>
                    {visCols.map(c=>(
                      <th key={c.key} className={c.num?'num':''} style={{width:c.w}}>{c.label}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {[...report.groups.entries()].map(([key, recs]) => {
                      const t = sumGroup(recs);
                      const isAll = key==='ALL';
                      return (
                        <React.Fragment key={key}>
                          {!isAll && (
                            <tr className="os-party-hdr">
                              <td colSpan={visCols.length}>
                                PARTY - {key}
                                {showAddress && recs[0]?.party?.address && <span className="os-party-addr">{recs[0].party.address}</span>}
                              </td>
                            </tr>
                          )}
                          {!summaryOnly && recs.map((r,i) => (
                            <tr key={`${key}-${i}`} className="os-bill-row">
                              {visCols.map(c=>(
                                <td key={c.key} className={c.num?'num':''}>{cellVal(c,r)}</td>
                              ))}
                            </tr>
                          ))}
                          <tr className="os-party-tot">
                            {visCols.map((c,i)=>(
                              <td key={c.key} className={c.num?'num':''}>
                                {i===0 ? 'TOTAL-PARTY' : totVal(c,t)}
                              </td>
                            ))}
                          </tr>
                        </React.Fragment>
                      );
                    })}
                    {report.count===0 && (
                      <tr><td colSpan={visCols.length} className="os-empty-cell">No records</td></tr>
                    )}
                  </tbody>
                  {grandTotal && report.count>0 && (
                    <tfoot>
                      <tr className="os-grand-row">
                        {visCols.map((c,i)=>(
                          <td key={c.key} className={c.num?'num':''}>
                            {i===0 ? 'GRAND TOTAL' : totVal(c,report.grand)}
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* ─── Bottom bar (always visible) ─── */}
          <div className="os-footer">
            <button type="button" className="os-fbtn" onClick={()=>notifyInfo('ZOOM')}>ZOOM</button>
            <button type="button" className="os-fbtn" onClick={()=>notifyInfo('Z')}>Z</button>
            <button type="button" className="os-fbtn" onClick={()=>{
              const now = new Date();
              setBillDateFrom(new Date(now.getFullYear(),now.getMonth(),1).toISOString().split('T')[0]);
              setBillDateTo(todayISO());
            }}>Month</button>
            <label className="os-fchk"><input type="checkbox" checked={onlyFullBill} onChange={e=>setOnlyFullBill(e.target.checked)} /> Only Full Bill</label>
            <label className="os-fchk os-dis"><input type="checkbox" disabled /> SvLog</label>
            <label className="os-fchk"><input type="checkbox" checked={tableMode} onChange={e=>setTableMode(e.target.checked)} /> Table</label>
            <div style={{flex:1}} />
            <button type="button" className="os-fbtn os-ok" onClick={stage==='filter'?generate:()=>setStage('filter')}>
              {stage==='filter' ? 'OK' : 'Filter Options'}
            </button>
            <button type="button" className="os-fbtn" onClick={onClose}>Exit</button>
          </div>
        </div>
      )}
    </ErpWindowedModal>
  );
};

/* ═══════════════════════════════════ CSS ═══════════════════════════════════ */
const css = `
/* Root */
.os-root { display:flex; flex-direction:column; height:100%; min-height:0; background:#b8d8d8; font-family:Tahoma,'Segoe UI',sans-serif; font-size:12px; }

/* Title bar */
.os-titlebar { display:flex; align-items:center; background:#003087; color:#fff; padding:2px 6px; min-height:28px; font-weight:700; font-size:13px; }
.os-title-text { flex:1; }
.os-type-toggle { display:flex; gap:4px; margin-right:12px; }
.os-type-btn { background:#002060; color:#c0d0f0; border:1px solid #3b82f6; padding:2px 8px; font-size:11px; font-weight:700; cursor:pointer; border-radius:3px; }
.os-type-btn.active { background:#ffaa00; color:#000; border-color:#fff; }
.os-tbtn-filter { background:#003087 !important; color:#fff !important; }

/* ── FILTER ── */
.os-filter-body { flex:1; min-height:0; overflow-y:auto; display:flex; flex-direction:column; gap:2px; padding:4px; }
.os-daterow { display:flex; align-items:center; gap:6px; font-size:12px; font-weight:700; padding:2px 4px; flex-wrap:wrap; }
.os-daterow input[type="date"] { height:22px; font-size:12px; padding:0 4px; border:1px solid #888; min-width:120px; }
.os-daterow select { height:22px; font-size:12px; }
.os-date-today { width:100px; background:#f0f0f0; }
.os-ml { margin-left:auto; }
.os-chk { display:flex; align-items:center; gap:3px; font-weight:700; font-size:12px; cursor:pointer; }
.os-dis { color:#999; }
.os-sel-sm { height:22px; font-size:12px; min-width:80px; border:1px solid #888; }
.os-num-sm { height:22px; font-size:12px; width:50px; border:1px solid #888; padding:0 4px; }
.os-btn-sm { height:24px; font-size:11px; font-weight:700; padding:0 12px; border:1px solid #555; background:#e8e8e8; cursor:pointer; }

.os-row-between { display:flex; align-items:center; justify-content:space-between; padding:1px 4px; }
.os-row-gap4 { display:flex; gap:4px; }

/* Tabs */
.os-tabs { display:flex; gap:1px; flex-wrap:wrap; padding:0 4px; }
.os-tabs button { background:#e0e8f0; border:1px solid #999; border-bottom:none; padding:2px 8px; font-size:11px; font-weight:700; cursor:pointer; }
.os-tabs button.on { background:#003087; color:#fff; }
.os-tabs button:disabled { color:#aaa; cursor:not-allowed; background:#e0e0e0; }

/* List */
.os-list-wrap { flex:1; min-height:0; display:flex; flex-direction:column; padding:0 4px; gap:2px; }
.os-filter-input { height:24px; border:1px solid #888; padding:0 6px; font-size:12px; max-width:300px; }
.os-list-scroll { flex:1; min-height:0; overflow:auto; border:1px solid #888; background:#fff; }
.os-list-table { width:100%; border-collapse:collapse; font-size:12px; }
.os-list-table th { text-align:left; background:#f4f4f4; border-bottom:1px solid #ccc; padding:2px 6px; position:sticky; top:0; font-weight:700; font-size:11px; }
.os-list-table td { border-bottom:1px solid #eee; padding:2px 6px; cursor:pointer; }
.os-list-table tr.on td { background:#003087; color:#fff; }
.os-empty-cell { text-align:center; padding:12px; color:#888; }

/* Checks grid — 3 columns */
.os-checks-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:1px 12px; padding:4px 8px; background:#d0e8e8; font-size:11px; }
.os-checks-grid label { display:flex; align-items:center; gap:3px; padding:1px 2px; cursor:pointer; white-space:nowrap; }
.os-hl { background:#0050d4; color:#fff; font-weight:700; padding:1px 4px !important; }

/* GroupBy bar */
.os-groupby-bar { display:flex; align-items:center; gap:6px; padding:3px 8px; background:#d0e8e8; font-size:11px; font-weight:700; flex-wrap:wrap; }

/* ── RESULT ── */
.os-result-body { flex:1; min-height:0; display:flex; flex-direction:column; background:#c8c8c8; }
.os-result-toolbar { display:flex; align-items:center; gap:6px; padding:4px 6px; background:#e0e0e0; border-bottom:1px solid #999; flex-wrap:wrap; }
.os-bill-count { font-size:11px; font-weight:700; color:#333; white-space:nowrap; }
.os-find-label { font-size:11px; font-weight:700; }
.os-find-input { height:22px; font-size:12px; border:1px solid #888; padding:0 6px; width:180px; }
.os-toolbar-right { display:flex; gap:4px; margin-left:auto; }
.os-tbtn { height:24px; font-size:11px; font-weight:700; padding:0 10px; border:1px solid #666; background:#e4e4e4; cursor:pointer; }
.os-tbtn:hover { background:#d0d0d0; }
.os-colset-wrap { position:relative; }
.os-colset-pop { position:absolute; top:100%; right:0; z-index:50; background:#fff; border:2px solid #003087; padding:6px; width:160px; box-shadow:2px 2px 8px rgba(0,0,0,.3); display:flex; flex-direction:column; gap:2px; font-size:11px; }

/* Grid */
.os-grid-scroll { flex:1; min-height:0; overflow:auto; background:#c8c8c8; max-height:calc(100vh - 180px); }
.os-no-maxh { max-height:none !important; }
.os-grid { width:100%; border-collapse:collapse; background:#fff; font-size:12px; }
.os-grid th { background:#003087; color:#fff; border:1px solid #002060; padding:2px 5px; text-align:left; font-weight:700; font-size:11px; white-space:nowrap; position:sticky; top:0; z-index:2; }
.os-grid td { border:1px solid #d0d0d0; padding:1px 5px; white-space:nowrap; height:20px; }
.os-grid .num, .os-grid th.num { text-align:right; font-variant-numeric:tabular-nums; }

.os-party-hdr td { background:#003087; color:#fff; font-weight:700; font-size:12px; padding:2px 6px !important; }
.os-party-addr { font-weight:400; margin-left:16px; font-size:11px; }
.os-bill-row:hover td { background:#e8f0ff; }
.os-party-tot td { color:#008000; font-weight:700; background:#fff; }
.os-grand-row td { font-weight:700; background:#f0f0f0; border-top:2px solid #666; }

/* ── Footer ── */
.os-footer { display:flex; align-items:center; gap:6px; padding:3px 6px; background:#dcdcdc; border-top:1px solid #999; min-height:32px; }
.os-fbtn { height:26px; font-size:12px; font-weight:700; padding:0 14px; border:1px solid #666; background:#e4e4e4; cursor:pointer; min-width:50px; }
.os-fbtn:hover { background:#d0d0d0; }
.os-ok { background:#003087; color:#fff; border-color:#002060; }
.os-ok:hover { background:#0040a0; }
.os-fchk { display:flex; align-items:center; gap:3px; font-size:11px; font-weight:700; white-space:nowrap; }

@media print {
  .os-titlebar, .os-footer, .os-result-toolbar { display:none !important; }
  .os-grid-scroll { overflow:visible !important; max-height:none !important; }
  .os-result-body { height:auto !important; }
}
`;

export default OutstandingReportModal;
