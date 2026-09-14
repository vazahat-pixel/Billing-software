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
    <Modal isOpen={isOpen} onClose={onClose} title="GSTR-2 Inward Supplies (Purchase Register)" className="max-w-7xl h-[92vh] bg-white rounded-[2.5rem] p-0 border-none shadow-2xl">
      <div className="flex flex-col h-full p-8 space-y-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <ShoppingCart size={20} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">GSTR-2 Purchase Register</h2>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Inward Supplies • ITC Verification • Supplier Breakdown</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              disabled={loading || !filteredRows.length}
              className="px-4 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
            >
              <Printer size={14} /> Print
            </button>
            <button
              onClick={handleExportExcel}
              disabled={loading || !filteredRows.length}
              className="px-4 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
            >
              <FileSpreadsheet size={14} /> Excel Export
            </button>
            <button
              onClick={fetchGstr2}
              disabled={loading}
              className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
            >
              {loading ? <RefreshCw className="animate-spin" size={14} /> : <RefreshCw size={14} />}
              Refresh
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-indigo-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-indigo-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Search Supplier / GSTIN</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Type name, GSTIN, invoice..."
                value={partySearch}
                onChange={(e) => setPartySearch(e.target.value)}
                className="w-full px-3 py-2 pl-8 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-indigo-500"
              />
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Registration Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-indigo-500"
            >
              <option value="ALL">All Inward Supplies</option>
              <option value="B2B">B2B (Registered Suppliers)</option>
              <option value="B2BUR">B2BUR (Unregistered Suppliers)</option>
            </select>
          </div>
        </div>

        {/* Stats Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bills</p>
            <p className="text-lg font-black text-slate-900 mt-0.5">{filteredRows.length}</p>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Taxable</p>
            <p className="text-lg font-black text-slate-900 mt-0.5 tabular-nums">{money(totals.taxable)}</p>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">CGST (ITC)</p>
            <p className="text-lg font-black text-slate-900 mt-0.5 tabular-nums">{money(totals.cgst)}</p>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SGST (ITC)</p>
            <p className="text-lg font-black text-slate-900 mt-0.5 tabular-nums">{money(totals.sgst)}</p>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">IGST (ITC)</p>
            <p className="text-lg font-black text-slate-900 mt-0.5 tabular-nums">{money(totals.igst)}</p>
          </div>
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Total Net Amount</p>
            <p className="text-lg font-black text-indigo-700 mt-0.5 tabular-nums">{money(totals.netAmount)}</p>
          </div>
        </div>

        {/* Data Table */}
        <div className="flex-1 border border-slate-200 rounded-2xl overflow-hidden flex flex-col bg-white">
          <div className="overflow-x-auto flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Invoice No</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Supplier Name</th>
                  <th className="px-4 py-3">GSTIN</th>
                  <th className="px-4 py-3 text-right">Taxable (₹)</th>
                  <th className="px-4 py-3 text-right">CGST (₹)</th>
                  <th className="px-4 py-3 text-right">SGST (₹)</th>
                  <th className="px-4 py-3 text-right">IGST (₹)</th>
                  <th className="px-4 py-3 text-right">Total Tax (₹)</th>
                  <th className="px-4 py-3 text-right">Total Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="py-20 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <RefreshCw className="animate-spin text-indigo-600" size={24} />
                        <span className="font-semibold text-xs">Loading GSTR-2 inward transactions...</span>
                      </div>
                    </td>
                  </tr>
                ) : !filteredRows.length ? (
                  <tr>
                    <td colSpan={11} className="py-20 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <ShoppingCart size={32} className="text-slate-300" />
                        <span className="font-semibold text-xs">No purchase transactions found for this period.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-2.5 text-slate-400 font-mono text-[11px]">{i + 1}</td>
                      <td className="px-4 py-2.5 font-bold text-slate-900">{r.invoiceNo || '—'}</td>
                      <td className="px-4 py-2.5 text-slate-600">{dt(r.date)}</td>
                      <td className="px-4 py-2.5 font-semibold text-slate-800">{r.partyName || '—'}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600">
                        {r.gstin ? (
                          <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-medium">{r.gstin}</span>
                        ) : (
                          <span className="text-slate-400 italic">Unregistered</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-900 tabular-nums">{money(r.taxable)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600 tabular-nums">{money(r.cgst)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600 tabular-nums">{money(r.sgst)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600 tabular-nums">{money(r.igst)}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-indigo-600 tabular-nums">{money(r.gstAmount)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-900 tabular-nums">{money(r.netAmount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Totals Row */}
          {!loading && filteredRows.length > 0 && (
            <div className="bg-slate-100 border-t border-slate-200 px-4 py-3 flex items-center justify-between text-xs font-bold text-slate-800">
              <span>Total ({filteredRows.length} purchases)</span>
              <div className="flex items-center gap-6 tabular-nums">
                <span>Taxable: {money(totals.taxable)}</span>
                <span>CGST: {money(totals.cgst)}</span>
                <span>SGST: {money(totals.sgst)}</span>
                <span>IGST: {money(totals.igst)}</span>
                <span className="text-indigo-700">Net: {money(totals.netAmount)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {printCfg && (
        <div style={{ display: 'none' }}>
          <ListPrint
            ref={printRef}
            title={printCfg.title}
            columns={printCfg.columns}
            rows={printCfg.rows}
          />
        </div>
      )}
    </Modal>
  );
}
