import React, { useEffect, useMemo, useRef, useState } from 'react';
import useStore from '../store/useStore';
import useConfigStore from '../store/useConfigStore';
import { toast } from '../store/useToastStore';
import Modal from '../components/ui/Modal';
import ErpWindowedModal from '../components/erp/ErpWindowedModal';
import { fmtDate, fmtMoney } from '../utils/invoiceHelpers';
import { downloadCsv } from '../utils/reportExport';
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

const acName = (o) => o.ledger?.name || o.party?.name || o.name || o.label || '';
const acGroup = (o) => {
  if (o.ledger?.group) return o.ledger.subGroup ? `${o.ledger.group} (${o.ledger.subGroup})` : o.ledger.group;
  if (o.ledger?.accountType) return o.ledger.accountType;
  if (o.party?.type) return `Party (${o.party.type})`;
  if (o.party?.group) return `Party (${o.party.group})`;
  return o.group || 'Party';
};
const acId = (o) => {
  const id = o.ledger?._id || o.ledger?.id || o.party?._id || o.party?.id || o.value || '';
  return String(id).replace(/^party:/, '').slice(-6).toUpperCase();
};

const fmtDateDMY = (isoDate) => {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const rowCP = (r) => {
  if (r.cp) return r.cp;
  if (r.contraShortCode) return r.contraShortCode;
  const contra = String(r.contraAccount || '').trim();
  if (contra) return contra.slice(0, 5).toUpperCase();
  return 'SCC';
};

const rowDescriptionClean = (r) => {
  if (r._material) {
    return r.particulars || 'JOB WORK MATERIAL';
  }
  const contra = String(r.contraAccount || '').trim();
  if (contra) return contra.toUpperCase();
  const part = String(r.particulars || r.narration || r.voucherType || '').trim();
  return part.toUpperCase() || 'SALES BOOK';
};

const rowRemark1Clean = (r) => {
  if (r.remark1) return r.remark1;
  const remarks = String(r.remarks || '').trim();
  const rt = String(r.refType || r.voucherType || '').toLowerCase();
  if (remarks) {
    // Payment/Receipt: backend sends raw bill numbers — add prefix to match reference format
    if (rt === 'payment' || rt === 'receipt') return `Bill No.:${remarks}`;
    // Sales/Purchase: remarks is the invoice/bill number directly
    if (rt === 'salesinvoice' || rt === 'sales') return remarks;
    if (rt === 'purchasebill' || rt === 'purchase') return remarks;
    // Notes: show the note number
    if (rt === 'debitnote' || rt === 'creditnote') return remarks;
    return remarks;
  }
  if (r.billVoucherNo || r.voucherNo) {
    const no = r.billVoucherNo || r.voucherNo;
    if (rt === 'payment' || rt === 'receipt') return `Bill No.:${no}`;
    return no;
  }
  return '—';
};

const rowAuditMark = (r) => {
  if (r.auditMark) return r.auditMark;
  if (r.accBill) return r.accBill;
  if (r.billVoucherNo || r.voucherNo) return 'B';
  return '—';
};

/** Head list dropdown */
function HeadListPanel({ heads, highlightIdx, onSelect }) {
  return (
    <div className="ledger-head-list">
      <div
        className={`ledger-head-item ${highlightIdx === -1 ? 'is-active' : ''}`}
        onMouseDown={(e) => { e.preventDefault(); onSelect(''); }}
      >
        <span className="font-bold">-- ALL ACCOUNT HEADS --</span>
      </div>
      {heads.map((h, idx) => (
        <div
          key={h}
          className={`ledger-head-item ${idx === highlightIdx ? 'is-active' : ''}`}
          onMouseDown={(e) => { e.preventDefault(); onSelect(h); }}
        >
          <span>{h}</span>
        </div>
      ))}
    </div>
  );
}

/** Inline account list — opens on focus/type */
function AccountListPanel({ rows, highlightIdx, onSelect, emptyText = 'No accounts found' }) {
  return (
    <div className="ledger-ac-list">
      <table className="ledger-ac-list-table">
        <thead>
          <tr>
            <th>AC_NAME</th>
            <th>ST_NAME (HEAD)</th>
            <th className="text-right">AC_ID</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={3} className="ledger-ac-empty">{emptyText}</td></tr>
          ) : rows.map((o, idx) => (
            <tr
              key={o.value || idx}
              className={idx === highlightIdx ? 'is-active' : ''}
              onMouseDown={(e) => { e.preventDefault(); onSelect(o); }}
            >
              <td className="font-semibold">{acName(o)}</td>
              <td><span className="ac-group-tag">{acGroup(o)}</span></td>
              <td className="text-right font-mono text-[10px]">{acId(o)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const LedgerModal = ({ isOpen, onClose, onOpenJournal, onOpenPayment, onOpenReceipt, onOpenSales, onOpenPurchase, onOpenNote, onOpenOutstanding }) => {
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
  // F3 filters Description, F5 filters Remark_1 — both drive the one toolbar box.
  const [filterField, setFilterField] = useState('description');
  const [descFilter, setDescFilter] = useState('');
  const [remarkFilter, setRemarkFilter] = useState('');
  const [selectedRow, setSelectedRow] = useState(0);
  const [checkedRows, setCheckedRows] = useState(new Set());
  const [jvRow, setJvRow] = useState(null);
  const printRef = useRef(null);
  const accHeadRef = useRef(null);
  const accountRef = useRef(null);
  const filterRef = useRef(null);

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
    setCheckedRows(new Set());
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
    if (accountText.trim()) {
      const q = accountText.trim().toLowerCase();
      const textMatched = list.filter((o) => acName(o).toLowerCase().includes(q) || acGroup(o).toLowerCase().includes(q));
      if (textMatched.length > 0) return textMatched;
    }
    if (accHead.trim()) {
      const q = accHead.trim().toLowerCase();
      const headMatched = list.filter((o) => acGroup(o).toLowerCase().includes(q));
      if (headMatched.length > 0) return headMatched;
    }
    return list;
  }, [ledgerOptions, accHead, accountText]);

  const resolveLedgerId = (id = ledgerId) => {
    if (!id) return null;
    if (id.startsWith('party:')) {
      const partyId = id.slice(6);
      const linked = (ledgers || []).find((l) => String(l.linkedPartyId) === partyId);
      if (linked) return String(linked._id || linked.id);
      return partyId;
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
    if (!picked || !id) {
      toast.warning('Select an account');
      setListOpen('account');
      accountRef.current?.focus();
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

  const mergedRows = rows; // only financial journal rows — material movements excluded


  const rowDescription = (r) =>
    String(r.particulars || r.narration || r.contraAccount || r.refType || '');
  const rowRemark = (r) => String(r.remarks || r.narration || '');

  const filteredRows = useMemo(() => {
    let data = [...mergedRows];
    if (onlyDr && !onlyCr) data = data.filter((r) => Number(r.debit || 0) > 0);
    if (onlyCr && !onlyDr) data = data.filter((r) => Number(r.credit || 0) > 0);
    const d = descFilter.trim().toLowerCase();
    if (d) data = data.filter((r) => rowDescription(r).toLowerCase().includes(d));
    const rm = remarkFilter.trim().toLowerCase();
    if (rm) data = data.filter((r) => rowRemark(r).toLowerCase().includes(rm));
    return data;
  }, [mergedRows, onlyDr, onlyCr, descFilter, remarkFilter]);

  const isFiltered =
    (onlyDr && !onlyCr) || (onlyCr && !onlyDr) || !!descFilter.trim() || !!remarkFilter.trim();

  const activeRow = Math.min(selectedRow, Math.max(0, filteredRows.length - 1));

  const toggleRowCheck = (id, e) => {
    if (e) e.stopPropagation();
    setCheckedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allChecked = useMemo(() => {
    if (filteredRows.length === 0) return false;
    return filteredRows.every((r, idx) => checkedRows.has(r._id || r.refId || idx));
  }, [filteredRows, checkedRows]);

  const toggleSelectAll = () => {
    if (allChecked) {
      setCheckedRows(new Set());
    } else {
      const next = new Set();
      filteredRows.forEach((r, idx) => next.add(r._id || r.refId || idx));
      setCheckedRows(next);
    }
  };

  /** Direct form opener — opens the edit form corresponding to any selected ledger row */
  const handleRowOpen = (row) => {
    if (!row) return;
    if (row._material) {
      toast.info(`Material entry: ${row.particulars || 'Job Work'}`);
      return;
    }
    const refType = String(row.refType || row.voucherType || '').toLowerCase();
    const docNo = row.billVoucherNo || row.voucherNo || row.entryNo || '';

    if (refType.includes('payment')) {
      if (onOpenPayment) onOpenPayment({ partyId, ledgerId: resolveLedgerId(), voucherNo: docNo, row });
      else toast.info(`Payment Voucher #${docNo}`);
    } else if (refType.includes('receipt')) {
      if (onOpenReceipt) onOpenReceipt({ partyId, ledgerId: resolveLedgerId(), voucherNo: docNo, row });
      else toast.info(`Receipt Voucher #${docNo}`);
    } else if (refType.includes('sale')) {
      if (onOpenSales) onOpenSales({ partyId, ledgerId: resolveLedgerId(), invoiceNo: docNo, row });
      else toast.info(`Sales Invoice #${docNo}`);
    } else if (refType.includes('purchase')) {
      if (onOpenPurchase) onOpenPurchase({ partyId, ledgerId: resolveLedgerId(), invoiceNo: docNo, row });
      else toast.info(`Purchase Bill #${docNo}`);
    } else if (refType.includes('note')) {
      if (onOpenNote) onOpenNote({ partyId, ledgerId: resolveLedgerId(), docNo, row });
      else toast.info(`Note #${docNo}`);
    } else if (refType.includes('journal')) {
      if (onOpenJournal) onOpenJournal({ partyId, ledgerId: resolveLedgerId(), entryNo: docNo, row });
      else setJvRow(row);
    } else {
      setJvRow(row);
    }
  };

  useEffect(() => {
    if (!isOpen || view !== 'statement') return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'F3' || e.key === 'F5') {
        e.preventDefault();
        setFilterField(e.key === 'F3' ? 'description' : 'remark');
        filterRef.current?.focus();
        filterRef.current?.select();
        return;
      }
      const tag = (e.target?.tagName || '').toUpperCase();
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedRow((i) => Math.min(i + 1, Math.max(0, filteredRows.length - 1)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedRow((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const row = filteredRows[activeRow];
        if (row) handleRowOpen(row);
      } else if (e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setView('entry');
      } else if (e.key === '*') {
        e.preventDefault();
        const row = filteredRows[activeRow];
        if (!row) return toast.warning('Select a ledger row first');
        setJvRow(row);
      } else if (e.key === '-') {
        e.preventDefault();
        if (onOpenPayment) onOpenPayment({ partyId, ledgerId: resolveLedgerId() });
        else toast.info('Cash Payment — open from Transaction > Cash Payment');
      } else if (e.key === '+') {
        e.preventDefault();
        if (onOpenReceipt) onOpenReceipt({ partyId, ledgerId: resolveLedgerId() });
        else toast.info('Cash Receipt — open from Transaction > Cash Book');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, view, partyId, filteredRows, activeRow, selectedRow, onOpenPayment, onOpenReceipt]);

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

  const handleExcel = () => {
    if (!statement || filteredRows.length === 0) return toast.warning('Load ledger first');
    const headers = ['Date', 'Bill/VNo', 'CP', 'ChqNo', 'Description', 'Debit', 'Credit', 'Balance', 'A.', 'Remark 1'];
    const body = filteredRows.map((r) => [
      fmtDateDMY(r.date || r.entryDate),
      r.billVoucherNo || r.voucherNo || '',
      rowCP(r),
      r.chequeNo || '',
      rowDescriptionClean(r),
      Number(r.debit || 0).toFixed(2),
      Number(r.credit || 0).toFixed(2),
      `${Number(r.runningBalance ?? r.balance ?? 0).toFixed(2)} ${(r.balanceType || '').toUpperCase()}`,
      rowAuditMark(r),
      rowRemark1Clean(r),
    ]);
    body.unshift([fmtDateDMY(from), 'OB', '', '', 'OPENING BALANCE',
      openingType === 'Dr' ? openingBal.toFixed(2) : '0.00',
      openingType === 'Cr' ? openingBal.toFixed(2) : '0.00',
      `${openingBal.toFixed(2)} ${openingType.toUpperCase()}`, '', '']);
    body.push(['', '', '', '', 'GRAND TOTAL',
      periodDebit.toFixed(2), periodCredit.toFixed(2), `${closingBal.toFixed(2)} ${closingType.toUpperCase()}`, '', '']);
    downloadCsv(`Ledger_${(ledgerName || 'account').replace(/\W+/g, '_')}_${from}_to_${to}.csv`, headers, body);
  };

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
              <HeadListPanel
                heads={filteredHeads}
                highlightIdx={listIdx}
                onSelect={(h) => pickHead(h)}
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

  const activeRowObj = filteredRows[activeRow];
  const activeDetailText = activeRowObj
    ? rowRemark1Clean(activeRowObj) !== '—'
      ? rowRemark1Clean(activeRowObj)
      : rowDescriptionClean(activeRowObj)
    : '';

  return (
    <ErpWindowedModal isOpen={isOpen} onClose={onClose} title="Zoom Ledger" windowId="ledger" defaultMode="maximized" bare>
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
              <button type="button" className="classic-erp-btn" onClick={handleExcel} disabled={!statement}>Excel</button>
              <button type="button" className="classic-erp-btn" onClick={() => toast.unavailable('Mail')}>Mail</button>
              <button type="button" className="classic-erp-btn" onClick={() => toast.unavailable('WhatsApp')}>Whatsapp</button>
              <button type="button" className="classic-erp-btn" onClick={() => toast.unavailable('ALL Reports')}>ALL Reports</button>
              <button
                type="button"
                className="classic-erp-btn"
                onClick={() => {
                  if (onOpenOutstanding) onOpenOutstanding({ partyId, ledgerId: resolveLedgerId() });
                  else toast.info('Outstanding — open from Reports > Outstanding');
                }}
              >
                O/S Reports
              </button>
              <button type="button" className="classic-erp-btn" onClick={() => shiftYear(1)} disabled={isLoading}>Next Year</button>
              <button type="button" className="classic-erp-btn" onClick={() => shiftYear(-1)} disabled={isLoading}>Back Year</button>
              <button type="button" className="classic-erp-btn" onClick={() => {
                const range = { from: fyStartISO(), to: todayISO() };
                setFrom(range.from);
                setTo(range.to);
                runLedger(range);
              }}>Current Year</button>
              <select
                className="classic-erp-select"
                style={{ height: 24, fontSize: 11 }}
                value={filterField}
                onChange={(e) => setFilterField(e.target.value)}
                title="F3 = Description, F5 = Remark_1"
              >
                <option value="description">Description</option>
                <option value="remark">Remark_1</option>
              </select>
              <input
                ref={filterRef}
                type="text"
                className="classic-erp-input ledger-toolbar-search"
                placeholder={filterField === 'description' ? 'Filter Description…' : 'Filter Remark_1…'}
                value={filterField === 'description' ? descFilter : remarkFilter}
                onChange={(e) =>
                  filterField === 'description' ? setDescFilter(e.target.value) : setRemarkFilter(e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    if (filterField === 'description') setDescFilter('');
                    else setRemarkFilter('');
                  }
                }}
              />
              {isFiltered && (
                <button
                  type="button"
                  className="classic-erp-btn"
                  onClick={() => { setDescFilter(''); setRemarkFilter(''); setOnlyDr(false); setOnlyCr(false); }}
                  title="Clear all row filters"
                >
                  Clear
                </button>
              )}
              <div className="ledger-toolbar-hints">
                <span>F3 &gt; Description Filter</span>
                <span>F5 &gt; Remark_1 Filter</span>
              </div>
            </div>

            <div className="ledger-toolbar2 print:hidden">
              <div className="ledger-toolbar2-left">
                <div className="ledger-toolbar2-row">
                  <input
                    type="text"
                    className="classic-erp-input ledger-party-box"
                    value={accountText || ledgerName}
                    readOnly
                    onClick={() => setView('entry')}
                    title="Click or press L to change account"
                  />
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
                  <span className="font-bold text-gray-700">SC27</span>
                  <span className="font-bold text-blue-900">{companyName}</span>
                  <span className="ml-auto classic-erp-label">Opening Bal</span>
                  <input type="text" className="classic-erp-input ledger-openingbal-box" value={money(openingBal)} readOnly />
                </div>
              </div>
              <div className="ledger-toolbar2-hints">
                <span>Press <b>(*)</b> To OpenJv</span>
                <span>Press <b>(-)</b> CashPayment</span>
                <span>Press <b>(+)</b> CashReceipt</span>
              </div>
            </div>

            <div className="ledger-stmt-body" ref={printRef}>
              {showAddress && (partyAddress || companyAddress) && (
                <div className="ledger-address-bar">
                  <div>
                    <b>{ledgerName}</b>
                    {partyAddress ? <span> — {partyAddress}</span> : null}
                    {partyInfo?.phone ? <span> · {partyInfo.phone}</span> : null}
                    {partyInfo?.gstin ? <span> · GSTIN {partyInfo.gstin}</span> : null}
                  </div>
                  <div className="ledger-address-comp">
                    {compShortName ? (companyName || '').slice(0, 12) : companyName}
                    {companyAddress ? ` — ${companyAddress}` : ''}
                  </div>
                </div>
              )}

              <div className="ledger-stmt-table-wrap relative">
                {(isLoading && !statement) ? (
                  <div className="p-4">
                    <InlineLoader message="Loading ledger…" className="mb-3" />
                    <SkeletonTable rows={10} cols={11} />
                  </div>
                ) : (
                  <table className="ledger-stmt-table">
                    <thead>
                      <tr>
                        <th className="w-7 text-center">
                          <input type="checkbox" checked={allChecked} onChange={toggleSelectAll} title="Select All" />
                        </th>
                        <th>Date</th>
                        <th>Bill/VNo</th>
                        <th>CP</th>
                        <th>ChqNo</th>
                        <th>Description</th>
                        <th className="num">Debit</th>
                        <th className="num">Credit</th>
                        <th className="num">Balance</th>
                        <th className="text-center">A.</th>
                        <th>Remark 1</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="ledger-ob-row">
                        <td className="text-center">
                          <input type="checkbox" disabled />
                        </td>
                        <td>{fmtDateDMY(from)}</td>
                        <td>OB</td>
                        <td>—</td>
                        <td>—</td>
                        <td><b>OPENING BALANCE</b></td>
                        <td className="num">{openingType === 'Dr' ? money(openingBal) : '0.00'}</td>
                        <td className="num">{openingType === 'Cr' ? money(openingBal) : '0.00'}</td>
                        <td className="num"><b>{money(openingBal)} {openingType.toUpperCase()}</b></td>
                        <td className="text-center">—</td>
                        <td>—</td>
                      </tr>
                      {filteredRows.map((row, i) => {
                        const rowKey = row._id || row.refId || i;
                        const isChecked = checkedRows.has(rowKey);
                        const debit = Number(row.debit || 0);
                        const credit = Number(row.credit || 0);
                        const bal = Number(row.runningBalance ?? row.balance ?? 0);
                        const balType = row.balanceType || '';
                        const cp = rowCP(row);
                        const desc = rowDescriptionClean(row);
                        const remark1 = rowRemark1Clean(row);
                        const audit = rowAuditMark(row);
                        const rowVt = String(row.voucherType || row.refType || '').toLowerCase();
                        const rowTypeClass = rowVt.includes('sale') ? 'ledger-row-sales'
                          : rowVt.includes('purchase') ? 'ledger-row-purchase'
                          : rowVt.includes('payment') ? 'ledger-row-payment'
                          : rowVt.includes('receipt') ? 'ledger-row-receipt'
                          : rowVt.includes('journal') ? 'ledger-row-journal'
                          : rowVt.includes('job') ? 'ledger-row-job'
                          : '';
                        return (
                          <tr
                            key={`${rowKey}-${i}`}
                            className={`${i === activeRow ? 'is-selected' : ''} ${rowTypeClass}`}
                            onClick={() => setSelectedRow(i)}
                            onDoubleClick={() => handleRowOpen(row)}
                            title="Press Enter or double-click to open form for editing"
                          >
                            <td className="text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => toggleRowCheck(rowKey, e)}
                              />
                            </td>
                            <td className="nowrap">{fmtDateDMY(row.date || row.entryDate)}</td>
                            <td>{row.billVoucherNo || row.voucherNo || row.entryNo || '—'}</td>
                            <td>{cp}</td>
                            <td>{row.chequeNo || row.chqNo || '—'}</td>
                            <td className="font-semibold">{desc}</td>
                            <td className="num">{money(debit)}</td>
                            <td className="num">{money(credit)}</td>
                            <td className="num bal font-bold">{money(bal)} {balType.toUpperCase()}</td>
                            <td className="text-center font-bold">{audit}</td>
                            <td>{showRemark ? remark1 : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="ledger-grand-bar print:hidden">
              <div className="ledger-grand-remark flex-1">
                <input
                  type="text"
                  className="classic-erp-input ledger-bottom-detail-box w-full font-bold"
                  value={activeDetailText}
                  readOnly
                />
              </div>
              <div className="ledger-grand-totals">
                <div className="ledger-record-counter text-center">
                  <span className="block text-[10px] text-gray-800 font-bold">Record</span>
                  <span className="block text-xs font-extrabold text-black">{filteredRows.length}</span>
                </div>
                <div className="ledger-grand-labels">
                  <span>Date Total</span>
                  <span>Grand Total</span>
                </div>
                <div className="ledger-grand-boxes">
                  <input type="text" className="classic-erp-input font-bold" readOnly title="Total Debit of listed rows" value={money(periodDebit)} />
                  <input type="text" className="classic-erp-input font-bold" readOnly title="Total Credit of listed rows" value={money(periodCredit)} />
                  <input type="text" className="classic-erp-input font-extrabold text-red-700" readOnly title="Closing balance of the account" value={`${money(closingBal)} ${closingType.toUpperCase()}`} />
                </div>
              </div>
            </div>

            <div className="classic-erp-form-footer print:hidden">
              <button type="button" className="classic-erp-btn" onClick={() => setView('entry')}>Back</button>
              <button type="button" className="classic-erp-btn" onClick={handlePrint} disabled={!statement}>Print</button>
              <button type="button" className="classic-erp-btn" onClick={onClose}>Exit</button>
            </div>
          </div>
          {jvRow && (
            <JournalVoucherPanel
              row={jvRow}
              onClose={() => setJvRow(null)}
              onOpenSource={() => {
                const t = jvRow.refType;
                if ((t === 'Payment' || t === 'Receipt')) {
                  const open = t === 'Receipt' ? onOpenReceipt : onOpenPayment;
                  if (open) { open({ partyId, ledgerId: resolveLedgerId(), voucherNo: jvRow.billVoucherNo }); setJvRow(null); return; }
                }
                if (onOpenJournal) { onOpenJournal({ partyId, ledgerId: resolveLedgerId(), entryNo: jvRow.voucherNo }); setJvRow(null); return; }
                toast.info(`Source document: ${jvRow.refType || 'Journal'} ${jvRow.billVoucherNo || ''}`);
              }}
            />
          )}
          <style>{ledgerStyles}</style>
        </>
      )}
    </ErpWindowedModal>
  );
};

/**
 * Open JV — renders the actual AccountingEntry behind a ledger row, every Dr/Cr leg of it.
 */
function JournalVoucherPanel({ row, onClose, onOpenSource }) {
  const lines = Array.isArray(row.journalLines) ? row.journalLines : [];
  const totalDr = lines.filter((l) => l.type === 'Dr').reduce((s, l) => s + Number(l.amount || 0), 0);
  const totalCr = lines.filter((l) => l.type === 'Cr').reduce((s, l) => s + Number(l.amount || 0), 0);

  return (
    <Modal isOpen onClose={onClose} className="max-w-[680px] w-full">
      <div className="ledger-jv" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
        <div className="ledger-jv-head">
          <span>Journal Voucher — {row.voucherNo || '—'}</span>
          <span className="ledger-jv-type">{voucherLabel(row.voucherType)}</span>
        </div>
        <div className="ledger-jv-meta">
          <div><b>Date</b><span>{fmtDateDMY(row.date)}</span></div>
          <div><b>Bill/VNo</b><span>{row.billVoucherNo || '—'}</span></div>
          <div><b>Ref Type</b><span>{row.refType || '—'}</span></div>
          {row.chequeNo ? <div><b>Chq No</b><span>{row.chequeNo}</span></div> : null}
        </div>
        {(row.entryNarration || row.narration) && (
          <div className="ledger-jv-narration">{row.entryNarration || row.narration}</div>
        )}
        <table className="ledger-jv-table">
          <thead>
            <tr><th>Account</th><th>Particulars</th><th className="num">Debit</th><th className="num">Credit</th></tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr><td colSpan={4} className="ledger-ac-empty">Journal lines unavailable for this row</td></tr>
            ) : lines.map((l, i) => (
              <tr key={i}>
                <td className="font-semibold">{l.ledgerName}</td>
                <td>{l.narration || '—'}</td>
                <td className="num">{l.type === 'Dr' ? money(l.amount) : '—'}</td>
                <td className="num">{l.type === 'Cr' ? money(l.amount) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}><b>Total</b></td>
              <td className="num"><b>{money(totalDr)}</b></td>
              <td className="num"><b>{money(totalCr)}</b></td>
            </tr>
          </tfoot>
        </table>
        <div className="ledger-jv-footer">
          <span className={Math.abs(totalDr - totalCr) < 0.01 ? 'ledger-jv-ok' : 'ledger-jv-bad'}>
            {Math.abs(totalDr - totalCr) < 0.01 ? 'Balanced' : `Out of balance by ${money(Math.abs(totalDr - totalCr))}`}
          </span>
          <button type="button" className="classic-erp-btn" onClick={onOpenSource}>Open Source</button>
          <button type="button" className="classic-erp-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
}

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
  .ledger-head-list {
    position: absolute; left: 0; right: 0; top: 100%; z-index: 60;
    max-height: 200px; overflow-y: auto;
    border: 2px solid #2b60db; background: #fff;
    box-shadow: 0 8px 24px rgba(0,0,0,.2);
  }
  .ledger-head-item {
    padding: 6px 10px; font-size: 11px; font-weight: 700; color: #1e293b;
    cursor: pointer; border-bottom: 1px solid #f1f5f9;
  }
  .ledger-head-item:hover, .ledger-head-item.is-active {
    background: #2563eb; color: #ffffff;
  }
  .ac-group-tag {
    display: inline-block; padding: 1px 5px; border-radius: 3px;
    background: #e2e8f0; color: #334155; font-size: 10px; font-weight: 700;
  }
  .ledger-ac-list-table tr:hover .ac-group-tag, .ledger-ac-list-table tr.is-active .ac-group-tag {
    background: #1d4ed8; color: #ffffff;
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
  .ledger-party-box {
    width: 170px; color: #b91c1c !important; font-weight: 800 !important; font-size: 13px !important;
    background: #ffffff !important; border: 1px solid #7eab7e !important; cursor: pointer;
  }
  .ledger-date-red { border-color: #c00 !important; color: #c00 !important; font-weight: 700 !important; background: #fff !important; }
  .ledger-green-btn { background: #bff0bf !important; border-color: #6ba86b !important; font-weight: 700 !important; color: #1e3a1e !important; }
  .ledger-l-hint { color: #b91c1c; font-weight: 800; font-size: 11px; }
  .ledger-openingbal-box { width: 90px; text-align: right; font-family: ui-monospace, Consolas, monospace; font-weight: 700; background: #fff !important; }
  .ledger-toolbar2-hints {
    display: flex; flex-direction: column; justify-content: center; text-align: right;
    font-size: 10px; font-weight: 700; color: #7a1212; line-height: 1.5; white-space: nowrap;
  }
  .ledger-toolbar2-hints b { color: #1d4ed8; }
  .ledger-stmt-body { flex: 1; min-height: 0; display: flex; flex-direction: column; background: #fff; overflow: hidden; }
  .ledger-stmt-table-wrap { flex: 1; min-height: 280px; overflow: auto; }
  .ledger-stmt-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .ledger-stmt-table thead th {
    position: sticky; top: 0; z-index: 2; background: #9bc89b; color: #111; border-bottom: 2px solid #5a8a5a;
    padding: 5px 6px; font-size: 11px; font-weight: 800; text-align: left;
  }
  .ledger-stmt-table thead th.num, .ledger-stmt-table td.num { text-align: right; font-family: ui-monospace, Consolas, monospace; }
  .ledger-stmt-table td { padding: 4px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
  .ledger-stmt-table tbody tr:nth-child(even) { background: #f8fafc; }
  .ledger-stmt-table tbody tr:hover { background: #dbeafe; }
  .ledger-ob-row td { background: #efe8dc !important; font-weight: 700; color: #443010; }
  .ledger-stmt-table tbody tr.is-selected td { background: #0066cc !important; color: #ffffff !important; font-weight: 600; }
  .ledger-stmt-table tbody tr.is-selected input[type="checkbox"] { accent-color: #ffffff; }
  .ledger-stmt-table tbody tr { cursor: pointer; }
  /* Transaction-type row coloring — matches reference software color coding */
  .ledger-stmt-table tbody tr.ledger-row-sales td { color: #1d4ed8; }
  .ledger-stmt-table tbody tr.ledger-row-purchase td { color: #92400e; }
  .ledger-stmt-table tbody tr.ledger-row-receipt td { color: #065f46; }
  .ledger-stmt-table tbody tr.ledger-row-payment td { color: #7c2d12; }
  .ledger-stmt-table tbody tr.ledger-row-journal td { color: #581c87; }
  .ledger-stmt-table tbody tr.ledger-row-job td { color: #0f4c4c; }
  .ledger-address-bar {
    display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap;
    padding: 4px 10px; font-size: 11px; color: #1e293b;
    background: #f8fafc; border-bottom: 1px solid #cbd5e1;
  }
  .ledger-address-comp { color: #475569; text-align: right; }
  .ledger-jv { background: #fff; font-size: 12px; }
  .ledger-jv-head {
    display: flex; justify-content: space-between; align-items: center;
    background: #374151; color: #fff; padding: 6px 10px; font-weight: 700;
  }
  .ledger-jv-type { font-size: 10px; opacity: .85; }
  .ledger-jv-meta {
    display: flex; flex-wrap: wrap; gap: 14px; padding: 6px 10px;
    background: #f1f5f9; border-bottom: 1px solid #cbd5e1; font-size: 11px;
  }
  .ledger-jv-meta div { display: flex; flex-direction: column; }
  .ledger-jv-meta b { font-size: 9px; text-transform: uppercase; color: #64748b; }
  .ledger-jv-narration { padding: 5px 10px; font-size: 11px; color: #334155; border-bottom: 1px solid #e2e8f0; }
  .ledger-jv-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .ledger-jv-table th { background: #e2e8f0; padding: 4px 8px; text-align: left; border-bottom: 1px solid #cbd5e1; }
  .ledger-jv-table td { padding: 4px 8px; border-bottom: 1px solid #eef2f7; }
  .ledger-jv-table .num { text-align: right; font-family: ui-monospace, Consolas, monospace; }
  .ledger-jv-table tfoot td { background: #f8fafc; border-top: 2px solid #94a3b8; }
  .ledger-jv-footer {
    display: flex; align-items: center; gap: 8px; padding: 8px 10px;
    background: #f3f0e6; border-top: 1px solid #c4b8a8;
  }
  .ledger-jv-ok { font-weight: 700; color: #15803d; margin-right: auto; }
  .ledger-jv-bad { font-weight: 700; color: #b91c1c; margin-right: auto; }
  .ledger-grand-bar {
    display: flex; align-items: center; gap: 12px; padding: 6px 10px;
    background: #9bc89b; border-top: 1px solid #7eab7e;
  }
  .ledger-bottom-detail-box {
    background: #ffffff !important; border: 1px solid #7eab7e !important; color: #111111 !important;
    font-weight: 700 !important; font-size: 12px !important; height: 26px !important;
  }
  .ledger-grand-totals { display: flex; align-items: center; gap: 10px; font-size: 11px; font-weight: 700; }
  .ledger-grand-labels { display: flex; flex-direction: column; text-align: right; line-height: 1.3; font-weight: 800; color: #1e3a1e; }
  .ledger-grand-boxes { display: flex; gap: 6px; }
  .ledger-grand-boxes input {
    width: 105px; text-align: right; font-family: ui-monospace, Consolas, monospace; font-weight: 700; background: #fff !important; height: 26px !important;
  }
  @media print {
    body * { visibility: hidden !important; }
    .ledger-stmt-window, .ledger-stmt-window * { visibility: visible !important; }
    .ledger-stmt-window { position: absolute !important; left: 0; top: 0; width: 100% !important; background: #fff !important; }
    .print\\:hidden, .classic-erp-header, .classic-erp-form-footer, .ledger-toolbar { display: none !important; }
  }
`;

export default LedgerModal;
