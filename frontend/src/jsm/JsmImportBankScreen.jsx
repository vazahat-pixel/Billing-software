import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import ErpWindowedModal from '../components/erp/ErpWindowedModal';
import JsmFormDialog from './JsmFormDialog';
import { accountingApi } from '../api/accounting.api';
import { toast } from '../store/useToastStore';
import { notifyError } from '../utils/notify';
import './jsm.css';

/**
 * JSM: Reports › Fas Reports › Import Bank (Tran_ImportCashBank, "Import Bank Statement").
 * Import Excel reads a bank statement into the grid (JSM's own header names: DATE, DESCRIPTION / NARRATION,
 * CHQ / REF NO, WITHDRAWAL / DEBIT, DEPOSIT / CREDIT, BALANCE); the Bank and Account named on the form are
 * the two sides; Save posts each row as a Receipt (deposit) or Payment (withdrawal) through the normal
 * voucher service, so the books, numbering and ledgers behave exactly as for a typed voucher.
 */
const FORM = 'Tran_ImportCashBank';
const n2 = (v) => (Number(v) || 0).toFixed(2);
const COLUMNS = [
  { key: 'SRNO', label: 'SR.NO', width: 50 },
  { key: 'REC_DATE', label: 'DATE', width: 90 },
  { key: 'NARRATION', label: 'NARRATION', width: 380 },
  { key: 'CHQ_NO', label: 'CHQ.NO', width: 90 },
  { key: 'CHQ_DATE', label: 'CHQ.DATE', width: 90 },
  { key: 'REC_PAY', label: 'REC/PAY', width: 70 },
  { key: 'REC_AMT', label: 'AMOUNT', width: 100, num: true, fmt: n2 },
  { key: 'CLOSING_BAL', label: 'BALANCE', width: 100, num: true, fmt: n2 },
];

const norm = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
// A header matches when it is one of JSM's names, or contains one of the longer words ("Withdrawal Amt.", "Chq/Ref No").
const pick = (headers, names, words = []) => headers.findIndex((h) => names.includes(norm(h)) || words.some((w) => norm(h).includes(w)));
const money = (v) => {
  const t = String(v ?? '').replace(/[₹,]|RS\.?|INR/gi, '').replace(/\s*(CR|DR)\s*$/i, '').trim();
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
};
const isoDate = (v) => {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === 'number' && v > 20000) return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  const m = String(v ?? '').trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

/** Find the header row, then read the dated lines under it. */
export function parseBankStatement(aoa) {
  const hi = aoa.findIndex((r) => r.some((c) => ['DATE', 'TXNDATE', 'TRANSACTIONDATE', 'VALUEDATE', 'VALUEDT'].includes(norm(c))));
  if (hi < 0) throw new Error('Header row not found');
  const h = aoa[hi];
  const iDate = pick(h, ['DATE', 'TXNDATE', 'TRANSACTIONDATE', 'VALUEDATE', 'VALUEDT']);
  const iNar = pick(h, ['NARRATION', 'DESCRIPTION', 'DETAILS', 'PARTICULAR', 'PARTICULARS'], ['NARRATION', 'DESCRIPTION']);
  const iChq = pick(h, ['CHQNO', 'CHEQUE', 'CHEQUENO', 'REF', 'REFNO'], ['CHQ', 'CHEQUE', 'REFNO']);
  const iWd = pick(h, ['WITHDRAWAL', 'WITHDRAW', 'DEBIT', 'DR'], ['WITHDRAW', 'DEBIT']);
  const iDep = pick(h, ['DEPOSIT', 'CREDIT', 'CR'], ['DEPOSIT', 'CREDIT']);
  const iAmt = pick(h, ['AMOUNT', 'TXNAMOUNT']);
  const iDrCr = pick(h, ['DRCR']);
  const iBal = pick(h, ['BALANCE', 'CLOSINGBALANCE', 'RUNNINGBALANCE'], ['BALANCE']);
  const out = [];
  for (const r of aoa.slice(hi + 1)) {
    const date = isoDate(r[iDate]);
    if (!date) continue;
    let amount = 0;
    let pay = '';
    if (iWd >= 0 && money(r[iWd]) > 0) { amount = money(r[iWd]); pay = 'P'; }
    else if (iDep >= 0 && money(r[iDep]) > 0) { amount = money(r[iDep]); pay = 'R'; }
    else if (iAmt >= 0 && money(r[iAmt]) > 0) {
      amount = money(r[iAmt]);
      pay = /^D/i.test(String(iDrCr >= 0 ? r[iDrCr] : '')) || /DR\s*$/i.test(String(r[iAmt])) ? 'P' : 'R';
    }
    if (!amount) continue;
    out.push({
      REC_DATE: date, NARRATION: String(iNar >= 0 ? r[iNar] ?? '' : '').trim(), CHQ_NO: String(iChq >= 0 ? r[iChq] ?? '' : '').trim(),
      CHQ_DATE: '', REC_PAY: pay, REC_AMT: amount, CLOSING_BAL: iBal >= 0 ? money(r[iBal]) : 0,
    });
  }
  return out.map((r, i) => ({ ...r, SRNO: i + 1 }));
}

let blueprintPromise;
const loadForms = () => {
  blueprintPromise ||= import('./blueprint/forms.json').then((m) => m.default);
  return blueprintPromise;
};

export default function JsmImportBankScreen({ isOpen, onClose }) {
  const [forms, setForms] = useState(null);
  const [state, setState] = useState({});
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setRows([]);
    setState({});
    loadForms().then(setForms);
  }, [isOpen]);

  const form = forms?.[FORM];
  const grids = useMemo(() => ({
    Dgv1: { columns: COLUMNS, rows, onRowClick: (r) => { if (window.confirm('Delete this row?')) setRows((x) => x.filter((y) => y !== r).map((y, i) => ({ ...y, SRNO: i + 1 }))); } },
  }), [rows]);
  if (!isOpen) return null;

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
      const parsed = parseBankStatement(aoa);
      setRows(parsed);
      if (!parsed.length) toast.info('No dated rows with an amount were found');
    } catch (err) {
      notifyError(err, 'Could not read the statement');
    }
  };

  const save = async () => {
    if (!rows.length) { toast.info('The grid is empty.'); return; }
    const bankName = String(state.txt_Bank || '').trim().toUpperCase();
    const partyName = String(state.txt_pname || '').trim().toUpperCase();
    if (!bankName) { toast.info('Select the bank.'); return; }
    if (!partyName) { toast.info('Select the account.'); return; }
    setBusy(true);
    try {
      const ledgers = await accountingApi.listLedgers({});
      const byName = (n) => ledgers.find((l) => String(l.name || '').trim().toUpperCase() === n);
      const bank = byName(bankName);
      const party = byName(partyName);
      if (!bank) throw new Error(`Bank "${state.txt_Bank}" was not found in the ledgers`);
      if (!party) throw new Error(`Account "${state.txt_pname}" was not found in the ledgers`);
      if (!window.confirm(`Post ${rows.length} voucher(s) against ${party.name} through ${bank.name}?`)) return;
      let done = 0;
      for (const r of rows) {
        const payload = {
          date: r.REC_DATE,
          partyLedgerId: party._id,
          bankLedgerId: bank._id,
          amount: r.REC_AMT,
          narration: r.NARRATION || 'Bank statement import',
          paymentMode: r.CHQ_NO ? 'Cheque' : 'NEFT',
          ...(r.CHQ_NO ? { chequeNo: r.CHQ_NO, chequeDate: r.CHQ_DATE || r.REC_DATE } : { utrNo: r.NARRATION || `IMP-${r.SRNO}` }),
        };
        await (r.REC_PAY === 'R' ? accountingApi.receipts(payload) : accountingApi.payments(payload));
        done += 1;
      }
      toast.success(`Save Complete: ${done} voucher(s)`);
      setRows([]);
    } catch (e) {
      notifyError(e, 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const run = (name) => {
    if (name === 'BtnCancel') { onClose?.(); return; }
    if (name === 'BtnLoad') { fileRef.current?.click(); return; }
    if (name === 'BtnSave') save();
  };

  return (
    <>
      <input ref={fileRef} type="file" accept=".xls,.xlsx" style={{ display: 'none' }} onChange={onFile} />
      <ErpWindowedModal
        isOpen
        onClose={onClose}
        title={form?.title || 'Import Bank Statement'}
        windowId={`jsm-${FORM}`}
        initialSize={form?.width && form?.height ? { w: form.width + 24, h: form.height + 56 } : undefined}
      >
        {({ WindowControls }) => (
          <div className="jsm-window">
            <div className="jsm-titlebar">
              <span>{form?.title || 'Import Bank Statement'}</span>
              <WindowControls />
            </div>
            {form ? <JsmFormDialog form={form} state={state} onChange={setState} onButton={run} busy={busy} grids={grids} /> : <div style={{ padding: 16 }}>Loading…</div>}
          </div>
        )}
      </ErpWindowedModal>
    </>
  );
}
