import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../../components/ui/Modal';
import { stage4Api } from '../../api/stage4.api';
import { notifyError } from '../../utils/notify';
import { toast } from '../../store/useToastStore';
import { downloadJson } from '../../utils/gstExport';
import { exportTableToExcel } from '../../utils/reportExport';
import { Calendar, Download, RefreshCw, FileSpreadsheet } from 'lucide-react';

const money = (v) =>
  `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
      {
        key: 'totalTax',
        label: 'Total Tax (₹)',
        render: (r) => (r.totals?.cgst || 0) + (r.totals?.sgst || 0) + (r.totals?.igst || 0),
      },
    ];
    exportTableToExcel(cols, reportData.monthly, `GSTR9_Annual_${financialYear}`);
    toast.success('GSTR-9 Excel exported successfully');
  };

  const table4 = reportData?.table4 || { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
  const table4a = reportData?.table4a || table4;
  const table4b = reportData?.table4b || { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
  const table4c = reportData?.table4c || { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
  const monthly = reportData?.monthly || [];
  const taxTotal = (row) => (row?.cgst || 0) + (row?.sgst || 0) + (row?.igst || 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="GSTR-9 Annual Return"
      className="max-w-6xl w-full h-[min(92vh,900px)] p-0 rounded-2xl"
    >
      <div className="flex flex-col h-full min-h-0 bg-[var(--bg-base)]">
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-card)]">
          <p className="text-[11px] text-[var(--text-muted)]">Annual consolidated return from books</p>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 h-8 px-2 rounded border border-[var(--border)] bg-[var(--bg-base)] text-[11px] font-semibold">
              <Calendar size={14} className="text-[var(--text-muted)]" />
              <span className="text-[var(--text-muted)]">FY</span>
              <select
                value={financialYear}
                onChange={(e) => setFinancialYear(e.target.value)}
                className="bg-transparent outline-none text-[var(--text-primary)]"
              >
                <option value="2025-26">2025-26</option>
                <option value="2024-25">2024-25</option>
                <option value="2023-24">2023-24</option>
              </select>
            </label>
            <button
              type="button"
              onClick={handleDownloadJson}
              disabled={loading || !reportData}
              className="erp-btn erp-btn-secondary h-8 px-3 text-[11px] gap-1"
            >
              <Download size={12} /> JSON
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={loading || !reportData}
              className="erp-btn erp-btn-secondary h-8 px-3 text-[11px] gap-1"
            >
              <FileSpreadsheet size={12} /> Excel
            </button>
            <button
              type="button"
              onClick={fetchGstr9}
              disabled={loading}
              className="erp-btn erp-btn-primary h-8 px-3 text-[11px] gap-1"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-muted)]">
                  GSTIN: {reportData?.gstin || 'REGISTERED'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-muted)]">
                  FY {financialYear}
                </span>
              </div>
              <p className="text-[12px] font-semibold text-[var(--text-primary)] mt-2">Annual consolidated turnover</p>
              <p className="text-[11px] text-[var(--text-muted)]">Aggregated from monthly GSTR-1 / GSTR-3B books</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-[9px] uppercase font-bold text-[var(--text-muted)] tracking-wider">Taxable</p>
                <p className="text-xl font-bold text-[var(--text-primary)] mt-0.5 tabular-nums">{money(table4.taxable)}</p>
              </div>
              <div className="text-right border-l border-[var(--border)] pl-6">
                <p className="text-[9px] uppercase font-bold text-[var(--text-muted)] tracking-wider">Total tax</p>
                <p className="text-xl font-bold text-[var(--text-primary)] mt-0.5 tabular-nums">
                  {money((table4.cgst || 0) + (table4.sgst || 0) + (table4.igst || 0))}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-1 border-b border-[var(--border)]">
            {[
              { id: 'table4', label: 'Table 4 outward' },
              { id: 'monthly', label: 'Monthly roll-up' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-2 text-[11px] font-semibold rounded-t-lg ${
                  activeTab === t.id
                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border)] border-b-[var(--bg-card)] -mb-px'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
              <RefreshCw className="animate-spin" size={22} />
              <span className="font-semibold text-[12px]">Computing annual GSTR-9…</span>
            </div>
          ) : activeTab === 'table4' ? (
            <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--bg-card)]">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-[var(--bg-base)] text-[var(--text-muted)] uppercase text-[9px] tracking-wider">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Nature of supplies</th>
                    <th className="px-3 py-2 font-semibold text-right">Taxable</th>
                    <th className="px-3 py-2 font-semibold text-right">CGST</th>
                    <th className="px-3 py-2 font-semibold text-right">SGST</th>
                    <th className="px-3 py-2 font-semibold text-right">IGST</th>
                    <th className="px-3 py-2 font-semibold text-right">Total tax</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {[
                    { label: '4A. B2B registered', row: table4a },
                    { label: '4B. B2C unregistered', row: table4b },
                    { label: '4C. Zero-rated / exports', row: table4c },
                  ].map((r) => (
                    <tr key={r.label} className="hover:bg-[var(--bg-base)]">
                      <td className="px-3 py-2.5 font-semibold text-[var(--text-primary)]">{r.label}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{money(r.row.taxable)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{money(r.row.cgst)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{money(r.row.sgst)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{money(r.row.igst)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{money(taxTotal(r.row))}</td>
                    </tr>
                  ))}
                  <tr className="bg-[var(--bg-base)] font-semibold">
                    <td className="px-3 py-3">4N. Total outward</td>
                    <td className="px-3 py-3 text-right tabular-nums">{money(table4.taxable)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{money(table4.cgst)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{money(table4.sgst)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{money(table4.igst)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {money((table4.cgst || 0) + (table4.sgst || 0) + (table4.igst || 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--bg-card)]">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-[var(--bg-base)] text-[var(--text-muted)] uppercase text-[9px] tracking-wider">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Period</th>
                    <th className="px-3 py-2 font-semibold text-right">Taxable</th>
                    <th className="px-3 py-2 font-semibold text-right">CGST</th>
                    <th className="px-3 py-2 font-semibold text-right">SGST</th>
                    <th className="px-3 py-2 font-semibold text-right">IGST</th>
                    <th className="px-3 py-2 font-semibold text-right">Total tax</th>
                    <th className="px-3 py-2 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {monthly.map((m, i) => {
                    const t = m.totals || {};
                    const totalTax = (t.cgst || 0) + (t.sgst || 0) + (t.igst || 0);
                    return (
                      <tr key={i} className="hover:bg-[var(--bg-base)]">
                        <td className="px-3 py-2 font-mono font-semibold">{m.period}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(t.taxable)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(t.cgst)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(t.sgst)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(t.igst)}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(totalTax)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase border border-[var(--border)] text-[var(--text-muted)]">
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
