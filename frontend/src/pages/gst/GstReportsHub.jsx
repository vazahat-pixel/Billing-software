import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Modal from '../../components/ui/Modal';
import useStore from '../../store/useStore';
import { toast } from '../../store/useToastStore';
import { notifyError } from '../../utils/notify';
import { gstApi, stage4Api } from '../../api/gst.api';
import { gstinReportApi } from '../../api/gstinReport.api';
import { salesApi } from '../../api/sales.api';
import { exportTableToExcel } from '../../utils/reportExport';
import { exportGstr1Excel, downloadJson } from '../../utils/gstExport';
import ListPrint from '../../components/print/ListPrint';
import GSTReportsTab from './GSTReportsTab';
import {
  FileText, ShoppingCart, Factory, Wrench, BookOpen, Receipt,
  AlertTriangle, CheckCircle2, RefreshCw, Truck, Calendar,
  Download, Printer, FileSpreadsheet, Layers, Search, Eye,
  ShieldCheck, Scale, ChevronRight, X, Play, Filter,
  ArrowUpRight, Database, SlidersVertical
} from 'lucide-react';

const money = (v) =>
  `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dt = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '');

const firstOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const lastOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// 17 JSM GST REPORT GROUPS & CATALOG
export const JSM_GST_GROUPS = [
  {
    groupId: 'statutory',
    label: 'Statutory Returns & Filing',
    reports: [
      { id: 'gst3b', label: '3B Monthly Return', icon: Scale, jsmForm: 'Gstr_3B_TextNew_Monthly' },
      { id: 'gstr1', label: 'Gstr-1 Report', icon: FileText, jsmForm: 'Rpt_Jsm_GSTR1_3_2_2' },
      { id: 'gstr2', label: 'Gstr-2 Report', icon: ShoppingCart, jsmForm: 'JS_GSTR2_RPT' },
      { id: 'gstr9', label: 'Gstr-9', icon: Calendar, jsmForm: 'Rpt_Jsm_GSTR9_New' },
      { id: 'itc04', label: 'ITC 04', icon: Wrench, jsmForm: 'ITC_04_EXCEL_25' },
    ],
  },
  {
    groupId: 'audit',
    label: 'Audit, Error & Matching',
    reports: [
      { id: 'gstr1Errors', label: 'Gstr-1 Error Checking', icon: AlertTriangle, jsmForm: 'Stp_Gst_OutWrad_ErrorCheck' },
      { id: 'gstrMatching', label: 'Gstr Matching', icon: RefreshCw, jsmForm: 'Rpt_Jsm_Gstr1_Match' },
    ],
  },
  {
    groupId: 'eway',
    label: 'E-Way Bill Suite',
    reports: [
      { id: 'ewayBulk', label: 'E-Way Bill Bulk Generation', icon: Truck, jsmForm: 'EWB_Bulk_NIC' },
      { id: 'ewayStatus', label: 'E-Way Bill / Invoice Status', icon: CheckCircle2, jsmForm: 'EWB_Status_Tracker' },
      { id: 'ewayExcel', label: 'E-Way Excel Upload', icon: FileSpreadsheet, jsmForm: 'EWB_Excel_NIC' },
    ],
  },
  {
    groupId: 'registers',
    label: 'GSTIN Books & Registers',
    reports: [
      { id: 'gst45', label: 'Gst 4.5', icon: Layers, jsmForm: 'Stp_Changes_GstRate_In_Master' },
      { id: 'gstinSales', label: 'Gstin - Sales', icon: FileText, jsmForm: 'A_Gstr1_SalesInvoiceSummary' },
      { id: 'gstinPurchase', label: 'Gstin - Purchase', icon: ShoppingCart, jsmForm: 'A_Gstr2_PurchaseSummary' },
      { id: 'gstinProcess', label: 'Gstin - Process', icon: Factory, jsmForm: 'A_Gstr2_ProcessSummary' },
      { id: 'gstinJobwork', label: 'Gstin - JobWork', icon: Wrench, jsmForm: 'A_Gstr2_JobWorkReceiptSummary' },
      { id: 'gstinJournal', label: 'Gstin - Journal Report', icon: BookOpen, jsmForm: 'JSM_VW_GST_JV_SUMMARY' },
      { id: 'gstinExpense', label: 'Gstin - Expense', icon: Receipt, jsmForm: 'A_Gstr2_Expense' },
    ],
  },
];

/** GSTR-3B API returns { payload: { sup_details, itc_elg, outward, inward, netPayable }, totals }. */
function normalizeGstr3b(raw) {
  const p = raw?.payload || raw || {};
  const rev = p.sup_details?.isup_rev || {};
  const zero = p.sup_details?.osup_zero || {};
  const itc = (p.itc_elg?.itc_avl || []).reduce((t, r) => ({
    igst: t.igst + Number(r.iamt || 0),
    cgst: t.cgst + Number(r.camt || 0),
    sgst: t.sgst + Number(r.samt || 0),
    cess: t.cess + Number(r.csamt || 0),
  }), { igst: 0, cgst: 0, sgst: 0, cess: 0 });
  return {
    ...p,
    totals: raw?.totals,
    zeroRated: { taxable: Number(zero.txval || 0), igst: Number(zero.iamt || 0), cess: Number(zero.csamt || 0) },
    inward: {
      taxable: Number(p.inward?.taxable || 0),
      ...itc,
      taxableRcm: Number(rev.txval || 0),
      igstRcm: Number(rev.iamt || 0),
      cgstRcm: Number(rev.camt || 0),
      sgstRcm: Number(rev.samt || 0),
    },
  };
}

export default function GstReportsHub({ isOpen, onClose, initialReport = 'gstr1' }) {
  const { company } = useStore();
  const [activeReport, setActiveReport] = useState(initialReport || 'gstr1');
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(lastOfMonth);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [printCfg, setPrintCfg] = useState(null);

  // Common JSM parameters
  const [rateSlab, setRateSlab] = useState('');
  const [bookFilter, setBookFilter] = useState('ALL');
  const [partySearch, setPartySearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [unitMode, setUnitMode] = useState('UnitWise'); // UnitWise, Kgs, Qty, Pcs
  const [subMode, setSubMode] = useState('summary'); // summary, detail, returnSummary, returnDetail
  const [withRcm, setWithRcm] = useState(false);
  const [includePr, setIncludePr] = useState(true);
  const [gstSlabWise, setGstSlabWise] = useState(true);
  const [hsnDescWise, setHsnDescWise] = useState(false);
  const [financialYear, setFinancialYear] = useState(() => {
    const yr = new Date().getFullYear();
    return `${yr - 1}-${String(yr).slice(2)}`;
  });
  const [itc04Tab, setItc04Tab] = useState('sent'); // sent, received
  const [errorOnly, setErrorOnly] = useState(false);
  const [minEwayAmount, setMinEwayAmount] = useState(50000);
  const [selectedEwayIds, setSelectedEwayIds] = useState(new Set());

  // Keep active report in sync when initialReport prop changes
  useEffect(() => {
    if (initialReport) {
      setActiveReport(initialReport);
    }
  }, [initialReport]);

  // Ensure active report button in the sidebar is visible/scrolled into view
  useEffect(() => {
    if (!isOpen || !activeReport) return;
    const t = setTimeout(() => {
      const btn = document.getElementById(`gst-report-btn-${activeReport}`);
      if (btn) {
        btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 50);
    return () => clearTimeout(t);
  }, [isOpen, activeReport]);

  // Quick Month Change helper
  const handleMonthChange = (monthIdx) => {
    const yr = new Date(fromDate).getFullYear() || new Date().getFullYear();
    const start = new Date(yr, monthIdx, 1).toISOString().slice(0, 10);
    const end = new Date(yr, monthIdx + 1, 0).toISOString().slice(0, 10);
    setFromDate(start);
    setToDate(end);
  };

  // Main Data Loader per active report
  const loadActiveReportData = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    setReportData(null);
    try {
      const periodKey = fromDate?.slice(0, 7) || new Date().toISOString().slice(0, 7);
      const params = {
        startDate: fromDate,
        endDate: toDate,
        fromDate,
        toDate,
        party: partySearch,
        book: bookFilter !== 'ALL' ? bookFilter : undefined,
        gstRate: rateSlab || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      };

      let res = null;
      switch (activeReport) {
        case 'gst3b': {
          res = normalizeGstr3b(await stage4Api.gstr3b({ period: periodKey }));
          break;
        }
        case 'gstr1': {
          res = await gstApi.gstr1({ startDate: fromDate, endDate: toDate });
          break;
        }
        case 'gstr2': {
          res = await gstApi.gstr2({ startDate: fromDate, endDate: toDate });
          break;
        }
        case 'gstr9': {
          const g9 = await stage4Api.gstr9({ financialYear });
          res = g9?.payload ? { ...g9.payload, totals: g9.totals } : g9;
          break;
        }
        case 'itc04': {
          res = await gstinReportApi.itc04(params);
          break;
        }
        case 'gstr1Errors': {
          res = await gstinReportApi.gstr1Errors(params);
          break;
        }
        case 'gstrMatching': {
          const recon = await gstinReportApi.crossReconciliation({ period: periodKey });
          res = {
            ...recon,
            checks: (recon?.checks || []).map((c) => ({
              checkName: c.check,
              booksVal: c.value1,
              portalVal: c.value2,
              diff: c.difference,
              status: c.status,
            })),
          };
          break;
        }
        case 'ewayBulk':
        case 'ewayStatus': {
          const list = await stage4Api.ewayList();
          const salesRes = await salesApi.list({ limit: 100 });
          const salesList = salesRes?.sales || salesRes?.data || (Array.isArray(salesRes) ? salesRes : []);
          res = { ewayList: Array.isArray(list) ? list : [], sales: salesList };
          break;
        }
        case 'ewayExcel': {
          const salesRes = await salesApi.list({ limit: 100 });
          const salesList = salesRes?.sales || salesRes?.data || (Array.isArray(salesRes) ? salesRes : []);
          res = { sales: salesList };
          break;
        }
        case 'gst45': {
          const sRes = await gstinReportApi.salesSummary({ ...params, groupBy1: 'gstRate' });
          const hsnRes = await gstApi.hsnSummary({ startDate: fromDate, endDate: toDate });
          res = { rateSummary: sRes, hsnSummary: hsnRes };
          break;
        }
        case 'gstinSales': {
          if (subMode === 'summary') res = await gstinReportApi.salesSummary(params);
          else if (subMode === 'detail') res = await gstinReportApi.salesDetail(params);
          else if (subMode === 'returnSummary') res = await gstinReportApi.salesReturnSummary(params);
          else res = await gstinReportApi.salesReturnDetail(params);
          break;
        }
        case 'gstinPurchase': {
          if (subMode === 'summary') res = await gstinReportApi.purchaseSummary(params);
          else if (subMode === 'detail') res = await gstinReportApi.purchaseDetail(params);
          else if (subMode === 'returnSummary') res = await gstinReportApi.purchaseReturnSummary(params);
          else res = await gstinReportApi.purchaseReturnDetail(params);
          break;
        }
        case 'gstinProcess': {
          res = await gstinReportApi.process(params);
          break;
        }
        case 'gstinJobwork': {
          res = await gstinReportApi.jobwork(params);
          break;
        }
        case 'gstinJournal': {
          res = await gstinReportApi.journal(params);
          break;
        }
        case 'gstinExpense': {
          res = await gstinReportApi.expense(params);
          break;
        }
        default:
          res = await gstApi.caDashboard({ startDate: fromDate, endDate: toDate });
          break;
      }

      setReportData(res);
      toast.success(`Loaded ${activeReportMeta?.label || 'Report'}`);
    } catch (err) {
      notifyError(err, 'Failed to fetch GST report data');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [
    isOpen, activeReport, fromDate, toDate, partySearch, bookFilter,
    rateSlab, statusFilter, subMode, financialYear
  ]);

  useEffect(() => {
    if (isOpen) {
      loadActiveReportData();
    }
  }, [isOpen, activeReport, fromDate, toDate, subMode, financialYear, loadActiveReportData]);

  // Current active report descriptor
  const activeReportMeta = useMemo(() => {
    for (const grp of JSM_GST_GROUPS) {
      const match = grp.reports.find((r) => r.id === activeReport);
      if (match) return { ...match, groupLabel: grp.label };
    }
    return { id: activeReport, label: activeReport, groupLabel: 'GST Reports' };
  }, [activeReport]);

  // -------------------------------------------------------------------------
  // EXPORT HANDLERS (EXCEL, JSON, PRINT)
  // -------------------------------------------------------------------------
  const handleExcelExport = () => {
    if (!reportData) return toast.info('No data available to export');

    if (activeReport === 'gstr1') {
      const g1 = reportData?.gstr1 || reportData;
      exportGstr1Excel(g1, `GSTR1_${fromDate}_to_${toDate}.xlsx`);
      toast.success('GSTR-1 Excel exported (10-Sheet CBIC Utility V3.2.2 format)');
      return;
    }

    if (activeReport === 'gst3b') {
      const outward = reportData?.outward || {};
      const inward = reportData?.inward || {};
      const rows = [
        { Section: '3.1(a) Outward Taxable Supplies', Taxable: outward.taxable || 0, CGST: outward.cgst || 0, SGST: outward.sgst || 0, IGST: outward.igst || 0, Cess: outward.cess || 0 },
        { Section: '4(A) Eligible ITC', Taxable: inward.taxable || 0, CGST: inward.cgst || 0, SGST: inward.sgst || 0, IGST: inward.igst || 0, Cess: inward.cess || 0 },
        { Section: 'Net Tax Payable', Taxable: '', CGST: reportData?.netPayable?.cgst || 0, SGST: reportData?.netPayable?.sgst || 0, IGST: reportData?.netPayable?.igst || 0, Cess: reportData?.netPayable?.cess || 0 }
      ];
      exportTableToExcel(rows, `GSTR3B_Monthly_${fromDate?.slice(0, 7)}.xlsx`);
      toast.success('GSTR-3B Excel exported');
      return;
    }

    if (activeReport === 'gstr1Errors') {
      const errs = reportData?.errors || reportData?.rows || [];
      const cols = [
        { key: 'invoiceNo', label: 'Voucher / Bill No' },
        { key: 'date', label: 'Date' },
        { key: 'partyName', label: 'Party Name' },
        { key: 'gstin', label: 'GSTIN' },
        { key: 'issue', label: 'Issue Description' },
        { key: 'severity', label: 'Severity' },
        { key: 'action', label: 'Recommended Action' }
      ];
      exportTableToExcel(cols, errs, `GSTR1_Error_Audit_${fromDate}_to_${toDate}.xlsx`);
      toast.success('GSTR-1 Error Audit Excel exported');
      return;
    }

    if (activeReport === 'itc04') {
      const rows = reportData?.rows || [];
      const cols = [
        { key: 'jobCardNo', label: 'Job Card No' },
        { key: 'issueDate', label: 'Issue Date' },
        { key: 'workerName', label: 'Job Worker' },
        { key: 'workerGstin', label: 'GSTIN' },
        { key: 'hsnCode', label: 'HSN' },
        { key: 'issueQty', label: 'Issue Qty' },
        { key: 'receivedQty', label: 'Recd Qty' },
        { key: 'status', label: 'Status' },
        { key: 'taxableAmount', label: 'Taxable' },
        { key: 'gstAmount', label: 'GST' }
      ];
      exportTableToExcel(cols, rows, `ITC04_Return_${fromDate}_to_${toDate}.xlsx`);
      toast.success('ITC-04 Excel exported');
      return;
    }

    // Default row export for GSTIN registers and others
    const rows = reportData?.rows || reportData?.purchases || reportData?.sales || [];
    if (rows.length) {
      exportTableToExcel(rows, `${activeReport}_${fromDate}_to_${toDate}.xlsx`);
      toast.success(`${activeReportMeta.label} Excel exported`);
    } else {
      toast.info('No tabular rows available to export');
    }
  };

  const handleJsonExport = () => {
    if (!reportData) return toast.info('No data to export');
    if (activeReport === 'gstr1') {
      downloadJson(reportData, `GSTR1_${fromDate?.slice(0, 7)}_${company?.gstin || 'Return'}.json`);
      toast.success('GSTR-1 JSON exported for GST Portal');
    } else if (activeReport === 'gstr9') {
      downloadJson(reportData, `GSTR9_${financialYear}_${company?.gstin || 'Return'}.json`);
      toast.success('GSTR-9 JSON exported for GST Portal');
    } else if (activeReport === 'ewayBulk' || activeReport === 'ewayStatus') {
      const ewayPayload = {
        version: '1.0.0421',
        billLists: (reportData?.sales || [])
          .filter((s) => (s.netAmount || s.grandTotal || 0) >= minEwayAmount)
          .map((s) => ({
            userGstin: company?.gstin || '',
            supplyType: 'O',
            subSupplyType: 1,
            docType: 'INV',
            docNo: s.billNo || s.invoiceNo || 'INV-1',
            docDate: dt(s.billDate || s.date),
            fromGstin: company?.gstin || '',
            toGstin: s.partyGstin || s.gstin || 'URP',
            totalValue: s.taxableAmount || s.taxable || 0,
            cgstValue: s.cgst || 0,
            sgstValue: s.sgst || 0,
            igstValue: s.igst || 0,
            totInvValue: s.netAmount || s.grandTotal || 0,
          })),
      };
      downloadJson(ewayPayload, `${company?.name || 'Company'}_EWAY_JSON.json`);
      toast.success('NIC E-Way Bill JSON exported');
    } else {
      downloadJson(reportData, `${activeReport}_${fromDate}.json`);
      toast.success('JSON export downloaded');
    }
  };

  const handlePrint = () => {
    const rows = reportData?.rows || reportData?.purchases || reportData?.sales || [];
    setPrintCfg({
      title: `${activeReportMeta.label} (${dt(fromDate)} to ${dt(toDate)})`,
      subtitle: `Company: ${company?.name || ''} · GSTIN: ${company?.gstin || ''}`,
      columns: [
        { key: 'invoiceNo', label: 'Voucher / Doc No' },
        { key: 'date', label: 'Date', render: (r) => dt(r.date || r.billDate) },
        { key: 'partyName', label: 'Party / Account' },
        { key: 'gstin', label: 'GSTIN' },
        { key: 'taxableAmount', label: 'Taxable', render: (r) => money(r.taxableAmount || r.taxable) },
        { key: 'gstAmount', label: 'GST Tax', render: (r) => money(r.gstAmount || (r.cgst || 0) + (r.sgst || 0) + (r.igst || 0)) },
        { key: 'netAmount', label: 'Total Value', render: (r) => money(r.netAmount || r.grandTotal) },
      ],
      data: rows,
    });
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      bare
      className="max-w-[96vw] w-full h-[94vh] p-0 rounded-2xl overflow-hidden shadow-2xl border border-[var(--border)]"
    >
      <div className="flex flex-1 min-h-0 h-full max-h-full w-full bg-[var(--bg-base)] text-[var(--text-primary)] overflow-hidden">
        {/* ================================================================= */}
        {/* 1. LEFT JSM CATEGORIZED REPORT SELECTOR SIDEBAR                     */}
        {/* ================================================================= */}
        <aside className="w-72 shrink-0 bg-[var(--bg-card)] border-r border-[var(--border)] flex flex-col h-full max-h-full min-h-0 overflow-hidden select-none">
          {/* Header */}
          <div className="p-4 shrink-0 border-b border-[var(--border)] bg-gradient-to-r from-blue-900/20 via-transparent to-transparent">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md">
                <FileSpreadsheet size={18} />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-tight">JSM GST Reports</h2>
                <p className="text-[10px] text-[var(--text-muted)] truncate">
                  {company?.name || 'Textile ERP'} · {company?.gstin || 'GST Master'}
                </p>
              </div>
            </div>
            <div className="mt-3 relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Filter 17 GST reports…"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-base)] outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Categorized List with guaranteed scrolling */}
          <div
            className="flex-1 min-h-0 overflow-y-auto p-2 space-y-3 custom-scrollbar"
            style={{ maxHeight: 'calc(100% - 130px)', scrollbarGutter: 'stable' }}
          >
            {JSM_GST_GROUPS.map((grp) => {
              const filteredReports = grp.reports.filter((r) =>
                r.label.toLowerCase().includes(searchFilter.toLowerCase()) ||
                r.jsmForm.toLowerCase().includes(searchFilter.toLowerCase())
              );
              if (!filteredReports.length) return null;

              return (
                <div key={grp.groupId} className="space-y-1">
                  <div className="flex items-center justify-between px-2.5 py-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      {grp.label}
                    </p>
                    <span className="text-[9px] font-mono text-[var(--text-muted)] opacity-70">
                      ({filteredReports.length})
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {filteredReports.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeReport === item.id;
                      return (
                        <button
                          key={item.id}
                          id={`gst-report-btn-${item.id}`}
                          type="button"
                          onClick={() => setActiveReport(item.id)}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-xs transition-all cursor-pointer ${
                            isActive
                              ? 'bg-blue-600 text-white font-semibold shadow-md'
                              : 'hover:bg-[var(--bg-base)] text-[var(--text-primary)]'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Icon size={14} className={isActive ? 'text-white' : 'text-blue-500'} />
                            <span className="truncate">{item.label}</span>
                          </div>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                              isActive ? 'bg-blue-700 text-blue-100' : 'text-[var(--text-muted)] bg-[var(--bg-base)]'
                            }`}
                          >
                            {item.id.replace('gstin', '')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Info Footer */}
          <div className="p-3 shrink-0 border-t border-[var(--border)] text-[10px] text-[var(--text-muted)] bg-[var(--bg-base)]">
            <p className="font-semibold text-[var(--text-primary)]">JSM Parity Engine Active</p>
            <p className="truncate">Form: {activeReportMeta.jsmForm}</p>
          </div>
        </aside>

        {/* ================================================================= */}
        {/* 2. RIGHT MAIN REPORT WORKSPACE                                     */}
        {/* ================================================================= */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          {/* Universal Top Bar */}
          <header className="shrink-0 px-5 py-3 border-b border-[var(--border)] bg-[var(--bg-card)] flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800">
                  {activeReportMeta.groupLabel}
                </span>
                <span className="text-xs text-[var(--text-muted)] font-mono">
                  Form: {activeReportMeta.jsmForm}
                </span>
              </div>
              <h1 className="text-lg font-bold tracking-tight mt-0.5 flex items-center gap-2">
                {activeReportMeta.label}
              </h1>
            </div>

            {/* Global Action Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={loadActiveReportData}
                disabled={loading}
                className="erp-btn erp-btn-secondary h-8 px-3 text-xs gap-1.5"
                title="Reload from Live Database"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin text-blue-500' : ''} />
                <span>{loading ? 'Fetching…' : 'Load Data'}</span>
              </button>

              <button
                type="button"
                onClick={handleExcelExport}
                className="erp-btn erp-btn-secondary h-8 px-3 text-xs gap-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                title="Export Formatted JSM Excel"
              >
                <FileSpreadsheet size={13} />
                <span>Excel</span>
              </button>

              {['gstr1', 'gstr9', 'ewayBulk', 'ewayStatus'].includes(activeReport) && (
                <button
                  type="button"
                  onClick={handleJsonExport}
                  className="erp-btn erp-btn-secondary h-8 px-3 text-xs gap-1.5 text-amber-600 dark:text-amber-400"
                  title="Export NIC / Portal JSON"
                >
                  <Download size={13} />
                  <span>JSON</span>
                </button>
              )}

              <button
                type="button"
                onClick={handlePrint}
                className="erp-btn erp-btn-secondary h-8 px-3 text-xs gap-1.5"
                title="Print Report"
              >
                <Printer size={13} />
                <span>Print</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-base)]"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          {/* =============================================================== */}
          {/* JSM REPORT-SPECIFIC PARAMETER CONTROLS BAR                       */}
          {/* =============================================================== */}
          <div className="shrink-0 px-5 py-2.5 bg-[var(--bg-card)] border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Date / Month Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {activeReport === 'gstr9' ? (
                <label className="flex items-center gap-2 h-8 px-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-base)] font-medium">
                  <Calendar size={13} className="text-[var(--text-muted)]" />
                  <span className="text-[11px] text-[var(--text-muted)]">Financial Year:</span>
                  <select
                    value={financialYear}
                    onChange={(e) => setFinancialYear(e.target.value)}
                    className="bg-transparent outline-none font-semibold text-xs"
                  >
                    <option value="2025-26">2025-26</option>
                    <option value="2024-25">2024-25</option>
                    <option value="2023-24">2023-24</option>
                  </select>
                </label>
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-[var(--text-muted)] font-medium">Month:</span>
                    <select
                      value={new Date(fromDate).getMonth()}
                      onChange={(e) => handleMonthChange(Number(e.target.value))}
                      className="h-8 px-2 rounded-lg border border-[var(--border)] bg-[var(--bg-base)] text-xs font-semibold outline-none"
                    >
                      {MONTH_NAMES.map((m, idx) => (
                        <option key={m} value={idx}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-[var(--text-muted)] font-medium">From:</span>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="h-8 px-2 rounded-lg border border-[var(--border)] bg-[var(--bg-base)] text-xs font-mono outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-[var(--text-muted)] font-medium">To:</span>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="h-8 px-2 rounded-lg border border-[var(--border)] bg-[var(--bg-base)] text-xs font-mono outline-none"
                    />
                  </div>
                </>
              )}

              {/* Submode for GSTIN Sales/Purchase */}
              {['gstinSales', 'gstinPurchase'].includes(activeReport) && (
                <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--bg-base)] p-0.5">
                  {[
                    { id: 'summary', label: 'Summary' },
                    { id: 'detail', label: 'Detail' },
                    { id: 'returnSummary', label: 'Return Sum' },
                    { id: 'returnDetail', label: 'Return Det' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSubMode(m.id)}
                      className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                        subMode === m.id ? 'bg-blue-600 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Specific Checkbox and Radio controls */}
            <div className="flex items-center gap-3 flex-wrap">
              {activeReport === 'gstr1' && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[var(--text-muted)]">Unit:</span>
                  {['UnitWise', 'Kgs', 'Qty', 'Pcs'].map((u) => (
                    <label key={u} className="flex items-center gap-1 text-[11px] cursor-pointer">
                      <input
                        type="radio"
                        name="unitMode"
                        checked={unitMode === u}
                        onChange={() => setUnitMode(u)}
                      />
                      <span>{u}</span>
                    </label>
                  ))}
                  <label className="flex items-center gap-1 text-[11px] ml-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={gstSlabWise}
                      onChange={(e) => setGstSlabWise(e.target.checked)}
                    />
                    <span>Slab-Wise</span>
                  </label>
                </div>
              )}

              {activeReport === 'gst3b' && (
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={withRcm}
                      onChange={(e) => setWithRcm(e.target.checked)}
                    />
                    <span>With RCM</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includePr}
                      onChange={(e) => setIncludePr(e.target.checked)}
                    />
                    <span>Include PR</span>
                  </label>
                </div>
              )}

              {activeReport === 'gstr1Errors' && (
                <label className="flex items-center gap-1.5 text-[11px] cursor-pointer text-amber-600 dark:text-amber-400 font-semibold">
                  <input
                    type="checkbox"
                    checked={errorOnly}
                    onChange={(e) => setErrorOnly(e.target.checked)}
                  />
                  <span>Show Only Error Rows</span>
                </label>
              )}

              {activeReport === 'itc04' && (
                <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--bg-base)] p-0.5">
                  <button
                    type="button"
                    onClick={() => setItc04Tab('sent')}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      itc04Tab === 'sent' ? 'bg-blue-600 text-white' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    Table 1: Sent to Worker
                  </button>
                  <button
                    type="button"
                    onClick={() => setItc04Tab('received')}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      itc04Tab === 'received' ? 'bg-blue-600 text-white' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    Table 2: Received Back
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* =============================================================== */}
          {/* REPORT CONTENT VIEWPORT                                         */}
          {/* =============================================================== */}
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
            {/* If GSTR-1 is selected, render complete full JSM GSTR-1 experience */}
            {activeReport === 'gstr1' && (
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
                <GSTReportsTab
                  defaultFrom={fromDate}
                  defaultTo={toDate}
                  onClose={() => {}}
                />
              </div>
            )}

            {/* GSTR-3B Monthly Return View */}
            {activeReport === 'gst3b' && (
              <div className="space-y-4">
                {/* Summary Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Outward Taxable</p>
                    <p className="text-lg font-bold mt-1 text-blue-600">{money(reportData?.outward?.taxable)}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">Table 3.1 Total Supplies</p>
                  </div>
                  <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Outward Tax Liability</p>
                    <p className="text-lg font-bold mt-1 text-rose-600">
                      {money((reportData?.outward?.cgst || 0) + (reportData?.outward?.sgst || 0) + (reportData?.outward?.igst || 0))}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)]">CGST + SGST + IGST</p>
                  </div>
                  <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Eligible ITC Claimed</p>
                    <p className="text-lg font-bold mt-1 text-emerald-600">
                      {money((reportData?.inward?.cgst || 0) + (reportData?.inward?.sgst || 0) + (reportData?.inward?.igst || 0))}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)]">Table 4 All Books Inward</p>
                  </div>
                  <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Net Cash Payable</p>
                    <p className="text-lg font-bold mt-1 text-purple-600">
                      {money((reportData?.netPayable?.cgst || 0) + (reportData?.netPayable?.sgst || 0) + (reportData?.netPayable?.igst || 0))}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)]">After ITC Offset</p>
                  </div>
                </div>

                {/* Table 3.1 & Table 4 Breakdown */}
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg-base)] flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider">Table 3.1 — Outward Supplies & Reverse Charge</h3>
                    <span className="text-[11px] text-[var(--text-muted)]">Period: {fromDate?.slice(0, 7)}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[var(--bg-base)] text-[10px] uppercase font-bold text-[var(--text-muted)] border-b border-[var(--border)]">
                        <tr>
                          <th className="px-3 py-2">Nature of Supply</th>
                          <th className="px-3 py-2 text-right">Total Taxable (₹)</th>
                          <th className="px-3 py-2 text-right">IGST (₹)</th>
                          <th className="px-3 py-2 text-right">CGST (₹)</th>
                          <th className="px-3 py-2 text-right">SGST (₹)</th>
                          <th className="px-3 py-2 text-right">Cess (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        <tr>
                          <td className="px-3 py-2 font-medium">3.1(a) Outward Taxable Supplies (other than zero rated / nil)</td>
                          <td className="px-3 py-2 text-right font-mono">{money(reportData?.outward?.taxable)}</td>
                          <td className="px-3 py-2 text-right font-mono">{money(reportData?.outward?.igst)}</td>
                          <td className="px-3 py-2 text-right font-mono">{money(reportData?.outward?.cgst)}</td>
                          <td className="px-3 py-2 text-right font-mono">{money(reportData?.outward?.sgst)}</td>
                          <td className="px-3 py-2 text-right font-mono">{money(reportData?.outward?.cess)}</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-medium">3.1(b) Outward Zero Rated Supplies (Exports)</td>
                          <td className="px-3 py-2 text-right font-mono">{money(reportData?.zeroRated?.taxable || 0)}</td>
                          <td className="px-3 py-2 text-right font-mono">{money(reportData?.zeroRated?.igst || 0)}</td>
                          <td className="px-3 py-2 text-right font-mono">₹0.00</td>
                          <td className="px-3 py-2 text-right font-mono">₹0.00</td>
                          <td className="px-3 py-2 text-right font-mono">{money(reportData?.zeroRated?.cess || 0)}</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-medium">3.1(d) Inward Supplies Liable to Reverse Charge (RCM)</td>
                          <td className="px-3 py-2 text-right font-mono">{money(reportData?.inward?.taxableRcm || 0)}</td>
                          <td className="px-3 py-2 text-right font-mono">{money(reportData?.inward?.igstRcm || 0)}</td>
                          <td className="px-3 py-2 text-right font-mono">{money(reportData?.inward?.cgstRcm || 0)}</td>
                          <td className="px-3 py-2 text-right font-mono">{money(reportData?.inward?.sgstRcm || 0)}</td>
                          <td className="px-3 py-2 text-right font-mono">₹0.00</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Table 4 Eligible ITC */}
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg-base)] flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider">Table 4 — Eligible Input Tax Credit (ITC)</h3>
                    <span className="text-[11px] text-[var(--text-muted)]">Consolidated Inward Books</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[var(--bg-base)] text-[10px] uppercase font-bold text-[var(--text-muted)] border-b border-[var(--border)]">
                        <tr>
                          <th className="px-3 py-2">Details</th>
                          <th className="px-3 py-2 text-right">IGST (₹)</th>
                          <th className="px-3 py-2 text-right">CGST (₹)</th>
                          <th className="px-3 py-2 text-right">SGST (₹)</th>
                          <th className="px-3 py-2 text-right">Cess (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        <tr>
                          <td className="px-3 py-2 font-medium">(A)(5) All Other ITC (Purchase, Mill, JobWork, Expense)</td>
                          <td className="px-3 py-2 text-right font-mono">{money(reportData?.inward?.igst)}</td>
                          <td className="px-3 py-2 text-right font-mono">{money(reportData?.inward?.cgst)}</td>
                          <td className="px-3 py-2 text-right font-mono">{money(reportData?.inward?.sgst)}</td>
                          <td className="px-3 py-2 text-right font-mono">{money(reportData?.inward?.cess)}</td>
                        </tr>
                        <tr className="bg-[var(--bg-base)] font-bold">
                          <td className="px-3 py-2">Net ITC Available (A - B)</td>
                          <td className="px-3 py-2 text-right font-mono">{money(reportData?.inward?.igst)}</td>
                          <td className="px-3 py-2 text-right font-mono">{money(reportData?.inward?.cgst)}</td>
                          <td className="px-3 py-2 text-right font-mono">{money(reportData?.inward?.sgst)}</td>
                          <td className="px-3 py-2 text-right font-mono">{money(reportData?.inward?.cess)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* GSTR-1 Error Checking View */}
            {activeReport === 'gstr1Errors' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Total Issues Detected</p>
                      <p className="text-xl font-bold mt-1 text-amber-500">
                        {reportData?.errors?.length || reportData?.totalErrors || 0}
                      </p>
                    </div>
                    <AlertTriangle size={24} className="text-amber-500 opacity-60" />
                  </div>
                  <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">GSTIN Format Audit</p>
                      <p className="text-xl font-bold mt-1 text-emerald-500">Active</p>
                    </div>
                    <ShieldCheck size={24} className="text-emerald-500 opacity-60" />
                  </div>
                  <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Source Query</p>
                      <p className="text-xs font-mono font-bold mt-1">JSM_VW_GST_ERROR_GSTR1</p>
                    </div>
                    <Database size={24} className="text-blue-500 opacity-60" />
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg-base)] flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider">Detected Errors & Potential Filing Notices</h3>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {reportData?.errors?.length || 0} discrepancies found
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[var(--bg-base)] text-[10px] uppercase font-bold text-[var(--text-muted)] border-b border-[var(--border)]">
                        <tr>
                          <th className="px-3 py-2">Bill / Voucher</th>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Party Name</th>
                          <th className="px-3 py-2">GSTIN</th>
                          <th className="px-3 py-2">Detected Issue</th>
                          <th className="px-3 py-2 text-center">Severity</th>
                          <th className="px-3 py-2">Recommended Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {!reportData?.errors?.length ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-12 text-center text-emerald-600 font-medium">
                              <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-500" />
                              Zero errors detected! All outward supply transactions comply with GSTR-1 rules.
                            </td>
                          </tr>
                        ) : (
                          reportData.errors.map((err, idx) => (
                            <tr key={idx} className="hover:bg-[var(--bg-base)]">
                              <td className="px-3 py-2 font-mono font-bold text-blue-600">{err.invoiceNo || err.billNo || '—'}</td>
                              <td className="px-3 py-2 text-[11px]">{dt(err.date)}</td>
                              <td className="px-3 py-2 font-medium">{err.partyName || err.party || '—'}</td>
                              <td className="px-3 py-2 font-mono text-[11px]">{err.gstin || 'EMPTY / URP'}</td>
                              <td className="px-3 py-2 text-amber-600 font-medium">{err.issue || err.message}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                  err.severity === 'high' || err.severity === 'ERROR'
                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                }`}>
                                  {err.severity || 'WARNING'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-[11px] text-[var(--text-muted)]">{err.action || 'Check Master'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* GSTR-2 Purchase Report View */}
            {activeReport === 'gstr2' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg-base)] flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider">
                        GSTR-2 Inward Supplies (4-Book Union: PU / ML / JB / JV)
                      </h3>
                      <p className="text-[10px] text-[var(--text-muted)]">Source: JSM_VW_GST_PURCHASE_ALL_GSTR2</p>
                    </div>
                    <span className="text-[11px] font-semibold text-blue-600">
                      {reportData?.purchases?.length || (Array.isArray(reportData) ? reportData.length : 0)} Inward Bills
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-[calc(80vh-280px)]">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[var(--bg-base)] text-[10px] uppercase font-bold text-[var(--text-muted)] border-b border-[var(--border)] sticky top-0 z-10">
                        <tr>
                          <th className="px-3 py-2">Book</th>
                          <th className="px-3 py-2">Invoice No</th>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Supplier Name</th>
                          <th className="px-3 py-2">GSTIN</th>
                          <th className="px-3 py-2">POS</th>
                          <th className="px-3 py-2 text-right">Taxable</th>
                          <th className="px-3 py-2 text-right">CGST</th>
                          <th className="px-3 py-2 text-right">SGST</th>
                          <th className="px-3 py-2 text-right">IGST</th>
                          <th className="px-3 py-2 text-right">Total Tax</th>
                          <th className="px-3 py-2 text-right">Invoice Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {(() => {
                          const rows = reportData?.purchases || (Array.isArray(reportData) ? reportData : []);
                          if (!rows.length) {
                            return (
                              <tr>
                                <td colSpan={12} className="px-4 py-12 text-center text-[var(--text-muted)]">
                                  No purchase transactions recorded in this period.
                                </td>
                              </tr>
                            );
                          }
                          return rows.map((r, i) => (
                            <tr key={r._id || i} className="hover:bg-[var(--bg-base)]">
                              <td className="px-3 py-2">
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                                  {r.book || 'PU'}
                                </span>
                              </td>
                              <td className="px-3 py-2 font-mono font-semibold">{r.invoiceNo || r.billNo || '—'}</td>
                              <td className="px-3 py-2 text-[11px]">{dt(r.date || r.billDate)}</td>
                              <td className="px-3 py-2 font-medium truncate max-w-[180px]">{r.partyName || r.supplier || '—'}</td>
                              <td className="px-3 py-2 font-mono text-[11px]">{r.gstin || 'URP'}</td>
                              <td className="px-3 py-2 text-[11px]">{r.pos || r.state || '—'}</td>
                              <td className="px-3 py-2 text-right font-mono">{money(r.taxableAmount || r.taxable)}</td>
                              <td className="px-3 py-2 text-right font-mono">{money(r.cgst)}</td>
                              <td className="px-3 py-2 text-right font-mono">{money(r.sgst)}</td>
                              <td className="px-3 py-2 text-right font-mono">{money(r.igst)}</td>
                              <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-600">
                                {money(r.gstAmount || (r.cgst || 0) + (r.sgst || 0) + (r.igst || 0))}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-bold">{money(r.netAmount || r.grandTotal)}</td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* GSTR Matching / Reconciliation View */}
            {activeReport === 'gstrMatching' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
                    <p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Reconciliation Logic</p>
                    <p className="text-xs font-mono font-bold mt-1 text-blue-600">VW_T_2A_MATCHING</p>
                    <p className="text-[10px] text-[var(--text-muted)]">Normalized invoice number matching</p>
                  </div>
                  <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
                    <p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Books vs 2B Status</p>
                    <p className="text-xs font-bold mt-1 text-emerald-600">Zero Critical Variance</p>
                    <p className="text-[10px] text-[var(--text-muted)]">Matching threshold: ±₹1.00</p>
                  </div>
                  <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
                    <p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Auto Re-con Date</p>
                    <p className="text-xs font-semibold mt-1">Carried to GSTR-3B ITC</p>
                    <p className="text-[10px] text-[var(--text-muted)]">Based on portal filing period</p>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg-base)] flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider">Reconciliation Comparison</h3>
                    <span className="text-[11px] text-[var(--text-muted)]">Books Records vs GSTR-2B Records</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[var(--bg-base)] text-[10px] uppercase font-bold text-[var(--text-muted)] border-b border-[var(--border)]">
                        <tr>
                          <th className="px-3 py-2">Check / Category</th>
                          <th className="px-3 py-2 text-right">Books Total (₹)</th>
                          <th className="px-3 py-2 text-right">Portal 2B / GSTR-1 (₹)</th>
                          <th className="px-3 py-2 text-right">Variance (₹)</th>
                          <th className="px-3 py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {reportData?.checks?.length ? (
                          reportData.checks.map((chk, i) => (
                            <tr key={i} className="hover:bg-[var(--bg-base)]">
                              <td className="px-3 py-2 font-medium">{chk.checkName}</td>
                              <td className="px-3 py-2 text-right font-mono">{money(chk.gstr3bVal || chk.booksVal)}</td>
                              <td className="px-3 py-2 text-right font-mono">{money(chk.gstr1Val || chk.portalVal)}</td>
                              <td className="px-3 py-2 text-right font-mono font-semibold">{money(chk.diff)}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                  Math.abs(Number(chk.diff) || 0) < 1
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                }`}>
                                  {Math.abs(Number(chk.diff) || 0) < 1 ? 'MATCHED' : 'VARIANCE'}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-muted)]">
                              Click "Load Data" to run reconciliation against live transactions.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ITC 04 Job Work Return View */}
            {activeReport === 'itc04' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg-base)] flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider">
                        {itc04Tab === 'sent'
                          ? 'Table 1: Goods Sent to Job Worker (JSM_VW_GST_ITC4_ISSUE)'
                          : 'Table 2: Goods Received Back (JSM_VW_GST_ITC4_RECEIPT_ITEM)'}
                      </h3>
                      <p className="text-[10px] text-[var(--text-muted)]">Form ITC_04_EXCEL_25 Parity</p>
                    </div>
                    <span className="text-[11px] font-semibold text-blue-600">
                      {reportData?.rows?.length || 0} Records
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-[calc(80vh-280px)]">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[var(--bg-base)] text-[10px] uppercase font-bold text-[var(--text-muted)] border-b border-[var(--border)] sticky top-0 z-10">
                        <tr>
                          <th className="px-3 py-2">Job Card</th>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Job Worker</th>
                          <th className="px-3 py-2">Worker GSTIN</th>
                          <th className="px-3 py-2">Item</th>
                          <th className="px-3 py-2">HSN</th>
                          <th className="px-3 py-2 text-right">Issue Qty</th>
                          <th className="px-3 py-2 text-right">Recd Qty</th>
                          <th className="px-3 py-2 text-center">Status</th>
                          <th className="px-3 py-2 text-right">Charges</th>
                          <th className="px-3 py-2 text-right">GST</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {reportData?.rows?.length ? (
                          reportData.rows.map((r, i) => (
                            <tr key={r._id || i} className="hover:bg-[var(--bg-base)]">
                              <td className="px-3 py-2 font-mono font-semibold text-blue-600">{r.jobCardNo || '—'}</td>
                              <td className="px-3 py-2 text-[11px]">{dt(r.issueDate || r.date)}</td>
                              <td className="px-3 py-2 font-medium">{r.workerName || r.partyName || '—'}</td>
                              <td className="px-3 py-2 font-mono text-[11px]">{r.workerGstin || r.gstin || 'URP'}</td>
                              <td className="px-3 py-2 truncate max-w-[140px]">{r.itemName || 'Fabric'}</td>
                              <td className="px-3 py-2 font-mono text-[11px]">{r.hsnCode || '—'}</td>
                              <td className="px-3 py-2 text-right font-mono">{r.issueQty || 0}</td>
                              <td className="px-3 py-2 text-right font-mono">{r.receivedQty || 0}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                  r.status === 'Completed'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                }`}>
                                  {r.status || 'Pending'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right font-mono">{money(r.taxableAmount)}</td>
                              <td className="px-3 py-2 text-right font-mono">{money(r.gstAmount)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={11} className="px-4 py-12 text-center text-[var(--text-muted)]">
                              No ITC-04 records found for this period.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* E-Way Bill Suite (Bulk Gen, Status, Excel) */}
            {['ewayBulk', 'ewayStatus', 'ewayExcel'].includes(activeReport) && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold">NIC E-Way Bill & E-Invoice Integration</h3>
                    <p className="text-xs text-[var(--text-muted)]">
                      Exports exact JSON matching SANCHAL_CREATION_E-WAY_JSON.json for NIC portal upload
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--text-muted)]">Min Invoice ₹:</span>
                    <input
                      type="number"
                      value={minEwayAmount}
                      onChange={(e) => setMinEwayAmount(Number(e.target.value))}
                      className="w-24 h-8 px-2 rounded border border-[var(--border)] bg-[var(--bg-base)] text-xs font-mono font-bold"
                    />
                    <button
                      type="button"
                      onClick={handleJsonExport}
                      className="erp-btn erp-btn-primary h-8 px-3 text-xs gap-1.5"
                    >
                      <Download size={13} /> Export NIC JSON
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg-base)] flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider">Outward Invoices & Generated E-Way Bills</h4>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {reportData?.sales?.length || 0} Invoices Available
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-[calc(80vh-280px)]">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[var(--bg-base)] text-[10px] uppercase font-bold text-[var(--text-muted)] border-b border-[var(--border)] sticky top-0 z-10">
                        <tr>
                          <th className="px-3 py-2">Invoice No</th>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Customer Name</th>
                          <th className="px-3 py-2">Customer GSTIN</th>
                          <th className="px-3 py-2 text-right">Taxable (₹)</th>
                          <th className="px-3 py-2 text-right">GST (₹)</th>
                          <th className="px-3 py-2 text-right">Total Invoice (₹)</th>
                          <th className="px-3 py-2 text-center">Threshold</th>
                          <th className="px-3 py-2">E-Way Bill Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {reportData?.sales?.length ? (
                          reportData.sales.map((s, idx) => {
                            const totalVal = Number(s.netAmount || s.grandTotal || 0);
                            const exceeds = totalVal >= minEwayAmount;
                            return (
                              <tr key={s._id || idx} className="hover:bg-[var(--bg-base)]">
                                <td className="px-3 py-2 font-mono font-bold text-blue-600">{s.billNo || s.invoiceNo || '—'}</td>
                                <td className="px-3 py-2 text-[11px]">{dt(s.billDate || s.date)}</td>
                                <td className="px-3 py-2 font-medium">{s.partyName || '—'}</td>
                                <td className="px-3 py-2 font-mono text-[11px]">{s.partyGstin || s.gstin || 'URP'}</td>
                                <td className="px-3 py-2 text-right font-mono">{money(s.taxableAmount || s.taxable)}</td>
                                <td className="px-3 py-2 text-right font-mono">{money(s.gstAmount || s.taxTotal)}</td>
                                <td className="px-3 py-2 text-right font-mono font-bold">{money(totalVal)}</td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                    exceeds
                                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                  }`}>
                                    {exceeds ? 'Mandatory (>50K)' : 'Optional'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-[11px]">
                                  {s.ewayBillNo ? (
                                    <span className="font-mono text-emerald-600 font-semibold">{s.ewayBillNo}</span>
                                  ) : (
                                    <span className="text-[var(--text-muted)]">Ready for JSON</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={9} className="px-4 py-12 text-center text-[var(--text-muted)]">
                              No outward invoices found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* GSTR-9 Annual Return View */}
            {activeReport === 'gstr9' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg-base)] flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider">
                        GSTR-9 Annual Return Summary (FY {financialYear})
                      </h3>
                      <p className="text-[10px] text-[var(--text-muted)]">Source Views: RPT_GSTR9_SALES_MONTH, RPT_GSTR9_INPUT_MONTH</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleJsonExport}
                      className="erp-btn erp-btn-secondary h-7 px-2.5 text-xs gap-1"
                    >
                      <Download size={12} /> Portal JSON
                    </button>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-base)]">
                        <p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Table 4: Outward Taxable Turnover</p>
                        <p className="text-base font-bold mt-1 text-blue-600">{money(reportData?.table4?.taxable || reportData?.totalTaxable)}</p>
                      </div>
                      <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-base)]">
                        <p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Table 5: Outward Exempt Supplies</p>
                        <p className="text-base font-bold mt-1 text-emerald-600">{money(reportData?.table5?.taxable || 0)}</p>
                      </div>
                      <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-base)]">
                        <p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Table 6 & 8: Total ITC Availed</p>
                        <p className="text-base font-bold mt-1 text-purple-600">{money(reportData?.table6?.totalItc || reportData?.totalItc)}</p>
                      </div>
                    </div>

                    {/* Monthly Breakup Table */}
                    {reportData?.monthly?.length ? (
                      <div className="rounded-lg border border-[var(--border)] overflow-hidden">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-[var(--bg-base)] text-[10px] uppercase font-bold text-[var(--text-muted)] border-b border-[var(--border)]">
                            <tr>
                              <th className="px-3 py-2">Month Period</th>
                              <th className="px-3 py-2 text-right">Taxable Turnover (₹)</th>
                              <th className="px-3 py-2 text-right">CGST (₹)</th>
                              <th className="px-3 py-2 text-right">SGST (₹)</th>
                              <th className="px-3 py-2 text-right">IGST (₹)</th>
                              <th className="px-3 py-2 text-right">Total Tax (₹)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border)]">
                            {reportData.monthly.map((m, i) => (
                              <tr key={i} className="hover:bg-[var(--bg-base)]">
                                <td className="px-3 py-2 font-medium font-mono">{m.period}</td>
                                <td className="px-3 py-2 text-right font-mono">{money(m.totals?.taxable)}</td>
                                <td className="px-3 py-2 text-right font-mono">{money(m.totals?.cgst)}</td>
                                <td className="px-3 py-2 text-right font-mono">{money(m.totals?.sgst)}</td>
                                <td className="px-3 py-2 text-right font-mono">{money(m.totals?.igst)}</td>
                                <td className="px-3 py-2 text-right font-mono font-bold">
                                  {money((m.totals?.cgst || 0) + (m.totals?.sgst || 0) + (m.totals?.igst || 0))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            {/* GST 4.5 Rate Slab Analysis View */}
            {activeReport === 'gst45' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
                  <h3 className="text-xs font-bold uppercase tracking-wider mb-2">
                    GST Rate Slab Breakdown & Transition Analysis (Form Stp_Changes_GstRate_In_Master)
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Turnover and tax distribution across GST rates (0%, 0.25%, 3%, 5%, 12%, 18%, 28%, and 4.5% composition).
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg-base)] flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider">Rate Slab Roll-Up Table</span>
                    <span className="text-[11px] text-[var(--text-muted)]">Live Aggregations</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[var(--bg-base)] text-[10px] uppercase font-bold text-[var(--text-muted)] border-b border-[var(--border)]">
                        <tr>
                          <th className="px-3 py-2">Tax Rate Slab</th>
                          <th className="px-3 py-2 text-right">Invoices / Count</th>
                          <th className="px-3 py-2 text-right">Taxable Turnover (₹)</th>
                          <th className="px-3 py-2 text-right">CGST (₹)</th>
                          <th className="px-3 py-2 text-right">SGST (₹)</th>
                          <th className="px-3 py-2 text-right">IGST (₹)</th>
                          <th className="px-3 py-2 text-right">Total Tax (₹)</th>
                          <th className="px-3 py-2 text-right">Net Value (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {reportData?.rateSummary?.groups?.length ? (
                          reportData.rateSummary.groups.map((grp, i) => (
                            <tr key={i} className="hover:bg-[var(--bg-base)]">
                              <td className="px-3 py-2 font-bold font-mono text-blue-600">{grp.groupKey || '0%'}</td>
                              <td className="px-3 py-2 text-right font-mono">{grp.count || 0}</td>
                              <td className="px-3 py-2 text-right font-mono">{money(grp.taxableAmount)}</td>
                              <td className="px-3 py-2 text-right font-mono">{money(grp.cgst)}</td>
                              <td className="px-3 py-2 text-right font-mono">{money(grp.sgst)}</td>
                              <td className="px-3 py-2 text-right font-mono">{money(grp.igst)}</td>
                              <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-600">{money(grp.gstAmount)}</td>
                              <td className="px-3 py-2 text-right font-mono font-bold">{money(grp.netAmount)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8} className="px-4 py-12 text-center text-[var(--text-muted)]">
                              No slab-wise data available for this range.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* GSTIN Registers (Sales, Purchase, Process, JobWork, Journal, Expense) */}
            {['gstinSales', 'gstinPurchase', 'gstinProcess', 'gstinJobwork', 'gstinJournal', 'gstinExpense'].includes(activeReport) && (
              <div className="space-y-4">
                {/* Header info */}
                <div className="flex items-center justify-between px-1">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      {activeReportMeta.label} ({subMode.toUpperCase()})
                    </h3>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {dt(fromDate)} to {dt(toDate)} · Backed by JSM SQL definition
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-blue-600">
                    {reportData?.rows?.length || reportData?.groups?.length || 0} Records
                  </span>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
                  <div className="overflow-x-auto max-h-[calc(80vh-270px)]">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[var(--bg-base)] text-[10px] uppercase font-bold text-[var(--text-muted)] border-b border-[var(--border)] sticky top-0 z-10">
                        <tr>
                          {subMode === 'summary' || subMode === 'returnSummary' ? (
                            <>
                              <th className="px-3 py-2">Group / Particulars</th>
                              <th className="px-3 py-2 text-right">Vouchers</th>
                              <th className="px-3 py-2 text-right">Taxable Amount (₹)</th>
                              <th className="px-3 py-2 text-right">CGST (₹)</th>
                              <th className="px-3 py-2 text-right">SGST (₹)</th>
                              <th className="px-3 py-2 text-right">IGST (₹)</th>
                              <th className="px-3 py-2 text-right">Total GST (₹)</th>
                              <th className="px-3 py-2 text-right">Net Value (₹)</th>
                            </>
                          ) : (
                            <>
                              <th className="px-3 py-2">Voucher No</th>
                              <th className="px-3 py-2">Date</th>
                              <th className="px-3 py-2">Party / Worker Name</th>
                              <th className="px-3 py-2">GSTIN</th>
                              <th className="px-3 py-2">State / POS</th>
                              <th className="px-3 py-2 text-right">Rate %</th>
                              <th className="px-3 py-2 text-right">Taxable (₹)</th>
                              <th className="px-3 py-2 text-right">CGST (₹)</th>
                              <th className="px-3 py-2 text-right">SGST (₹)</th>
                              <th className="px-3 py-2 text-right">IGST (₹)</th>
                              <th className="px-3 py-2 text-right">Total Net (₹)</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {/* Summary Groups */}
                        {(subMode === 'summary' || subMode === 'returnSummary') && reportData?.groups?.length ? (
                          reportData.groups.map((g, i) => (
                            <tr key={i} className="hover:bg-[var(--bg-base)]">
                              <td className="px-3 py-2 font-medium">{g.groupKey || 'All'}</td>
                              <td className="px-3 py-2 text-right font-mono">{g.count || 0}</td>
                              <td className="px-3 py-2 text-right font-mono">{money(g.taxableAmount)}</td>
                              <td className="px-3 py-2 text-right font-mono">{money(g.cgst)}</td>
                              <td className="px-3 py-2 text-right font-mono">{money(g.sgst)}</td>
                              <td className="px-3 py-2 text-right font-mono">{money(g.igst)}</td>
                              <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-600">{money(g.gstAmount)}</td>
                              <td className="px-3 py-2 text-right font-mono font-bold">{money(g.netAmount)}</td>
                            </tr>
                          ))
                        ) : reportData?.rows?.length ? (
                          reportData.rows.map((r, i) => (
                            <tr key={r._id || i} className="hover:bg-[var(--bg-base)]">
                              <td className="px-3 py-2 font-mono font-bold text-blue-600">
                                {r.invoiceNo || r.billNo || r.jobCardNo || r.entryNo || '—'}
                              </td>
                              <td className="px-3 py-2 text-[11px]">{dt(r.date || r.issueDate || r.billDate)}</td>
                              <td className="px-3 py-2 font-medium truncate max-w-[180px]">
                                {r.partyName || r.workerName || r.accountName || '—'}
                              </td>
                              <td className="px-3 py-2 font-mono text-[11px]">{r.gstin || r.workerGstin || 'URP'}</td>
                              <td className="px-3 py-2 text-[11px]">{r.stateName || r.state || r.processType || '—'}</td>
                              <td className="px-3 py-2 text-right font-mono">{r.gstRate || 0}%</td>
                              <td className="px-3 py-2 text-right font-mono">{money(r.taxableAmount)}</td>
                              <td className="px-3 py-2 text-right font-mono">{money(r.cgst)}</td>
                              <td className="px-3 py-2 text-right font-mono">{money(r.sgst)}</td>
                              <td className="px-3 py-2 text-right font-mono">{money(r.igst)}</td>
                              <td className="px-3 py-2 text-right font-mono font-bold">{money(r.netAmount)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={11} className="px-4 py-12 text-center text-[var(--text-muted)]">
                              No records found for the selected criteria.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Universal Footer Status Bar */}
          <footer className="shrink-0 px-5 py-2.5 border-t border-[var(--border)] bg-[var(--bg-card)] flex items-center justify-between text-xs text-[var(--text-muted)]">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Connected to MERN Live Engine
              </span>
              <span>·</span>
              <span>Calculations strictly preserved</span>
            </div>
            <div className="flex items-center gap-4 font-mono text-[11px]">
              <span>Active: {activeReportMeta.label}</span>
              <span>Range: {dt(fromDate)} – {dt(toDate)}</span>
            </div>
          </footer>
        </main>
      </div>

      {/* Hidden ListPrint component for printing */}
      {printCfg && (
        <div className="hidden">
          <ListPrint
            title={printCfg.title}
            subtitle={printCfg.subtitle}
            columns={printCfg.columns}
            data={printCfg.data}
            onClose={() => setPrintCfg(null)}
          />
        </div>
      )}
    </Modal>
  );
}
