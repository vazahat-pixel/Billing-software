import React, { useMemo, useState } from 'react';
import Modal from '../../components/ui/Modal';
import { gstinReportApi } from '../../api/gstinReport.api';
import { notifyError } from '../../utils/notify';
import useStore from '../../store/useStore';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fyStart = (d) => new Date(d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1, 3, 1);
const dmy = (v) => { const t = new Date(v); return Number.isNaN(t.getTime()) ? '' : `${String(t.getDate()).padStart(2, '0')}-${String(t.getMonth() + 1).padStart(2, '0')}-${t.getFullYear()}`; };
const n2 = (v) => (Number(v) || 0).toFixed(2);

const KINDS = {
  gstinSales: { title: 'GSTIN All Sales Reports', fetch: [['SALES BOOK', 'salesDetail']] },
  gstinPurchase: { title: 'GSTIN All Purchase Reports', fetch: [['PURCHASE ACCOUNT', 'purchaseDetail'], ['MILL', 'process'], ['WORK', 'jobwork']] },
  gstinProcess: { title: 'GSTIN All Process Reports', fetch: [['MILL', 'process']] },
  gstinJobwork: { title: 'GSTIN All JobWork Reports', fetch: [['WORK', 'jobwork']] },
  gstinJournal: { title: 'GSTIN All Journal Reports', fetch: [['JOURNAL', 'journal']] },
  gstinExpense: { title: 'GSTIN All Expense Reports', fetch: [['EXPENSE', 'expense']] },
};

const billNo = (r) => r.invoiceNo || r.supplierInvoiceNo || r.jobCardNo || r.challanNo || r.voucherNo || r.noteNo || '';
const flat = (res) => {
  if (!res) return [];
  if (Array.isArray(res.rows)) return res.rows;
  return (res.groups || []).flatMap((g) => g.rows || (g.subGroups || []).flatMap((s) => s.rows || []));
};
const COLS = ['BILL.NO', 'BILL.DT', 'PARTY', 'TAXABLE.AMT', 'SGST.AMT', 'CGST.AMT', 'IGST.AMT', 'RCM', 'BILL.AMT'];
const sumRows = (rows) => rows.reduce((a, r) => ({ t: a.t + (r.taxableAmount || 0), s: a.s + (r.sgst || 0), c: a.c + (r.cgst || 0), i: a.i + (r.igst || 0), b: a.b + (r.netAmount || 0) }), { t: 0, s: 0, c: 0, i: 0, b: 0 });

/** JSM's "GSTIN All ... Reports": dialog (From / To, GroupBy) then a REGISTER > GSTIN_NO grouped grid with totals. */
const SOURCE_TYPE = { salesDetail: 'sales', purchaseDetail: 'purchase', process: 'job', jobwork: 'job' };

const GstinJsmReport = ({ isOpen, onClose, kind = 'gstinPurchase', onOpenRow }) => {
  const cfg = KINDS[kind] || KINDS.gstinPurchase;
  const today = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(() => iso(fyStart(today)));
  const [to, setTo] = useState(() => iso(today));
  const [summary, setSummary] = useState(false);
  const [registers, setRegisters] = useState(null);
  const [loading, setLoading] = useState(false);
  const books = useStore((st) => st.books) || [];
  const bookName = (id) => {
    const b = books.find((x) => [x._id, x.id, x.code, x.bookCd, x.name].some((k) => k != null && String(k) === String(id)));
    return b ? String(b.name || b.bookName || '').toUpperCase() : '';
  };

  const run = async () => {
    setLoading(true);
    try {
      const out = [];
      for (const [reg, fn] of cfg.fetch) {
        const rows = flat(await gstinReportApi[fn]({ fromDate: from, toDate: to })).map((r) => ({ ...r, _sourceType: SOURCE_TYPE[fn] }));
        // purchase / sales rows carry their own book; keep them under that register name when present
        const by = new Map();
        rows.forEach((r) => {
          const key = (typeof r.bookName === 'string' && r.bookName) || bookName(r.bookId) || reg;
          if (!by.has(key)) by.set(key, []);
          by.get(key).push(r);
        });
        by.forEach((list, key) => out.push({ name: key, rows: list.sort((a, b) => new Date(a.date) - new Date(b.date)) }));
      }
      setRegisters(out);
    } catch (err) { notifyError(err, 'Could not load the report'); } finally { setLoading(false); }
  };

  const grand = sumRows((registers || []).flatMap((r) => r.rows));
  const cell = 'px-1.5 py-[1px] whitespace-nowrap border-r border-[var(--border)]';
  const num = `${cell} text-right tabular-nums`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={cfg.title} className={registers ? 'max-w-6xl w-full h-[min(90vh,820px)] p-0' : 'max-w-xl w-full p-0'}>
      {!registers ? (
        <div className="p-3 bg-[var(--bg-base)] flex flex-col gap-3 text-[12px]">
          <div className="flex items-center gap-2">
            <span className="font-semibold">From</span>
            <input type="date" className="erp-input h-7" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="font-semibold">To</span>
            <input type="date" className="erp-input h-7" value={to} onChange={(e) => setTo(e.target.value)} />
            <span className="ml-auto font-semibold">Company Wise</span>
            <select className="erp-input h-7" disabled><option>Current</option></select>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">Printout Pattern</span>
            <select className="erp-input h-7" disabled><option>1-Continue</option></select>
            <span className="font-semibold ml-3">GroupBy 1</span>
            <select className="erp-input h-7" disabled><option>Register</option></select>
            <span className="font-semibold">GroupBy 2</span>
            <select className="erp-input h-7" disabled><option>Gstin_No</option></select>
          </div>
          <label className="flex items-center gap-1"><input type="checkbox" checked={summary} onChange={(e) => setSummary(e.target.checked)} /> Summary Reports</label>
          <div className="flex justify-end gap-2">
            <button type="button" className="erp-btn erp-btn-primary h-7 px-4 text-[11px]" disabled={loading} onClick={run}>{loading ? 'Loading…' : 'Ok'}</button>
            <button type="button" className="erp-btn erp-btn-secondary h-7 px-4 text-[11px]" onClick={onClose}>Exit</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full min-h-0 bg-white text-black">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead className="sticky top-0">
                <tr className="bg-[#9b1c1c] text-white">{COLS.map((c) => <th key={c} className={`${cell} text-left font-semibold`}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {registers.map((reg) => {
                  const byGstin = new Map();
                  reg.rows.forEach((r) => { const k = r.gstin || ''; if (!byGstin.has(k)) byGstin.set(k, []); byGstin.get(k).push(r); });
                  const regTot = sumRows(reg.rows);
                  return (
                    <React.Fragment key={reg.name}>
                      <tr className="bg-[#fbe2b8] font-bold"><td colSpan={9} className={cell}>REGISTER - {reg.name}</td></tr>
                      {[...byGstin.entries()].map(([g, list]) => {
                        const gt = sumRows(list);
                        return (
                          <React.Fragment key={g || 'none'}>
                            <tr className="bg-[#eef3d6]"><td colSpan={9} className={cell}>GSTIN_NO - {g}</td></tr>
                            {!summary && list.map((r, i) => (
                              <tr
                                key={`${r._id || i}-${i}`}
                                className={`hover:bg-[#fff6dd]${onOpenRow && r._id && r._sourceType ? ' cursor-pointer' : ''}`}
                                onClick={onOpenRow && r._id && r._sourceType ? () => onOpenRow({ id: r._id, sourceType: r._sourceType }) : undefined}
                              >
                                <td className={cell}>{billNo(r)}</td><td className={cell}>{dmy(r.date)}</td><td className={cell}>{r.partyName}</td>
                                <td className={num}>{n2(r.taxableAmount)}</td><td className={num}>{n2(r.sgst)}</td><td className={num}>{n2(r.cgst)}</td><td className={num}>{n2(r.igst)}</td>
                                <td className={cell}>{r.reverseCharge === 'Y' ? 'Yes' : 'No'}</td><td className={num}>{n2(r.netAmount)}</td>
                              </tr>
                            ))}
                            <tr className="font-bold"><td className={cell}>GSTIN_NO-TOTAL</td><td className={cell} /><td className={cell} />
                              <td className={num}>{n2(gt.t)}</td><td className={num}>{n2(gt.s)}</td><td className={num}>{n2(gt.c)}</td><td className={num}>{n2(gt.i)}</td><td className={cell} /><td className={num}>{n2(gt.b)}</td></tr>
                          </React.Fragment>
                        );
                      })}
                      <tr className="font-bold"><td className={cell}>REGISTER-TOTAL</td><td className={cell} /><td className={cell} />
                        <td className={num}>{n2(regTot.t)}</td><td className={num}>{n2(regTot.s)}</td><td className={num}>{n2(regTot.c)}</td><td className={num}>{n2(regTot.i)}</td><td className={cell} /><td className={num}>{n2(regTot.b)}</td></tr>
                    </React.Fragment>
                  );
                })}
                <tr className="font-bold bg-[#f1f1f1]"><td className={cell}>GRAND TOTAL</td><td className={cell} /><td className={cell} />
                  <td className={num}>{n2(grand.t)}</td><td className={num}>{n2(grand.s)}</td><td className={num}>{n2(grand.c)}</td><td className={num}>{n2(grand.i)}</td><td className={cell} /><td className={num}>{n2(grand.b)}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="shrink-0 flex justify-end gap-2 p-2 border-t border-[var(--border)] bg-[var(--bg-base)]">
            <button type="button" className="erp-btn erp-btn-secondary h-7 px-4 text-[11px]" onClick={() => window.print()}>Print</button>
            <button type="button" className="erp-btn erp-btn-secondary h-7 px-4 text-[11px]" onClick={() => setRegisters(null)}>Back</button>
            <button type="button" className="erp-btn erp-btn-secondary h-7 px-4 text-[11px]" onClick={onClose}>Exit</button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default GstinJsmReport;
