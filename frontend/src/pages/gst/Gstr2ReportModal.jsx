import React, { useState, useEffect, useCallback, useRef } from 'react';
import Modal from '../../components/ui/Modal';
import { gstApi } from '../../api/gst.api';
import { notifyError } from '../../utils/notify';
import { toast } from '../../store/useToastStore';
import { exportTableToExcel } from '../../utils/reportExport';
import ListPrint from '../../components/print/ListPrint';
import {
  ShoppingCart, Calendar, Download, Printer, FileSpreadsheet,
  Search, RefreshCw, Filter, CheckCircle2, AlertCircle, Eye
} from 'lucide-react';

const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dt = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '');
const firstOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };
const lastOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10); };

export default function Gstr2ReportModal({ isOpen, onClose }) {
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(lastOfMonth);
  const [partySearch, setPartySearch] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // ALL, B2B, B2BUR
  const [loading, setLoading] = useState(false);
  const [purchases, setPurchases] = useState([]);
  const printRef = useRef(null);
  const [printCfg, setPrintCfg] = useState(null);

  const fetchGstr2 = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const data = await gstApi.gstr2({ startDate: fromDate, endDate: toDate });
      setPurchases(Array.isArray(data) ? data : data?.purchases || []);
    } catch (err) {
      notifyError(err, 'Failed to fetch GSTR-2 purchase data');
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  }, [isOpen, fromDate, toDate]);

  useEffect(() => {
    if (isOpen) fetchGstr2();
  }, [isOpen, fetchGstr2]);

  const filteredRows = purchases.filter((p) => {
    const matchesParty = !partySearch || 
      (p.partyName || '').toLowerCase().includes(partySearch.toLowerCase()) ||
      (p.gstin || '').toLowerCase().includes(partySearch.toLowerCase()) ||
      (p.invoiceNo || '').toLowerCase().includes(partySearch.toLowerCase());

    const isB2B = Boolean(p.gstin && p.gstin.trim().length === 15);
    if (filterType === 'B2B' && !isB2B) return false;
    if (filterType === 'B2BUR' && isB2B) return false;

    return matchesParty;
  });

  const totals = filteredRows.reduce(
    (acc, r) => {
      acc.taxable += Number(r.taxable || 0);
      acc.cgst += Number(r.cgst || 0);
      acc.sgst += Number(r.sgst || 0);
      acc.igst += Number(r.igst || 0);
      acc.gstAmount += Number(r.gstAmount || 0);
      acc.netAmount += Number(r.netAmount || 0);
      return acc;
    },
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, gstAmount: 0, netAmount: 0 }
  );

  const handleExportExcel = () => {
    if (!filteredRows.length) return toast.info('No data to export');
    const cols = [
      { key: 'invoiceNo', label: 'Invoice No' },
      { key: 'date', label: 'Invoice Date', render: (r) => dt(r.date) },
      { key: 'partyName', label: 'Supplier Name' },
      { key: 'gstin', label: 'Supplier GSTIN' },
      { key: 'taxable', label: 'Taxable Amount' },
      { key: 'cgst', label: 'CGST' },
      { key: 'sgst', label: 'SGST' },
      { key: 'igst', label: 'IGST' },
      { key: 'gstAmount', label: 'Total Tax' },
      { key: 'netAmount', label: 'Invoice Value' },
    ];
    exportTableToExcel(cols, filteredRows, `GSTR2_${fromDate}_to_${toDate}`);
    toast.success('GSTR-2 Excel exported successfully');
  };

  const handlePrint = () => {
    if (!filteredRows.length) return toast.info('No data to print');
    setPrintCfg({
      title: `GSTR-2 Inward Supplies (${fromDate} to ${toDate})`,
      columns: [
        { key: 'invoiceNo', label: 'Invoice No' },
        { key: 'date', label: 'Date', render: (r) => dt(r.date) },
        { key: 'partyName', label: 'Supplier' },
        { key: 'gstin', label: 'GSTIN' },
        { key: 'taxable', label: 'Taxable (₹)', align: 'right', render: (r) => money(r.taxable) },
        { key: 'cgst', label: 'CGST (₹)', align: 'right', render: (r) => money(r.cgst) },
        { key: 'sgst', label: 'SGST (₹)', align: 'right', render: (r) => money(r.sgst) },
        { key: 'igst', label: 'IGST (₹)', align: 'right', render: (r) => money(r.igst) },
        { key: 'netAmount', label: 'Total (₹)', align: 'right', render: (r) => money(r.netAmount) },
      ],
      rows: filteredRows,
    });
    setTimeout(() => {
      if (printRef.current?.triggerPrint) printRef.current.triggerPrint();
    }, 150);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="GSTR-2 Inward Supplies" className="max-w-7xl w-full h-[min(92vh,900px)] p-0 rounded-2xl">
      <div className="flex flex-col h-full min-h-0 bg-[var(--bg-base)]">
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-card)]">
          <p className="text-[11px] text-[var(--text-muted)]">Purchase register · ITC verification</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handlePrint} disabled={loading || !filteredRows.length} className="erp-btn erp-btn-secondary h-8 px-3 text-[11px] gap-1">
              <Printer size={12} /> Print
            </button>
            <button type="button" onClick={handleExportExcel} disabled={loading || !filteredRows.length} className="erp-btn erp-btn-secondary h-8 px-3 text-[11px] gap-1">
              <FileSpreadsheet size={12} /> Excel
            </button>
            <button type="button" onClick={fetchGstr2} disabled={loading} className="erp-btn erp-btn-primary h-8 px-3 text-[11px] gap-1">
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
            <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              From date
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 px-2 rounded border border-[var(--border)] bg-[var(--bg-base)] text-[12px] font-medium text-[var(--text-primary)]" />
            </label>
            <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              To date
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 px-2 rounded border border-[var(--border)] bg-[var(--bg-base)] text-[12px] font-medium text-[var(--text-primary)]" />
            </label>
            <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Search
              <div className="relative">
                <Search size={12} className="absolute left-2 top-2.5 text-[var(--text-muted)]" />
                <input type="text" placeholder="Supplier, GSTIN, invoice" value={partySearch} onChange={(e) => setPartySearch(e.target.value)} className="w-full h-8 pl-7 pr-2 rounded border border-[var(--border)] bg-[var(--bg-base)] text-[12px] font-medium text-[var(--text-primary)]" />
              </div>
            </label>
            <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Type
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="h-8 px-2 rounded border border-[var(--border)] bg-[var(--bg-base)] text-[12px] font-medium text-[var(--text-primary)]">
                <option value="ALL">All inward</option>
                <option value="B2B">B2B registered</option>
                <option value="B2BUR">B2BUR unregistered</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            {[
              { label: 'Bills', val: filteredRows.length },
              { label: 'Taxable', val: money(totals.taxable) },
              { label: 'CGST', val: money(totals.cgst) },
              { label: 'SGST', val: money(totals.sgst) },
              { label: 'IGST', val: money(totals.igst) },
              { label: 'Net', val: money(totals.netAmount) },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{s.label}</p>
                <p className="text-[13px] font-bold tabular-nums text-[var(--text-primary)] mt-1">{s.val}</p>
              </div>
            ))}
          </div>

          <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--bg-card)]">
            <div className="overflow-x-auto max-h-[min(48vh,480px)] overflow-y-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 z-10 bg-[var(--bg-base)] text-[var(--text-muted)] uppercase text-[9px] tracking-wider">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Invoice</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Supplier</th>
                    <th className="px-3 py-2">GSTIN</th>
                    <th className="px-3 py-2 text-right">Taxable</th>
                    <th className="px-3 py-2 text-right">CGST</th>
                    <th className="px-3 py-2 text-right">SGST</th>
                    <th className="px-3 py-2 text-right">IGST</th>
                    <th className="px-3 py-2 text-right">Tax</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {loading ? (
                    <tr><td colSpan={11} className="py-12 text-center text-[var(--text-muted)]">Loading…</td></tr>
                  ) : !filteredRows.length ? (
                    <tr><td colSpan={11} className="py-12 text-center text-[var(--text-muted)]">No purchases for this period.</td></tr>
                  ) : filteredRows.map((r, i) => (
                    <tr key={i} className="hover:bg-[var(--bg-base)]">
                      <td className="px-3 py-2 text-[var(--text-muted)]">{i + 1}</td>
                      <td className="px-3 py-2 font-semibold">{r.invoiceNo || '—'}</td>
                      <td className="px-3 py-2">{dt(r.date)}</td>
                      <td className="px-3 py-2">{r.partyName || '—'}</td>
                      <td className="px-3 py-2 font-mono text-[10px]">{r.gstin || 'Unregistered'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(r.taxable)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(r.cgst)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(r.sgst)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(r.igst)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{money(r.gstAmount)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{money(r.netAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && filteredRows.length > 0 && (
              <div className="border-t border-[var(--border)] px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold bg-[var(--bg-base)] text-[var(--text-primary)]">
                <span>Total ({filteredRows.length})</span>
                <div className="flex flex-wrap gap-4 tabular-nums text-[var(--text-muted)]">
                  <span>Taxable {money(totals.taxable)}</span>
                  <span>CGST {money(totals.cgst)}</span>
                  <span>SGST {money(totals.sgst)}</span>
                  <span>IGST {money(totals.igst)}</span>
                  <span className="text-[var(--text-primary)]">Net {money(totals.netAmount)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {printCfg && (
        <div style={{ display: 'none' }}>
          <ListPrint ref={printRef} title={printCfg.title} columns={printCfg.columns} rows={printCfg.rows} />
        </div>
      )}
    </Modal>
  );
}
