import React, { useEffect, useMemo, useRef, useState } from 'react';
import useStore from '../store/useStore';
import useConfigStore from '../store/useConfigStore';
import { toast } from '../store/useToastStore';
import Modal from '../components/ui/Modal';
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

/**
 * Ledger Statement — classic ERP layout, live AccountingEntry statement.
 */
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

  const [ledgerId, setLedgerId] = useState('');
  const [from, setFrom] = useState(fyStartISO());
  const [to, setTo] = useState(todayISO());
  const [showRemark, setShowRemark] = useState(true);
  const [showAddress, setShowAddress] = useState(true);
  const [busy, setBusy] = useState(false);
  const printRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    fetchLedgers().catch(() => {});
    fetchParties().catch(() => {});
    setFrom(fyStartISO());
    setTo(todayISO());
  }, [isOpen, fetchLedgers, fetchParties]);

  const ledgerOptions = useMemo(() => {
    const map = new Map();
    (ledgers || []).forEach((l) => {
      const id = String(l._id || l.id);
      if (!id) return;
      const tag = l.linkedPartyId ? 'Party' : l.accountType || l.group || 'Ledger';
      map.set(id, { value: id, label: `${l.name} (${tag})`, ledger: l });
    });
    (parties || []).forEach((p) => {
      const pid = String(p._id || p.id);
      const linked = (ledgers || []).find((l) => String(l.linkedPartyId) === pid);
      if (linked) return;
      map.set(`party:${pid}`, {
        value: `party:${pid}`,
        label: `${p.name} (Party — no ledger)`,
        partyOnly: true,
        party: p,
      });
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [ledgers, parties]);

  const resolveLedgerId = () => {
    if (!ledgerId) return null;
    if (ledgerId.startsWith('party:')) {
      const partyId = ledgerId.slice(6);
      const linked = (ledgers || []).find((l) => String(l.linkedPartyId) === partyId);
      return linked ? String(linked._id || linked.id) : null;
    }
    return ledgerId;
  };

  const selectedMeta = useMemo(
    () => ledgerOptions.find((o) => o.value === ledgerId) || null,
    [ledgerOptions, ledgerId]
  );

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

  const runLedger = async ({ silent = false } = {}) => {
    const id = resolveLedgerId();
    if (!ledgerId) {
      if (!silent) toast.warning('Select an account / ledger');
      return;
    }
    if (!id) {
      if (!silent) {
        toast.warning('No ledger linked for this party yet. Create a bill/payment first or link in Account Master.');
      }
      return;
    }
    setBusy(true);
    try {
      await fetchLedgerStatement({ ledgerId: id, from, to });
    } catch (err) {
      if (!silent) toast.error(err, { fallback: 'Failed to load ledger' });
    } finally {
      setBusy(false);
    }
  };

  // Auto-load when account / period changes
  useEffect(() => {
    if (!isOpen || !ledgerId) return undefined;
    const id = resolveLedgerId();
    if (!id) return undefined;
    let cancelled = false;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        await fetchLedgerStatement({ ledgerId: id, from, to });
      } catch (err) {
        if (!cancelled) {
          toast.error(err, { fallback: 'Failed to load ledger' });
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, ledgerId, from, to]);

  const statement = currentLedgerStatement;
  const rows = useMemo(() => {
    if (!statement) return [];
    if (Array.isArray(statement.statement)) return statement.statement;
    if (Array.isArray(statement.entries)) return statement.entries;
    if (Array.isArray(statement.lines)) return statement.lines;
    return [];
  }, [statement]);

  const ledgerName =
    statement?.ledgerName || statement?.ledger?.name || selectedMeta?.ledger?.name || '—';
  const openingBal = Number(statement?.openingBalance ?? statement?.opening ?? 0);
  const openingType = statement?.openingBalanceType || (openingBal >= 0 ? 'Dr' : 'Cr');
  const closingBal = Number(statement?.closingBalance ?? statement?.closing ?? 0);
  const closingType = statement?.closingBalanceType || '';

  const periodDebit = rows.reduce((s, r) => s + Number(r.debit || 0), 0);
  const periodCredit = rows.reduce((s, r) => s + Number(r.credit || 0), 0);

  const partyAddress = partyInfo
    ? [partyInfo.address, partyInfo.city, partyInfo.state, partyInfo.pincode].filter(Boolean).join(', ')
    : '';

  const handlePrint = () => {
    if (!statement) {
      toast.warning('Load ledger first');
      return;
    }
    document.body.classList.add('ledger-printing');
    setTimeout(() => {
      window.print();
      setTimeout(() => document.body.classList.remove('ledger-printing'), 400);
    }, 50);
  };

  const isLoading = busy || loading;

  return (
    <Modal isOpen={isOpen} onClose={onClose} bare className="max-w-[980px] w-full">
      <div className="classic-erp-window ledger-stmt-window">
        <ErpBusyOverlay show={isLoading && !!statement} message="Refreshing ledger…" />
        <div className="classic-erp-header">
          <span>Ledger Statement</span>
          <button type="button" className="classic-erp-close-btn" onClick={onClose}>
            X
          </button>
        </div>

        {/* Filters */}
        <div className="ledger-stmt-filters print:hidden">
          <div className="ledger-stmt-field">
            <span className="ledger-stmt-label">Company</span>
            <input className="classic-erp-input" value={companyName} readOnly disabled />
            {financialYear ? <span className="ledger-stmt-fy">FY {financialYear}</span> : null}
          </div>
          <div className="ledger-stmt-field ledger-stmt-field--grow">
            <span className="ledger-stmt-label">Account</span>
            <select
              className="classic-erp-select"
              value={ledgerId}
              onChange={(e) => setLedgerId(e.target.value)}
            >
              <option value="">— Select Account —</option>
              {ledgerOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="ledger-stmt-field">
            <span className="ledger-stmt-label">From</span>
            <input
              type="date"
              className="classic-erp-input"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="ledger-stmt-field">
            <span className="ledger-stmt-label">To</span>
            <input
              type="date"
              className="classic-erp-input"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>

        <div className="ledger-stmt-opts print:hidden">
          <label className="ledger-stmt-check">
            <input type="checkbox" checked={showRemark} onChange={(e) => setShowRemark(e.target.checked)} />
            Show Remark
          </label>
          <label className="ledger-stmt-check">
            <input type="checkbox" checked={showAddress} onChange={(e) => setShowAddress(e.target.checked)} />
            Show Party Address
          </label>
          <span className="ledger-stmt-hint">
            Sales · Purchase · Receipt · Payment · Mill · Journal · Returns
          </span>
        </div>

        {/* Statement body */}
        <div className="ledger-stmt-body" ref={printRef}>
          <div className="ledger-print-only hidden print:block">
            <div className="ledger-print-head">
              <div className="ledger-print-co">{companyName}</div>
              {companyAddress ? <div className="ledger-print-addr">{companyAddress}</div> : null}
              <div className="ledger-print-title">LEDGER STATEMENT</div>
            </div>
          </div>

          <div className="ledger-stmt-summary">
            <div>
              <div className="ledger-stmt-acc-name">{ledgerName}</div>
              {showAddress && partyAddress ? (
                <div className="ledger-stmt-acc-addr">{partyAddress}</div>
              ) : null}
              {showAddress && partyInfo?.gstin ? (
                <div className="ledger-stmt-acc-addr">GSTIN: {partyInfo.gstin}</div>
              ) : null}
            </div>
            <div className="ledger-stmt-bal-box">
              <div>
                Period: <b>{fmtDate(from)}</b> to <b>{fmtDate(to)}</b>
              </div>
              <div>
                Opening: <b>{fmtMoney(openingBal)} {openingType}</b>
              </div>
              <div>
                Closing: <b>{fmtMoney(closingBal)} {closingType}</b>
              </div>
            </div>
          </div>

          <div className="ledger-stmt-table-wrap relative">
            {(isLoading && !statement) || (isLoading && rows.length === 0 && statement) ? (
              <div className="p-4">
                <InlineLoader message="Loading ledger statement…" className="mb-3" />
                <SkeletonTable rows={10} cols={6} />
              </div>
            ) : !statement ? (
              <div className="ledger-stmt-empty">Select an account to load ledger statement</div>
            ) : (
              <table className="ledger-stmt-table">
                <thead>
                  <tr>
                    <th style={{ width: '11%' }}>Date</th>
                    <th style={{ width: '16%' }}>Voucher</th>
                    <th>Particulars</th>
                    <th style={{ width: '13%' }} className="num">
                      Debit
                    </th>
                    <th style={{ width: '13%' }} className="num">
                      Credit
                    </th>
                    <th style={{ width: '15%' }} className="num">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="ledger-ob-row">
                    <td>{fmtDate(from)}</td>
                    <td>—</td>
                    <td>
                      <b>Opening Balance</b>
                    </td>
                    <td className="num">{openingType === 'Dr' ? money(openingBal) : '—'}</td>
                    <td className="num">{openingType === 'Cr' ? money(openingBal) : '—'}</td>
                    <td className="num">
                      <b>
                        {money(openingBal)} {openingType}
                      </b>
                    </td>
                  </tr>

                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="ledger-stmt-empty-row">
                        No transactions in this period
                      </td>
                    </tr>
                  )}

                  {rows.map((row, i) => {
                    const debit = Number(row.debit || 0);
                    const credit = Number(row.credit || 0);
                    const bal = Number(row.runningBalance ?? row.balance ?? 0);
                    const balType = row.balanceType || '';
                    const particular =
                      row.particulars || row.narration || row.contraAccount || row.refType || '—';
                    return (
                      <tr key={`${row._id || row.voucherNo || i}-${i}`}>
                        <td className="nowrap">{fmtDate(row.date || row.entryDate)}</td>
                        <td>
                          <div className="voucher-no">{row.voucherNo || row.entryNo || '—'}</div>
                          {row.voucherType ? (
                            <div className="voucher-type">{voucherLabel(row.voucherType)}</div>
                          ) : null}
                        </td>
                        <td>
                          <div>{particular}</div>
                          {showRemark && row.contraAccount && particular !== row.contraAccount ? (
                            <div className="contra">Contra: {row.contraAccount}</div>
                          ) : null}
                          {showRemark && row.remarks ? <div className="remark">{row.remarks}</div> : null}
                        </td>
                        <td className="num">{debit > 0 ? money(debit) : '—'}</td>
                        <td className="num">{credit > 0 ? money(credit) : '—'}</td>
                        <td className="num bal">
                          {money(bal)}
                          {balType ? ` ${balType}` : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="tfoot-label">
                      Period Total
                    </td>
                    <td className="num">
                      <b>{money(periodDebit)}</b>
                    </td>
                    <td className="num">
                      <b>{money(periodCredit)}</b>
                    </td>
                    <td className="num">
                      <b>
                        {money(closingBal)} {closingType}
                      </b>
                    </td>
                  </tr>
                  <tr className="closing-row">
                    <td colSpan={3} className="tfoot-label">
                      Closing Balance
                    </td>
                    <td className="num">{closingType === 'Dr' ? money(closingBal) : '—'}</td>
                    <td className="num">{closingType === 'Cr' ? money(closingBal) : '—'}</td>
                    <td className="num">
                      <b>
                        {money(closingBal)} {closingType}
                      </b>
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>

        <div className="classic-erp-form-footer print:hidden">
          <button type="button" className="classic-erp-btn btn-blue" onClick={() => runLedger()} disabled={isLoading}>
            {isLoading ? <ButtonLoader label="Loading…" /> : 'Ledger'}
          </button>
          <button type="button" className="classic-erp-btn" onClick={handlePrint} disabled={!statement}>
            Print
          </button>
          <button
            type="button"
            className="classic-erp-btn"
            onClick={() => toast.unavailable('Interest Report')}
          >
            Interest
          </button>
          <button
            type="button"
            className="classic-erp-btn"
            onClick={() => toast.unavailable('Bank Reconciliation')}
          >
            Bank Recon.
          </button>
          <button type="button" className="classic-erp-btn" onClick={onClose}>
            Exit
          </button>
        </div>
      </div>

      <style>{`
        .ledger-stmt-window { max-height: 92vh; }
        .ledger-stmt-filters {
          display: flex; flex-wrap: wrap; gap: 8px 12px;
          padding: 10px 12px; border-bottom: 1px solid var(--border, #c4b8a8);
          background: #faf8f5; align-items: center;
        }
        .ledger-stmt-field { display: flex; align-items: center; gap: 6px; }
        .ledger-stmt-field--grow { flex: 1; min-width: 220px; }
        .ledger-stmt-field--grow .classic-erp-select { flex: 1; }
        .ledger-stmt-label {
          font-size: 10px; font-weight: 700; color: #5c4a32;
          text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap;
          min-width: 52px;
        }
        .ledger-stmt-fy { font-size: 10px; color: #888; white-space: nowrap; }
        .ledger-stmt-opts {
          display: flex; flex-wrap: wrap; gap: 14px; align-items: center;
          padding: 6px 12px; border-bottom: 1px solid #e5dfd4; background: #fff;
          font-size: 11px;
        }
        .ledger-stmt-check { display: flex; align-items: center; gap: 6px; cursor: pointer; font-weight: 600; color: #333; }
        .ledger-stmt-check input { accent-color: #3d2914; }
        .ledger-stmt-hint { margin-left: auto; font-size: 10px; color: #999; }
        .ledger-stmt-body {
          flex: 1; min-height: 0; display: flex; flex-direction: column;
          background: #fff; overflow: hidden;
        }
        .ledger-stmt-summary {
          display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap;
          padding: 8px 12px; border-bottom: 1px solid #ddd; background: #f5f0e8;
        }
        .ledger-stmt-acc-name { font-size: 13px; font-weight: 800; color: #1a1208; text-transform: uppercase; }
        .ledger-stmt-acc-addr { font-size: 10px; color: #555; margin-top: 2px; }
        .ledger-stmt-bal-box { font-size: 11px; text-align: right; line-height: 1.45; color: #333; }
        .ledger-stmt-table-wrap { flex: 1; min-height: 280px; overflow: auto; }
        .ledger-stmt-table {
          width: 100%; border-collapse: collapse; font-size: 11px; color: #111;
        }
        .ledger-stmt-table thead th {
          position: sticky; top: 0; z-index: 1;
          background: #3d2914; color: #fff; font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.04em;
          padding: 7px 8px; text-align: left; border: none;
        }
        .ledger-stmt-table thead th.num { text-align: right; }
        .ledger-stmt-table td {
          padding: 5px 8px; border-bottom: 1px solid #e8e2d8; vertical-align: top;
        }
        .ledger-stmt-table td.num { text-align: right; font-variant-numeric: tabular-nums; font-family: ui-monospace, Consolas, monospace; font-size: 10.5px; }
        .ledger-stmt-table td.bal { font-weight: 700; }
        .ledger-stmt-table td.nowrap { white-space: nowrap; }
        .ledger-stmt-table tbody tr:nth-child(even) { background: #fafaf8; }
        .ledger-stmt-table tbody tr:hover { background: #f0ebe3; }
        .ledger-ob-row td { background: #efe8dc !important; font-weight: 600; }
        .voucher-no { font-family: ui-monospace, Consolas, monospace; font-size: 10px; font-weight: 700; }
        .voucher-type { font-size: 9px; color: #7a6548; font-weight: 700; letter-spacing: 0.03em; }
        .contra { font-size: 9px; color: #666; margin-top: 1px; }
        .remark { font-size: 9px; color: #888; font-style: italic; margin-top: 1px; }
        .ledger-stmt-empty, .ledger-stmt-empty-row {
          text-align: center; color: #999; padding: 28px 12px; font-size: 12px;
        }
        .ledger-stmt-table tfoot td {
          background: #f5f0e8; border-top: 1px solid #3d2914; padding: 6px 8px; font-size: 11px;
        }
        .closing-row td { background: #efe8dc !important; }
        .tfoot-label { text-align: right; font-weight: 800; text-transform: uppercase; font-size: 10px; }

        @media print {
          body * { visibility: hidden !important; }
          .ledger-stmt-window, .ledger-stmt-window * { visibility: visible !important; }
          .ledger-stmt-window {
            position: absolute !important; left: 0; top: 0; width: 100% !important;
            max-height: none !important; background: #fff !important;
          }
          .print\\:hidden, .classic-erp-header, .classic-erp-form-footer,
          .ledger-stmt-filters, .ledger-stmt-opts { display: none !important; }
          .ledger-stmt-table-wrap { overflow: visible !important; max-height: none !important; }
          .ledger-stmt-table thead th { background: #111 !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .ledger-print-only { display: block !important; }
          .ledger-print-head { text-align: center; margin-bottom: 8px; }
          .ledger-print-co { font-size: 16px; font-weight: 800; }
          .ledger-print-addr { font-size: 10px; color: #444; }
          .ledger-print-title { font-size: 12px; font-weight: 800; letter-spacing: 0.12em; margin-top: 6px; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px; }
        }
        @page { size: A4 portrait; margin: 10mm; }
      `}</style>
    </Modal>
  );
};

export default LedgerModal;
