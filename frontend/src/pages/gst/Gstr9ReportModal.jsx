import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../../components/ui/Modal';
import { stage4Api } from '../../api/stage4.api';
import { notifyError } from '../../utils/notify';
import { toast } from '../../store/useToastStore';
import { downloadJson } from '../../utils/gstExport';
import { exportTableToExcel } from '../../utils/reportExport';
import {
  FileText, Calendar, Download, RefreshCw, FileSpreadsheet,
  CheckCircle2, ShieldCheck, ChevronRight, Layers, DollarSign
} from 'lucide-react';

const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Gstr9ReportModal({ isOpen, onClose }) {
  const currentYear = new Date().getFullYear();
  const defaultFy = `${currentYear - 1}-${String(currentYear).slice(2)}`;
  const [financialYear, setFinancialYear] = useState(defaultFy);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [activeTab, setActiveTab] = useState('table4');

  const fetchGstr9 = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const data = await stage4Api.gstr9({ financialYear });
      setReportData(data?.payload || data || null);
    } catch (err) {
      notifyError(err, 'Failed to generate GSTR-9 Annual Return');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [isOpen, financialYear]);

  useEffect(() => {
    if (isOpen) fetchGstr9();
  }, [isOpen, fetchGstr9]);

  const handleDownloadJson = () => {
    if (!reportData) return toast.info('No return data to export');
    downloadJson(reportData, `GSTR9_${financialYear}_${reportData.gstin || 'Return'}.json`);
    toast.success('GSTR-9 JSON exported for GST portal');
  };

  const handleExportExcel = () => {
    if (!reportData?.monthly?.length) return toast.info('No monthly roll-up data to export');
    const cols = [
      { key: 'period', label: 'Tax Period (Month)' },
      { key: 'taxable', label: 'Taxable Turnover (₹)', render: (r) => r.totals?.taxable || 0 },
      { key: 'cgst', label: 'CGST (₹)', render: (r) => r.totals?.cgst || 0 },
      { key: 'sgst', label: 'SGST (₹)', render: (r) => r.totals?.sgst || 0 },
      { key: 'igst', label: 'IGST (₹)', render: (r) => r.totals?.igst || 0 },
      { key: 'totalTax', label: 'Total Tax (₹)', render: (r) => (r.totals?.cgst || 0) + (r.totals?.sgst || 0) + (r.totals?.igst || 0) },
    ];
    exportTableToExcel(cols, reportData.monthly, `GSTR9_Annual_${financialYear}`);
    toast.success('GSTR-9 Excel exported successfully');
  };

  const table4 = reportData?.table4 || { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
  const monthly = reportData?.monthly || [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="GSTR-9 Annual Return Dashboard" className="max-w-6xl h-[92vh] bg-white rounded-[2.5rem] p-0 border-none shadow-2xl">
      <div className="flex flex-col h-full p-8 space-y-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">GSTR-9 Annual Return</h2>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Annual Consolidated Return • Audit Preparation • Section 44 Compliance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-xl">
              <Calendar size={14} className="text-slate-500" />
              <span className="text-xs font-bold text-slate-500">FY:</span>
              <select
                value={financialYear}
                onChange={(e) => setFinancialYear(e.target.value)}
                className="bg-transparent text-xs font-black text-slate-900 focus:outline-none cursor-pointer"
              >
                <option value="2025-26">2025-26</option>
                <option value="2024-25">2024-25</option>
                <option value="2023-24">2023-24</option>
              </select>
            </div>

            <button
              onClick={handleExportExcel}
              disabled={loading || !reportData}
              className="px-4 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
            >
              <FileSpreadsheet size={14} /> Excel
            </button>
            <button
              onClick={handleDownloadJson}
              disabled={loading || !reportData}
              className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
            >
              <Download size={14} /> Portal JSON
            </button>
            <button
              onClick={fetchGstr9}
              disabled={loading}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
            >
              <RefreshCw className={loading ? 'animate-spin' : ''} size={14} />
            </button>
          </div>
        </div>

        {/* GSTIN & Summary Banner */}
        <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl text-white flex items-center justify-between flex-wrap gap-4 shadow-lg">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-mono font-bold uppercase tracking-wider">
                GSTIN: {reportData?.gstin || 'REGISTERED'}
              </span>
              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded text-[10px] font-bold uppercase tracking-wider">
                FY {financialYear}
              </span>
            </div>
            <h3 className="text-xl font-bold mt-2">Annual Consolidated Turnover</h3>
            <p className="text-xs text-slate-400 mt-0.5">Aggregated from monthly GSTR-1 and GSTR-3B filings</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Taxable Turnover</p>
              <p className="text-2xl font-black text-emerald-400 mt-0.5 tabular-nums">{money(table4.taxable)}</p>
            </div>
            <div className="text-right border-l border-slate-700 pl-6">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Tax Paid</p>
              <p className="text-2xl font-black text-white mt-0.5 tabular-nums">
                {money((table4.cgst || 0) + (table4.sgst || 0) + (table4.igst || 0))}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200 pb-1">
          <button
            onClick={() => setActiveTab('table4')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'table4'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Table 4: Outward Supplies Details
          </button>
          <button
            onClick={() => setActiveTab('monthly')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'monthly'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Monthly Roll-Up (12 Months)
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="animate-spin text-emerald-600" size={28} />
              <span className="font-semibold text-xs">Computing Annual GSTR-9 across 12 periods...</span>
            </div>
          ) : activeTab === 'table4' ? (
            <div className="space-y-4">
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3">Nature of Supplies (Table 4)</th>
                      <th className="px-5 py-3 text-right">Taxable Value (₹)</th>
                      <th className="px-5 py-3 text-right">CGST (₹)</th>
                      <th className="px-5 py-3 text-right">SGST (₹)</th>
                      <th className="px-5 py-3 text-right">IGST (₹)</th>
                      <th className="px-5 py-3 text-right">Total Tax (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50/80">
                      <td className="px-5 py-3.5">
                        <span className="font-bold text-slate-900">4A. Supplies made to registered persons (B2B)</span>
                        <p className="text-[10px] text-slate-400 mt-0.5">Regular taxable supplies to GSTIN registered buyers</p>
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-slate-900 tabular-nums">{money(table4.taxable)}</td>
                      <td className="px-5 py-3.5 text-right text-slate-700 tabular-nums">{money(table4.cgst)}</td>
                      <td className="px-5 py-3.5 text-right text-slate-700 tabular-nums">{money(table4.sgst)}</td>
                      <td className="px-5 py-3.5 text-right text-slate-700 tabular-nums">{money(table4.igst)}</td>
                      <td className="px-5 py-3.5 text-right font-bold text-emerald-600 tabular-nums">
                        {money((table4.cgst || 0) + (table4.sgst || 0) + (table4.igst || 0))}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/80">
                      <td className="px-5 py-3.5">
                        <span className="font-bold text-slate-900">4B. Supplies made to unregistered persons (B2C)</span>
                        <p className="text-[10px] text-slate-400 mt-0.5">Retail supplies to consumers without GSTIN</p>
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-slate-900 tabular-nums">₹0.00</td>
                      <td className="px-5 py-3.5 text-right text-slate-700 tabular-nums">₹0.00</td>
                      <td className="px-5 py-3.5 text-right text-slate-700 tabular-nums">₹0.00</td>
                      <td className="px-5 py-3.5 text-right text-slate-700 tabular-nums">₹0.00</td>
                      <td className="px-5 py-3.5 text-right font-bold text-emerald-600 tabular-nums">₹0.00</td>
                    </tr>
                    <tr className="hover:bg-slate-50/80">
                      <td className="px-5 py-3.5">
                        <span className="font-bold text-slate-900">4C. Zero-rated supplies (Exports)</span>
                        <p className="text-[10px] text-slate-400 mt-0.5">Export on payment of tax or under LUT</p>
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-slate-900 tabular-nums">₹0.00</td>
                      <td className="px-5 py-3.5 text-right text-slate-700 tabular-nums">₹0.00</td>
                      <td className="px-5 py-3.5 text-right text-slate-700 tabular-nums">₹0.00</td>
                      <td className="px-5 py-3.5 text-right text-slate-700 tabular-nums">₹0.00</td>
                      <td className="px-5 py-3.5 text-right font-bold text-emerald-600 tabular-nums">₹0.00</td>
                    </tr>
                    <tr className="bg-slate-50 font-black border-t-2 border-slate-200">
                      <td className="px-5 py-4 text-slate-900 uppercase text-xs tracking-wider">
                        4N. Total Outward Supplies (4A to 4M)
                      </td>
                      <td className="px-5 py-4 text-right text-slate-900 tabular-nums">{money(table4.taxable)}</td>
                      <td className="px-5 py-4 text-right text-slate-900 tabular-nums">{money(table4.cgst)}</td>
                      <td className="px-5 py-4 text-right text-slate-900 tabular-nums">{money(table4.sgst)}</td>
                      <td className="px-5 py-4 text-right text-slate-900 tabular-nums">{money(table4.igst)}</td>
                      <td className="px-5 py-4 text-right text-emerald-700 tabular-nums">
                        {money((table4.cgst || 0) + (table4.sgst || 0) + (table4.igst || 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Period</th>
                    <th className="px-4 py-3 text-right">Taxable (₹)</th>
                    <th className="px-4 py-3 text-right">CGST (₹)</th>
                    <th className="px-4 py-3 text-right">SGST (₹)</th>
                    <th className="px-4 py-3 text-right">IGST (₹)</th>
                    <th className="px-4 py-3 text-right">Total Tax (₹)</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthly.map((m, i) => {
                    const t = m.totals || {};
                    const totalTax = (t.cgst || 0) + (t.sgst || 0) + (t.igst || 0);
                    return (
                      <tr key={i} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">{m.period}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900 tabular-nums">{money(t.taxable)}</td>
                        <td className="px-4 py-3 text-right text-slate-600 tabular-nums">{money(t.cgst)}</td>
                        <td className="px-4 py-3 text-right text-slate-600 tabular-nums">{money(t.sgst)}</td>
                        <td className="px-4 py-3 text-right text-slate-600 tabular-nums">{money(t.igst)}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600 tabular-nums">{money(totalTax)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                            Consolidated
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
