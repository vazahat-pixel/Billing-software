import React, { useState, useMemo, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import useStore from '../../store/useStore';
import { toast } from '../../store/useToastStore';
import { SkeletonTable } from '../../components/ui/loaders';
import { notifyError } from '../../utils/notify';
import { downloadJson, getMonthDateRange, buildGstr1Filename } from '../../utils/gstExport';
import { exportTableToExcel } from '../../utils/reportExport';
import { stage4Api } from '../../api/stage4.api';
import {
   Check,
   AlertTriangle,
   AlertCircle,
   RefreshCw,
   Download,
   FileText,
   CheckCircle2,
   FileSpreadsheet,
   Eye,
   Play,
   Sparkles,
   Calendar,
   ShieldCheck,
   ShieldAlert,
   X
} from 'lucide-react';

const GST_MODAL_CLASS = 'max-w-6xl w-full h-[min(92vh,900px)] p-0 rounded-2xl';
const moneyInr = (n) =>
   `₹ ${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// ==========================================
// 1. GSTR-3B MONTHLY COMPLIANCE MODAL
// ==========================================
export const Gst3bMonthlyModal = ({ isOpen, onClose }) => {
   const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
   const [isFiling, setIsFiling] = useState(false);
   const [filedStatus, setFiledStatus] = useState(false);
   const [loading, setLoading] = useState(false);
   const [reportData, setReportData] = useState(null);

   useEffect(() => {
      if (!isOpen) return;
      setLoading(true);
      setFiledStatus(false);
      stage4Api.gstr3b({ period: selectedMonth })
         .then((data) => {
            const outward = data?.outward || {};
            const inward = data?.inward || {};
            const net = data?.netPayable || {};
            setReportData({
               salesTaxable: outward.taxable || 0,
               salesCgst: outward.cgst || 0,
               salesSgst: outward.sgst || 0,
               salesIgst: outward.igst || 0,
               salesTotalGst: (outward.cgst || 0) + (outward.sgst || 0) + (outward.igst || 0),
               purchasesTaxable: inward.taxable || 0,
               purchasesCgst: inward.cgst || 0,
               purchasesSgst: inward.sgst || 0,
               purchasesIgst: inward.igst || 0,
               purchasesTotalGst: (inward.cgst || 0) + (inward.sgst || 0) + (inward.igst || 0),
               netCgst: net.cgst || 0,
               netSgst: net.sgst || 0,
               netIgst: net.igst || 0,
               netTotal: (net.cgst || 0) + (net.sgst || 0) + (net.igst || 0) + (net.cess || 0),
            });
         })
         .catch((err) => notifyError(err, 'Failed to load GSTR-3B'))
         .finally(() => setLoading(false));
   }, [isOpen, selectedMonth]);

   const display = reportData || {
      salesTaxable: 0, salesCgst: 0, salesSgst: 0, salesIgst: 0, salesTotalGst: 0,
      purchasesTaxable: 0, purchasesCgst: 0, purchasesSgst: 0, purchasesIgst: 0, purchasesTotalGst: 0,
      netCgst: 0, netSgst: 0, netIgst: 0, netTotal: 0,
   };

   const handleFileReturn = async () => {
      setIsFiling(true);
      try {
         await stage4Api.snapshotReturn({ returnType: 'GSTR3B', period: selectedMonth });
         setFiledStatus(true);
         toast.success('GSTR-3B snapshot saved — ready for GST portal upload');
      } catch (err) {
         notifyError(err, 'GSTR-3B snapshot failed');
      } finally {
         setIsFiling(false);
      }
   };

   return (
      <Modal isOpen={isOpen} onClose={onClose} title="GSTR-3B Monthly Return" className={GST_MODAL_CLASS}>
         <div className="flex flex-col h-full min-h-0 bg-[var(--bg-base)]">
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-card)]">
               <p className="text-[11px] text-[var(--text-muted)]">
                  Books-derived summary for portal filing · Period {selectedMonth}
               </p>
               <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 h-8 px-2 rounded border border-[var(--border)] bg-[var(--bg-base)] text-[11px] font-semibold text-[var(--text-primary)]">
                     <Calendar size={14} className="text-[var(--text-muted)]" />
                     <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => { setSelectedMonth(e.target.value); setFiledStatus(false); }}
                        className="bg-transparent outline-none"
                     />
                  </label>
                  <button
                     type="button"
                     disabled={isFiling || filedStatus || loading}
                     onClick={handleFileReturn}
                     className="erp-btn erp-btn-primary h-8 px-3 text-[11px] gap-1"
                  >
                     {isFiling ? <RefreshCw size={12} className="animate-spin" /> : filedStatus ? <CheckCircle2 size={12} /> : <Play size={12} />}
                     {isFiling ? 'Saving…' : filedStatus ? 'Snapshot saved' : 'Save snapshot'}
                  </button>
               </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
               {loading && (
                  <p className="text-[12px] text-[var(--text-muted)]">Loading GSTR-3B…</p>
               )}
               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-3">
                     <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">3.1 Outward supplies</span>
                        <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-[var(--bg-base)] text-[var(--text-muted)]">Liability</span>
                     </div>
                     <div className="flex justify-between text-[12px]"><span className="text-[var(--text-muted)]">Taxable</span><span className="font-semibold tabular-nums">{moneyInr(display.salesTaxable)}</span></div>
                     <div className="flex justify-between text-[12px]"><span className="text-[var(--text-muted)]">IGST</span><span className="tabular-nums">{moneyInr(display.salesIgst)}</span></div>
                     <div className="flex justify-between text-[12px]"><span className="text-[var(--text-muted)]">CGST / SGST</span><span className="tabular-nums">{moneyInr(display.salesCgst)} / {moneyInr(display.salesSgst)}</span></div>
                     <div className="pt-2 border-t border-[var(--border-subtle)]">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Gross liability</p>
                        <p className="text-xl font-bold tabular-nums text-[var(--text-primary)] mt-1">{moneyInr(display.salesTotalGst)}</p>
                     </div>
                  </div>

                  <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-3">
                     <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">4. Eligible ITC</span>
                        <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">Credit</span>
                     </div>
                     <div className="flex justify-between text-[12px]"><span className="text-[var(--text-muted)]">Inward taxable</span><span className="font-semibold tabular-nums">{moneyInr(display.purchasesTaxable)}</span></div>
                     <div className="flex justify-between text-[12px]"><span className="text-[var(--text-muted)]">IGST</span><span className="tabular-nums">{moneyInr(display.purchasesIgst)}</span></div>
                     <div className="flex justify-between text-[12px]"><span className="text-[var(--text-muted)]">CGST / SGST</span><span className="tabular-nums">{moneyInr(display.purchasesCgst)} / {moneyInr(display.purchasesSgst)}</span></div>
                     <div className="pt-2 border-t border-[var(--border-subtle)]">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">ITC available</p>
                        <p className="text-xl font-bold tabular-nums text-[var(--text-primary)] mt-1">{moneyInr(display.purchasesTotalGst)}</p>
                     </div>
                  </div>

                  <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-3 md:col-span-2 xl:col-span-1">
                     <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Net tax position</p>
                     <p className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">{moneyInr(Math.abs(display.netTotal))}</p>
                     <p className="text-[11px] text-[var(--text-muted)]">{display.netTotal < 0 ? 'Surplus credit (ITC &gt; liability)' : 'Net tax payable'}</p>
                     <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border-subtle)]">
                        <div>
                           <p className="text-[9px] font-bold uppercase text-[var(--text-muted)]">CGST</p>
                           <p className="text-[12px] font-semibold tabular-nums">{moneyInr(display.netCgst)}</p>
                        </div>
                        <div>
                           <p className="text-[9px] font-bold uppercase text-[var(--text-muted)]">SGST</p>
                           <p className="text-[12px] font-semibold tabular-nums">{moneyInr(display.netSgst)}</p>
                        </div>
                        <div>
                           <p className="text-[9px] font-bold uppercase text-[var(--text-muted)]">IGST</p>
                           <p className="text-[12px] font-semibold tabular-nums">{moneyInr(display.netIgst)}</p>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </Modal>
   );
};



// ==========================================
// 2. GSTR-1 OUTWARD SUPPLIES RETURN MODAL
// ==========================================
export const Gstr1Modal = ({ isOpen, onClose }) => {
   const { fetchGstr1, company } = useStore();
   const [activeTab, setActiveTab] = useState('b2b');
   const [exporting, setExporting] = useState(false);
   const [loading, setLoading] = useState(false);
   const [periodMode, setPeriodMode] = useState('thisMonth'); // thisMonth, lastMonth, q2, ytd, custom
   const [searchQuery, setSearchQuery] = useState('');
   const [rateFilter, setRateFilter] = useState('ALL');

   // Compute dates based on period presets
   const defaultDates = useMemo(() => {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth(); // 0-based
      const pad = (n) => String(n).padStart(2, '0');
      const lastDay = (year, month) => new Date(year, month + 1, 0).getDate();

      return {
         thisMonth: {
            from: `${y}-${pad(m + 1)}-01`,
            to: `${y}-${pad(m + 1)}-${pad(lastDay(y, m))}`,
            label: `This Month (${now.toLocaleString('en-IN', { month: 'short' })} ${y})`
         },
         lastMonth: {
            from: `${m === 0 ? y - 1 : y}-${pad(m === 0 ? 12 : m)}-01`,
            to: `${m === 0 ? y - 1 : y}-${pad(m === 0 ? 12 : m)}-${pad(lastDay(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1))}`,
            label: `Last Month (${new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'short' })} ${m === 0 ? y - 1 : y})`
         },
         q2: {
            from: `${y}-07-01`,
            to: `${y}-09-30`,
            label: `Q2 (Jul - Sep ${y})`
         },
         ytd: {
            from: `${m >= 3 ? y : y - 1}-04-01`,
            to: `${m >= 3 ? y + 1 : y}-03-31`,
            label: `FY ${m >= 3 ? y : y - 1}-${String((m >= 3 ? y + 1 : y)).slice(-2)} (Full Year)`
         }
      };
   }, []);

   const [startDate, setStartDate] = useState(defaultDates.thisMonth.from);
   const [endDate, setEndDate] = useState(defaultDates.thisMonth.to);
   const [gstr1Data, setGstr1Data] = useState(null);

   const loadData = async (from = startDate, to = endDate) => {
      setLoading(true);
      try {
         const data = await fetchGstr1(from, to);
         setGstr1Data(data || null);
      } catch (err) {
         notifyError(err, 'Failed to load GSTR-1');
         setGstr1Data(null);
      } finally {
         setLoading(false);
      }
   };

   useEffect(() => {
      if (isOpen) {
         loadData(startDate, endDate);
      }
   }, [isOpen, startDate, endDate]);

   const handlePeriodPreset = (preset) => {
      setPeriodMode(preset);
      if (defaultDates[preset]) {
         setStartDate(defaultDates[preset].from);
         setEndDate(defaultDates[preset].to);
      }
   };

   // Government JSON Download
   const handleDownloadJson = async () => {
      setExporting(true);
      try {
         const data = gstr1Data || (await fetchGstr1(startDate, endDate));
         const { invoices: _inv, period: _period, totals: _totals, ...payload } = data || {};
         const clean = data?.payload || payload;
         downloadJson(clean, buildGstr1Filename(startDate, endDate));
         toast.success(`GSTR-1 JSON downloaded (${startDate} to ${endDate})`);
      } catch (err) {
         notifyError(err, 'GSTR-1 export failed');
      } finally {
         setExporting(false);
      }
   };

   // Government Excel Workbook (.xlsx) Download
   const handleDownloadExcel = async () => {
      setExporting(true);
      try {
         const { exportGstr1Excel } = await import('../../utils/gstExport');
         const data = gstr1Data || (await fetchGstr1(startDate, endDate));
         const fileName = `GSTR1_V3_2_2_${startDate}_to_${endDate}.xlsx`;
         exportGstr1Excel(data, fileName);
         toast.success(`GSTR-1 Government Utility Excel downloaded!`);
      } catch (err) {
         notifyError(err, 'Excel export failed');
      } finally {
         setExporting(false);
      }
   };

   // Download Active Tab CSV
   const handleDownloadCsv = () => {
      const activeRows = tableData[activeTab] || [];
      if (!activeRows.length) {
         return toast.warning('No records to export in this section');
      }
      const exportCols = activeColumns.map(c => ({ key: c.key, label: c.label }));
      exportTableToExcel(`GSTR1_${activeTab.toUpperCase()}_${startDate}_to_${endDate}.csv`, exportCols, activeRows);
      toast.success(`${activeTab.toUpperCase()} exported to CSV`);
   };

   // Extract & Normalize Data from GSTR-1 API response
   const tableData = useMemo(() => {
      const payload = gstr1Data?.payload || gstr1Data || {};

      // 1. B2B Rows
      let b2bRows = payload.b2bRows || [];
      if (!b2bRows.length && Array.isArray(payload.b2b)) {
         b2bRows = payload.b2b.flatMap((party) =>
            (party.inv || []).map((inv) => {
               const det = inv.itms?.[0]?.itm_det || {};
               return {
                  gstin: party.ctin || '',
                  partyName: party.cname || inv.party_name || 'Registered Recipient',
                  invoiceNo: inv.inum || '',
                  date: inv.idt || '',
                  netAmount: inv.val || 0,
                  stateName: inv.pos_name || inv.pos || '',
                  reverseCharge: inv.rchrg || 'N',
                  invType: inv.inv_typ || 'Regular',
                  taxRate: `${det.rt || 5}%`,
                  taxableAmount: det.txval || 0,
                  cgst: det.camt || 0,
                  sgst: det.samt || 0,
                  igst: det.iamt || 0,
                  cess: det.csamt || 0,
               };
            })
         );
      }

      // 2. B2CL Rows
      const b2clRows = payload.b2clRows || [];

      // 3. B2CS Rows
      const b2csRows = (payload.b2cs || []).map((r, i) => {
         const txval = Number(r.txval || 0);
         const camt = Number(r.camt || 0);
         const samt = Number(r.samt || 0);
         const iamt = Number(r.iamt || 0);
         const csamt = Number(r.csamt || 0);
         const totTax = camt + samt + iamt + csamt;
         return {
            id: i,
            typ: r.typ || 'OE',
            pos: r.pos_name || r.pos || 'Local',
            taxRate: `${parseFloat(r.rt || 0).toFixed(2)}%`,
            rawRate: parseFloat(r.rt || 0),
            taxableAmount: txval,
            cgst: camt,
            sgst: samt,
            igst: iamt,
            cess: csamt,
            totalTax: totTax,
            grossTotal: txval + totTax,
         };
      });

      // 4. CDNR Rows
      const cdnrRows = payload.cdnrRows || [];

      // 5. CDNUR Rows
      const cdnuRows = payload.cdnuRows || [];

      // 6. EXP Rows
      const expRows = payload.expRows || [];

      // 7. EXEMP Rows
      const exempRows = (payload.exempRows || []).map((e) => ({
         ...e,
         total: Number(e.nilRated || 0) + Number(e.exempted || 0) + Number(e.nonGst || 0)
      }));

      // 8. HSN Rows
      const hsnRows = payload.hsnRows || payload.hsn?.data || [];

      // 9. DOCS Rows
      const docsRows = payload.docsRows || [];

      return {
         b2b: b2bRows,
         b2cl: b2clRows,
         b2cs: b2csRows,
         cdnr: cdnrRows,
         cdnu: cdnuRows,
         exp: expRows,
         exemp: exempRows,
         hsn: hsnRows,
         docs: docsRows,
      };
   }, [gstr1Data]);

   // Executive Summary KPI calculations
   const kpis = useMemo(() => {
      const totals = gstr1Data?.totals || {};
      const b2bList = tableData.b2b || [];
      const b2csList = tableData.b2cs || [];

      let taxable = Number(totals.taxable || 0);
      let cgst = Number(totals.cgst || 0);
      let sgst = Number(totals.sgst || 0);
      let igst = Number(totals.igst || 0);
      let cess = Number(totals.cess || 0);
      let invCount = Number(totals.invoiceCount || (b2bList.length + (tableData.b2cl?.length || 0)));

      // Fallback sum from tables if totals object is 0
      if (!taxable && (b2bList.length || b2csList.length)) {
         b2bList.forEach(r => {
            taxable += Number(r.taxableAmount || 0);
            cgst += Number(r.cgst || 0);
            sgst += Number(r.sgst || 0);
            igst += Number(r.igst || 0);
            cess += Number(r.cess || 0);
         });
         b2csList.forEach(r => {
            taxable += Number(r.taxableAmount || 0);
            cgst += Number(r.cgst || 0);
            sgst += Number(r.sgst || 0);
            igst += Number(r.igst || 0);
            cess += Number(r.cess || 0);
         });
      }

      const totalTax = cgst + sgst + igst + cess;
      const grossTotal = taxable + totalTax;

      return {
         invoiceCount: invCount,
         taxable,
         cgst,
         sgst,
         igst,
         cess,
         totalTax,
         grossTotal,
      };
   }, [gstr1Data, tableData]);

   // Filter rows based on search query & rate filter
   const filteredRows = useMemo(() => {
      const rows = tableData[activeTab] || [];
      const q = searchQuery.trim().toLowerCase();

      return rows.filter((r) => {
         // Rate filter
         if (rateFilter !== 'ALL') {
            const rowRate = parseFloat(r.taxRate || r.rt || r.rate || 0);
            if (parseFloat(rateFilter) !== rowRate) return false;
         }
         // Search filter
         if (!q) return true;
         const str = [
            r.invoiceNo,
            r.partyName,
            r.gstin,
            r.stateName,
            r.pos,
            r.noteNo,
            r.hsn_sc,
            r.desc,
            r.docType,
            r.exportType
         ].filter(Boolean).join(' ').toLowerCase();
         return str.includes(q);
      });
   }, [tableData, activeTab, searchQuery, rateFilter]);

   // Compute column-level totals for the active table
   const tableTotals = useMemo(() => {
      let taxable = 0;
      let cgst = 0;
      let sgst = 0;
      let igst = 0;
      let total = 0;

      filteredRows.forEach((r) => {
         taxable += Number(r.taxableAmount || r.txval || 0);
         cgst += Number(r.cgst || r.camt || 0);
         sgst += Number(r.sgst || r.samt || 0);
         igst += Number(r.igst || r.iamt || 0);
         total += Number(r.netAmount || r.grossTotal || r.val || r.total || 0);
      });

      return { taxable, cgst, sgst, igst, total };
   }, [filteredRows]);

   // Tab definitions with official schedule names
   const tabs = [
      { id: 'b2b', label: 'B2B Invoices', sub: '4A, 4B, 4C, 6B, 6C', count: tableData.b2b?.length || 0 },
      { id: 'b2cl', label: 'B2C (Large)', sub: 'Table 5A, 5B', count: tableData.b2cl?.length || 0 },
      { id: 'b2cs', label: 'B2C (Small)', sub: 'Table 7 Details', count: tableData.b2cs?.length || 0 },
      { id: 'cdnr', label: 'Credit / Debit (Reg)', sub: 'Table 9B CDNR', count: tableData.cdnr?.length || 0 },
      { id: 'cdnu', label: 'Credit / Debit (Unreg)', sub: 'Table 9B CDNUR', count: tableData.cdnu?.length || 0 },
      { id: 'exp', label: 'Exports (EXP)', sub: 'Table 6A', count: tableData.exp?.length || 0 },
      { id: 'exemp', label: 'Nil / Exempt', sub: 'Table 8A, 8B, 8C, 8D', count: tableData.exemp?.length || 0 },
      { id: 'hsn', label: 'HSN Summary', sub: 'Table 12 HSN', count: tableData.hsn?.length || 0 },
      { id: 'docs', label: 'Docs Issued', sub: 'Table 13 DOCS', count: tableData.docs?.length || 0 },
   ];

   // Columns configuration per active schedule
   const activeColumns = useMemo(() => {
      switch (activeTab) {
         case 'b2b':
            return [
               { key: 'invoiceNo', label: 'Invoice No', align: 'left', font: 'font-mono font-bold text-blue-700' },
               { key: 'date', label: 'Date', align: 'left' },
               { key: 'partyName', label: 'Receiver Name', align: 'left', font: 'font-semibold text-slate-800' },
               { key: 'gstin', label: 'Recipient GSTIN', align: 'left', font: 'font-mono text-slate-600' },
               { key: 'stateName', label: 'POS State', align: 'left' },
               { key: 'invType', label: 'Type', align: 'center', badge: true },
               { key: 'reverseCharge', label: 'RCM', align: 'center' },
               { key: 'taxRate', label: 'Rate', align: 'right' },
               { key: 'taxableAmount', label: 'Taxable (₹)', align: 'right', format: 'currency' },
               { key: 'cgst', label: 'CGST (₹)', align: 'right', format: 'currency' },
               { key: 'sgst', label: 'SGST (₹)', align: 'right', format: 'currency' },
               { key: 'igst', label: 'IGST (₹)', align: 'right', format: 'currency' },
               { key: 'netAmount', label: 'Invoice Total (₹)', align: 'right', format: 'currency', font: 'font-bold text-slate-900' },
            ];
         case 'b2cl':
            return [
               { key: 'invoiceNo', label: 'Invoice No', align: 'left', font: 'font-mono font-bold' },
               { key: 'date', label: 'Date', align: 'left' },
               { key: 'stateName', label: 'Place of Supply', align: 'left' },
               { key: 'taxRate', label: 'Rate', align: 'right' },
               { key: 'taxableAmount', label: 'Taxable (₹)', align: 'right', format: 'currency' },
               { key: 'igst', label: 'IGST (₹)', align: 'right', format: 'currency' },
               { key: 'cess', label: 'Cess (₹)', align: 'right', format: 'currency' },
               { key: 'netAmount', label: 'Invoice Value (₹)', align: 'right', format: 'currency', font: 'font-bold' },
            ];
         case 'b2cs':
            return [
               { key: 'typ', label: 'Type', align: 'left', font: 'font-semibold' },
               { key: 'pos', label: 'Place of Supply (POS)', align: 'left' },
               { key: 'taxRate', label: 'Rate', align: 'right' },
               { key: 'taxableAmount', label: 'Taxable Value (₹)', align: 'right', format: 'currency' },
               { key: 'cgst', label: 'CGST (₹)', align: 'right', format: 'currency' },
               { key: 'sgst', label: 'SGST (₹)', align: 'right', format: 'currency' },
               { key: 'igst', label: 'IGST (₹)', align: 'right', format: 'currency' },
               { key: 'totalTax', label: 'Total Tax (₹)', align: 'right', format: 'currency', font: 'text-amber-700 font-semibold' },
               { key: 'grossTotal', label: 'Gross Value (₹)', align: 'right', format: 'currency', font: 'font-bold text-slate-900' },
            ];
         case 'cdnr':
            return [
               { key: 'noteNo', label: 'Note No', align: 'left', font: 'font-mono font-bold text-purple-700' },
               { key: 'noteDate', label: 'Date', align: 'left' },
               { key: 'noteType', label: 'Note Type', align: 'center', badge: true },
               { key: 'partyName', label: 'Receiver Name', align: 'left' },
               { key: 'gstin', label: 'GSTIN', align: 'left', font: 'font-mono' },
               { key: 'pos', label: 'POS', align: 'left' },
               { key: 'taxRate', label: 'Rate', align: 'right' },
               { key: 'taxableAmount', label: 'Taxable (₹)', align: 'right', format: 'currency' },
               { key: 'cgst', label: 'CGST (₹)', align: 'right', format: 'currency' },
               { key: 'sgst', label: 'SGST (₹)', align: 'right', format: 'currency' },
               { key: 'igst', label: 'IGST (₹)', align: 'right', format: 'currency' },
               { key: 'reason', label: 'Reason', align: 'left' },
               { key: 'netAmount', label: 'Note Value (₹)', align: 'right', format: 'currency', font: 'font-bold' },
            ];
         case 'cdnu':
            return [
               { key: 'type', label: 'Supply Type', align: 'left' },
               { key: 'noteNo', label: 'Note No', align: 'left', font: 'font-mono font-bold' },
               { key: 'noteDate', label: 'Date', align: 'left' },
               { key: 'noteType', label: 'Type', align: 'center', badge: true },
               { key: 'pos', label: 'POS', align: 'left' },
               { key: 'taxRate', label: 'Rate', align: 'right' },
               { key: 'taxableAmount', label: 'Taxable (₹)', align: 'right', format: 'currency' },
               { key: 'cgst', label: 'CGST (₹)', align: 'right', format: 'currency' },
               { key: 'sgst', label: 'SGST (₹)', align: 'right', format: 'currency' },
               { key: 'igst', label: 'IGST (₹)', align: 'right', format: 'currency' },
               { key: 'netAmount', label: 'Value (₹)', align: 'right', format: 'currency', font: 'font-bold' },
            ];
         case 'exp':
            return [
               { key: 'exportType', label: 'Export Type', align: 'center', badge: true },
               { key: 'invoiceNo', label: 'Invoice No', align: 'left', font: 'font-mono font-bold' },
               { key: 'date', label: 'Date', align: 'left' },
               { key: 'portCode', label: 'Port Code', align: 'left' },
               { key: 'shippingBillNo', label: 'Shipping Bill No', align: 'left' },
               { key: 'taxRate', label: 'Rate', align: 'right' },
               { key: 'taxableAmount', label: 'Taxable (₹)', align: 'right', format: 'currency' },
               { key: 'igst', label: 'IGST (₹)', align: 'right', format: 'currency' },
               { key: 'invoiceValue', label: 'Invoice Value (₹)', align: 'right', format: 'currency', font: 'font-bold' },
            ];
         case 'exemp':
            return [
               { key: 'description', label: 'Description', align: 'left', font: 'font-semibold' },
               { key: 'nilRated', label: 'Nil Rated (₹)', align: 'right', format: 'currency' },
               { key: 'exempted', label: 'Exempted (₹)', align: 'right', format: 'currency' },
               { key: 'nonGst', label: 'Non-GST (₹)', align: 'right', format: 'currency' },
               { key: 'total', label: 'Total Value (₹)', align: 'right', format: 'currency', font: 'font-bold' },
            ];
         case 'hsn':
            return [
               { key: 'hsn_sc', label: 'HSN Code', align: 'left', font: 'font-mono font-bold text-blue-700' },
               { key: 'desc', label: 'Description', align: 'left', font: 'text-slate-800' },
               { key: 'uqc', label: 'UQC', align: 'center' },
               { key: 'qty', label: 'Total Quantity', align: 'right', format: 'number' },
               { key: 'txval', label: 'Taxable Value (₹)', align: 'right', format: 'currency' },
               { key: 'camt', label: 'CGST (₹)', align: 'right', format: 'currency' },
               { key: 'samt', label: 'SGST (₹)', align: 'right', format: 'currency' },
               { key: 'iamt', label: 'IGST (₹)', align: 'right', format: 'currency' },
               { key: 'val', label: 'Total Value (₹)', align: 'right', format: 'currency', font: 'font-bold text-slate-900' },
            ];
         case 'docs':
            return [
               { key: 'docType', label: 'Nature of Document', align: 'left', font: 'font-semibold' },
               { key: 'from', label: 'From Sr. No.', align: 'left', font: 'font-mono' },
               { key: 'to', label: 'To Sr. No.', align: 'left', font: 'font-mono' },
               { key: 'totnum', label: 'Total Issued', align: 'right', font: 'font-bold' },
               { key: 'cancel', label: 'Cancelled', align: 'right', font: 'text-rose-600 font-bold' },
               { key: 'net_issue', label: 'Net Number', align: 'right', font: 'text-emerald-700 font-bold' },
            ];
         default:
            return [];
      }
   }, [activeTab]);

   const fmtVal = (row, col) => {
      const v = row[col.key];
      if (col.format === 'currency') {
         return `₹ ${(Number(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      if (col.format === 'number') {
         return (Number(v) || 0).toLocaleString('en-IN');
      }
      return v != null && v !== '' ? String(v) : '—';
   };

   return (
      <Modal
         isOpen={isOpen}
         onClose={onClose}
         bare={true}
         className="max-w-[96vw] w-[96vw] max-h-[88vh] bg-slate-50 rounded-2xl p-0 border border-slate-300 shadow-2xl overflow-hidden flex flex-col"
      >
         <div className="flex flex-col bg-slate-50 overflow-hidden text-slate-800">
            {/* Header Ribbon */}
            <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between flex-wrap gap-2 shadow-sm shrink-0">
               <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-sm shadow-blue-200">
                     G1
                  </div>
                  <div>
                     <div className="flex items-center gap-1.5">
                        <h2 className="text-sm font-black text-slate-900 tracking-tight">GSTR-1 Outward Supplies Return</h2>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Rule 59(1)</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Live</span>
                     </div>
                     <p className="text-[10px] text-slate-500 mt-0.5">
                        <span className="font-semibold text-slate-700">{company?.name || 'Company Outward Register'}</span> · GSTIN: <strong className="font-mono text-blue-700">{company?.gstin || gstr1Data?.gstin || '24AAACC1206D1ZH'}</strong>
                     </p>
                  </div>
               </div>
               <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => loadData(startDate, endDate)} disabled={loading} className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-[11px] font-bold flex items-center gap-1 transition-all">
                     <RefreshCw size={11} className={loading ? 'animate-spin text-blue-600' : ''} /> Refresh
                  </button>
                  <button type="button" onClick={handleDownloadExcel} disabled={exporting || loading} className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[11px] font-bold flex items-center gap-1 transition-all disabled:opacity-50">
                     <FileSpreadsheet size={11} /> Excel (.xlsx)
                  </button>
                  <button type="button" onClick={handleDownloadJson} disabled={exporting || loading} className="px-2.5 py-1.5 bg-slate-800 hover:bg-black text-white rounded text-[11px] font-bold flex items-center gap-1 transition-all disabled:opacity-50">
                     <Download size={11} /> {exporting ? '...' : 'JSON'}
                  </button>
                  <button type="button" onClick={handleDownloadCsv} disabled={loading} className="px-2.5 py-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-800 rounded text-[11px] font-bold flex items-center gap-1 transition-all">
                     <FileText size={11} /> CSV
                  </button>
                  <button type="button" onClick={onClose} className="p-1.5 ml-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer" title="Close (Esc)">
                     <X size={15} />
                  </button>
               </div>
            </div>

            {/* Period + Date Controls */}
            <div className="bg-slate-100 border-b border-slate-200 px-4 py-1.5 flex items-center justify-between flex-wrap gap-2 shrink-0">
               <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-500 uppercase mr-1">Period:</span>
                  {[
                     { key: 'thisMonth', label: defaultDates.thisMonth.label },
                     { key: 'lastMonth', label: defaultDates.lastMonth.label },
                     { key: 'q2', label: defaultDates.q2.label },
                     { key: 'ytd', label: 'Full FY' },
                     { key: 'custom', label: 'Custom' },
                  ].map((p) => (
                     <button key={p.key} type="button" onClick={() => handlePeriodPreset(p.key)} className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${periodMode === p.key ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-200'}`}>
                        {p.label}
                     </button>
                  ))}
               </div>
               <div className="flex items-center gap-2 text-[11px]">
                  <div className="flex items-center gap-1 bg-white border border-slate-300 rounded px-2 py-0.5">
                     <span className="text-slate-400 font-semibold">From:</span>
                     <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPeriodMode('custom'); }} className="font-mono font-bold text-slate-800 bg-transparent outline-none text-[11px]" />
                  </div>
                  <div className="flex items-center gap-1 bg-white border border-slate-300 rounded px-2 py-0.5">
                     <span className="text-slate-400 font-semibold">To:</span>
                     <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPeriodMode('custom'); }} className="font-mono font-bold text-slate-800 bg-transparent outline-none text-[11px]" />
                  </div>
               </div>
            </div>

            {/* Compact KPI Bar */}
            <div className="bg-white border-b border-slate-200 px-4 py-1.5 shrink-0">
               <div className="flex items-center gap-1.5 overflow-x-auto">
                  {[
                     { label: 'Invoices', value: kpis.invoiceCount, isMoney: false, color: 'text-slate-900', bg: 'bg-slate-50 border-slate-200' },
                     { label: 'Taxable', value: kpis.taxable, isMoney: true, color: 'text-blue-800', bg: 'bg-blue-50 border-blue-100' },
                     { label: 'CGST', value: kpis.cgst, isMoney: true, color: 'text-emerald-800', bg: 'bg-emerald-50 border-emerald-100' },
                     { label: 'SGST', value: kpis.sgst, isMoney: true, color: 'text-emerald-800', bg: 'bg-emerald-50 border-emerald-100' },
                     { label: 'IGST', value: kpis.igst, isMoney: true, color: 'text-purple-800', bg: 'bg-purple-50 border-purple-100' },
                     { label: 'Total Tax', value: kpis.totalTax, isMoney: true, color: 'text-amber-800', bg: 'bg-amber-50 border-amber-100' },
                     { label: 'Gross Total', value: kpis.grossTotal, isMoney: true, color: 'text-white', bg: 'bg-slate-900 border-slate-900' },
                  ].map((kpi) => (
                     <div key={kpi.label} className={`flex items-center gap-1.5 px-2.5 py-1 rounded border ${kpi.bg} shrink-0`}>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">{kpi.label}:</span>
                        <span className={`text-[11px] font-black ${kpi.color} font-mono whitespace-nowrap`}>
                           {kpi.isMoney ? `₹ ${(Number(kpi.value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : kpi.value}
                        </span>
                     </div>
                  ))}
               </div>
            </div>

            {/* Schedule Tabs Bar */}
            <div className="bg-slate-100 border-b border-slate-300 px-3 pt-1 flex items-center gap-0.5 overflow-x-auto custom-scrollbar shrink-0">
               {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                     <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`px-2.5 py-1 rounded-t text-[11px] font-bold transition-all whitespace-nowrap flex items-center gap-1 border-t border-x ${isActive ? 'bg-white text-blue-700 border-slate-300 shadow-sm' : 'bg-slate-100 border-transparent text-slate-500 hover:bg-slate-200 hover:text-slate-800'}`}>
                        {tab.label}
                        <span className={`px-1 rounded text-[9px] font-extrabold ${isActive ? 'bg-blue-100 text-blue-700' : tab.count > 0 ? 'bg-slate-300 text-slate-700' : 'bg-slate-200 text-slate-400'}`}>{tab.count}</span>
                     </button>
                  );
               })}
            </div>

            {/* Filter & Search Toolbar */}
            <div className="bg-white px-4 py-1 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
               <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded px-2 py-1 flex-1 max-w-xs">
                  <span className="text-slate-400 text-[10px]">🔍</span>
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={`Search ${activeTab.toUpperCase()}…`} className="bg-transparent text-[11px] text-slate-800 placeholder-slate-400 outline-none w-full" />
                  {searchQuery && <button type="button" onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 text-[10px] font-bold">✕</button>}
               </div>
               <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 font-semibold">Rate:</span>
                  <select value={rateFilter} onChange={(e) => setRateFilter(e.target.value)} className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px] font-bold text-slate-700 outline-none">
                     <option value="ALL">All</option>
                     <option value="0">0%</option>
                     <option value="5">5%</option>
                     <option value="12">12%</option>
                     <option value="18">18%</option>
                     <option value="28">28%</option>
                  </select>
                  <span className="text-[11px] text-slate-500 border-l border-slate-200 pl-2">
                     <strong className="text-slate-800">{filteredRows.length}</strong> rec
                  </span>
               </div>
            </div>

            {/* Main Data Table */}
            <div className="bg-white overflow-auto custom-scrollbar flex flex-col max-h-[58vh]">
               {loading ? (
                  <div className="p-4">
                     <SkeletonTable rows={6} cols={activeColumns.length} />
                  </div>
               ) : filteredRows.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                     <div className="text-3xl mb-2">📋</div>
                     <h3 className="text-sm font-bold text-slate-700 mb-1">No {activeTab.toUpperCase()} records for this period</h3>
                     <p className="text-xs text-slate-400 max-w-xs mb-3">No supplies between {startDate} and {endDate}.</p>
                     <div className="flex gap-2">
                        <button type="button" onClick={() => handlePeriodPreset('lastMonth')} className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-700 hover:bg-slate-50">Last Month</button>
                        <button type="button" onClick={() => handlePeriodPreset('ytd')} className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700">Full FY (YTD)</button>
                     </div>
                  </div>
               ) : (
                  <table className="w-full text-left text-xs border-collapse">
                     <thead className="sticky top-0 bg-slate-100 border-b border-slate-300 text-slate-600 font-bold uppercase z-10">
                        <tr>
                           <th className="px-2 py-1 w-7 text-center text-[10px]">#</th>
                           {activeColumns.map((col) => (
                              <th key={col.key} className={`px-2 py-1 text-[10px] whitespace-nowrap ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}>
                                 {col.label}
                              </th>
                           ))}
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100 text-slate-700">
                        {filteredRows.map((row, idx) => (
                           <tr key={row.id || row.invoiceNo || idx} className="hover:bg-blue-50/30 transition-colors">
                              <td className="px-2 py-0.5 text-center text-[10px] text-slate-400 font-mono">{idx + 1}</td>
                              {activeColumns.map((col) => {
                                 const val = fmtVal(row, col);
                                 return (
                                    <td key={col.key} className={`px-2 py-0.5 whitespace-nowrap text-[11px] ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.font || ''}`}>
                                       {col.badge ? <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200">{val}</span> : val}
                                    </td>
                                 );
                              })}
                           </tr>
                        ))}
                     </tbody>
                     {filteredRows.length > 0 && (
                        <tfoot className="sticky bottom-0 bg-slate-200 border-t-2 border-slate-400 font-bold text-slate-900 z-10">
                           <tr>
                              <td className="px-2 py-1 text-center text-[10px] font-black">∑</td>
                              {activeColumns.map((col, cIdx) => {
                                 if (col.key === 'taxableAmount' || col.key === 'txval') return <td key={col.key} className="px-2 py-1 text-right font-mono text-[11px] font-black text-blue-900">₹ {tableTotals.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>;
                                 if (col.key === 'cgst' || col.key === 'camt') return <td key={col.key} className="px-2 py-1 text-right font-mono text-[11px] font-black text-emerald-900">₹ {tableTotals.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>;
                                 if (col.key === 'sgst' || col.key === 'samt') return <td key={col.key} className="px-2 py-1 text-right font-mono text-[11px] font-black text-emerald-900">₹ {tableTotals.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>;
                                 if (col.key === 'igst' || col.key === 'iamt') return <td key={col.key} className="px-2 py-1 text-right font-mono text-[11px] font-black text-purple-900">₹ {tableTotals.igst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>;
                                 if (col.key === 'netAmount' || col.key === 'grossTotal' || col.key === 'val' || col.key === 'invoiceValue') return <td key={col.key} className="px-2 py-1 text-right font-mono text-[11px] font-black text-slate-900">₹ {tableTotals.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>;
                                 if (cIdx === 0) return <td key={col.key} className="px-2 py-1 text-[11px] font-bold text-slate-600">{filteredRows.length} row(s)</td>;
                                 return <td key={col.key} className="px-2 py-1" />;
                              })}
                           </tr>
                        </tfoot>
                     )}
                  </table>
               )}
            </div>
         </div>
      </Modal>
   );
};

// ==========================================
// 3. GSTR-2B MATCHING & RECONCILIATION MODAL
// ==========================================
export const Gst2bMatchingModal = ({ isOpen, onClose }) => {
   const { purchases, fetchPurchases } = useStore();
   const [loading, setLoading] = useState(false);

   useEffect(() => {
      if (!isOpen) return;
      setLoading(true);
      fetchPurchases()
         .catch(() => {})
         .finally(() => setLoading(false));
   }, [isOpen, fetchPurchases]);

   /** ERP purchase register only — portal GSTR-2B matching is NOT connected (Sprint 4). */
   const listData = useMemo(() => {
      return (purchases || []).map((p) => ({
         id: p._id || p.id,
         invoiceNo: p.invoiceNo || p.billNo || '—',
         date: p.date,
         supplier: p.supplierId?.name || p.supplierName || 'Supplier',
         gstin: p.supplierId?.gstin || '—',
         erpTaxable: parseFloat(p.taxableAmount ?? p.totalAmount ?? 0),
         erpGst: parseFloat(p.gstAmount || 0),
         status: 'ERP_ONLY'
      }));
   }, [purchases]);

   const totals = useMemo(() => {
      return listData.reduce(
         (acc, row) => {
            acc.count += 1;
            acc.taxable += row.erpTaxable || 0;
            acc.gst += row.erpGst || 0;
            return acc;
         },
         { count: 0, taxable: 0, gst: 0 }
      );
   }, [listData]);

   return (
      <Modal isOpen={isOpen} onClose={onClose} title="GSTR-2B ITC Matching" className={GST_MODAL_CLASS}>
         <div className="flex flex-col h-full min-h-0 bg-[var(--bg-base)]">
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-card)]">
               <p className="text-[11px] text-[var(--text-muted)]">
                  Purchase register from company books · Portal GSTR-2B matching not connected
               </p>
               <button
                  type="button"
                  onClick={() => toast.unavailable('GSTR-2B portal reconciliation')}
                  className="erp-btn erp-btn-secondary h-8 px-3 text-[11px] gap-1 opacity-70 cursor-not-allowed"
                  title="Requires GSTN/GSP integration"
               >
                  <ShieldCheck size={12} />
                  Portal match (soon)
               </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
               <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[11px] text-[var(--text-muted)]">
                  Live purchase invoices only. Portal download and auto-match will ship with the Compliance Engine.
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                     { label: 'ERP bills', val: String(totals.count) },
                     { label: 'ERP taxable', val: moneyInr(totals.taxable) },
                     { label: 'ERP GST', val: moneyInr(totals.gst) },
                  ].map((s) => (
                     <div key={s.label} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{s.label}</p>
                        <p className="text-lg font-bold tabular-nums text-[var(--text-primary)] mt-1">{s.val}</p>
                     </div>
                  ))}
               </div>

               <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--bg-card)]">
                  {loading && <SkeletonTable rows={8} cols={5} className="m-3" />}
                  {!loading && listData.length === 0 && (
                     <p className="p-8 text-[12px] text-center text-[var(--text-muted)]">No purchase invoices found for this company.</p>
                  )}
                  {!loading && listData.length > 0 && (
                     <div className="overflow-x-auto max-h-[min(52vh,520px)] overflow-y-auto">
                        <table className="w-full text-left text-[11px]">
                           <thead className="sticky top-0 bg-[var(--bg-base)] text-[var(--text-muted)] uppercase text-[9px] tracking-wider">
                              <tr>
                                 <th className="px-3 py-2 font-semibold">Reference</th>
                                 <th className="px-3 py-2 font-semibold">Supplier</th>
                                 <th className="px-3 py-2 font-semibold">GSTIN</th>
                                 <th className="px-3 py-2 font-semibold text-right">ERP taxable</th>
                                 <th className="px-3 py-2 font-semibold text-right">ERP GST</th>
                                 <th className="px-3 py-2 font-semibold text-center">Portal</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-[var(--border-subtle)]">
                              {listData.map((row) => (
                                 <tr key={row.id} className="hover:bg-[var(--bg-base)]">
                                    <td className="px-3 py-2">
                                       <p className="font-semibold text-[var(--text-primary)]">{row.invoiceNo}</p>
                                       <p className="text-[10px] text-[var(--text-muted)]">{row.date ? String(row.date).slice(0, 10) : '—'}</p>
                                    </td>
                                    <td className="px-3 py-2 text-[var(--text-primary)]">{row.supplier}</td>
                                    <td className="px-3 py-2 font-mono text-[10px] text-[var(--text-muted)]">{row.gstin}</td>
                                    <td className="px-3 py-2 text-right font-medium tabular-nums">{moneyInr(row.erpTaxable)}</td>
                                    <td className="px-3 py-2 text-right font-medium tabular-nums">{moneyInr(row.erpGst)}</td>
                                    <td className="px-3 py-2 text-center">
                                       <span className="inline-block px-2 py-0.5 text-[9px] font-bold uppercase rounded border border-[var(--border)] text-[var(--text-muted)] bg-[var(--bg-base)]">
                                          Not linked
                                       </span>
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  )}
               </div>
            </div>
         </div>
      </Modal>
   );
};


// ==========================================
// 4. GSTR-3B DETAILED LEDGER/AUDIT MODAL
// ==========================================
export const Gst3bDetailModal = ({ isOpen, onClose }) => {
   const { sales, purchases, fetchSales, fetchPurchases } = useStore();
   const [activeTab, setActiveTab] = useState('outward');

   useEffect(() => {
      if (isOpen) { fetchSales(); fetchPurchases(); }
   }, [isOpen, fetchSales, fetchPurchases]);

   return (
      <Modal isOpen={isOpen} onClose={onClose} title="GST Ledger Detail" className="max-w-[95vw] w-full h-[min(92vh,900px)] p-0 rounded-2xl">
         <div className="flex flex-col h-full min-h-0 bg-[var(--bg-base)]">
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-card)]">
               <p className="text-[11px] text-[var(--text-muted)]">Invoice-level drilldown from sales and purchase books</p>
               <div className="flex gap-1 p-0.5 rounded-lg bg-[var(--bg-base)] border border-[var(--border)]">
                  <button
                     type="button"
                     onClick={() => setActiveTab('outward')}
                     className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-colors ${
                        activeTab === 'outward'
                           ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                           : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                     }`}
                  >
                     Outward
                  </button>
                  <button
                     type="button"
                     onClick={() => setActiveTab('inward')}
                     className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-colors ${
                        activeTab === 'inward'
                           ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                           : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                     }`}
                  >
                     Inward ITC
                  </button>
               </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4">
               <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--bg-card)]">
                  <div className="overflow-x-auto max-h-[min(70vh,640px)] overflow-y-auto">
                     <table className="w-full text-left text-[11px]">
                        <thead className="sticky top-0 bg-[var(--bg-base)] text-[var(--text-muted)] uppercase text-[9px] tracking-wider">
                           <tr>
                              <th className="px-3 py-2 font-semibold">Reference</th>
                              <th className="px-3 py-2 font-semibold">Party</th>
                              <th className="px-3 py-2 font-semibold text-right">Taxable</th>
                              <th className="px-3 py-2 font-semibold text-right">CGST</th>
                              <th className="px-3 py-2 font-semibold text-right">SGST</th>
                              <th className="px-3 py-2 font-semibold text-right">IGST</th>
                              <th className="px-3 py-2 font-semibold text-right">Net GST</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-subtle)]">
                           {(activeTab === 'outward' ? sales : purchases).map((row, idx) => {
                              const taxable = Number(row.taxableAmount ?? row.totals?.subtotal ?? 0);
                              const cgst = Number(row.cgst ?? row.totals?.cgst ?? 0);
                              const sgst = Number(row.sgst ?? row.totals?.sgst ?? 0);
                              const igst = Number(row.igst ?? row.totals?.igst ?? 0);
                              const gst = Number(row.gstAmount ?? cgst + sgst + igst);
                              return (
                                 <tr key={row._id || row.id || idx} className="hover:bg-[var(--bg-base)]">
                                    <td className="px-3 py-2 font-semibold text-[var(--text-primary)]">{row.invoiceNo}</td>
                                    <td className="px-3 py-2 text-[var(--text-muted)]">
                                       {row.partyName || row.customerId?.name || row.supplierId?.name || '—'}
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums">{moneyInr(taxable)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{moneyInr(cgst)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{moneyInr(sgst)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{moneyInr(igst)}</td>
                                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{moneyInr(gst)}</td>
                                 </tr>
                              );
                           })}
                        </tbody>
                     </table>
                  </div>
               </div>
            </div>
         </div>
      </Modal>
   );
};



// ==========================================
// 5. GSTR-1 ERROR VALIDATOR & SCANNER MODAL
// ==========================================
export const Gstr1ErrorChekModal = ({ isOpen, onClose }) => {
   const { fetchSales } = useStore();
   const [scanning, setScanning] = useState(false);
   const [audited, setAudited] = useState(false);
   const [issuesList, setIssuesList] = useState([]);
   const [fixedStatus, setFixedStatus] = useState(false);

   useEffect(() => {
      if (isOpen) fetchSales();
   }, [isOpen, fetchSales]);

   const runAudit = async () => {
      setScanning(true);
      setFixedStatus(false);
      try {
         const period = new Date().toISOString().slice(0, 7);
         const result = await stage4Api.certificationRun({ period });
         const gaps = result?.gaps || result?.run?.gaps || [];
         const issues = gaps.map((g, i) => {
            const msg = typeof g === 'string' ? g : (g.message || g.code || 'Compliance gap');
            return {
               id: String(i),
               invoiceNo: g.invoiceNo || '—',
               partyName: g.partyName || 'Compliance',
               type: (g.severity === 'error' || g.level === 'error') ? 'ERROR' : 'WARNING',
               code: g.code || 'GSTR_GAP',
               message: msg,
            };
         });
         setIssuesList(issues);
         setAudited(true);
         if (issues.length === 0) toast.success('No compliance issues found');
      } catch (err) {
         notifyError(err, 'Compliance audit failed');
      } finally {
         setScanning(false);
      }
   };

   const handleAutoFix = async () => {
      setScanning(true);
      try {
         await stage4Api.hsnSync();
         setFixedStatus(true);
         setIssuesList([]);
         toast.success('HSN codes synced from items');
      } catch (err) {
         notifyError(err, 'Auto-fix failed');
      } finally {
         setScanning(false);
      }
   };

   const errorsCount = issuesList.filter(i => i.type === 'ERROR').length;
   const warningsCount = issuesList.filter(i => i.type === 'WARNING').length;

   return (
      <Modal isOpen={isOpen} onClose={onClose} title="GSTR-1 Compliance Audit" className={GST_MODAL_CLASS}>
         <div className="flex flex-col h-full min-h-0 bg-[var(--bg-base)]">
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-card)]">
               <p className="text-[11px] text-[var(--text-muted)]">Validate GSTIN, HSN and filing gaps from books</p>
               <div className="flex items-center gap-2">
                  {!scanning && audited && issuesList.length > 0 && !fixedStatus && (
                     <button type="button" onClick={handleAutoFix} className="erp-btn erp-btn-secondary h-8 px-3 text-[11px] gap-1">
                        <Sparkles size={12} /> Auto-fix HSN
                     </button>
                  )}
                  <button type="button" onClick={runAudit} disabled={scanning} className="erp-btn erp-btn-primary h-8 px-3 text-[11px] gap-1">
                     {scanning ? <RefreshCw className="animate-spin" size={12} /> : <Play size={12} />}
                     {scanning ? 'Scanning…' : 'Run scan'}
                  </button>
               </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4">
               <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] min-h-[280px] p-4">
                  {scanning ? (
                     <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--text-muted)]">
                        <RefreshCw className="animate-spin" size={22} />
                        <p className="text-[12px] font-semibold">Scanning records…</p>
                     </div>
                  ) : !audited ? (
                     <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--text-muted)]">
                        <ShieldAlert size={28} />
                        <p className="text-[12px] font-semibold text-[var(--text-primary)]">Ready to scan</p>
                        <p className="text-[11px]">Run scan to check filing compliance.</p>
                     </div>
                  ) : fixedStatus || issuesList.length === 0 ? (
                     <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <CheckCircle2 size={28} className="text-emerald-600" />
                        <p className="text-[12px] font-semibold text-[var(--text-primary)]">No open issues</p>
                        <p className="text-[11px] text-[var(--text-muted)]">Books look clear for this check.</p>
                     </div>
                  ) : (
                     <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                           <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-100">
                              <AlertCircle size={12} /> {errorsCount} errors
                           </span>
                           <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-100">
                              <AlertTriangle size={12} /> {warningsCount} warnings
                           </span>
                        </div>
                        <div className="space-y-2 max-h-[min(50vh,480px)] overflow-y-auto">
                           {issuesList.map((issue, idx) => (
                              <div key={idx} className="flex gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-base)]">
                                 <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${issue.type === 'ERROR' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>
                                    {issue.type === 'ERROR' ? <AlertCircle size={14} /> : <AlertTriangle size={14} />}
                                 </div>
                                 <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                       <span className="font-semibold text-[var(--text-primary)]">{issue.invoiceNo}</span>
                                       <span className="text-[var(--text-muted)]">{issue.partyName}</span>
                                       <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-muted)]">{issue.code}</span>
                                    </div>
                                    <p className="text-[11px] text-[var(--text-muted)] mt-1">{issue.message}</p>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  )}
               </div>
            </div>
         </div>
      </Modal>
   );
};

// ==========================================
// 6. GST COMPLIANCE OVERVIEW (SCORECARD)
// ==========================================
export const GstComplianceModal = ({ isOpen, onClose }) => {
   return (
      <Modal isOpen={isOpen} onClose={onClose} title="GST Compliance" className="max-w-lg w-full p-0 rounded-2xl">
         <div className="flex flex-col bg-[var(--bg-base)]">
            <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-card)]">
               <p className="text-[13px] font-semibold text-[var(--text-primary)]">Use live GST reports</p>
               <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-relaxed">
                  Review GSTR-1, GSTR-3B, CA Desk, and GSTIN reports from your books, then file on the GST portal with your CA.
               </p>
            </div>
            <div className="p-4 space-y-3 text-[12px] text-[var(--text-primary)]">
               <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-muted)]">
                  Numbers come from saved bills in this ERP — not from the GST portal.
               </div>
               <ul className="list-disc pl-5 space-y-1.5 text-[var(--text-muted)]">
                  <li>GSTR-1 / GSTR-3B exports are books helpers — verify before GSTN filing.</li>
                  <li>GSTR-2B portal matching is not auto-connected in this build.</li>
                  <li>E-invoice / e-way may depend on your plan and setup.</li>
               </ul>
            </div>
            <div className="p-3 border-t border-[var(--border)] bg-[var(--bg-card)] flex justify-end">
               <button type="button" onClick={onClose} className="erp-btn erp-btn-primary h-8 px-4 text-[11px]">
                  Close
               </button>
            </div>
         </div>
      </Modal>
   );
};
