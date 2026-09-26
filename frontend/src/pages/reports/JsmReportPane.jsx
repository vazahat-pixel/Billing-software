import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/ui/Modal';
import ErpWindowedModal from '../../components/erp/ErpWindowedModal';
import { downloadCsv } from '../../utils/reportExport';
import { notifyInfo, notifyWarning } from '../../utils/notify';
import { openWhatsAppShare } from '../../utils/invoiceHelpers';

const fyStart = () => {
  const d = new Date();
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-04-01`;
};
const today = () => new Date().toISOString().slice(0, 10);
const dmy = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${dt.getFullYear()}`;
};
const n2 = (v) => (Number(v) || 0).toFixed(2);
const partyId = (p) => String(p?._id || p?.id || '');

const TABS = [
  { key: 'party', label: 'Party', live: true },
  { key: 'broker', label: 'Broker', live: true },
  { key: 'city', label: 'City', live: true },
  { key: 'book', label: 'Book', live: true },
  { key: 'haste', label: 'Haste', live: false },
  { key: 'transport', label: 'Transport', live: false },
  { key: 'item', label: 'Item', live: false },
  { key: 'salesman', label: 'SalesMan', live: false },
  { key: 'area', label: 'Area', live: false },
];

const COLS = [
  { key: 'com', label: 'COM' },
  { key: 'billNo', label: 'BILLNO' },
  { key: 'billDt', label: 'BILL.DT' },
  { key: 'party', label: 'PARTY' },
  { key: 'item', label: 'ITEM.NAME' },
  { key: 'pcs', label: 'PCS', num: true },
  { key: 'qty', label: 'QTY', num: true },
  { key: 'rate', label: 'RATE', num: true },
  { key: 'amount', label: 'AMOUNT', num: true },
  { key: 'add', label: 'T.ADD', num: true },
  { key: 'less', label: 'T.LESS', num: true },
  { key: 'net', label: 'NET.', num: true },
];

const SALES_KEYS = new Set(['salesSummary', 'salesDetail', 'salesItemWise', 'salesHaste']);

export default function JsmReportPane({
  reportTitle,
  reportKey,
  parties = [],
  salesRows = [],
  loading,
  onGenerate,
  onExit,
  children,
}) {
  const companyCode = 'SCC';
  const [from, setFrom] = useState(fyStart);
  const [to, setTo] = useState(today);
  const [tab, setTab] = useState('party');
  const [picked, setPicked] = useState(() => new Set());
  const [q, setQ] = useState('');
  const [groupBy, setGroupBy] = useState('Register');
  const [grandTotal, setGrandTotal] = useState(true);
  const [summaryOnly, setSummaryOnly] = useState(false);
  const [status, setStatus] = useState('All');
  const [stage, setStage] = useState('filter');
  const [hidden, setHidden] = useState(() => new Set());
  const [colsOpen, setColsOpen] = useState(false);

  const isSales = SALES_KEYS.has(reportKey);

  const rowsForTab = useMemo(() => {
    const list = Array.isArray(parties) ? parties : [];
    if (tab === 'broker') {
      return list.filter((p) => /broker/i.test(`${p.type || ''} ${p.group || ''}`));
    }
    if (tab === 'city') {
      const cities = [...new Set(list.map((p) => p.city || p.station).filter(Boolean))].sort();
      return cities.map((name) => ({ _id: `city:${name}`, name, city: name }));
    }
    if (tab === 'book') {
      return [{ _id: 'book:SALES BOOK', name: 'SALES BOOK' }];
    }
    if (tab === 'party') {
      return list.filter((p) => !/broker/i.test(String(p.type || '')));
    }
    return [];
  }, [parties, tab]);

  const visible = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rowsForTab;
    return rowsForTab.filter((p) => String(p.name || '').toLowerCase().includes(query) || String(p.city || p.station || '').toLowerCase().includes(query));
  }, [rowsForTab, q]);

  const toggle = (id) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedNames = useMemo(() => {
    const names = new Set();
    parties.forEach((p) => {
      if (picked.has(partyId(p))) names.add(String(p.name || '').toLowerCase());
    });
    picked.forEach((id) => {
      if (String(id).startsWith('city:')) names.add(String(id).slice(5).toLowerCase());
    });
    return names;
  }, [picked, parties]);

  const run = async () => {
    await onGenerate?.(from, to, [...selectedNames]);
    setStage('result');
  };

  useEffect(() => {
    setStage('filter');
    setPicked(new Set());
  }, [reportKey]);

  useEffect(() => {
    if (stage !== 'filter') return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onExit?.();
        return;
      }
      if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.target?.tagName === 'SELECT') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      run();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // run closes over the current filter; rebind when those inputs change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, from, to, loading, picked, groupBy, status]);

  const lines = useMemo(() => {
    let bills = Array.isArray(salesRows) ? salesRows : [];
    if (selectedNames.size) {
      bills = bills.filter((r) => {
        const party = String(r.partyName || '').toLowerCase();
        const city = String(r.city || '').toLowerCase();
        return selectedNames.has(party) || selectedNames.has(city);
      });
    }
    if (status === 'Pending') bills = bills.filter((r) => Number(r.balance || 0) > 0.01);
    const flat = [];
    bills.forEach((bill) => {
      const items = bill.items?.length ? bill.items : [{
        name: '',
        pcs: 0,
        qty: 0,
        rate: 0,
        amount: bill.netAmount || 0,
        addAmt: 0,
        lessAmt: 0,
      }];
      items.forEach((it) => {
        const add = Number(it.addAmt || 0);
        const less = Number(it.lessAmt || 0);
        const amount = Number(it.amount || 0);
        flat.push({
          book: bill.book || 'SALES BOOK',
          party: bill.partyName || '',
          city: bill.city || '',
          com: companyCode,
          billNo: bill.invoiceNo || '',
          billDt: bill.date,
          item: it.name || '',
          pcs: it.pcs || 0,
          qty: it.qty || 0,
          rate: it.rate || 0,
          amount,
          add,
          less,
          net: amount + add - less,
        });
      });
    });
    const groups = new Map();
    flat.forEach((row) => {
      const key = groupBy === 'Party' ? (row.party || 'PARTY') : groupBy === 'None' ? 'ALL' : (row.book || 'SALES BOOK');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });
    return { groups, flat };
  }, [salesRows, selectedNames, status, groupBy, companyCode]);

  const sum = (rows) => rows.reduce((a, r) => ({
    pcs: a.pcs + Number(r.pcs || 0),
    qty: a.qty + Number(r.qty || 0),
    amount: a.amount + Number(r.amount || 0),
    add: a.add + Number(r.add || 0),
    less: a.less + Number(r.less || 0),
    net: a.net + Number(r.net || 0),
    rate: 0,
  }), { pcs: 0, qty: 0, amount: 0, add: 0, less: 0, net: 0, rate: 0 });

  const grand = sum(lines.flat);
  if (lines.flat.length && grand.qty) grand.rate = grand.amount / grand.qty;

  const cols = COLS.filter((c) => !hidden.has(c.key));
  const cell = (col, row, isTotal) => {
    if (isTotal && ['com', 'billNo', 'billDt', 'party', 'item'].includes(col.key)) return col.key === 'com' ? row.label : '';
    if (col.key === 'billDt') return dmy(row.billDt);
    if (col.num) return n2(row[col.key]);
    return row[col.key] ?? '';
  };

  const exportCsv = () => {
    const body = [];
    lines.groups.forEach((rows, key) => {
      body.push([`REGISTER - ${key}`]);
      if (!summaryOnly) rows.forEach((r) => body.push(cols.map((c) => cell(c, r))));
      const t = sum(rows);
      body.push(cols.map((c, i) => (i === 0 ? 'REGISTER-TOTAL' : (c.num ? n2(t[c.key]) : ''))));
    });
    if (grandTotal) body.push(cols.map((c, i) => (i === 0 ? 'GRAND TOTAL' : (c.num ? n2(grand[c.key]) : ''))));
    downloadCsv(`report-${reportKey || 'sales'}.csv`, cols.map((c) => c.label), body);
  };

  if (stage === 'filter') {
    return (
      <Modal isOpen onClose={onExit} bare className="max-w-[960px] w-[960px]" overlayZ={10100}>
      <div className="jsm-filter" data-enter-nav="off" onKeyDown={(e) => e.stopPropagation()}>
        <div className="jsm-filter-title">{reportTitle || 'Report'}</div>
        <div className="jsm-filter-top">
          <label>From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label>To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <span className="jsm-filter-company">Company Wise</span>
          <select defaultValue="current" disabled title="This login is one company">
            <option value="current">Current</option>
          </select>
        </div>
        <div className="jsm-filter-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={tab === t.key ? 'on' : ''}
              disabled={!t.live}
              title={t.live ? '' : 'No saved master for this filter'}
              onClick={() => { setTab(t.key); setQ(''); }}
            >
              {t.label}
            </button>
          ))}
          <button type="button" className="jsm-filter-all" onClick={() => setPicked(new Set(visible.map((p) => partyId(p) || p._id)))}>
            Select/UnSelect All
          </button>
        </div>
        <input
          className="jsm-filter-search"
          placeholder="Type to find in this list…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="jsm-filter-list">
          <table>
            <thead>
              <tr>
                <th />
                <th>AC_NAME</th>
                <th>ST_NAME</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr><td colSpan={3} className="jsm-empty">{TABS.find((t) => t.key === tab)?.live ? 'Nothing in this list' : 'This filter is not stored yet'}</td></tr>
              )}
              {visible.map((p) => {
                const id = partyId(p) || p._id;
                const on = picked.has(id);
                return (
                  <tr key={id} className={on ? 'on' : ''} onClick={() => toggle(id)}>
                    <td><input type="checkbox" checked={on} onChange={() => toggle(id)} onClick={(e) => e.stopPropagation()} /></td>
                    <td>{p.name}</td>
                    <td>{p.city || p.station || ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="jsm-filter-opts">
          <label>Printout
            <select defaultValue="1"><option>1-Continue</option></select>
          </label>
          <label><input type="checkbox" checked={grandTotal} onChange={(e) => setGrandTotal(e.target.checked)} /> Grand Total</label>
          <label><input type="checkbox" checked={summaryOnly} onChange={(e) => setSummaryOnly(e.target.checked)} /> Summary Reports</label>
          <label>GroupBy 1
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
              <option>Register</option>
              <option>Party</option>
              <option>None</option>
            </select>
          </label>
          <label>Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option>All</option>
              <option>Pending</option>
            </select>
          </label>
        </div>
        <div className="jsm-filter-actions">
          <button type="button" className="jsm-ok" onClick={run} disabled={loading}>{loading ? 'Loading…' : 'Ok'}</button>
          <button type="button" onClick={onExit}>Exit</button>
          <span>Enter = Ok</span>
        </div>
        <style>{css}</style>
      </div>
      </Modal>
    );
  }

  const showRegister = isSales;

  return (
    <ErpWindowedModal
      isOpen
      onClose={() => setStage('filter')}
      title="Report Control"
      windowId={`report-control-${reportKey || 'report'}`}
      defaultMode="maximized"
      bare
    >
    {({ WindowControls }) => (
    <div className="jsm-result" data-enter-nav="off">
      <div className="classic-erp-header shrink-0">
        <span className="erp-window-title">Report Control</span>
        <WindowControls />
      </div>
      <div className="jsm-result-scroll">
        {showRegister ? (
          <table className="jsm-grid">
            <thead>
              <tr>{cols.map((c) => <th key={c.key} className={c.num ? 'num' : ''}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {[...lines.groups.entries()].map(([key, rows]) => {
                const t = sum(rows);
                if (rows.length && t.qty) t.rate = t.amount / t.qty;
                return (
                  <React.Fragment key={key}>
                    <tr className="jsm-reg"><td colSpan={cols.length}>REGISTER - {key}</td></tr>
                    {!summaryOnly && rows.map((r, i) => (
                      <tr key={`${r.billNo}-${i}`}>
                        {cols.map((c) => <td key={c.key} className={c.num ? 'num' : ''}>{cell(c, r)}</td>)}
                      </tr>
                    ))}
                    <tr className="jsm-regtot">
                      {cols.map((c, i) => (
                        <td key={c.key} className={c.num ? 'num' : ''}>{i === 0 ? 'REGISTER-TOTAL' : (c.num ? n2(t[c.key]) : '')}</td>
                      ))}
                    </tr>
                  </React.Fragment>
                );
              })}
              {lines.flat.length === 0 && (
                <tr><td colSpan={cols.length} className="jsm-empty">No bills for this filter</td></tr>
              )}
            </tbody>
            {grandTotal && lines.flat.length > 0 && (
              <tfoot>
                <tr>
                  {cols.map((c, i) => (
                    <td key={c.key} className={c.num ? 'num' : ''}>{i === 0 ? 'GRAND TOTAL' : (c.num ? n2(grand[c.key]) : '')}</td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        ) : children}
      </div>
      <div className="jsm-result-bar">
        <div className="jsm-colset">
          <button type="button" onClick={() => setColsOpen((v) => !v)}>ColumnSet</button>
          {colsOpen && (
            <div className="jsm-colset-pop">
              {COLS.map((c) => (
                <label key={c.key}>
                  <input
                    type="checkbox"
                    checked={!hidden.has(c.key)}
                    onChange={() => setHidden((prev) => {
                      const next = new Set(prev);
                      if (next.has(c.key)) next.delete(c.key);
                      else next.add(c.key);
                      return next;
                    })}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="jsm-length"><span>Total Length</span><i /></div>
        <button type="button" onClick={exportCsv} disabled={!showRegister}>Excel</button>
        <button type="button" onClick={() => window.print()}>PreView</button>
        <button type="button" onClick={() => notifyInfo('Mail needs a party email on the selected account')}>Mail</button>
        <button type="button" onClick={() => {
          if (!lines.flat.length) return notifyWarning('Generate the report first');
          openWhatsAppShare(`${reportTitle}\nBills: ${lines.flat.length}\nNet: ${n2(grand.net)}`, '');
        }}>Whatsapp</button>
        <button type="button" onClick={() => window.print()}>Print</button>
        <button type="button" onClick={() => setStage('filter')}>Exit</button>
      </div>
      <style>{css}</style>
    </div>
    )}
    </ErpWindowedModal>
  );
}

const css = `
.jsm-filter { background:#8ecae6; height:min(78vh, 640px); min-height:420px; display:flex; flex-direction:column; padding:8px; gap:6px; font-size:12px; }
.jsm-filter-title { background:#1e3a5f; color:#fff; font-weight:800; font-size:13px; letter-spacing:.02em; padding:6px 10px; }
.jsm-filter-top { display:flex; gap:8px; align-items:center; background:#9aa4b2; padding:6px; }
.jsm-filter-top input, .jsm-filter-top select, .jsm-filter-opts select { height:22px; font-size:12px; }
.jsm-filter-company { margin-left:auto; background:#fff; border:1px solid #334; padding:2px 8px; font-weight:700; }
.jsm-filter-tabs { display:flex; gap:2px; align-items:flex-end; flex-wrap:wrap; }
.jsm-filter-tabs button { background:#dbe4ea; border:1px solid #64748b; border-bottom:none; padding:3px 8px; font-size:11px; font-weight:700; cursor:pointer; }
.jsm-filter-tabs button.on { background:#1d4ed8; color:#fff; }
.jsm-filter-tabs button:disabled { color:#94a3b8; cursor:not-allowed; }
.jsm-filter-all { margin-left:auto; background:#e2e8f0 !important; border:1px solid #64748b !important; }
.jsm-filter-search { height:24px; border:1px solid #64748b; padding:0 6px; }
.jsm-filter-list { flex:1; min-height:0; overflow:auto; background:#fff; border:1px solid #64748b; }
.jsm-filter-list table { width:100%; border-collapse:collapse; font-size:12px; }
.jsm-filter-list th { text-align:left; background:#f8fafc; position:sticky; top:0; }
.jsm-filter-list td, .jsm-filter-list th { border-bottom:1px solid #e2e8f0; padding:2px 6px; }
.jsm-filter-list tr.on td { background:#1d4ed8; color:#fff; }
.jsm-filter-opts { display:flex; flex-wrap:wrap; gap:10px; align-items:center; background:#7dd3fc; padding:6px; }
.jsm-filter-actions { display:flex; gap:8px; justify-content:flex-end; align-items:center; background:#94a3b8; padding:6px; }
.jsm-filter-actions button, .jsm-result-bar button { height:26px; padding:0 12px; font-weight:700; }
.jsm-ok { background:#e2e8f0; }
.jsm-result { height:100%; min-height:0; display:flex; flex-direction:column; background:#bdbdbd; }
.jsm-result-scroll { flex:1; min-height:0; overflow:auto; background:#d0d0d0; }
.jsm-grid { width:100%; border-collapse:collapse; background:#fff; font-size:12px; font-family:Tahoma,sans-serif; }
.jsm-grid th { background:#7f1d1d; color:#fff; border:1px solid #451a1a; padding:3px 4px; text-align:left; }
.jsm-grid td { border:1px solid #e5e5e5; padding:2px 4px; }
.jsm-grid .num, .jsm-grid th.num { text-align:right; font-variant-numeric:tabular-nums; }
.jsm-reg td { background:#1d4ed8; color:#fff; font-weight:800; }
.jsm-regtot td { color:#15803d; font-weight:800; }
.jsm-grid tfoot td { font-weight:800; background:#f8fafc; }
.jsm-empty { text-align:center; padding:16px; color:#64748b; }
.jsm-result-bar { display:flex; gap:8px; align-items:center; padding:6px; background:#e5e5e5; border-top:1px solid #94a3b8; position:relative; }
.jsm-length { display:flex; flex-direction:column; font-size:11px; color:#1d4ed8; font-weight:700; min-width:90px; }
.jsm-length i { display:block; height:12px; background:#22c55e; border:1px solid #15803d; }
.jsm-colset-pop { position:absolute; bottom:36px; left:6px; background:#fff; border:2px solid #1d4ed8; padding:6px; display:flex; flex-direction:column; gap:2px; font-size:11px; z-index:5; }
`;
