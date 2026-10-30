import React, { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../../components/ui/Modal';
import { stage4Api } from '../../api/stage4.api';
import useConfigStore from '../../store/useConfigStore';
import { notifyError } from '../../utils/notify';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dmy = (d) => { const t = new Date(d); return `${String(t.getDate()).padStart(2, '0')}/${String(t.getMonth() + 1).padStart(2, '0')}/${t.getFullYear()}`; };
const fyStart = (d) => new Date(d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1, 3, 1);
const num = (n) => (Number(n) || 0).toFixed(2);
const W = { name: 34, c: 13 };
const pad = (s, n) => String(s).slice(0, n).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);
const row = (name, a, b, c, d) => `${pad(name, W.name)}${[a, b, c, d].map((v) => (v === undefined || v === '' ? ' '.repeat(W.c) : rpad(typeof v === 'number' ? num(v) : v, W.c))).join('')}`;
const line = '-'.repeat(W.name + W.c * 4);

/** The GSTR-3B text return as JSM prints it (BOOK / TAXABLE VALUE / IGST / CGST / SGST), built from the books. */
export function build3bText({ company, gstin, from, to, kind, data }) {
  const j = data?.payload?.jsm;
  if (!j) return 'No data for the period.';
  const out = [];
  const t4 = (x) => [x.taxable, x.igst, x.cgst, x.sgst];
  // JSM lists only the bills that carry GST in the purchase section
  const taxed = (s) => ({ ...s, taxable: s.taxedTaxable ?? s.taxable });
  const sales = j.sales;
  const payable = {
    taxable: sales.taxable - j.salesReturn.taxable - j.salesCredit.taxable + j.salesDebit.taxable,
    igst: sales.igst - j.salesReturn.igst - j.salesCredit.igst + j.salesDebit.igst,
    cgst: sales.cgst - j.salesReturn.cgst - j.salesCredit.cgst + j.salesDebit.cgst,
    sgst: sales.sgst - j.salesReturn.sgst - j.salesCredit.sgst + j.salesDebit.sgst,
  };
  out.push(`${pad(company, 60)}PAGE NO. : 1`);
  out.push(`${kind} DATE : FROM ${dmy(from)}  TO  ${dmy(to)}`);
  out.push(`GSTIN : ${gstin || ''}`);
  out.push(`${' '.repeat(34)}GSTR-3B MONTHLY RETURN`);
  out.push(line);
  out.push(row('BOOK', 'TAXABLE VALUE', 'IGST', 'CGST', 'SGST'));
  out.push(row('', '', 'PAYABLE', 'PAYABLE', 'PAYABLE'));
  out.push(line);
  out.push(row('SALES (Outward taxable supplies)', ...t4(sales)));
  out.push(line);
  out.push(row('TOTAL SALES :', ...t4(sales)));
  out.push(line);
  out.push(row('SALES RETURN ( - )', ...t4(j.salesReturn)));
  out.push(row('CREDIT NOTE ( - )', ...t4(j.salesCredit)));
  out.push(row('DEBIT NOTE ( + )', ...t4(j.salesDebit)));
  out.push(line);
  out.push(row('TOTAL PAYABLE', ...t4(payable)));
  out.push(line);
  out.push('RCM PURCHASE BOOK');
  out.push(row('RCM PURCHASE BOOK ( TOTAL )', ...t4(j.rcm)));
  out.push(line);
  out.push('PURCHASE (ALL)');
  out.push(row('BOOK', 'TAXABLE VALUE', 'IGST', 'CGST', 'SGST'));
  out.push(row('', '', 'RECEIVABLE', 'RECEIVABLE', 'RECEIVABLE'));
  const names = { Mill: 'MILL', Purchase: 'PURCHASE ACCOUNT', JobWork: 'WORK', Expense: 'EXPENSE' };
  const src = (data.payload.itcBySource || []).map(taxed).filter((s) => s.taxable || s.igst || s.cgst || s.sgst);
  src.forEach((s) => out.push(row(names[s.source] || s.source, ...t4(s))));
  const pur = src.reduce((a, s) => ({ taxable: a.taxable + s.taxable, igst: a.igst + s.igst, cgst: a.cgst + s.cgst, sgst: a.sgst + s.sgst }), { taxable: 0, igst: 0, cgst: 0, sgst: 0 });
  out.push(line);
  out.push(row('TOTAL PURCHASE :', ...t4(pur)));
  out.push(line);
  out.push(row('DEBIT NOTE ( - )', ...t4(j.purchaseDebit)));
  out.push(row('CREDIT NOTE ( + )', ...t4(j.purchaseCredit)));
  out.push(line);
  const rec = {
    taxable: pur.taxable - j.purchaseDebit.taxable + j.purchaseCredit.taxable,
    igst: pur.igst - j.purchaseDebit.igst + j.purchaseCredit.igst,
    cgst: pur.cgst - j.purchaseDebit.cgst + j.purchaseCredit.cgst,
    sgst: pur.sgst - j.purchaseDebit.sgst + j.purchaseCredit.sgst,
  };
  out.push(row('TOTAL RECEIVABLE', ...t4(rec)));
  out.push(line);
  const net = { taxable: payable.taxable - rec.taxable, igst: payable.igst + j.rcm.igst - rec.igst, cgst: payable.cgst + j.rcm.cgst - rec.cgst, sgst: payable.sgst + j.rcm.sgst - rec.sgst };
  out.push(row('NET PAYBLE/RECEIVABLE :-', net.taxable, net.igst, net.cgst, net.sgst));
  out.push(line);
  out.push(`BALANCE :- ${num(-(net.igst + net.cgst + net.sgst))}`);
  return out.join('\n');
}

/** JSM's "GSTR-3B MONTHLY RETURN" window: type, From/To, With Rcm, Excel / Mail / Screen / Print / Exit. */
const Gstr3bJsmReport = ({ isOpen, onClose }) => {
  const today = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(() => iso(fyStart(today)));
  const [to, setTo] = useState(() => iso(today));
  const [kind, setKind] = useState('Regular');
  const [withRcm, setWithRcm] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const company = useConfigStore((s) => s.companySettings?.legalName || s.company?.name || '');
  const gstin = useConfigStore((s) => s.companySettings?.gstin || '');
  const pre = useRef(null);

  useEffect(() => { if (!isOpen) setText(''); }, [isOpen]);

  const run = async () => {
    setLoading(true);
    try {
      const data = await stage4Api.gstr3b({ period: from.slice(0, 7), from, to });
      setText(build3bText({ company: String(company).toUpperCase(), gstin, from, to, kind, data }));
    } catch (err) { notifyError(err, 'Could not load GSTR-3B'); } finally { setLoading(false); }
  };
  const print = () => {
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.write(`<pre style="font:11px 'Courier New',monospace">${text.replace(/</g, '&lt;')}</pre>`);
    w.document.close(); w.focus(); w.print();
  };
  const excel = () => {
    const csv = text.split('\n').filter((l) => !/^-+$/.test(l)).map((l) => `"${l.replace(/"/g, '""')}"`).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `GSTR3B_${from}_${to}.csv`; a.click();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="GSTR-3B MONTHLY RETURN" className="max-w-4xl w-full p-0">
      <div className="p-3 bg-[var(--bg-base)] flex flex-col gap-2 min-h-[320px]">
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <select className="erp-input h-7" value="None" disabled aria-label="Filter"><option>None</option></select>
          <select className="erp-input h-7" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Return type">
            <option>Regular</option><option>Composition</option>
          </select>
          <label className="font-semibold text-amber-600">DATE</label>
          <input type="date" className="erp-input h-7" value={from} onChange={(e) => setFrom(e.target.value)} />
          <label className="font-semibold text-amber-600">TO</label>
          <input type="date" className="erp-input h-7" value={to} onChange={(e) => setTo(e.target.value)} />
          <label className="flex items-center gap-1"><input type="checkbox" checked={withRcm} onChange={(e) => setWithRcm(e.target.checked)} /> With Rcm</label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="erp-btn erp-btn-secondary h-7 px-3 text-[11px]" disabled={!text} onClick={excel}>Excel</button>
          <button type="button" className="erp-btn erp-btn-secondary h-7 px-3 text-[11px]" disabled={!text} onClick={() => { window.location.href = `mailto:?subject=GSTR-3B&body=${encodeURIComponent(text.slice(0, 1800))}`; }}>Mail</button>
          <button type="button" className="erp-btn erp-btn-primary h-7 px-3 text-[11px]" disabled={loading} onClick={run}>{loading ? 'Loading…' : 'Screen'}</button>
          <button type="button" className="erp-btn erp-btn-secondary h-7 px-3 text-[11px]" disabled={!text} onClick={print}>Print</button>
          <button type="button" className="erp-btn erp-btn-secondary h-7 px-3 text-[11px]" onClick={onClose}>Exit</button>
        </div>
        {text && (
          <pre ref={pre} className="flex-1 overflow-auto bg-white text-black border border-[var(--border)] p-3 text-[11px] leading-[1.35]" style={{ fontFamily: "'Courier New', ui-monospace, monospace" }}>{text}</pre>
        )}
      </div>
    </Modal>
  );
};

export default Gstr3bJsmReport;
