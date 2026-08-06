import React, { useEffect, useMemo, useRef, useState } from 'react';
import useStore from '../store/useStore';
import useConfigStore from '../store/useConfigStore';
import { toast } from '../store/useToastStore';
import Modal from '../components/ui/Modal';
import ErpWindowedModal from '../components/erp/ErpWindowedModal';
import { fmtDate, fmtMoney } from '../utils/invoiceHelpers';
import { SkeletonTable, InlineLoader, ButtonLoader, ErpBusyOverlay } from '../components/ui/loaders';

const todayISO = () => new Date().toISOString().slice(0, 10);
const fyStartISO = () => {
  const y = new Date().getFullYear();
  const m = new Date().getMonth();
  const startYear = m >= 3 ? y : y - 1;
  return `${startYear}-04-01`;
};

/** FY start year that `fromDate` falls in (Apr–Mar cycle), regardless of what's currently picked. */
const fyStartYearOf = (isoDate) => {
  const d = new Date(isoDate);
  const y = d.getFullYear();
  const m = d.getMonth();
  return m >= 3 ? y : y - 1;
};
const fyRange = (startYear) => ({
  from: `${startYear}-04-01`,
  to: `${startYear + 1}-03-31`,
});

const money = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const voucherLabel = (type = '') =>
  String(type)
    .replace(/Auto$/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toUpperCase();

const acName = (o) => o.ledger?.name || o.party?.name || o.label || '';
const acGroup = (o) => o.ledger?.group || o.ledger?.accountType || 'Party';

/** Inline account list — opens on focus/type */
function AccountListPanel({ rows, highlightIdx, onSelect, emptyText = 'No accounts' }) {
  return (
    <div className="ledger-ac-list">
      <table className="ledger-ac-list-table">
        <thead>
          <tr>
            <th>AC_NAME</th>
            <th>ST_NAME</th>
            <th>AC_ID</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={3} className="ledger-ac-empty">{emptyText}</td></tr>
          ) : rows.map((o, idx) => (
            <tr
              key={o.value}
              className={idx === highlightIdx ? 'is-active' : ''}
              onMouseDown={(e) => { e.preventDefault(); onSelect(o); }}
            >
              <td>{acName(o)}</td>
              <td>{acGroup(o)}</td>
              <td>{String(o.ledger?._id || o.ledger?.id || o.value).slice(-6)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const LedgerModal = ({ isOpen, onClose, onOpenJournal, onOpenPayment, onOpenReceipt }) => {
  const {
    ledgers,
    parties,
    fetchLedgers,
    fetchParties,
    fetchLedgerStatement,
    currentLedgerStatement,
    loading,
  } = useStore();

  const companyName = useConfigStore(
    (s) => s.companySettings?.legalName || s.companySettings?.shortName || s.company?.name || 'Company'
  );
  const companyAddress = useConfigStore((s) => {
    const st = s.companySettings || {};
    return [st.address, st.city, st.state, st.pincode].filter(Boolean).join(', ');
  });
  const financialYear = useConfigStore((s) => s.financialYear || s.companySettings?.financialYear);

  const [view, setView] = useState('entry');
  const [ledgerId, setLedgerId] = useState('');
  const [accHead, setAccHead] = useState('');
  const [accountText, setAccountText] = useState('');
  const [from, setFrom] = useState(fyStartISO());
  const [to, setTo] = useState(todayISO());
  const [showRemark, setShowRemark] = useState(true);
  const [showAddress, setShowAddress] = useState(true);
  const [onlyDr, setOnlyDr] = useState(false);
  const [onlyCr, setOnlyCr] = useState(false);
  const [compShortName, setCompShortName] = useState(false);
  const [newProcess, setNewProcess] = useState(false);
  const [withPuVoNo, setWithPuVoNo] = useState(false);
  const [listOpen, setListOpen] = useState(null);
  const [listIdx, setListIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const printRef = useRef(null);
  const accHeadRef = useRef(null);
  const accountRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    fetchLedgers().catch(() => {});
    fetchParties().catch(() => {});
    setView('entry');
    setLedgerId('');
    setAccHead('');
    setAccountText('');
    setListOpen(null);
    setFrom(fyStartISO());
    setTo(todayISO());
  }, [isOpen, fetchLedgers, fetchParties]);

  const ledgerOptions = useMemo(() => {
    const map = new Map();
    (ledgers || []).forEach((l) => {
      const id = String(l._id || l.id);
      if (!id) return;
      map.set(id, { value: id, label: `${l.name} (${l.accountType || l.group || 'Ledger'})`, ledger: l });
    });
    (parties || []).forEach((p) => {
      const pid = String(p._id || p.id);
      const linked = (ledgers || []).find((l) => String(l.linkedPartyId) === pid);
      if (linked) return;
      map.set(`party:${pid}`, {
        value: `party:${pid}`,
        label: `${p.name} (Party)`,
        partyOnly: true,
        party: p,
      });
    });
    return Array.from(map.values()).sort((a, b) => acName(a).localeCompare(acName(b)));
  }, [ledgers, parties]);

  const accountHeads = useMemo(() => {
    const set = new Set();
    ledgerOptions.forEach((o) => set.add(acGroup(o)));
    return Array.from(set).sort();
  }, [ledgerOptions]);

  const filteredHeads = useMemo(() => {
    const q = accHead.trim().toLowerCase();
    if (!q) return accountHeads;
    return accountHeads.filter((h) => h.toLowerCase().includes(q));
  }, [accountHeads, accHead]);

  const filteredAccounts = useMemo(() => {
    let list = ledgerOptions;
    if (accHead.trim()) {
      const q = accHead.trim().toLowerCase();
      list = list.filter((o) => acGroup(o).toLowerCase().includes(q));
    }
    if (accountText.trim()) {
      const q = accountText.trim().toLowerCase();
      list = list.filter((o) => acName(o).toLowerCase().includes(q));
    }
    return list;
  }, [ledgerOptions, accHead, accountText]);

  const resolveLedgerId = (id = ledgerId) => {
    if (!id) return null;
    if (id.startsWith('party:')) {
      const partyId = id.slice(6);
      const linked = (ledgers || []).find((l) => String(l.linkedPartyId) === partyId);
      return linked ? String(linked._id || linked.id) : null;
    }
    return id;
  };

  const pickAccount = (o) => {
    setLedgerId(o.value);
    setAccountText(acName(o));
    setAccHead(acGroup(o));
    setListOpen(null);
    accountRef.current?.focus();
  };

  const pickHead = (head) => {
    setAccHead(head);
    setListOpen(null);
    accountRef.current?.focus();
    setListOpen('account');
    setListIdx(0);
  };

  const resolveAccountFromText = () => {
    if (ledgerId) return ledgerId;
    const q = accountText.trim().toLowerCase();
    if (!q) return '';
    const exact = ledgerOptions.find((o) => acName(o).toLowerCase() === q);
    if (exact) {
      setLedgerId(exact.value);
      return exact.value;
    }
    const partial = ledgerOptions.find((o) => acName(o).toLowerCase().includes(q));
    if (partial) {
      setLedgerId(partial.value);
      setAccountText(acName(partial));
      return partial.value;
    }
    return '';
  };

  const runLedger = async (overrideRange) => {
    const picked = resolveAccountFromText() || ledgerId;
    const id = resolveLedgerId(picked);
    if (!picked) {
      toast.warning('Select an account');
      setListOpen('account');
      accountRef.current?.focus();
      return false;
    }
    if (!id) {
      toast.warning('No ledger linked for this party yet. Create a bill/payment first.');
      return false;
    }
    const effFrom = overrideRange?.from ?? from;
    const effTo = overrideRange?.to ?? to;
    setBusy(true);
    try {
      await fetchLedgerStatement({ ledgerId: id, from: effFrom, to: effTo });
      setView('statement');
      return true;
    } catch (err) {
      toast.error(err, { fallback: 'Failed to load ledger' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  /** Next Year / Back Year — shifts the whole Apr–Mar window relative to whatever's currently shown. */
  const shiftYear = (direction) => {
    const startYear = fyStartYearOf(from) + direction;
    const range = fyRange(startYear);
    setFrom(range.from);
    setTo(range.to);
    runLedger(range);
  };

  const handleListKey = (e, list, onPick) => {
    if (!listOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setListIdx((i) => Math.min(i + 1, Math.max(0, list.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setListIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && list[listIdx]) {
      e.preventDefault();
      onPick(list[listIdx]);
    } else if (e.key === 'Escape') {
      setListOpen(null);
    }
  };

  const statement = currentLedgerStatement;
  const rows = useMemo(() => {
    if (!statement) return [];
    if (Array.isArray(statement.statement)) return statement.statement;
    if (Array.isArray(statement.entries)) return statement.entries;
    if (Array.isArray(statement.lines)) return statement.lines;
    return [];
  }, [statement]);

  const filteredRows = useMemo(() => {
    let data = [...rows];
    if (onlyDr && !onlyCr) data = data.filter((r) => Number(r.debit || 0) > 0);
    if (onlyCr && !onlyDr) data = data.filter((r) => Number(r.credit || 0) > 0);
    return data;
  }, [rows, onlyDr, onlyCr]);

  const selectedMeta = ledgerOptions.find((o) => o.value === ledgerId) || null;
  const partyInfo = useMemo(() => {
    const stmtLedger = currentLedgerStatement?.ledger;
    const linkedId = stmtLedger?.linkedPartyId
      ? String(stmtLedger.linkedPartyId)
      : selectedMeta?.ledger?.linkedPartyId
        ? String(selectedMeta.ledger.linkedPartyId)
        : ledgerId.startsWith('party:')
          ? ledgerId.slice(6)
          : '';
    if (!linkedId) return null;
    return (parties || []).find((p) => String(p._id || p.id) === linkedId) || null;
  }, [currentLedgerStatement, selectedMeta, ledgerId, parties]);

  const partyId = partyInfo ? String(partyInfo._id || partyInfo.id) : '';

  // Classic ERP power-user shortcuts, active only while viewing a statement:
  // L = change account, * = Journal Voucher, - = Cash Payment, + = Cash Receipt.
  useEffect(() => {
    if (!isOpen || view !== 'statement') return undefined;
    const onKeyDown = (e) => {
      const tag = (e.target?.tagName || '').toUpperCase();
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if (e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setView('entry');
      } else if (e.key === '*') {
        e.preventDefault();
        if (onOpenJournal) onOpenJournal({ partyId, ledgerId: resolveLedgerId() });
        else toast.info('Journal Voucher — open from Transaction > Journal (GST)');
      } else if (e.key === '-') {
        e.preventDefault();
        if (onOpenPayment) onOpenPayment({ partyId, ledgerId: resolveLedgerId() });
        else toast.info('Cash Payment — open from Transaction > Cash Book');
      } else if (e.key === '+') {
        e.preventDefault();
        if (onOpenReceipt) onOpenReceipt({ partyId, ledgerId: resolveLedgerId() });
        else toast.info('Cash Receipt — open from Transaction > Cash Book');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, view, partyId, onOpenJournal, onOpenPayment, onOpenReceipt]);

  const ledgerName =
    statement?.ledgerName || statement?.ledger?.name || selectedMeta?.ledger?.name || accountText || '—';
  const openingBal = Number(statement?.openingBalance ?? statement?.opening ?? 0);
  const openingType = statement?.openingBalanceType || (openingBal >= 0 ? 'Dr' : 'Cr');
  const closingBal = Number(statement?.closingBalance ?? statement?.closing ?? 0);
  const closingType = statement?.closingBalanceType || '';
  const periodDebit = filteredRows.reduce((s, r) => s + Number(r.debit || 0), 0);
  const periodCredit = filteredRows.reduce((s, r) => s + Number(r.credit || 0), 0);
  const partyAddress = partyInfo
    ? [partyInfo.address, partyInfo.city, partyInfo.state, partyInfo.pincode].filter(Boolean).join(', ')
    : '';

  const handlePrint = () => {
    if (!statement) return toast.warning('Load ledger first');
    document.body.classList.add('ledger-printing');
    setTimeout(() => {
      window.print();
      setTimeout(() => document.body.classList.remove('ledger-printing'), 400);
    }, 50);
  };

  const isLoading = busy || loading;

  const entryForm = (
    <div className="ledger-entry-compact">
      <div className="ledger-entry-titlebar">
        <span>Account Ledger</span>
        <button type="button" className="ledger-entry-close" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="ledger-entry-body">
        <div className="ledger-entry-main">
          <label className="ledger-form-label">Acc.Head</label>
          <div className="ledger-field-wrap">
            <input
              ref={accHeadRef}
              className="classic-erp-input"
              value={accHead}
              onChange={(e) => { setAccHead(e.target.value); setListOpen('head'); setListIdx(0); }}
              onFocus={() => { setListOpen('head'); setListIdx(0); }}
              onKeyDown={(e) => handleListKey(e, filteredHeads.map((h) => ({ value: h, label: h })), (item) => pickHead(item.value))}
              placeholder="Type to filter head…"
            />
            {listOpen === 'head' && (
              <AccountListPanel
                rows={filteredHeads.map((h) => ({ value: h, label: h, ledger: { name: h, group: h } }))}
                highlightIdx={listIdx}
                onSelect={(item) => pickHead(item.value)}
                emptyText="No account heads"
              />
            )}
          </div>

          <label className="ledger-form-label">Company</label>
          <select className="classic-erp-select ledger-company-select" value="current" disabled>
            <option value="current">{companyName}</option>
          </select>

          <label className="ledger-form-label">Account</label>
          <div className="ledger-field-wrap">
            <input
              ref={accountRef}
              className="classic-erp-input"
              value={accountText}
              onChange={(e) => {
                setAccountText(e.target.value);
                setLedgerId('');
                setListOpen('account');
                setListIdx(0);
              }}
              onFocus={() => { setListOpen('account'); setListIdx(0); }}
              onKeyDown={(e) => handleListKey(e, filteredAccounts, pickAccount)}
              placeholder="Type account name…"
            />
            {listOpen === 'account' && (
              <AccountListPanel
                rows={filteredAccounts}
                highlightIdx={listIdx}
                onSelect={pickAccount}
              />
            )}
          </div>

          <label className="ledger-form-label">From Date</label>
          <input type="date" className="classic-erp-input" value={from} onChange={(e) => setFrom(e.target.value)} />

          <label className="ledger-form-label">To</label>
          <input type="date" className="classic-erp-input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>

        <div className="ledger-side-checks">
          <label className={`ledger-toggle-check ${showRemark ? 'is-on' : ''}`}>
            <input type="checkbox" checked={showRemark} onChange={(e) => setShowRemark(e.target.checked)} />With Remark (Detail)
          </label>
          <label className={`ledger-toggle-check ${showAddress ? 'is-on' : ''}`}>
            <input type="checkbox" checked={showAddress} onChange={(e) => setShowAddress(e.target.checked)} />With Address
          </label>
          <label className={`ledger-toggle-check ${compShortName ? 'is-on' : ''}`}>
            <input type="checkbox" checked={compShortName} onChange={(e) => setCompShortName(e.target.checked)} />Comp ShortName
          </label>
          <div className="ledger-toggle-row">
            <label className={`ledger-toggle-check ${newProcess ? 'is-on' : ''}`} style={{ flex: 1 }}>
              <input type="checkbox" checked={newProcess} onChange={(e) => setNewProcess(e.target.checked)} />New Process
            </label>
            <button type="button" className="classic-erp-btn ledger-tes-btn" onClick={() => toast.unavailable('Tes')}>Tes</button>
          </div>
          <label className={`ledger-toggle-check ${withPuVoNo ? 'is-on' : ''}`}>
            <input type="checkbox" checked={withPuVoNo} onChange={(e) => setWithPuVoNo(e.target.checked)} />With PuVouNo
          </label>
        </div>
      </div>
      {financialYear ? <div className="ledger-entry-fy">FY {financialYear}</div> : null}
      <div className="ledger-entry-footer">
        <button type="button" className="classic-erp-btn btn-blue" onClick={runLedger} disabled={isLoading}>
          {isLoading ? <ButtonLoader label="Loading…" /> : 'Ledger'}
        </button>
        <button type="button" className="classic-erp-btn" onClick={() => toast.unavailable('Confirmation')}>Confirmation</button>
        <button type="button" className="classic-erp-btn" onClick={() => toast.unavailable('Interest')}>Interest</button>
        <button type="button" className="classic-erp-btn" onClick={() => toast.unavailable('Reconciliation')}>Reconciliation</button>
        <button type="button" className="classic-erp-btn" onClick={onClose}>Exit</button>
      </div>
    </div>
  );

  if (!isOpen) return null;

  if (view === 'entry') {
    return (
      <>
        <Modal isOpen={isOpen} onClose={onClose} bare className="ledger-entry-modal-wrap">
          {entryForm}
        </Modal>
        <style>{ledgerStyles}</style>
      </>
    );
  }

  return (
    <ErpWindowedModal isOpen={isOpen} onClose={onClose} title="Zoom Ledger" windowId="ledger" bare>
      {({ WindowControls }) => (
        <>
          <div className="classic-erp-window ledger-stmt-window h-full min-h-0 !max-h-none flex flex-col">
            <ErpBusyOverlay show={isLoading && !!statement} message="Refreshing ledger…" />
            <div className="classic-erp-header shrink-0">
              <span className="erp-window-title truncate">Zoom Ledger</span>
              <WindowControls />
            </div>

            <div className="ledger-toolbar print:hidden">
              <button type="button" className="classic-erp-btn" onClick={handlePrint} disabled={!statement}>Print</button>
              <button type="button" className="classic-erp-btn" onClick={runLedger} disabled={isLoading}>
                {isLoading ? <ButtonLoader label="Refreshing…" /> : 'Screen'}
              </button>
              <button type="button" className="classic-erp-btn" onClick={() => toast.unavailable('Excel')}>Excel</button>
              <button type="button" className="classic-erp-btn" onClick={() => toast.unavailable('Mail')}>Mail</button>
              <button type="button" className="classic-erp-btn" onClick={() => toast.unavailable('WhatsApp')}>Whatsapp</button>
              <button type="button" className="classic-erp-btn" onClick={() => toast.unavailable('ALL Reports')}>ALL Reports</button>
              <button type="button" className="classic-erp-btn" onClick={() => toast.unavailable('O/S Reports')}>O/S Reports</button>
              <button type="button" className="classic-erp-btn" onClick={() => shiftYear(1)} disabled={isLoading}>Next Year</button>
              <button type="button" className="classic-erp-btn" onClick={() => shiftYear(-1)} disabled={isLoading}>Back Year</button>
              <button type="button" className="classic-erp-btn" onClick={() => {
                const range = { from: fyStartISO(), to: todayISO() };
                setFrom(range.from);
                setTo(range.to);
                runLedger(range);
              }}>Current Year</button>
              <input type="text" className="classic-erp-input ledger-toolbar-search" placeholder="" />
              <div className="ledger-toolbar-hints">
                <span>F3 &gt; Description Filter</span>
                <span>F5 &gt; Remark_1 Filter</span>
              </div>
            </div>

            <div className="ledger-toolbar2 print:hidden">
              <div className="ledger-toolbar2-left">
                <div className="ledger-toolbar2-row">
                  <input type="text" className="classic-erp-input ledger-party-box" value={ledgerName} readOnly />
                  <span className="classic-erp-label">Date</span>
                  <input type="date" className="classic-erp-input ledger-date-red" value={from} onChange={(e) => setFrom(e.target.value)} />
                  <span className="classic-erp-label">To</span>
                  <input type="date" className="classic-erp-input ledger-date-red" value={to} onChange={(e) => setTo(e.target.value)} />
                  <button type="button" className="classic-erp-btn ledger-green-btn" onClick={() => runLedger()} disabled={isLoading}>OK</button>
                  <button type="button" className="classic-erp-btn ledger-green-btn" onClick={() => toast.unavailable('Month')}>Month</button>
                  <label className="ledger-stmt-check"><input type="checkbox" checked={onlyDr} onChange={(e) => setOnlyDr(e.target.checked)} />Only Dr</label>
                  <label className="ledger-stmt-check"><input type="checkbox" checked={onlyCr} onChange={(e) => setOnlyCr(e.target.checked)} />Only Cr</label>
                </div>
                <div className="ledger-toolbar2-row">
                  <button type="button" className="classic-erp-btn ledger-green-btn" onClick={() => setView('entry')}>Filter</button>
                  <span className="ledger-l-hint">To Change Account = Press L</span>
                  {financialYear ? <span>{financialYear}</span> : null}
                  <span>{companyName}</span>
                  <span className="ml-auto classic-erp-label">Opening Bal</span>
                  <input type="text" className="classic-erp-input ledger-openingbal-box" value={fmtMoney(openingBal)} readOnly />
                </div>
              </div>
              <div className="ledger-toolbar2-hints">
                <span>Press <b>(*)</b> To OpenJv</span>
                <span>Press <b>(-)</b> CashPayment</span>
                <span>Press <b>(+)</b> CashReceipt</span>
              </div>
            </div>

            <div className="ledger-stmt-body" ref={printRef}>

              <div className="ledger-stmt-table-wrap relative">
                {(isLoading && !statement) ? (
                  <div className="p-4">
                    <InlineLoader message="Loading ledger…" className="mb-3" />
                    <SkeletonTable rows={10} cols={10} />
                  </div>
                ) : (
                  <table className="ledger-stmt-table">
                    <thead>
                      <tr>
                        <th>Date</th><th>Bill/Vno</th><th>CP</th><th>ChqNo</th><th>Description</th>
                        <th className="num">Debit</th><th className="num">Credit</th><th className="num">Balance</th><th>A.</th><th>Remark 1</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="ledger-ob-row">
                        <td>{fmtDate(from)}</td><td>OB</td><td>—</td><td>—</td><td><b>Opening Balance</b></td>
                        <td className="num">{openingType === 'Dr' ? money(openingBal) : '—'}</td>
                        <td className="num">{openingType === 'Cr' ? money(openingBal) : '—'}</td>
                        <td className="num"><b>{money(openingBal)}</b></td><td><b>{openingType}</b></td><td>—</td>
                      </tr>
                      {filteredRows.map((row, i) => {
                        const debit = Number(row.debit || 0);
                        const credit = Number(row.credit || 0);
                        const bal = Number(row.runningBalance ?? row.balance ?? 0);
                        const balType = row.balanceType || '';
                        const particular = row.particulars || row.narration || row.contraAccount || row.refType || '—';
                        const cp = String((row.contraAccount || '').split(',')[0] || '').trim();
                        return (
                          <tr key={`${row._id || row.voucherNo || i}-${i}`}>
                            <td className="nowrap">{fmtDate(row.date || row.entryDate)}</td>
                            <td>{row.voucherNo || row.entryNo || '—'}</td>
                            <td>{cp || '—'}</td>
                            <td>{row.chequeNo || row.chqNo || '—'}</td>
                            <td>{particular}</td>
                            <td className="num">{debit > 0 ? money(debit) : '—'}</td>
                            <td className="num">{credit > 0 ? money(credit) : '—'}</td>
                            <td className="num bal">{money(bal)}</td>
                            <td>{balType || '—'}</td>
                            <td>{showRemark ? (row.remarks || row.narration || '—') : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="ledger-grand-bar print:hidden">
              <div className="ledger-grand-remark" />
              <div className="ledger-grand-totals">
                <div>Record<br /><b>{filteredRows.length}</b></div>
                <div className="ledger-grand-labels">
                  <span>Date Total</span>
                  <span>Grand Total</span>
                </div>
                <div className="ledger-grand-boxes">
                  <input type="text" className="classic-erp-input" readOnly value={money(periodDebit)} />
                  <input type="text" className="classic-erp-input" readOnly value={money(periodCredit)} />
                  <input type="text" className="classic-erp-input" readOnly value={`${money(closingBal)} ${closingType}`} />
                </div>
              </div>
            </div>

            <div className="classic-erp-form-footer print:hidden">
              <button type="button" className="classic-erp-btn" onClick={() => setView('entry')}>Back</button>
              <button type="button" className="classic-erp-btn" onClick={handlePrint} disabled={!statement}>Print</button>
              <button type="button" className="classic-erp-btn" onClick={onClose}>Exit</button>
            </div>
          </div>
          <style>{ledgerStyles}</style>
        </>
      )}
    </ErpWindowedModal>
  );
};

const ledgerStyles = `
  .ledger-entry-modal-wrap {
    width: min(520px, 96vw) !important;
    max-width: 520px !important;
    padding: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
  }
  .ledger-entry-compact {
    background: #fffbd8;
    border: 2px solid #808080;
    box-shadow: 4px 4px 0 rgba(0,0,0,.15);
    font-size: 12px;
  }
  .ledger-entry-titlebar {
    display: flex; align-items: center; justify-content: space-between;
    background: #ece9d8;
    color: #111; font-weight: 700; padding: 4px 8px; font-size: 13px;
    border-bottom: 1px solid #aca899;
  }
  .ledger-entry-close {
    background: #d9534f; border: 1px solid #a02622; color: #fff;
    font-size: 13px; cursor: pointer; line-height: 1; width: 20px; height: 18px;
  }
  .ledger-entry-body {
    display: grid; grid-template-columns: 1fr 170px; gap: 8px;
    padding: 10px 10px 6px;
  }
  .ledger-entry-main {
    display: grid; grid-template-columns: 78px 1fr; gap: 6px 8px; align-items: center;
  }
  .ledger-form-label { font-weight: 700; font-size: 12px; color: #111; }
  .ledger-field-wrap { position: relative; }
  .ledger-company-select { background: #cfe2ff; color: #003399; font-weight: 700; }
  .ledger-side-checks {
    display: flex; flex-direction: column; gap: 5px; font-size: 11px;
  }
  .ledger-toggle-check {
    display: flex; align-items: center; gap: 5px; cursor: pointer; font-weight: 700;
    padding: 3px 6px; border-radius: 2px; background: #808080; color: #e5e5e5;
  }
  .ledger-toggle-check.is-on { background: #1d4ed8; color: #fff; }
  .ledger-toggle-row { display: flex; align-items: center; gap: 4px; }
  .ledger-tes-btn { padding: 2px 8px !important; font-size: 10px !important; }
  .ledger-stmt-check { display: flex; align-items: center; gap: 4px; cursor: pointer; font-weight: 600; }
  .ledger-entry-fy { padding: 0 10px 4px; font-size: 10px; color: #666; }
  .ledger-entry-footer {
    display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 10px;
    border-top: 1px solid #c4b8a8; background: #f3f0e6;
  }
  .ledger-ac-list {
    position: absolute; left: 0; right: 0; top: 100%; z-index: 50;
    max-height: 220px; overflow: auto;
    border: 2px solid #2b60db; background: #fff;
    box-shadow: 0 8px 24px rgba(0,0,0,.2);
  }
  .ledger-ac-list-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .ledger-ac-list-table th {
    position: sticky; top: 0; background: #f1f5f9;
    border-bottom: 1px solid #cbd5e1; padding: 4px 6px; text-align: left;
  }
  .ledger-ac-list-table td { border-bottom: 1px solid #e2e8f0; padding: 4px 6px; cursor: pointer; }
  .ledger-ac-list-table tr:hover td, .ledger-ac-list-table tr.is-active td { background: #2563eb; color: #fff; }
  .ledger-ac-empty { text-align: center; color: #94a3b8; padding: 12px; }
  .ledger-toolbar {
    display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 8px;
    background: #9bc89b; border-bottom: 1px solid #7eab7e; align-items: center;
  }
  .ledger-toolbar-search { width: 160px; height: 24px; }
  .ledger-toolbar-hints {
    display: flex; flex-direction: column; margin-left: auto; text-align: right;
    font-size: 10px; font-weight: 700; color: #7a1212; line-height: 1.3;
  }
  .ledger-toolbar2 {
    display: flex; gap: 12px; padding: 4px 8px;
    background: #9bc89b; border-bottom: 1px solid #7eab7e; align-items: stretch;
  }
  .ledger-toolbar2-left { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
  .ledger-toolbar2-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: #111; }
  .ledger-party-box { width: 160px; color: #b91c1c; font-weight: 800; }
  .ledger-date-red { border-color: #c00 !important; color: #c00; font-weight: 700; }
  .ledger-green-btn { background: #bff0bf !important; border-color: #6ba86b !important; }
  .ledger-l-hint { color: #b91c1c; font-weight: 800; }
  .ledger-openingbal-box { width: 90px; text-align: right; font-family: ui-monospace, Consolas, monospace; }
  .ledger-toolbar2-hints {
    display: flex; flex-direction: column; justify-content: center; text-align: right;
    font-size: 10px; font-weight: 700; color: #7a1212; line-height: 1.5; white-space: nowrap;
  }
  .ledger-toolbar2-hints b { color: #1d4ed8; }
  .ledger-stmt-body { flex: 1; min-height: 0; display: flex; flex-direction: column; background: #fff; overflow: hidden; }
  .ledger-stmt-table-wrap { flex: 1; min-height: 280px; overflow: auto; }
  .ledger-stmt-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .ledger-stmt-table thead th {
    position: sticky; top: 0; z-index: 1; background: #fff; color: #111; border-bottom: 2px solid #333;
    padding: 6px 8px; font-size: 11px; font-weight: 800;
  }
  .ledger-stmt-table thead th.num, .ledger-stmt-table td.num { text-align: right; font-family: ui-monospace, Consolas, monospace; }
  .ledger-stmt-table td { padding: 4px 8px; border-bottom: 1px solid #ddd; vertical-align: top; }
  .ledger-stmt-table tbody tr:nth-child(even) { background: #f5f5f5; }
  .ledger-stmt-table tbody tr:hover { background: #1e40af; color: #fff; }
  .ledger-ob-row td { background: #efe8dc !important; font-weight: 600; }
  .ledger-grand-bar {
    display: flex; align-items: center; gap: 16px; padding: 6px 10px;
    background: #9bc89b; border-top: 1px solid #7eab7e;
  }
  .ledger-grand-remark { flex: 1; height: 30px; background: #fff; border: 1px solid #7eab7e; border-radius: 2px; }
  .ledger-grand-totals { display: flex; align-items: center; gap: 10px; font-size: 11px; font-weight: 700; }
  .ledger-grand-labels { display: flex; flex-direction: column; text-align: right; line-height: 1.3; }
  .ledger-grand-boxes { display: flex; gap: 6px; }
  .ledger-grand-boxes input { width: 100px; text-align: right; font-family: ui-monospace, Consolas, monospace; font-weight: 700; }
  @media print {
    body * { visibility: hidden !important; }
    .ledger-stmt-window, .ledger-stmt-window * { visibility: visible !important; }
    .ledger-stmt-window { position: absolute !important; left: 0; top: 0; width: 100% !important; background: #fff !important; }
    .print\\:hidden, .classic-erp-header, .classic-erp-form-footer, .ledger-toolbar { display: none !important; }
  }
`;

export default LedgerModal;
