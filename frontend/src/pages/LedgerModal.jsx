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

const LedgerModal = ({ isOpen, onClose }) => {
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

  const runLedger = async () => {
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
    setBusy(true);
    try {
      await fetchLedgerStatement({ ledgerId: id, from, to });
      setView('statement');
      return true;
    } catch (err) {
      toast.error(err, { fallback: 'Failed to load ledger' });
      return false;
    } finally {
      setBusy(false);
    }
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
          <input className="classic-erp-input" value={companyName} readOnly disabled />

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
          <label className="ledger-stmt-check"><input type="checkbox" checked={showRemark} onChange={(e) => setShowRemark(e.target.checked)} />With Remark (Detail)</label>
          <label className="ledger-stmt-check"><input type="checkbox" checked={showAddress} onChange={(e) => setShowAddress(e.target.checked)} />With Address</label>
          <label className="ledger-stmt-check"><input type="checkbox" checked={compShortName} onChange={(e) => setCompShortName(e.target.checked)} />Comp ShortName</label>
          <label className="ledger-stmt-check"><input type="checkbox" checked={newProcess} onChange={(e) => setNewProcess(e.target.checked)} />New Process</label>
          <label className="ledger-stmt-check"><input type="checkbox" checked={withPuVoNo} onChange={(e) => setWithPuVoNo(e.target.checked)} />With PuVoNo</label>
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
              <button type="button" className="classic-erp-btn" onClick={() => setView('entry')}>Change A/c</button>
              <button type="button" className="classic-erp-btn" onClick={() => { setFrom(fyStartISO()); setTo(todayISO()); runLedger(); }}>CurrentYear</button>
              <label className="ledger-stmt-check ml-auto"><input type="checkbox" checked={onlyDr} onChange={(e) => setOnlyDr(e.target.checked)} />Only Dr</label>
              <label className="ledger-stmt-check"><input type="checkbox" checked={onlyCr} onChange={(e) => setOnlyCr(e.target.checked)} />Only Cr</label>
            </div>

            <div className="ledger-stmt-body" ref={printRef}>
              <div className="ledger-stmt-summary">
                <div>
                  <div className="ledger-stmt-acc-name">{ledgerName}</div>
                  {showAddress && partyAddress ? <div className="ledger-stmt-acc-addr">{partyAddress}</div> : null}
                </div>
                <div className="ledger-stmt-bal-box">
                  <div>Period: <b>{fmtDate(from)}</b> to <b>{fmtDate(to)}</b></div>
                  <div>Opening: <b>{fmtMoney(openingBal)} {openingType}</b></div>
                  <div>Closing: <b>{fmtMoney(closingBal)} {closingType}</b></div>
                </div>
              </div>

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
                    <tfoot>
                      <tr>
                        <td colSpan={5} className="tfoot-label">Grand Total</td>
                        <td className="num"><b>{money(periodDebit)}</b></td>
                        <td className="num"><b>{money(periodCredit)}</b></td>
                        <td className="num"><b>{money(closingBal)}</b></td>
                        <td><b>{closingType}</b></td><td>—</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
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
    background: linear-gradient(#0054e3, #003399);
    color: #fff; font-weight: 700; padding: 4px 8px; font-size: 13px;
  }
  .ledger-entry-close { background: none; border: none; color: #fff; font-size: 18px; cursor: pointer; line-height: 1; }
  .ledger-entry-body {
    display: grid; grid-template-columns: 1fr 170px; gap: 8px;
    padding: 10px 10px 6px;
  }
  .ledger-entry-main {
    display: grid; grid-template-columns: 78px 1fr; gap: 6px 8px; align-items: center;
  }
  .ledger-form-label { font-weight: 700; font-size: 12px; color: #111; }
  .ledger-field-wrap { position: relative; }
  .ledger-side-checks {
    display: flex; flex-direction: column; gap: 4px;
    background: #eef3ff; border: 1px solid #94a3b8; padding: 6px; font-size: 11px;
  }
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
  .ledger-stmt-body { flex: 1; min-height: 0; display: flex; flex-direction: column; background: #fff; overflow: hidden; }
  .ledger-stmt-summary {
    display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap;
    padding: 8px 12px; border-bottom: 1px solid #ddd; background: #f5f0e8;
  }
  .ledger-stmt-acc-name { font-size: 13px; font-weight: 800; color: #c00; text-transform: uppercase; }
  .ledger-stmt-acc-addr { font-size: 10px; color: #555; margin-top: 2px; }
  .ledger-stmt-bal-box { font-size: 11px; text-align: right; line-height: 1.45; }
  .ledger-stmt-table-wrap { flex: 1; min-height: 280px; overflow: auto; }
  .ledger-stmt-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .ledger-stmt-table thead th {
    position: sticky; top: 0; z-index: 1; background: #555; color: #fff;
    padding: 6px 8px; font-size: 10px; text-transform: uppercase;
  }
  .ledger-stmt-table thead th.num, .ledger-stmt-table td.num { text-align: right; font-family: ui-monospace, Consolas, monospace; }
  .ledger-stmt-table td { padding: 4px 8px; border-bottom: 1px solid #ddd; vertical-align: top; }
  .ledger-stmt-table tbody tr:nth-child(even) { background: #f5f5f5; }
  .ledger-stmt-table tbody tr:hover { background: #1e40af; color: #fff; }
  .ledger-ob-row td { background: #efe8dc !important; font-weight: 600; }
  .ledger-stmt-table tfoot td { background: #f5f0e8; border-top: 1px solid #333; padding: 6px 8px; }
  .tfoot-label { text-align: right; font-weight: 800; text-transform: uppercase; font-size: 10px; }
  @media print {
    body * { visibility: hidden !important; }
    .ledger-stmt-window, .ledger-stmt-window * { visibility: visible !important; }
    .ledger-stmt-window { position: absolute !important; left: 0; top: 0; width: 100% !important; background: #fff !important; }
    .print\\:hidden, .classic-erp-header, .classic-erp-form-footer, .ledger-toolbar { display: none !important; }
  }
`;

export default LedgerModal;
