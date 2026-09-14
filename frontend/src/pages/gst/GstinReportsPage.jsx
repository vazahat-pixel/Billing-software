import React, { useState, useCallback, useRef, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import ReportControlPanel from '../../components/reports/ReportControlPanel';
import { gstinReportApi } from '../../api/gstinReport.api';
import { notifyError } from '../../utils/notify';
import { toast } from '../../store/useToastStore';
import { exportTableToExcel } from '../../utils/reportExport';
import ListPrint from '../../components/print/ListPrint';
import {
  FileText, ShoppingCart, Factory, Wrench, BookOpen, Receipt,
  AlertTriangle, CheckCircle2, XCircle, ChevronRight, Download,
  Printer, FileSpreadsheet, ArrowLeft, Shield, RefreshCw, Search,
} from 'lucide-react';

const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dt = (d) => d ? new Date(d).toLocaleDateString('en-IN') : '';
const firstOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };
const lastOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10); };

const SECTIONS = [
  { id: 'sales', label: 'GSTIN Sales', icon: FileText, color: '#3b82f6' },
  { id: 'purchase', label: 'GSTIN Purchase', icon: ShoppingCart, color: '#8b5cf6' },
  { id: 'process', label: 'GSTIN Process', icon: Factory, color: '#f59e0b' },
  { id: 'jobwork', label: 'GSTIN JobWork', icon: Wrench, color: '#10b981' },
  { id: 'journal', label: 'GSTIN Journal', icon: BookOpen, color: '#6366f1' },
  { id: 'expense', label: 'GSTIN Expense', icon: Receipt, color: '#ef4444' },
  { id: 'gstr1errors', label: 'GSTR-1 Errors', icon: AlertTriangle, color: '#f97316' },
  { id: 'gstr3berrors', label: 'GSTR-3B Errors', icon: Shield, color: '#dc2626' },
  { id: 'itc04', label: 'ITC-04', icon: Wrench, color: '#0891b2' },
  { id: 'reconciliation', label: 'Reconciliation', icon: RefreshCw, color: '#059669' },
];

const SALES_TABS = [
  { id: 'summary', label: 'Sales Summary' },
  { id: 'detail', label: 'Sales Detail' },
  { id: 'returnSummary', label: 'Return Summary' },
  { id: 'returnDetail', label: 'Return Detail' },
];

const PURCHASE_TABS = [
  { id: 'summary', label: 'Purchase Summary' },
  { id: 'detail', label: 'Purchase Detail' },
  { id: 'returnSummary', label: 'Return Summary' },
  { id: 'returnDetail', label: 'Return Detail' },
];

const DETAIL_COLUMNS = [
  { key: 'invoiceNo', label: 'Invoice No', align: 'left' },
  { key: 'date', label: 'Date', align: 'left', render: (r) => dt(r.date) },
  { key: 'partyName', label: 'Party', align: 'left' },
  { key: 'gstin', label: 'GSTIN', align: 'left' },
  { key: 'stateName', label: 'State', align: 'left' },
  { key: 'gstRate', label: 'Rate%', align: 'right', render: (r) => `${r.gstRate || 0}%` },
  { key: 'taxableAmount', label: 'Taxable', align: 'right', render: (r) => money(r.taxableAmount) },
  { key: 'cgst', label: 'CGST', align: 'right', render: (r) => money(r.cgst) },
  { key: 'sgst', label: 'SGST', align: 'right', render: (r) => money(r.sgst) },
  { key: 'igst', label: 'IGST', align: 'right', render: (r) => money(r.igst) },
  { key: 'cess', label: 'Cess', align: 'right', render: (r) => money(r.cess) },
  { key: 'netAmount', label: 'Net Amount', align: 'right', render: (r) => money(r.netAmount) },
];

const PROCESS_COLUMNS = [
  { key: 'jobCardNo', label: 'Job Card', align: 'left' },
  { key: 'date', label: 'Date', align: 'left', render: (r) => dt(r.date) },
  { key: 'partyName', label: 'Worker', align: 'left' },
  { key: 'gstin', label: 'GSTIN', align: 'left' },
  { key: 'processType', label: 'Process', align: 'left' },
  { key: 'issueQty', label: 'Issue Qty', align: 'right' },
  { key: 'gstRate', label: 'Rate%', align: 'right', render: (r) => `${r.gstRate || 0}%` },
  { key: 'taxableAmount', label: 'Taxable', align: 'right', render: (r) => money(r.taxableAmount) },
  { key: 'cgst', label: 'CGST', align: 'right', render: (r) => money(r.cgst) },
  { key: 'sgst', label: 'SGST', align: 'right', render: (r) => money(r.sgst) },
  { key: 'igst', label: 'IGST', align: 'right', render: (r) => money(r.igst) },
  { key: 'netAmount', label: 'Net Amount', align: 'right', render: (r) => money(r.netAmount) },
];

const JOBWORK_COLUMNS = [
  { key: 'jobCardNo', label: 'Job Card', align: 'left' },
  { key: 'date', label: 'Issue Date', align: 'left', render: (r) => dt(r.date) },
  { key: 'partyName', label: 'Worker', align: 'left' },
  { key: 'gstin', label: 'GSTIN', align: 'left' },
  { key: 'processType', label: 'Process', align: 'left' },
  { key: 'issuePcs', label: 'Pcs', align: 'right' },
  { key: 'issueQty', label: 'Issue Qty', align: 'right' },
  { key: 'receivedQty', label: 'Recd Qty', align: 'right' },
  { key: 'status', label: 'Status', align: 'center' },
  { key: 'taxableAmount', label: 'Charges', align: 'right', render: (r) => money(r.taxableAmount) },
  { key: 'gstAmount', label: 'GST', align: 'right', render: (r) => money(r.gstAmount) },
  { key: 'netAmount', label: 'Total', align: 'right', render: (r) => money(r.netAmount) },
];

const JOURNAL_COLUMNS = [
  { key: 'entryNo', label: 'Voucher No', align: 'left' },
  { key: 'date', label: 'Date', align: 'left', render: (r) => dt(r.date) },
  { key: 'partyName', label: 'Account', align: 'left' },
  { key: 'narration', label: 'Narration', align: 'left' },
  { key: 'gstRate', label: 'Rate%', align: 'right', render: (r) => `${r.gstRate || 0}%` },
  { key: 'taxableAmount', label: 'Taxable', align: 'right', render: (r) => money(r.taxableAmount) },
  { key: 'cgst', label: 'CGST', align: 'right', render: (r) => money(r.cgst) },
  { key: 'sgst', label: 'SGST', align: 'right', render: (r) => money(r.sgst) },
  { key: 'igst', label: 'IGST', align: 'right', render: (r) => money(r.igst) },
  { key: 'netAmount', label: 'Total', align: 'right', render: (r) => money(r.netAmount) },
];

const ITC04_COLUMNS = [
  { key: 'jobCardNo', label: 'Job Card', align: 'left' },
  { key: 'issueDate', label: 'Issue Date', align: 'left', render: (r) => dt(r.issueDate) },
  { key: 'receiveDate', label: 'Receive Date', align: 'left', render: (r) => dt(r.receiveDate) },
  { key: 'workerName', label: 'Job Worker', align: 'left' },
  { key: 'workerGstin', label: 'Worker GSTIN', align: 'left' },
  { key: 'itemName', label: 'Item', align: 'left' },
  { key: 'hsnCode', label: 'HSN', align: 'left' },
  { key: 'issueQty', label: 'Issue Qty', align: 'right' },
  { key: 'receivedQty', label: 'Recd Qty', align: 'right' },
  { key: 'pendingQty', label: 'Pending', align: 'right' },
  { key: 'wastage', label: 'Wastage', align: 'right' },
  { key: 'status', label: 'Status', align: 'center' },
];

const SUMMARY_COLUMNS = [
  { key: 'groupKey', label: 'Group / Particulars', align: 'left' },
  { key: 'count', label: 'Vouchers', align: 'right' },
  { key: 'taxableAmount', label: 'Taxable (₹)', align: 'right', render: (r) => money(r.taxableAmount) },
  { key: 'cgst', label: 'CGST (₹)', align: 'right', render: (r) => money(r.cgst) },
  { key: 'sgst', label: 'SGST (₹)', align: 'right', render: (r) => money(r.sgst) },
  { key: 'igst', label: 'IGST (₹)', align: 'right', render: (r) => money(r.igst) },
  { key: 'cess', label: 'Cess (₹)', align: 'right', render: (r) => money(r.cess) },
  { key: 'gstAmount', label: 'GST Total (₹)', align: 'right', render: (r) => money(r.gstAmount) },
  { key: 'netAmount', label: 'Net Amount (₹)', align: 'right', render: (r) => money(r.netAmount) },
];

const ERROR_COLUMNS = [
  { key: 'invoiceNo', label: 'Invoice No', align: 'left' },
  { key: 'partyName', label: 'Party Name', align: 'left' },
  { key: 'issue', label: 'Notice / Issue', align: 'left' },
  { key: 'severity', label: 'Severity', align: 'center' },
  { key: 'action', label: 'Recommended Action', align: 'left' },
];

const RECON_COLUMNS = [
  { key: 'checkName', label: 'Verification Point', align: 'left' },
  { key: 'gstr1Val', label: 'GSTR-1 Outward (₹)', align: 'right', render: (r) => money(r.gstr1Val) },
  { key: 'gstr3bVal', label: 'GSTR-3B Table 3.1 (₹)', align: 'right', render: (r) => money(r.gstr3bVal) },
  { key: 'diff', label: 'Variance (₹)', align: 'right', render: (r) => money(r.diff) },
  { key: 'status', label: 'Status', align: 'center' },
];

export default function GstinReportsPage({ isOpen, onClose, initialSection = 'sales' }) {
  const [section, setSection] = useState(initialSection || 'sales');
  const [subTab, setSubTab] = useState('summary');

  useEffect(() => {
    if (initialSection) {
      setSection(initialSection);
    }
  }, [initialSection]);
  const [filters, setFilters] = useState({
    fromDate: firstOfMonth(), toDate: lastOfMonth(),
    partyId: '', gstin: '', bookId: '', gstRate: '', state: '',
    groupBy1: '', groupBy2: '', mode: 'detail', partyName: '',
  });
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [printData, setPrintData] = useState(null);
  const printRef = useRef();

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      let data;
      const params = { ...filters };

      switch (section) {
        case 'sales':
          if (subTab === 'summary') data = await gstinReportApi.salesSummary(params);
          else if (subTab === 'detail') data = await gstinReportApi.salesDetail(params);
          else if (subTab === 'returnSummary') data = await gstinReportApi.salesReturnSummary(params);
          else if (subTab === 'returnDetail') data = await gstinReportApi.salesReturnDetail(params);
          break;
        case 'purchase':
          if (subTab === 'summary') data = await gstinReportApi.purchaseSummary(params);
          else if (subTab === 'detail') data = await gstinReportApi.purchaseDetail(params);
          else if (subTab === 'returnSummary') data = await gstinReportApi.purchaseReturnSummary(params);
          else if (subTab === 'returnDetail') data = await gstinReportApi.purchaseReturnDetail(params);
          break;
        case 'process': data = await gstinReportApi.process(params); break;
        case 'jobwork': data = await gstinReportApi.jobwork(params); break;
        case 'journal': data = await gstinReportApi.journal(params); break;
        case 'expense': data = await gstinReportApi.expense(params); break;
        case 'gstr1errors': data = await gstinReportApi.gstr1Errors(params); break;
        case 'gstr3berrors':
          data = await gstinReportApi.gstr3bErrors({ period: filters.fromDate?.slice(0, 7) || new Date().toISOString().slice(0, 7) });
          break;
        case 'itc04': data = await gstinReportApi.itc04(params); break;
        case 'reconciliation':
          data = await gstinReportApi.crossReconciliation({ period: filters.fromDate?.slice(0, 7) || new Date().toISOString().slice(0, 7) });
          break;
        default: break;
      }
      setReportData(data);
      if (data?.rows?.length || data?.groups?.length || data?.errors?.length || data?.checks?.length) {
        toast.success(`Report generated: ${data.rowCount || data.rows?.length || data.errors?.length || data.checks?.length || 0} records`);
      }
    } catch (err) {
      notifyError(err, 'Report failed');
    } finally {
      setLoading(false);
    }
  }, [section, subTab, filters]);

  // Auto-fetch report whenever modal opens or section/tab changes
  useEffect(() => {
    if (isOpen) {
      fetchReport();
    }
  }, [isOpen, section, subTab, fetchReport]);

  const getColumns = () => {
    if ((section === 'sales' || section === 'purchase') && (subTab === 'summary' || subTab === 'returnSummary')) {
      return SUMMARY_COLUMNS;
    }
    if (section === 'process') return PROCESS_COLUMNS;
    if (section === 'jobwork') return JOBWORK_COLUMNS;
    if (section === 'journal' || section === 'expense') return JOURNAL_COLUMNS;
    if (section === 'itc04') return ITC04_COLUMNS;
    if (section === 'gstr1errors' || section === 'gstr3berrors') return ERROR_COLUMNS;
    if (section === 'reconciliation') return RECON_COLUMNS;
    return DETAIL_COLUMNS;
  };

  const getRows = () => {
    if (!reportData) return [];
    // If in summary mode and groups exist, return clean summary rows
    if ((subTab === 'summary' || subTab === 'returnSummary') && reportData.groups?.length) {
      return reportData.groups.map((g) => ({
        groupKey: `${g.groupBy ? g.groupBy.toUpperCase() + ': ' : ''}${g.groupKey || 'All'}`,
        count: g.count || (g.rows ? g.rows.length : 1),
        taxableAmount: g.taxableAmount || 0,
        cgst: g.cgst || 0,
        sgst: g.sgst || 0,
        igst: g.igst || 0,
        cess: g.cess || 0,
        gstAmount: g.gstAmount || 0,
        netAmount: g.netAmount || 0,
      }));
    }

    if (reportData.rows?.length) return reportData.rows;

    if (reportData.groups?.length) {
      const allRows = [];
      reportData.groups.forEach((g) => {
        if (g.rows?.length) {
          allRows.push(...g.rows);
        } else {
          allRows.push({
            groupKey: `${g.groupBy ? g.groupBy.toUpperCase() + ': ' : ''}${g.groupKey || 'All'}`,
            invoiceNo: `${g.groupBy}: ${g.groupKey}`,
            partyName: g.groupKey,
            stateName: g.groupKey,
            gstRate: 'Mixed',
            taxableAmount: g.taxableAmount,
            cgst: g.cgst,
            sgst: g.sgst,
            igst: g.igst,
            cess: g.cess,
            gstAmount: g.gstAmount,
            netAmount: g.netAmount,
            count: g.count || 1,
          });
        }
      });
      return allRows;
    }

    if (reportData.errors?.length) {
      return reportData.errors.map((e) => ({
        invoiceNo: e.invoiceNo || '—',
        partyName: e.partyName || '—',
        issue: e.message || e.error || e.issue || 'Audit Issue',
        severity: e.severity || 'Notice',
        action: e.action || 'Verify',
      }));
    }

    if (reportData.checks?.length) {
      return reportData.checks.map((c) => ({
        checkName: c.name || c.title || c.label || 'Reconciliation Check',
        gstr1Val: c.gstr1 ?? c.val1 ?? 0,
        gstr3bVal: c.gstr3b ?? c.val2 ?? 0,
        diff: c.diff || 0,
        status: c.status || 'OK',
      }));
    }

    return [];
  };

  const handleExcel = () => {
    const cols = getColumns();
    const rows = getRows();
    if (!rows.length) return toast.warning('No data to export');
    exportTableToExcel(`GSTIN_${section}_${subTab}`, cols, rows);
  };

  const handlePrint = () => {
    const cols = getColumns();
    const rows = getRows();
    if (!rows.length) return toast.warning('No data to print');
    setPrintData({ title: reportData?.reportName || `GSTIN ${section}`, columns: cols, rows });
    setTimeout(() => {
      if (printRef.current) printRef.current.print();
    }, 200);
  };

  const sectionMeta = SECTIONS.find((s) => s.id === section) || SECTIONS[0];
  const SectionIcon = sectionMeta.icon;
  const hasTabs = section === 'sales' || section === 'purchase';
  const tabs = section === 'sales' ? SALES_TABS : section === 'purchase' ? PURCHASE_TABS : [];
  const isErrorSection = section === 'gstr1errors' || section === 'gstr3berrors';
  const isReconSection = section === 'reconciliation';

  const rowCount = reportData?.rowCount || reportData?.rows?.length || reportData?.groups?.length || 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="GSTIN Reports & GST Compliance"
      className="max-w-[96vw] w-[96vw] h-[94vh] max-h-[94vh] bg-white rounded-[2rem] p-0 border-none shadow-2xl"
    >
      <div className="gstin-page">
        {/* Left Sidebar */}
        <div className="gstin-sidebar">
          <div className="gstin-sidebar-title">
            <FileText size={14} />
            <span>GST Reports</span>
          </div>
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                className={`gstin-nav-item ${section === s.id ? 'gstin-nav-active' : ''}`}
                onClick={() => { setSection(s.id); setSubTab('summary'); setReportData(null); }}
                type="button"
              >
                <Icon size={14} style={{ color: section === s.id ? '#fff' : s.color }} />
                <span>{s.label}</span>
                <ChevronRight size={12} className="gstin-nav-arrow" />
              </button>
            );
          })}
        </div>

        {/* Main Content */}
        <div className="gstin-main">
          {/* Section Header with Always-Visible Action Bar */}
          <div className="gstin-section-header" style={{ borderLeftColor: sectionMeta.color }}>
            <SectionIcon size={22} style={{ color: sectionMeta.color }} />
            <div>
              <div className="flex items-center gap-3">
                <h2 className="gstin-section-title">{sectionMeta.label}</h2>
                {reportData && (
                  <span className="px-2.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-full text-[10px] font-bold">
                    {rowCount} {rowCount === 1 ? 'Record' : 'Records'} Found
                  </span>
                )}
              </div>
              {hasTabs && <p className="gstin-section-sub">Select sub-view or adjust filters below</p>}
            </div>

            {/* Quick Action Buttons on Header */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={fetchReport}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                {loading ? 'Loading...' : 'Refresh / Generate'}
              </button>
              <button
                type="button"
                onClick={handleExcel}
                disabled={!getRows().length && !reportData?.groups?.length}
                className="px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <FileSpreadsheet size={13} />
                Excel
              </button>
              <button
                type="button"
                onClick={handlePrint}
                disabled={!getRows().length && !reportData?.groups?.length}
                className="px-3.5 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <Printer size={13} />
                Print
              </button>
            </div>
          </div>

          {/* Sub-tabs for Sales/Purchase */}
          {hasTabs && (
            <div className="gstin-tabs">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  className={`gstin-tab ${subTab === t.id ? 'gstin-tab-active' : ''}`}
                  onClick={() => { setSubTab(t.id); }}
                  type="button"
                >{t.label}</button>
              ))}
            </div>
          )}

          {/* Report Controls */}
          {!isErrorSection && !isReconSection && (
            <ReportControlPanel
              filters={filters}
              onFilterChange={setFilters}
              onSearch={fetchReport}
              onPrint={handlePrint}
              onExcel={handleExcel}
              loading={loading}
              showBook={section !== 'journal'}
              showGstRate={section !== 'itc04'}
            />
          )}

          {/* Simple controls for Error/Reconciliation sections */}
          {(isErrorSection || isReconSection) && (
            <div className="gstin-simple-controls">
              <div className="rcp-field">
                <label className="rcp-label">From Date</label>
                <input type="date" className="rcp-input" value={filters.fromDate} onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value }))} />
              </div>
              <div className="rcp-field">
                <label className="rcp-label">To Date</label>
                <input type="date" className="rcp-input" value={filters.toDate} onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value }))} />
              </div>
              <button className="rcp-btn rcp-btn-primary" onClick={fetchReport} disabled={loading} type="button">
                {loading ? 'Checking...' : 'Run Check'}
              </button>
            </div>
          )}

          {/* Report Results */}
          <div className="gstin-results">
            {/* Grouped Summary View */}
            {reportData?.groups && (
              <div className="gstin-groups">
                {reportData.groups.map((g, gi) => (
                  <div key={gi} className="gstin-group">
                    <div className="gstin-group-header">
                      <span className="gstin-group-key">{g.groupBy}: {g.groupKey}</span>
                      <span className="gstin-group-count">{g.count} records</span>
                      <span className="gstin-group-total">{money(g.taxableAmount)}</span>
                      <span className="gstin-group-gst">GST: {money(g.gstAmount)}</span>
                      <span className="gstin-group-net">{money(g.netAmount)}</span>
                    </div>
                    {g.subGroups && g.subGroups.map((sg, si) => (
                      <div key={si} className="gstin-subgroup">
                        <span className="gstin-subgroup-key">{sg.groupBy}: {sg.groupKey}</span>
                        <span>{sg.count} records</span>
                        <span>{money(sg.taxableAmount)}</span>
                        <span>GST: {money(sg.gstAmount)}</span>
                        <span>{money(sg.netAmount)}</span>
                      </div>
                    ))}
                    {g.rows && g.rows.length > 0 && (
                      <div className="gstin-group-detail">
                        <ReportTable columns={getColumns()} rows={g.rows} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Detail Table View */}
            {reportData?.rows && !reportData.groups && (
              <ReportTable columns={getColumns()} rows={reportData.rows} />
            )}

            {/* Error Checking View */}
            {isErrorSection && reportData?.errors && (
              <ErrorCheckResults data={reportData} />
            )}

            {/* Reconciliation View */}
            {isReconSection && reportData?.checks && (
              <ReconciliationResults data={reportData} />
            )}

            {/* Totals Footer */}
            {reportData?.totals && !isErrorSection && !isReconSection && (
              <div className="gstin-totals">
                <div className="gstin-total-item"><span>Records</span><strong>{reportData.totals.count || reportData.rowCount || 0}</strong></div>
                <div className="gstin-total-item"><span>Taxable</span><strong>{money(reportData.totals.taxableAmount)}</strong></div>
                <div className="gstin-total-item"><span>CGST</span><strong>{money(reportData.totals.cgst)}</strong></div>
                <div className="gstin-total-item"><span>SGST</span><strong>{money(reportData.totals.sgst)}</strong></div>
                <div className="gstin-total-item"><span>IGST</span><strong>{money(reportData.totals.igst)}</strong></div>
                <div className="gstin-total-item"><span>Cess</span><strong>{money(reportData.totals.cess)}</strong></div>
                <div className="gstin-total-item gstin-total-highlight"><span>Net Amount</span><strong>{money(reportData.totals.netAmount)}</strong></div>
              </div>
            )}

            {/* Empty State */}
            {!reportData && !loading && (
              <div className="gstin-empty">
                <SectionIcon size={48} style={{ color: sectionMeta.color, opacity: 0.3 }} />
                <p className="text-slate-600 font-bold text-sm">Ready to generate {sectionMeta.label}</p>
                <p className="text-slate-400 text-xs">Click the button below to query transactions</p>
                <button
                  type="button"
                  onClick={fetchReport}
                  className="mt-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md cursor-pointer flex items-center gap-2"
                >
                  <Search size={14} />
                  Load {sectionMeta.label} Now
                </button>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="gstin-loading">
                <div className="gstin-spinner" />
                <p>Generating report from transaction data...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {printData && (
        <div style={{ display: 'none' }}>
          <ListPrint ref={printRef} title={printData.title} columns={printData.columns} rows={printData.rows} />
        </div>
      )}

      <style>{`
        .gstin-page { display: flex; height: calc(94vh - 60px); max-height: calc(94vh - 60px); overflow: hidden; }
        .gstin-sidebar { width: 220px; min-width: 220px; background: var(--bg-base, #f8fafc); border-right: 1px solid var(--border, #e2e8f0); overflow-y: auto; padding: 12px 8px; display: flex; flex-direction: column; gap: 2px; }
        .gstin-sidebar-title { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: var(--text-muted, #94a3b8); padding: 8px 12px 12px; display: flex; align-items: center; gap: 6px; }
        .gstin-nav-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 8px; font-size: 11px; font-weight: 600; color: var(--text-primary, #1e293b); background: transparent; border: none; cursor: pointer; transition: all 0.15s; width: 100%; text-align: left; }
        .gstin-nav-item:hover { background: var(--bg-card, #fff); }
        .gstin-nav-active { background: var(--accent, #1e293b) !important; color: #fff !important; }
        .gstin-nav-arrow { margin-left: auto; opacity: 0.3; }
        .gstin-main { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; }
        .gstin-section-header { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--bg-card, #fff); border: 1px solid var(--border, #e2e8f0); border-left: 4px solid; border-radius: 10px; }
        .gstin-section-title { font-size: 16px; font-weight: 800; color: var(--text-primary, #1e293b); margin: 0; }
        .gstin-section-sub { font-size: 10px; color: var(--text-muted, #94a3b8); margin: 2px 0 0; }
        .gstin-tabs { display: flex; gap: 4px; background: var(--bg-base, #f8fafc); border-radius: 8px; padding: 4px; border: 1px solid var(--border, #e2e8f0); }
        .gstin-tab { font-size: 10px; font-weight: 700; padding: 6px 16px; border: none; border-radius: 6px; background: transparent; color: var(--text-muted, #94a3b8); cursor: pointer; transition: all 0.15s; text-transform: uppercase; letter-spacing: 0.04em; }
        .gstin-tab-active { background: var(--accent, #1e293b); color: #fff; }
        .gstin-simple-controls { display: flex; gap: 10px; align-items: flex-end; padding: 12px 16px; background: var(--bg-card, #fff); border: 1px solid var(--border, #e2e8f0); border-radius: 10px; }
        .gstin-results { flex: 1; min-height: 200px; }
        .gstin-totals { display: flex; gap: 12px; padding: 14px 16px; background: var(--bg-base, #f8fafc); border: 1px solid var(--border, #e2e8f0); border-radius: 10px; flex-wrap: wrap; }
        .gstin-total-item { display: flex; flex-direction: column; gap: 2px; min-width: 100px; }
        .gstin-total-item span { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted, #94a3b8); }
        .gstin-total-item strong { font-size: 14px; font-weight: 800; color: var(--text-primary, #1e293b); font-variant-numeric: tabular-nums; }
        .gstin-total-highlight { background: var(--accent, #1e293b); color: #fff; padding: 6px 12px; border-radius: 8px; }
        .gstin-total-highlight span { color: rgba(255,255,255,0.6); }
        .gstin-total-highlight strong { color: #fff; }
        .gstin-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; gap: 12px; }
        .gstin-empty p { font-size: 12px; color: var(--text-muted, #94a3b8); }
        .gstin-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; gap: 12px; }
        .gstin-spinner { width: 32px; height: 32px; border: 3px solid var(--border, #e2e8f0); border-top-color: var(--accent, #3b82f6); border-radius: 50%; animation: gstin-spin 0.8s linear infinite; }
        @keyframes gstin-spin { to { transform: rotate(360deg); } }
        .gstin-loading p { font-size: 11px; color: var(--text-muted, #94a3b8); }
        .gstin-groups { display: flex; flex-direction: column; gap: 8px; }
        .gstin-group { border: 1px solid var(--border, #e2e8f0); border-radius: 10px; overflow: hidden; }
        .gstin-group-header { display: flex; align-items: center; gap: 16px; padding: 10px 16px; background: var(--bg-base, #f8fafc); font-size: 11px; font-weight: 700; border-bottom: 1px solid var(--border-subtle, #f1f5f9); flex-wrap: wrap; }
        .gstin-group-key { color: var(--text-primary, #1e293b); font-size: 12px; }
        .gstin-group-count { color: var(--text-muted, #94a3b8); font-size: 10px; }
        .gstin-group-total, .gstin-group-gst, .gstin-group-net { font-variant-numeric: tabular-nums; }
        .gstin-group-net { color: var(--accent, #3b82f6); font-weight: 800; }
        .gstin-subgroup { display: flex; align-items: center; gap: 16px; padding: 6px 16px 6px 32px; font-size: 10px; color: var(--text-muted, #94a3b8); border-bottom: 1px solid var(--border-subtle, #f1f5f9); }
        .gstin-subgroup-key { font-weight: 700; color: var(--text-secondary, #64748b); }
        .gstin-group-detail { max-height: 400px; overflow-y: auto; }
        .rcp-field { display: flex; flex-direction: column; gap: 3px; min-width: 130px; }
        .rcp-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted, #94a3b8); }
        .rcp-input { font-size: 12px; padding: 6px 10px; border: 1px solid var(--border, #e2e8f0); border-radius: 6px; background: var(--bg-card, #fff); color: var(--text-primary, #1e293b); outline: none; }
        .rcp-input:focus { border-color: var(--accent, #3b82f6); }
        .rcp-btn { font-size: 10px; font-weight: 700; padding: 6px 14px; border-radius: 6px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; transition: all 0.15s; text-transform: uppercase; }
        .rcp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .rcp-btn-primary { background: var(--accent, #1e293b); color: #fff; }
      `}</style>
    </Modal>
  );
}

// ─── Reusable Table ───
function ReportTable({ columns, rows }) {
  if (!rows?.length) {
    return <div className="gstin-empty"><p>No records found for the selected criteria</p></div>;
  }
  return (
    <div className="rt-container">
      <table className="rt-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`rt-th ${c.align === 'right' ? 'rt-right' : c.align === 'center' ? 'rt-center' : ''}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r._id || r.entryNo || i} className="rt-row">
              {columns.map((c) => (
                <td key={c.key} className={`rt-td ${c.align === 'right' ? 'rt-right' : c.align === 'center' ? 'rt-center' : ''}`}>
                  {c.render ? c.render(r) : r[c.key] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <style>{`
        .rt-container { border: 1px solid var(--border, #e2e8f0); border-radius: 10px; overflow: hidden; max-height: 60vh; overflow-y: auto; }
        .rt-table { width: 100%; border-collapse: collapse; font-size: 11px; }
        .rt-th { padding: 8px 10px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted, #94a3b8); background: var(--bg-base, #f8fafc); border-bottom: 1px solid var(--border, #e2e8f0); position: sticky; top: 0; z-index: 5; white-space: nowrap; }
        .rt-td { padding: 6px 10px; border-bottom: 1px solid var(--border-subtle, #f1f5f9); color: var(--text-primary, #1e293b); white-space: nowrap; }
        .rt-row:hover { background: rgba(59,130,246,0.03); }
        .rt-right { text-align: right; font-variant-numeric: tabular-nums; }
        .rt-center { text-align: center; }
      `}</style>
    </div>
  );
}

// ─── Error Check Results ───
function ErrorCheckResults({ data }) {
  return (
    <div className="err-container">
      <div className="err-summary">
        <div className={`err-badge ${data.totalErrors > 0 ? 'err-badge-error' : 'err-badge-ok'}`}>
          {data.totalErrors > 0 ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{data.totalErrors} Errors</span>
        </div>
        <div className="err-badge err-badge-warn">
          <AlertTriangle size={16} />
          <span>{data.totalWarnings} Warnings</span>
        </div>
        {data.totalInfo > 0 && (
          <div className="err-badge err-badge-info">
            <span>{data.totalInfo} Info</span>
          </div>
        )}
      </div>
      <div className="err-list">
        {data.errors.map((e, i) => (
          <div key={i} className={`err-item err-item-${e.severity}`}>
            <div className="err-item-icon">
              {e.severity === 'error' ? <XCircle size={14} /> : e.severity === 'warning' ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
            </div>
            <div className="err-item-body">
              <div className="err-item-code">{e.code}</div>
              <div className="err-item-msg">{e.message}</div>
              {e.invoiceNo && <div className="err-item-ref">Invoice: {e.invoiceNo} | Date: {dt(e.date)}</div>}
            </div>
          </div>
        ))}
        {data.errors.length === 0 && (
          <div className="gstin-empty">
            <CheckCircle2 size={48} style={{ color: '#10b981', opacity: 0.5 }} />
            <p>No errors detected — all transactions validated successfully</p>
          </div>
        )}
      </div>
      <style>{`
        .err-container { display: flex; flex-direction: column; gap: 12px; }
        .err-summary { display: flex; gap: 10px; }
        .err-badge { display: flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 700; }
        .err-badge-error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
        .err-badge-warn { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
        .err-badge-ok { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
        .err-badge-info { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
        .err-list { display: flex; flex-direction: column; gap: 4px; max-height: 60vh; overflow-y: auto; }
        .err-item { display: flex; gap: 10px; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border, #e2e8f0); }
        .err-item-error { border-left: 3px solid #dc2626; background: #fef2f2; }
        .err-item-warning { border-left: 3px solid #d97706; background: #fffbeb; }
        .err-item-info { border-left: 3px solid #2563eb; background: #eff6ff; }
        .err-item-icon { padding-top: 2px; }
        .err-item-error .err-item-icon { color: #dc2626; }
        .err-item-warning .err-item-icon { color: #d97706; }
        .err-item-info .err-item-icon { color: #2563eb; }
        .err-item-body { flex: 1; }
        .err-item-code { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted, #94a3b8); }
        .err-item-msg { font-size: 12px; font-weight: 600; color: var(--text-primary, #1e293b); margin-top: 2px; }
        .err-item-ref { font-size: 10px; color: var(--text-muted, #94a3b8); margin-top: 2px; }
      `}</style>
    </div>
  );
}

// ─── Reconciliation Results ───
function ReconciliationResults({ data }) {
  return (
    <div className="recon-container">
      <div className={`recon-status ${data.overallStatus === 'RECONCILED' ? 'recon-ok' : 'recon-fail'}`}>
        {data.overallStatus === 'RECONCILED' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
        <span>{data.overallStatus === 'RECONCILED' ? 'All Reports Reconciled' : `${data.mismatches?.length || 0} Mismatches Found`}</span>
      </div>
      <div className="recon-checks">
        {data.checks.map((c, i) => (
          <div key={i} className={`recon-check ${c.status === 'MATCH' ? 'recon-check-ok' : 'recon-check-fail'}`}>
            <div className="recon-check-icon">
              {c.status === 'MATCH' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            </div>
            <div className="recon-check-body">
              <div className="recon-check-label">{c.check}</div>
              <div className="recon-check-values">
                <span>{c.source1}: {money(c.value1)}</span>
                <span className="recon-vs">vs</span>
                <span>{c.source2}: {money(c.value2)}</span>
                {c.difference > 0 && <span className="recon-diff">Diff: {money(c.difference)}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
      <style>{`
        .recon-container { display: flex; flex-direction: column; gap: 12px; }
        .recon-status { display: flex; align-items: center; gap: 10px; padding: 14px 20px; border-radius: 10px; font-size: 14px; font-weight: 800; }
        .recon-ok { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
        .recon-fail { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
        .recon-checks { display: flex; flex-direction: column; gap: 6px; }
        .recon-check { display: flex; gap: 10px; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border, #e2e8f0); }
        .recon-check-ok { border-left: 3px solid #16a34a; }
        .recon-check-fail { border-left: 3px solid #dc2626; background: #fef2f2; }
        .recon-check-icon { padding-top: 2px; }
        .recon-check-ok .recon-check-icon { color: #16a34a; }
        .recon-check-fail .recon-check-icon { color: #dc2626; }
        .recon-check-body { flex: 1; }
        .recon-check-label { font-size: 12px; font-weight: 700; color: var(--text-primary, #1e293b); }
        .recon-check-values { display: flex; gap: 8px; align-items: center; font-size: 11px; color: var(--text-muted, #94a3b8); margin-top: 4px; flex-wrap: wrap; font-variant-numeric: tabular-nums; }
        .recon-vs { font-size: 9px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; }
        .recon-diff { color: #dc2626; font-weight: 700; }
      `}</style>
    </div>
  );
}
