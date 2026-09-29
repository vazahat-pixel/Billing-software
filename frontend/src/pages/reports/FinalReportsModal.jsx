import React, { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../../components/ui/Modal';
import { accountingApi } from '../../api/accounting.api';
import useConfigStore from '../../store/useConfigStore';
import { toast } from '../../store/useToastStore';
import { exportTableToExcel } from '../../utils/reportExport';

const todayISO = () => new Date().toISOString().split('T')[0];
const fyStartISO = () => {
  const now = new Date();
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-04-01`;
};
const fyEndISO = () => {
  const now = new Date();
  const endYear = now.getMonth() >= 3 ? now.getFullYear() + 1 : now.getFullYear();
  return `${endYear}-03-31`;
};
const dmy = (iso) => {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : String(iso);
};
const inr = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (amount, sales) => (sales > 0.001 ? ((Number(amount) || 0) / sales * 100).toFixed(2) : '');

function companyAddress(company) {
  const meta = company?.meta || {};
  const raw = meta.address;
  const parts = [];
  if (typeof raw === 'string' && raw.trim()) parts.push(raw.trim());
  else if (raw && typeof raw === 'object') parts.push([raw.line1, raw.line2, raw.street].filter(Boolean).join(', '));
  [meta.city, meta.state, meta.pincode].forEach((p) => { if (p) parts.push(p); });
  return parts.filter(Boolean).join(', ');
}

const TITLES = {
  groupList: 'Group List',
  trial: 'Trail Balance',
  pl: 'Trading & ProfitLoss Account',
  bs: 'Balance Sheet',
};

export default function FinalReportsModal({ isOpen, onClose, kind = 'groupList' }) {
  const company = useConfigStore((s) => s.company);
  const [phase, setPhase] = useState('filter');
  const [busy, setBusy] = useState(false);
  const [heads, setHeads] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [picked, setPicked] = useState(() => new Set());
  const [report, setReport] = useState(null);
  const printAfter = useRef(false);

  const [asOn, setAsOn] = useState(todayISO);
  const [from, setFrom] = useState(fyStartISO);
  const [to, setTo] = useState(todayISO);
  const [withAddress, setWithAddress] = useState(false);
  const [withPan, setWithPan] = useState(false);
  const [withBroker, setWithBroker] = useState(false);

  const [basis, setBasis] = useState('current');
  const [layout, setLayout] = useState('double');
  const [order, setOrder] = useState('group');

  const [openingStock, setOpeningStock] = useState('0');
  const [closingStock, setClosingStock] = useState('0');
  const [provisional, setProvisional] = useState(false);
  const [showPercent, setShowPercent] = useState(false);
  const [netSalesPct, setNetSalesPct] = useState(false);

  const [bsLayout, setBsLayout] = useState('double');
  const [bsOrder, setBsOrder] = useState('group');
  const [onlySummary, setOnlySummary] = useState(false);
  const [withNetProfit, setWithNetProfit] = useState(true);
  const [withStation, setWithStation] = useState(false);
  const [bsFrom, setBsFrom] = useState(fyStartISO);
  const [bsTo, setBsTo] = useState(fyEndISO);

  useEffect(() => {
    if (!isOpen) return;
    setPhase('filter');
    setReport(null);
    let cancelled = false;
    accountingApi.finalHeads().then((data) => {
      if (cancelled) return;
      const list = data?.heads || [];
      const acc = data?.accounts || [];
      setHeads(list);
      setAccounts(acc);
      if (kind === 'trial') setPicked(new Set(list.map((h) => h.name)));
      else setPicked(new Set());
    }).catch((err) => toast.error(err, { fallback: 'Could not load accounts' }));
    return () => { cancelled = true; };
  }, [isOpen, kind]);

  useEffect(() => {
    if (phase !== 'screen' || !printAfter.current) return undefined;
    printAfter.current = false;
    const t = setTimeout(() => window.print(), 280);
    return () => clearTimeout(t);
  }, [phase, report]);

  useEffect(() => {
    if (phase !== 'screen') return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setPhase('filter');
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [phase]);

  const selectedAccounts = useMemo(
    () => accounts.filter((a) => picked.has(a.id)),
    [accounts, picked]
  );
  const openAccounts = useMemo(
    () => accounts.filter((a) => !picked.has(a.id)),
    [accounts, picked]
  );

  const toggleId = (id) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleHead = (name) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const loadReport = async () => {
    if (kind === 'groupList') {
      if (!picked.size) {
        toast.warning('Select an account');
        return null;
      }
      return accountingApi.groupListReport({ asOn, ledgerIds: [...picked] });
    }
    if (kind === 'trial') {
      if (!picked.size) {
        toast.warning('Select an account head');
        return null;
      }
      return accountingApi.jsmTrialBalance({
        from, to, basis, layout, order, heads: [...picked],
      });
    }
    if (kind === 'pl') {
      return accountingApi.jsmProfitLoss({
        from, to, openingStock, closingStock,
      });
    }
    return accountingApi.jsmBalanceSheet({
      from: bsFrom,
      asOn: bsTo,
      layout: bsLayout,
      order: bsOrder,
      onlySummary,
      withNetProfit,
      withStation,
    });
  };

  const openScreen = async (alsoPrint = false) => {
    setBusy(true);
    try {
      const data = await loadReport();
      if (!data) return;
      printAfter.current = alsoPrint;
      setReport(data);
      setPhase('screen');
    } catch (err) {
      toast.error(err, { fallback: 'Could not build the report' });
    } finally {
      setBusy(false);
    }
  };

  const downloadExcel = async () => {
    setBusy(true);
    try {
      const data = report && phase === 'screen' ? report : await loadReport();
      if (!data) return;
      const rows = excelRows(kind, data);
      if (!rows.length) {
        toast.warning('Nothing to export');
        return;
      }
      exportTableToExcel(`${TITLES[kind] || 'Report'}.xlsx`, rows.columns, rows.rows);
    } catch (err) {
      toast.error(err, { fallback: 'Excel export failed' });
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {phase === 'filter' && (
        <Modal isOpen onClose={onClose} bare enableEscape style={{ width: 'min(820px, 96vw)', maxWidth: 820 }}>
          <div
            className="jsm-filter"
            data-enter-nav="off"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                openScreen(false);
              }
            }}
          >
            <div className="jsm-filter-title">{TITLES[kind]}</div>
            {kind === 'groupList' && (
              <GroupFilter
                asOn={asOn} setAsOn={setAsOn}
                withAddress={withAddress} setWithAddress={setWithAddress}
                withPan={withPan} setWithPan={setWithPan}
                withBroker={withBroker} setWithBroker={setWithBroker}
                openAccounts={openAccounts}
                selectedAccounts={selectedAccounts}
                toggleId={toggleId}
              />
            )}
            {kind === 'trial' && (
              <TrialFilter
                from={from} setFrom={setFrom} to={to} setTo={setTo}
                basis={basis} setBasis={setBasis}
                layout={layout} setLayout={setLayout}
                order={order} setOrder={setOrder}
                heads={heads} picked={picked} toggleHead={toggleHead}
              />
            )}
            {kind === 'pl' && (
              <PlFilter
                from={from} setFrom={setFrom} to={to} setTo={setTo}
                openingStock={openingStock} setOpeningStock={setOpeningStock}
                closingStock={closingStock} setClosingStock={setClosingStock}
                provisional={provisional} setProvisional={setProvisional}
                showPercent={showPercent} setShowPercent={setShowPercent}
                netSalesPct={netSalesPct} setNetSalesPct={setNetSalesPct}
              />
            )}
            {kind === 'bs' && (
              <BsFilter
                from={bsFrom} setFrom={setBsFrom} to={bsTo} setTo={setBsTo}
                layout={bsLayout} setLayout={setBsLayout}
                order={bsOrder} setOrder={setBsOrder}
                onlySummary={onlySummary} setOnlySummary={setOnlySummary}
                provisional={provisional} setProvisional={setProvisional}
                withNetProfit={withNetProfit} setWithNetProfit={setWithNetProfit}
                withStation={withStation} setWithStation={setWithStation}
                capital={accounts.filter((a) => a.head === 'CAPITAL ACCOUNT')}
              />
            )}
            <div className="jsm-filter-actions">
              {kind === 'pl' || kind === 'bs' ? (
                <button type="button" className="classic-erp-btn btn-blue" disabled={busy} onClick={() => openScreen(false)}>OK</button>
              ) : (
                <>
                  <button type="button" className="classic-erp-btn btn-blue" disabled={busy} onClick={() => openScreen(false)}>Screen</button>
                  <button type="button" className="classic-erp-btn" disabled={busy} onClick={() => openScreen(true)}>Print</button>
                  <button type="button" className="classic-erp-btn" disabled={busy} onClick={downloadExcel}>Excel</button>
                  {kind === 'trial' && (
                    <button type="button" className="classic-erp-btn" disabled={busy} onClick={downloadExcel}>File</button>
                  )}
                </>
              )}
              <button type="button" className="classic-erp-btn" onClick={onClose}>Exit</button>
            </div>
            {busy && <div className="jsm-busy">Building report…</div>}
          </div>
        </Modal>
      )}

      {phase === 'screen' && report && (
        <div className="jsm-screen-overlay" data-enter-nav="off">
          <div className="jsm-screen-bar print:hidden">
            <strong>{TITLES[kind]}</strong>
            <span />
            <button type="button" className="classic-erp-btn" onClick={() => window.print()}>Print</button>
            <button type="button" className="classic-erp-btn" onClick={downloadExcel}>Excel</button>
            <button type="button" className="classic-erp-btn" onClick={() => setPhase('filter')}>Exit</button>
          </div>
          <div className="jsm-sheet-scroll">
            <article className="jsm-sheet">
              <SheetHead
                company={company}
                provisional={provisional && (kind === 'pl' || kind === 'bs')}
                title={sheetTitle(kind, report)}
                period={sheetPeriod(kind, report, { from, to, asOn, bsFrom, bsTo })}
              />
              {kind === 'groupList' && (
                <GroupSheet data={report} withAddress={withAddress} withPan={withPan} withBroker={withBroker} />
              )}
              {kind === 'trial' && <TrialSheet data={report} />}
              {kind === 'pl' && <PlSheet data={report} showPercent={showPercent || netSalesPct} />}
              {kind === 'bs' && <BsSheet data={report} />}
            </article>
          </div>
        </div>
      )}
      <style>{finalCss}</style>
    </>
  );
}

function SheetHead({ company, title, period, provisional }) {
  const addr = companyAddress(company);
  return (
    <header className="jsm-sheet-head">
      <div className="jsm-co">{company?.name || 'Company'}</div>
      {addr ? <div className="jsm-addr">{addr}</div> : null}
      {provisional ? <div className="jsm-provisional">PROVISIONAL</div> : null}
      <div className="jsm-meta">
        <span>{title}</span>
        <span>{period}</span>
      </div>
    </header>
  );
}

function sheetTitle(kind, report) {
  if (kind === 'groupList') return `REPORT : Group List Balance    As On Date ${dmy(report.asOn)}`;
  if (kind === 'trial') return 'REPORT : Trail Balance Report';
  if (kind === 'pl') return 'REPORT : Trading & Profit & Loss Account';
  return 'REPORT : Balance Sheet';
}

function sheetPeriod(kind, report, dates) {
  if (kind === 'groupList') return '';
  if (kind === 'trial') return `PERIOD : ${dmy(report.from || dates.from)} To ${dmy(report.to || dates.to)}`;
  if (kind === 'pl') return `PERIOD : ${dmy(report.period?.from || dates.from)} To ${dmy(report.period?.to || dates.to)}`;
  return `As On ${dmy(report.asOn || dates.bsTo)}`;
}

function GroupFilter({ asOn, setAsOn, withAddress, setWithAddress, withPan, setWithPan, withBroker, setWithBroker, openAccounts, selectedAccounts, toggleId }) {
  return (
    <>
      <div className="jsm-row">
        <label>As On Date</label>
        <input type="date" className="classic-erp-input" value={asOn} onChange={(e) => setAsOn(e.target.value)} />
        <label className="jsm-check"><input type="checkbox" checked={withAddress} onChange={(e) => setWithAddress(e.target.checked)} /> With Address</label>
        <label className="jsm-check"><input type="checkbox" checked={withPan} onChange={(e) => setWithPan(e.target.checked)} /> With PanNo</label>
        <label className="jsm-check"><input type="checkbox" checked={withBroker} onChange={(e) => setWithBroker(e.target.checked)} /> With Broker</label>
      </div>
      <AccountTable rows={openAccounts} onToggle={toggleId} />
      <AccountTable rows={selectedAccounts} onToggle={toggleId} selected />
      <div className="jsm-row">
        <span className="jsm-pill">Company Wise</span>
        <select className="classic-erp-select" defaultValue="current"><option value="current">Current</option></select>
      </div>
    </>
  );
}

function AccountTable({ rows, onToggle, selected }) {
  return (
    <div className="jsm-acc-box">
      <div className="jsm-acc-head"><span>Account Name</span><span>Account code</span></div>
      <div className="jsm-acc-body">
        {rows.length === 0 && <div className="jsm-empty">{selected ? 'Tick accounts above' : 'No accounts'}</div>}
        {rows.map((a) => (
          <button type="button" key={a.id} className="jsm-acc-row" onClick={() => onToggle(a.id)}>
            <span><input type="checkbox" readOnly checked={!!selected} /> {a.name}</span>
            <span>{a.code}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TrialFilter({ from, setFrom, to, setTo, basis, setBasis, layout, setLayout, order, setOrder, heads, picked, toggleHead }) {
  return (
    <>
      <fieldset className="jsm-box">
        <legend>A</legend>
        <label className="jsm-check"><input type="radio" name="tb-basis" checked={basis === 'current'} onChange={() => setBasis('current')} /> X-Current</label>
        <label className="jsm-check"><input type="radio" name="tb-basis" checked={basis === 'opening'} onChange={() => setBasis('opening')} /> Y-Opening</label>
        <label>From</label>
        <input type="date" className="classic-erp-input" value={from} onChange={(e) => setFrom(e.target.value)} />
        <label>To</label>
        <input type="date" className="classic-erp-input" value={to} onChange={(e) => setTo(e.target.value)} />
      </fieldset>
      <fieldset className="jsm-box">
        <legend>B</legend>
        {[
          ['double', '1-Double'],
          ['single', '2-Single'],
          ['singleGroup', '3-Single Group Wise Total'],
          ['summary', '4-Summary'],
          ['doubleGroup', '5-Double Group'],
        ].map(([value, label]) => (
          <label key={value} className="jsm-check">
            <input type="radio" name="tb-layout" checked={layout === value} onChange={() => setLayout(value)} /> {label}
          </label>
        ))}
      </fieldset>
      <fieldset className="jsm-box">
        <legend>C — Order By</legend>
        {[
          ['group', 'A-Group Wise'],
          ['alpha', 'B-Alphabet'],
          ['schedule', 'C-Schedule Wise'],
        ].map(([value, label]) => (
          <label key={value} className="jsm-check">
            <input type="radio" name="tb-order" checked={order === value} onChange={() => setOrder(value)} /> {label}
          </label>
        ))}
      </fieldset>
      <div className="jsm-acc-box">
        <div className="jsm-acc-head"><span>Account Name</span><span>Account code</span></div>
        <div className="jsm-acc-body">
          {heads.map((h) => (
            <button type="button" key={h.name} className="jsm-acc-row" onClick={() => toggleHead(h.name)}>
              <span><input type="checkbox" readOnly checked={picked.has(h.name)} /> {h.name}</span>
              <span>{h.code}</span>
            </button>
          ))}
          {!heads.length && <div className="jsm-empty">No account heads</div>}
        </div>
      </div>
    </>
  );
}

function PlFilter({ from, setFrom, to, setTo, openingStock, setOpeningStock, closingStock, setClosingStock, provisional, setProvisional, showPercent, setShowPercent, netSalesPct, setNetSalesPct }) {
  return (
    <div className="jsm-pl-filter">
      <div className="jsm-row jsm-center">
        <label>From Date</label>
        <input type="date" className="classic-erp-input" value={from} onChange={(e) => setFrom(e.target.value)} />
        <label>As On Date</label>
        <input type="date" className="classic-erp-input" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <div className="jsm-pl-stock">
        <label>Opening Balance ( Rs. )</label>
        <input className="classic-erp-input" value={openingStock} onChange={(e) => setOpeningStock(e.target.value)} />
        <label>Closing Balance ( Rs. )</label>
        <input className="classic-erp-input" value={closingStock} onChange={(e) => setClosingStock(e.target.value)} />
        <div className="jsm-hint">lbl_closing<br />lbl_stockinhand</div>
      </div>
      <div className="jsm-voucher-line">Vou No. (0) / Closing Stock / C / Stock In Hand</div>
      <div className="jsm-row">
        <span className="jsm-pill">Company Wise</span>
        <select className="classic-erp-select" defaultValue="current"><option value="current">Current</option></select>
        <label className="jsm-check"><input type="checkbox" checked={provisional} onChange={(e) => setProvisional(e.target.checked)} /> Provisional</label>
        <label className="jsm-check"><input type="checkbox" checked={netSalesPct} onChange={(e) => setNetSalesPct(e.target.checked)} /> Net Sales %</label>
        <label className="jsm-check"><input type="checkbox" checked={showPercent} onChange={(e) => setShowPercent(e.target.checked)} /> Show %</label>
      </div>
    </div>
  );
}

function BsFilter({ from, setFrom, to, setTo, layout, setLayout, order, setOrder, onlySummary, setOnlySummary, provisional, setProvisional, withNetProfit, setWithNetProfit, withStation, setWithStation, capital }) {
  return (
    <div className="jsm-pl-filter">
      <div className="jsm-row">
        <div>
          <div className="jsm-row"><label>From Date</label><input type="date" className="classic-erp-input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="jsm-row"><label>As On Date</label><input type="date" className="classic-erp-input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        <label className="jsm-check"><input type="radio" name="bs-layout" checked={layout === 'double'} onChange={() => setLayout('double')} /> Double</label>
        <label className="jsm-check"><input type="radio" name="bs-layout" checked={layout === 'single'} onChange={() => setLayout('single')} /> Single</label>
      </div>
      <fieldset className="jsm-box">
        {[
          ['group', '1- Group Wise'],
          ['alpha', '2- Alphabet'],
          ['schedule', '3- Schedule Wise'],
        ].map(([value, label]) => (
          <label key={value} className="jsm-check">
            <input type="radio" name="bs-order" checked={order === value} onChange={() => setOrder(value)} /> {label}
          </label>
        ))}
      </fieldset>
      <div className="jsm-acc-box">
        <div className="jsm-acc-head"><span>Name</span><span>Percentage(%)</span></div>
        <div className="jsm-acc-body">
          {(capital.length ? capital : [{ id: 'cap', name: 'CAPITAL ACCOUNT', code: '' }]).map((a) => (
            <div key={a.id} className="jsm-acc-row" style={{ cursor: 'default' }}>
              <span>{a.name}</span>
              <span>0.00</span>
            </div>
          ))}
        </div>
      </div>
      <div className="jsm-row">
        <label className="jsm-check"><input type="checkbox" checked={onlySummary} onChange={(e) => setOnlySummary(e.target.checked)} /> Only Summary</label>
        <label className="jsm-check"><input type="checkbox" checked={provisional} onChange={(e) => setProvisional(e.target.checked)} /> Provisional</label>
        <label className="jsm-check"><input type="checkbox" checked={withNetProfit} onChange={(e) => setWithNetProfit(e.target.checked)} /> With Net Profit Show</label>
      </div>
      <div className="jsm-row">
        <span className="jsm-pill">Company Wise</span>
        <select className="classic-erp-select" defaultValue="current"><option value="current">Current</option></select>
        <label className="jsm-check"><input type="checkbox" checked={withStation} onChange={(e) => setWithStation(e.target.checked)} /> With Station</label>
      </div>
    </div>
  );
}

function GroupSheet({ data, withAddress, withPan, withBroker }) {
  const extra = [withAddress && 'Address', withPan && 'Pan No', withBroker && 'Broker'].filter(Boolean);
  return (
    <table className="jsm-table">
      <thead>
        <tr>
          <th>A/c Name</th>
          {extra.map((h) => <th key={h}>{h}</th>)}
          <th className="num">Debit</th>
          <th className="num">Credit</th>
        </tr>
      </thead>
      <tbody>
        {(data.groups || []).map((g) => (
          <React.Fragment key={g.name}>
            <tr className="jsm-gh"><td colSpan={3 + extra.length}>{g.name}</td></tr>
            {g.lines.map((l) => (
              <tr key={l.ledgerId}>
                <td className="pad">{l.name}</td>
                {withAddress && <td>{l.address}</td>}
                {withPan && <td>{l.pan}</td>}
                {withBroker && <td />}
                <td className="num">{l.debit ? inr(l.debit) : ''}</td>
                <td className="num">{l.credit ? inr(l.credit) : ''}</td>
              </tr>
            ))}
            <tr className="jsm-tot">
              <td colSpan={1 + extra.length}>Group Total :</td>
              <td className="num">{inr(g.totalDebit)}</td>
              <td className="num">{inr(g.totalCredit)}</td>
            </tr>
          </React.Fragment>
        ))}
        {!data.groups?.length && (
          <tr><td colSpan={3 + extra.length} className="jsm-empty">No balance for the selected accounts on this date.</td></tr>
        )}
        <tr className="jsm-grand">
          <td colSpan={1 + extra.length}>Grand Total :</td>
          <td className="num">{inr(data.grandDebit)}</td>
          <td className="num">{inr(data.grandCredit)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function TrialSheet({ data }) {
  if (data.mode === 'single') {
    return (
      <table className="jsm-table">
        <thead>
          <tr><th>A/c Name</th><th className="num">Debit</th><th className="num">Credit</th></tr>
        </thead>
        <tbody>
          {(data.groups || []).map((g) => (
            <React.Fragment key={g.name}>
              <tr className="jsm-gh"><td colSpan={3}>{g.name}</td></tr>
              {g.lines.map((l) => (
                <tr key={l.ledgerId || l.name}>
                  <td className="pad">{l.name}</td>
                  <td className="num">{l.debit ? inr(l.debit) : ''}</td>
                  <td className="num">{l.credit ? inr(l.credit) : ''}</td>
                </tr>
              ))}
              {data.showGroupTotal !== false && (
                <tr className="jsm-tot">
                  <td>Group Total :</td>
                  <td className="num">{inr(g.totalDebit)}</td>
                  <td className="num">{inr(g.totalCredit)}</td>
                </tr>
              )}
            </React.Fragment>
          ))}
          <tr className="jsm-grand">
            <td>Grand Total :</td>
            <td className="num">{inr(data.debitTotal)}</td>
            <td className="num">{inr(data.creditTotal)}</td>
          </tr>
          <tr>
            <td colSpan={3} className="num">Diff.Amt : {inr(data.difference)}</td>
          </tr>
        </tbody>
      </table>
    );
  }
  return (
    <>
      <div className="jsm-two">
        <SideBlock title="LIABILITIES" amountHead="CREDIT" groups={data.left || []} />
        <SideBlock title="ASSETS" amountHead="DEBIT" groups={data.right || []} />
      </div>
      <div className="jsm-foot-totals">
        <span>Credit Total : {inr(data.creditTotal)}</span>
        <span>Debit Total : {inr(data.debitTotal)}</span>
        <span>Diff.Amt : {inr(data.difference)}</span>
      </div>
    </>
  );
}

function SideBlock({ title, amountHead, groups }) {
  return (
    <div className="jsm-side">
      <div className="jsm-side-head"><span>{title}</span><span>{amountHead}</span></div>
      {(groups || []).map((g) => (
        <div key={g.name}>
          <div className="jsm-group">{g.name}</div>
          {(g.lines || []).map((l) => (
            <div className="jsm-line" key={`${g.name}-${l.name}`}>
              <span>{l.name}{l.station ? `   ${l.station}` : ''}</span>
              <span>{inr(l.amount)}</span>
            </div>
          ))}
          <div className="jsm-line jsm-line-total"><span /><span>{inr(g.total)}</span></div>
        </div>
      ))}
    </div>
  );
}

function PlSheet({ data, showPercent }) {
  const sales = data.netSales || 0;
  return (
    <div className="jsm-green">
      <PlBlock title="TRADING ACCOUNT" block={data.trading} sales={sales} showPercent={showPercent} gross />
      <PlBlock title="PROFIT & LOSS ACCOUNT" block={data.profitLoss} sales={sales} showPercent={showPercent} />
    </div>
  );
}

function PlBlock({ title, block, sales, showPercent, gross }) {
  const left = block?.left || [];
  const right = block?.right || [];
  const n = Math.max(left.length, right.length, 1);
  const rows = Array.from({ length: n }, (_, i) => ({ l: left[i], r: right[i] }));
  const marker = gross ? block.gross : block.net;
  return (
    <table className="jsm-table jsm-pl">
      <thead>
        <tr className="jsm-gh"><td colSpan={showPercent ? 5 : 4}>{title}</td></tr>
        <tr>
          <th>EXPENDITURE</th>
          <th className="num">RS</th>
          {showPercent && <th className="num">Per%</th>}
          <th>INCOME</th>
          <th className="num">RS</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            <td>{row.l?.name || ''}</td>
            <td className="num">{row.l ? inr(row.l.amount) : ''}</td>
            {showPercent && <td className="num">{row.l ? pct(row.l.amount, sales) : ''}</td>}
            <td>{row.r?.name || ''}</td>
            <td className="num">{row.r ? inr(row.r.amount) : ''}</td>
          </tr>
        ))}
        <tr className="jsm-tot">
          <td />
          <td className="num">{inr(block.leftSub)}</td>
          {showPercent && <td />}
          <td>TOTAL</td>
          <td className="num">{inr(block.rightSub)}</td>
        </tr>
        {marker?.amount > 0.001 && (
          <tr className="jsm-tot">
            {marker.side === 'left' ? (
              <>
                <td>{marker.label}</td>
                <td className="num">{inr(marker.amount)}</td>
                {showPercent && <td className="num">{pct(marker.amount, sales)}</td>}
                <td />
                <td />
              </>
            ) : (
              <>
                <td />
                <td />
                {showPercent && <td />}
                <td>{marker.label}</td>
                <td className="num">{inr(marker.amount)}</td>
              </>
            )}
          </tr>
        )}
        <tr className="jsm-grand">
          <td>TOTAL</td>
          <td className="num">{inr(block.leftTotal)}</td>
          {showPercent && <td />}
          <td>TOTAL</td>
          <td className="num">{inr(block.rightTotal)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function BsSheet({ data }) {
  if (data.layout === 'single') {
    return (
      <table className="jsm-table">
        <thead><tr><th>Name</th><th className="num">RS.</th></tr></thead>
        <tbody>
          <tr className="jsm-gh"><td colSpan={2}>LIABILITIES</td></tr>
          {(data.left || []).map((g) => (
            <React.Fragment key={g.name}>
              <tr className="jsm-gh"><td colSpan={2}>{g.name}</td></tr>
              {g.lines.map((l) => (
                <tr key={l.name}><td className="pad">{l.name}{l.station ? `  ${l.station}` : ''}</td><td className="num">{inr(l.amount)}</td></tr>
              ))}
              <tr className="jsm-tot"><td>{g.name}</td><td className="num">{inr(g.total)}</td></tr>
            </React.Fragment>
          ))}
          <tr className="jsm-gh"><td colSpan={2}>ASSETS</td></tr>
          {(data.right || []).map((g) => (
            <React.Fragment key={g.name}>
              <tr className="jsm-gh"><td colSpan={2}>{g.name}</td></tr>
              {g.lines.map((l) => (
                <tr key={l.name}><td className="pad">{l.name}{l.station ? `  ${l.station}` : ''}</td><td className="num">{inr(l.amount)}</td></tr>
              ))}
              <tr className="jsm-tot"><td>{g.name}</td><td className="num">{inr(g.total)}</td></tr>
            </React.Fragment>
          ))}
          {data.withNetProfit && data.netProfit !== 0 && (
            <tr className="jsm-net"><td>{data.netLabel}</td><td className="num">{inr(Math.abs(data.netProfit))}</td></tr>
          )}
          <tr className="jsm-grand"><td>TOTAL</td><td className="num">{inr(data.grandLeft)} / {inr(data.grandRight)}</td></tr>
        </tbody>
      </table>
    );
  }
  return (
    <div className="jsm-green">
      <div className="jsm-two">
        <SideBlock title="LIABILITIES" amountHead="RS." groups={data.left || []} />
        <SideBlock title="ASSETS" amountHead="RS." groups={data.right || []} />
      </div>
      <div className="jsm-bs-mid">
        <span>{inr(data.leftSub)}</span>
        <span>{inr(data.rightSub)}</span>
      </div>
      {data.withNetProfit && data.netProfit !== 0 && (
        <div className="jsm-net-row">
          <span>{data.netProfit > 0 ? data.netLabel : ''}</span>
          <span>{data.netProfit > 0 ? inr(data.netProfit) : ''}</span>
          <span>{data.netProfit < 0 ? data.netLabel : ''}</span>
          <span>{data.netProfit < 0 ? inr(Math.abs(data.netProfit)) : ''}</span>
        </div>
      )}
      <div className="jsm-bs-total">
        <span>TOTAL</span>
        <span>{inr(data.grandLeft)}</span>
        <span>TOTAL</span>
        <span>{inr(data.grandRight)}</span>
      </div>
      {Math.abs(data.difference) >= 0.05 && (
        <div className="jsm-diff">Difference {inr(data.difference)} — books are not equal. No figure was adjusted.</div>
      )}
    </div>
  );
}

function excelRows(kind, data) {
  if (kind === 'groupList' || (kind === 'trial' && data.mode === 'single')) {
    const rows = [];
    const groups = data.groups || [];
    groups.forEach((g) => {
      (g.lines || []).forEach((l) => rows.push({ head: g.name, name: l.name, debit: l.debit || 0, credit: l.credit || 0 }));
      rows.push({ head: g.name, name: 'Group Total', debit: g.totalDebit, credit: g.totalCredit });
    });
    if (kind === 'groupList') rows.push({ head: '', name: 'Grand Total', debit: data.grandDebit, credit: data.grandCredit });
    else rows.push({ head: '', name: 'Grand Total', debit: data.debitTotal, credit: data.creditTotal });
    return {
      columns: [
        { key: 'head', label: 'Group' },
        { key: 'name', label: 'Account' },
        { key: 'debit', label: 'Debit' },
        { key: 'credit', label: 'Credit' },
      ],
      rows,
    };
  }
  if (kind === 'trial' || kind === 'bs') {
    const rows = [];
    (data.left || []).forEach((g) => {
      (g.lines || []).forEach((l) => rows.push({ side: 'Liabilities', head: g.name, name: l.name, amount: l.amount }));
      rows.push({ side: 'Liabilities', head: g.name, name: 'Total', amount: g.total });
    });
    (data.right || []).forEach((g) => {
      (g.lines || []).forEach((l) => rows.push({ side: 'Assets', head: g.name, name: l.name, amount: l.amount }));
      rows.push({ side: 'Assets', head: g.name, name: 'Total', amount: g.total });
    });
    return {
      columns: [
        { key: 'side', label: 'Side' },
        { key: 'head', label: 'Group' },
        { key: 'name', label: 'Account' },
        { key: 'amount', label: 'Amount' },
      ],
      rows,
    };
  }
  const rows = [];
  const push = (section, block) => {
    const n = Math.max(block.left.length, block.right.length);
    for (let i = 0; i < n; i += 1) {
      rows.push({
        section,
        expenditure: block.left[i]?.name || '',
        expAmt: block.left[i]?.amount || '',
        income: block.right[i]?.name || '',
        incAmt: block.right[i]?.amount || '',
      });
    }
  };
  if (data.trading) push('Trading', data.trading);
  if (data.profitLoss) push('Profit & Loss', data.profitLoss);
  return {
    columns: [
      { key: 'section', label: 'Section' },
      { key: 'expenditure', label: 'Expenditure' },
      { key: 'expAmt', label: 'Rs' },
      { key: 'income', label: 'Income' },
      { key: 'incAmt', label: 'Rs' },
    ],
    rows,
  };
}

const finalCss = `
.jsm-filter { background: #e8eef5; color: #111; font-size: 12px; padding: 8px 10px 10px; }
.jsm-filter-title { font-weight: 700; font-size: 13px; margin-bottom: 6px; }
.jsm-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 6px 0; }
.jsm-center { justify-content: center; }
.jsm-check { display: inline-flex; align-items: center; gap: 4px; background: #4b5563; color: #fff; padding: 2px 8px; border-radius: 2px; font-size: 11px; }
.jsm-pill { background: #1d4ed8; color: #fff; padding: 2px 8px; font-size: 11px; }
.jsm-box { border: 1px solid #94a3b8; margin: 6px 0; padding: 6px 8px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.jsm-box legend { padding: 0 4px; font-weight: 700; }
.jsm-acc-box { border: 1px solid #94a3b8; background: #fff; margin: 6px 0; max-height: 180px; overflow: auto; }
.jsm-acc-head, .jsm-acc-row { display: grid; grid-template-columns: 1fr 90px; gap: 8px; padding: 2px 6px; width: 100%; text-align: left; background: #fff; border: 0; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
.jsm-acc-head { position: sticky; top: 0; background: #f8fafc; font-weight: 700; }
.jsm-acc-row:hover { background: #dbeafe; }
.jsm-empty { padding: 8px; color: #64748b; text-align: center; }
.jsm-filter-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
.jsm-busy { margin-top: 6px; font-weight: 700; }
.jsm-pl-filter { background: #d7f4fb; margin: -8px -10px; padding: 10px; }
.jsm-pl-stock { display: grid; grid-template-columns: 180px 120px 1fr; gap: 6px 8px; align-items: center; margin: 10px 0; }
.jsm-hint { font-size: 11px; color: #334155; }
.jsm-voucher-line { border: 1px solid #64748b; background: #fff; padding: 4px 8px; margin: 8px 0; font-weight: 600; }
.jsm-screen-overlay { position: fixed; inset: 0; z-index: 12050; background: #1f2937; display: flex; flex-direction: column; }
.jsm-screen-bar { display: flex; gap: 8px; align-items: center; padding: 8px 12px; background: #bbf7d0; color: #111; }
.jsm-screen-bar span { flex: 1; }
.jsm-sheet-scroll { flex: 1; overflow: auto; padding: 16px; }
.jsm-sheet { background: #fff; color: #111; max-width: 980px; margin: 0 auto; padding: 18px 22px 28px; min-height: 70vh; }
.jsm-sheet-head { text-align: center; margin-bottom: 10px; }
.jsm-co { font-weight: 800; font-size: 16px; letter-spacing: 0.04em; }
.jsm-addr, .jsm-provisional { font-size: 11px; }
.jsm-meta { display: flex; justify-content: space-between; gap: 12px; font-size: 11px; margin-top: 8px; text-align: left; }
.jsm-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.jsm-table th, .jsm-table td { border-bottom: 1px solid #111; padding: 2px 4px; }
.jsm-table .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.jsm-table .pad { padding-left: 16px; }
.jsm-gh td, .jsm-group { font-weight: 800; text-decoration: underline; }
.jsm-tot td { font-weight: 700; }
.jsm-grand td { font-weight: 800; border-top: 2px solid #111; }
.jsm-two { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.jsm-side-head, .jsm-line, .jsm-foot-totals, .jsm-bs-mid, .jsm-net-row, .jsm-bs-total { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; }
.jsm-side-head { font-weight: 800; border-bottom: 1px solid #111; }
.jsm-line span:first-child { padding-left: 14px; }
.jsm-line-total { font-weight: 800; border-top: 1px solid #111; }
.jsm-foot-totals { margin-top: 12px; font-weight: 800; border-top: 2px solid #111; padding-top: 4px; }
.jsm-green .jsm-side, .jsm-pl { background: #e7f6e7; }
.jsm-bs-mid { background: #86efac; font-weight: 800; padding: 4px 8px; margin-top: 8px; }
.jsm-net-row { background: #86efac; font-weight: 800; padding: 4px 8px; }
.jsm-bs-total { background: #fde047; font-weight: 800; padding: 4px 8px; }
.jsm-diff { margin-top: 8px; color: #b91c1c; font-size: 11px; font-weight: 700; }
.jsm-net td { background: #86efac; font-weight: 800; }
@media print {
  body * { visibility: hidden !important; }
  .jsm-sheet, .jsm-sheet * { visibility: visible !important; }
  .jsm-sheet { position: absolute; left: 0; top: 0; width: 100%; max-width: none; box-shadow: none; }
  .jsm-screen-bar { display: none !important; }
}
`;
