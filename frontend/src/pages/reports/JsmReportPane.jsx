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

const dmyDash = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${dt.getFullYear()}`;
};

const dmySlash = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${dt.getFullYear()}`;
};

const n2 = (v) => (Number(v) || 0).toFixed(2);
const nInt = (v) => String(Math.round(Number(v) || 0));
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

/** Summary Columns matching client's Screenshot 1 */
const SUMMARY_COLS = [
  { key: 'billDt', label: 'BILL.DT', width: '95px' },
  { key: 'billNo', label: 'BILLNO', width: '80px', num: true, int: true },
  { key: 'party', label: 'PARTY' },
  { key: 'pcs', label: 'T.PCS', num: true, int: true, width: '65px' },
  { key: 'qty', label: 'T.QTY', num: true, width: '75px' },
  { key: 'sgst', label: 'SGST', num: true, width: '75px' },
  { key: 'cgst', label: 'CGST', num: true, width: '75px' },
  { key: 'igst', label: 'IGST', num: true, width: '80px' },
  { key: 'tcs', label: 'TCS', num: true, width: '65px' },
  { key: 'net', label: 'NET.AMOUNT', num: true, width: '100px' },
];

/** Detailed Item-wise Columns matching client's Screenshot 2 & 3 */
const DETAIL_COLS = [
  { key: 'com', label: 'COM', width: '60px' },
  { key: 'billNo', label: 'BILLNO', width: '75px' },
  { key: 'billDt', label: 'BILL.DT', width: '90px' },
  { key: 'party', label: 'PARTY' },
  { key: 'item', label: 'ITEM.NAME' },
  { key: 'pcs', label: 'PCS', num: true, int: true, width: '60px' },
  { key: 'qty', label: 'QTY', num: true, width: '75px' },
  { key: 'rate', label: 'RATE', num: true, width: '75px' },
  { key: 'amount', label: 'AMOUNT', num: true, width: '90px' },
  { key: 'add', label: 'T.ADD', num: true, width: '65px' },
  { key: 'less', label: 'T.LESS', num: true, width: '75px' },
  { key: 'net', label: 'NET.AMOUNT', num: true, width: '100px' },
];

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
  const [summaryOnly, setSummaryOnly] = useState(() => String(reportKey || '').toLowerCase().includes('summary'));
  const [status, setStatus] = useState('All');
  const [stage, setStage] = useState('filter');
  const [hidden, setHidden] = useState(() => new Set());
  const [colsOpen, setColsOpen] = useState(false);
  const [selectedRowKey, setSelectedRowKey] = useState(null);

  const isPurchase = String(reportKey || '').toLowerCase().includes('purchase');
  const isSummary = String(reportKey || '').toLowerCase().includes('summary') || Boolean(summaryOnly);
  const activeColsDef = isSummary ? SUMMARY_COLS : DETAIL_COLS;

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
      return [{ _id: 'book:SALES BOOK', name: 'SALES BOOK' }, { _id: 'book:PURCHASE BOOK', name: 'PURCHASE BOOK' }];
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
    setSummaryOnly(String(reportKey || '').toLowerCase().includes('summary'));
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
    const defaultBook = isPurchase ? 'PURCHASE BOOK' : 'SALES BOOK';

    bills.forEach((bill) => {
      const bookName = bill.book || defaultBook;

      if (isSummary) {
        // Summary mode: 1 row per bill
        const tPcs = Number(bill.tPcs ?? (bill.items || []).reduce((a, b) => a + Number(b.pcs || 0), 0));
        const tQty = Number(bill.tQty ?? (bill.items || []).reduce((a, b) => {
          const fold = Number(b.fold || 0);
          const q = Number(b.qty || b.mts || 0);
          return a + (fold > 0 ? q * (1 - fold / 100) : q);
        }, 0));

        flat.push({
          _key: String(bill._id || bill.invoiceNo || Math.random()),
          book: bookName,
          party: bill.partyName || '',
          city: bill.city || '',
          com: companyCode,
          billNo: bill.invoiceNo || bill.billNo || '',
          billDt: bill.date,
          pcs: tPcs,
          qty: tQty,
          sgst: Number(bill.sgst || 0),
          cgst: Number(bill.cgst || 0),
          igst: Number(bill.igst || 0),
          tcs: Number(bill.tcs || 0),
          net: Number(bill.netAmount || 0),
        });
      } else {
        // Detail mode: 1 row per item
        const items = bill.items?.length ? bill.items : [{
          name: '',
          pcs: 0,
          qty: 0,
          rate: 0,
          amount: bill.netAmount || 0,
          addAmt: 0,
          lessAmt: 0,
          netAmount: bill.netAmount || 0,
        }];

        items.forEach((it, iIdx) => {
          const add = Number(it.addAmt || 0);
          const less = Number(it.lessAmt || 0);
          const amount = Number(it.amount || 0);
          const itemNet = Number(it.netAmount || (amount + add - less));

          flat.push({
            _key: `${bill._id || bill.invoiceNo}-${iIdx}`,
            book: bookName,
            party: bill.partyName || '',
            city: bill.city || '',
            com: companyCode,
            billNo: bill.invoiceNo || bill.billNo || '',
            billDt: bill.date,
            item: it.name || it.itemName || '',
            pcs: Number(it.pcs || 0),
            qty: Number(it.qty || it.mts || 0),
            rate: Number(it.rate || 0),
            amount,
            add,
            less,
            net: itemNet,
          });
        });
      }
    });

    const groups = new Map();
    flat.forEach((row) => {
      const key = groupBy === 'Party' ? (row.party || 'PARTY') : groupBy === 'None' ? 'ALL' : (row.book || defaultBook);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });

    return { groups, flat };
  }, [salesRows, selectedNames, status, groupBy, companyCode, isSummary, isPurchase]);

  const sum = (rows) => {
    if (isSummary) {
      return rows.reduce((a, r) => ({
        pcs: a.pcs + Number(r.pcs || 0),
        qty: a.qty + Number(r.qty || 0),
        sgst: a.sgst + Number(r.sgst || 0),
        cgst: a.cgst + Number(r.cgst || 0),
        igst: a.igst + Number(r.igst || 0),
        tcs: a.tcs + Number(r.tcs || 0),
        net: a.net + Number(r.net || 0),
      }), { pcs: 0, qty: 0, sgst: 0, cgst: 0, igst: 0, tcs: 0, net: 0 });
    }

    const t = rows.reduce((a, r) => ({
      pcs: a.pcs + Number(r.pcs || 0),
      qty: a.qty + Number(r.qty || 0),
      amount: a.amount + Number(r.amount || 0),
      add: a.add + Number(r.add || 0),
      less: a.less + Number(r.less || 0),
      net: a.net + Number(r.net || 0),
      rate: 0,
    }), { pcs: 0, qty: 0, amount: 0, add: 0, less: 0, net: 0, rate: 0 });

    if (t.qty > 0) {
      t.rate = t.amount / t.qty;
    }
    return t;
  };

  const grand = sum(lines.flat);

  const cols = activeColsDef.filter((c) => !hidden.has(c.key));

  const cell = (col, row) => {
    if (col.key === 'billDt') {
      return isSummary ? dmyDash(row.billDt) : dmySlash(row.billDt);
    }
    if (col.int) {
      return nInt(row[col.key]);
    }
    if (col.num) {
      return n2(row[col.key]);
    }
    return row[col.key] ?? '';
  };

  const exportCsv = () => {
    const body = [];
    lines.groups.forEach((rows, key) => {
      body.push([`REGISTER - ${key}`]);
      rows.forEach((r) => body.push(cols.map((c) => cell(c, r))));
      const t = sum(rows);
      body.push(cols.map((c, i) => (i === 0 ? 'REGISTER-TOTAL' : (c.num ? (c.int ? nInt(t[c.key]) : n2(t[c.key])) : ''))));
    });
    if (grandTotal) {
      body.push(cols.map((c, i) => (i === 0 ? 'GRAND TOTAL' : (c.num ? (c.int ? nInt(grand[c.key]) : n2(grand[c.key])) : ''))));
    }
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
            <button
              type="button"
              className="jsm-filter-all"
              onClick={() => {
                if (picked.size === visible.length) setPicked(new Set());
                else setPicked(new Set(visible.map((p) => partyId(p) || p._id)));
              }}
            >
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
                  <th style={{ width: 36 }} />
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
            <table className="jsm-grid">
              <thead>
                <tr>
                  <th className="jsm-sel-col" style={{ width: 24, textAlign: 'center' }}>▶</th>
                  {cols.map((c) => (
                    <th key={c.key} className={c.num ? 'num' : ''} style={{ width: c.width }}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...lines.groups.entries()].map(([key, rows]) => {
                  const t = sum(rows);
                  const isTopSelected = selectedRowKey === `reg-${key}`;

                  return (
                    <React.Fragment key={key}>
                      <tr
                        className={`jsm-reg ${isTopSelected ? 'jsm-row-active' : ''}`}
                        onClick={() => setSelectedRowKey(`reg-${key}`)}
                      >
                        <td className="jsm-sel-col">{isTopSelected ? '▶' : ''}</td>
                        <td colSpan={cols.length}>REGISTER - {key}</td>
                      </tr>
                      {rows.map((r, i) => {
                        const isRowSelected = selectedRowKey === r._key || (!selectedRowKey && i === 0);
                        return (
                          <tr
                            key={r._key || i}
                            className={isRowSelected ? 'jsm-row-active' : ''}
                            onClick={() => setSelectedRowKey(r._key)}
                          >
                            <td className="jsm-sel-col">{isRowSelected ? '▶' : ''}</td>
                            {cols.map((c) => (
                              <td key={c.key} className={c.num ? 'num' : ''}>{cell(c, r)}</td>
                            ))}
                          </tr>
                        );
                      })}
                      <tr className="jsm-regtot">
                        <td className="jsm-sel-col" />
                        {cols.map((c, i) => {
                          if (i === 0) return <td key={c.key}>REGISTER-TOTAL</td>;
                          // In summary mode: Col 1 & 2 (BILLNO, PARTY) are blank
                          if (isSummary && (c.key === 'billNo' || c.key === 'party')) return <td key={c.key} />;
                          // In detail mode: non-numerical text columns are blank
                          if (!isSummary && ['billNo', 'billDt', 'party', 'item'].includes(c.key)) return <td key={c.key} />;
                          if (c.num) return <td key={c.key} className="num">{c.int ? nInt(t[c.key]) : n2(t[c.key])}</td>;
                          return <td key={c.key} />;
                        })}
                      </tr>
                    </React.Fragment>
                  );
                })}

                {lines.flat.length === 0 && (
                  <tr>
                    <td className="jsm-sel-col" />
                    <td colSpan={cols.length} className="jsm-empty">No records found for this filter</td>
                  </tr>
                )}
              </tbody>

              {grandTotal && lines.flat.length > 0 && (
                <tfoot>
                  <tr className="jsm-grandtot">
                    <td className="jsm-sel-col" />
                    {cols.map((c, i) => {
                      if (i === 0) return <td key={c.key}>GRAND TOTAL</td>;
                      if (isSummary && (c.key === 'billNo' || c.key === 'party')) return <td key={c.key} />;
                      if (!isSummary && ['billNo', 'billDt', 'party', 'item'].includes(c.key)) return <td key={c.key} />;
                      if (c.num) return <td key={c.key} className="num">{c.int ? nInt(grand[c.key]) : n2(grand[c.key])}</td>;
                      return <td key={c.key} />;
                    })}
                  </tr>
                  <tr className="jsm-new-indicator">
                    <td className="jsm-sel-col">*</td>
                    <td colSpan={cols.length} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Bottom Bar: Exact Match to Screenshot */}
          <div className="jsm-result-bar">
            <div className="jsm-colset">
              <button type="button" onClick={() => setColsOpen((v) => !v)}>ColumnSet</button>
              {colsOpen && (
                <div className="jsm-colset-pop">
                  {activeColsDef.map((c) => (
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

            <div className="jsm-progress-container">
              <div className="jsm-progress-bar" />
            </div>

            <div className="jsm-length">
              <span>Total Lenth</span>
              <div className="jsm-length-slider">
                <span className="jsm-handle">||</span>
              </div>
            </div>

            <button type="button" onClick={exportCsv}>Excel</button>
            <button type="button" onClick={() => window.print()}>PreView</button>
            <button type="button" onClick={() => notifyInfo('Mail needs a party email on the selected account')}>Mail</button>
            <button type="button" onClick={() => {
              if (!lines.flat.length) return notifyWarning('Generate the report first');
              openWhatsAppShare(`${reportTitle}\nBills: ${lines.flat.length}\nNet: ${n2(grand.net)}`, '');
            }}>Whatsa</button>
            <button type="button" onClick={() => window.print()}>Print</button>
            <button type="button" onClick={() => setStage('filter')}>Exit</button>

            <div className="jsm-amount-box">0.00</div>
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

.jsm-result { height:100%; min-height:0; display:flex; flex-direction:column; background:#9e9e9e; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; }
.jsm-result-scroll { flex:1; min-height:0; overflow:auto; background:#9e9e9e; }
.jsm-grid { width:100%; border-collapse:collapse; background:#fff; font-size:12px; }
.jsm-grid th { background:#7f0000; color:#fff; border:1px solid #5a0000; padding:3px 5px; text-align:left; font-weight:bold; font-size:11px; white-space:nowrap; }
.jsm-grid td { border:1px solid #d4d4d4; padding:2px 5px; white-space:nowrap; height:20px; }
.jsm-grid .num, .jsm-grid th.num { text-align:right; font-variant-numeric:tabular-nums; }
.jsm-sel-col { width:20px !important; min-width:20px !important; max-width:20px !important; background:#d4d4d4 !important; border-color:#a0a0a0 !important; text-align:center !important; font-size:10px; font-weight:bold; color:#000; padding:0 !important; cursor:default; }
.jsm-reg td { background:#0055b3; color:#fff; font-weight:bold; }
.jsm-reg .jsm-sel-col { background:#0055b3 !important; color:#fff !important; }
.jsm-row-active td { background:#e0f2fe; }
.jsm-row-active .jsm-sel-col { background:#bfdbfe !important; }
.jsm-regtot td { color:#008000; font-weight:bold; background:#fff; }
.jsm-regtot .jsm-sel-col { background:#d4d4d4 !important; }
.jsm-grandtot td { color:#000000; font-weight:bold; background:#fff; border-top:2px solid #a0a0a0; }
.jsm-grandtot .jsm-sel-col { background:#d4d4d4 !important; }
.jsm-new-indicator td { background:#fff; height:18px; border-top:none; }
.jsm-new-indicator .jsm-sel-col { background:#d4d4d4 !important; font-size:13px; line-height:1; }
.jsm-empty { text-align:center; padding:16px; color:#64748b; }

.jsm-result-bar { display:flex; gap:6px; align-items:center; padding:4px 8px; background:#dcdcdc; border-top:1px solid #808080; position:relative; min-height:36px; box-shadow: inset 0 1px 0 #fff; }
.jsm-result-bar button {
  background:#e1e1e1;
  border:1px solid #707070;
  border-radius:2px;
  font-size:11px;
  font-weight:bold;
  padding:2px 10px;
  height:24px;
  cursor:pointer;
  box-shadow: 1px 1px 0 #fff inset, -1px -1px 0 #999 inset;
}
.jsm-result-bar button:active {
  box-shadow: -1px -1px 0 #fff inset, 1px 1px 0 #999 inset;
}

.jsm-progress-container { width:180px; height:20px; background:#22c55e; border:1px solid #16a34a; box-shadow:inset 0 1px 2px rgba(0,0,0,0.2); }
.jsm-progress-bar { width:100%; height:100%; background:#22c55e; }

.jsm-length { display:flex; align-items:center; gap:6px; font-size:11px; color:#004085; font-weight:bold; }
.jsm-length-slider { width:18px; height:22px; background:#e1e1e1; border:1px solid #707070; display:flex; align-items:center; justify-content:center; }
.jsm-handle { font-size:10px; color:#666; font-weight:bold; }

.jsm-amount-box { margin-left:auto; background:#fff; border:1px solid #707070; padding:2px 8px; font-size:12px; font-weight:bold; font-family:monospace; color:#000; min-width:80px; text-align:right; height:22px; line-height:18px; box-shadow:inset 1px 1px 2px #ccc; }

.jsm-colset-pop { position:absolute; bottom:36px; left:6px; background:#fff; border:2px solid #0055b3; padding:6px; display:flex; flex-direction:column; gap:3px; font-size:11px; z-index:100; box-shadow:2px 2px 6px rgba(0,0,0,0.3); }
`;
