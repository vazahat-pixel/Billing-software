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
      <Modal isOpen={isOpen} onClose={onClose} title="GSTR-3B Monthly Return Dashboard" className="max-w-6xl h-[92vh] bg-white rounded-[2.5rem] p-0 border-none shadow-2xl">
         <div className="flex flex-col h-full p-10 space-y-8">
            {/* Modern Header */}
            <div className="flex items-center justify-between">
               <div>
                  <h2 className="text-4xl font-black text-black tracking-tight italic">GSTR-3B Return<span className="text-slate-300">.</span></h2>
                  <p className="text-slate-400 text-[11px] font-bold uppercase tracking-[0.2em] mt-2">Compliance Intelligence • Professional Filing</p>
               </div>
               <div className="flex gap-4">
                  <div className="flex items-center gap-3 px-6 py-3 bg-white border border-slate-100 rounded-xl">
                     <Calendar className="text-slate-300" size={16} />
                     <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => { setSelectedMonth(e.target.value); setFiledStatus(false); }}
                        className="text-[11px] font-bold uppercase tracking-widest bg-transparent outline-none text-black"
                     />
                  </div>
                  <button
                     disabled={isFiling || filedStatus}
                     onClick={handleFileReturn}
                     className={`px-8 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest shadow-lg flex items-center gap-3 transition-all ${filedStatus ? 'bg-black text-white cursor-default' : 'bg-black text-white hover:bg-slate-800'
                        }`}
                  >
                     {isFiling ? <RefreshCw size={14} className="animate-spin" /> : filedStatus ? <CheckCircle2 size={14} /> : <Play size={14} />}
                     {isFiling ? 'Processing...' : filedStatus ? 'Snapshot Saved' : 'Save Filing Snapshot'}
                  </button>
               </div>
            </div>

            {/* Analytics Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-y-auto pr-2 custom-scrollbar">
               {/* Section 3.1 & 4 Cards */}
               <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                     <div className="flex justify-between items-center pb-6 border-b border-slate-50">
                        <span className="text-[11px] font-bold text-black uppercase tracking-widest">3.1 Outward Supplies</span>
                        <span className="px-3 py-1 bg-slate-50 text-slate-400 text-[9px] font-bold rounded-lg uppercase">Liability</span>
                     </div>
                     <div className="space-y-4">
                        <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 uppercase">
                           <span>Taxable Turnover</span>
                           <span className="text-black font-black">₹ {display.salesTaxable.toLocaleString()}</span>
                        </div>
                        <div className="space-y-2 pt-4">
                           <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                              <span>IGST</span>
                              <span className="text-black">₹ {display.salesIgst.toLocaleString()}</span>
                           </div>
                           <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                              <span>CGST / SGST</span>
                              <span className="text-black">₹ {display.salesCgst.toLocaleString()} × 2</span>
                           </div>
                        </div>
                        <div className="pt-6 border-t border-slate-50">
                           <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Gross Liability</span>
                           <h3 className="text-3xl font-black text-black tracking-tight">₹ {display.salesTotalGst.toLocaleString()}</h3>
                        </div>
                     </div>
                  </div>

                  <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                     <div className="flex justify-between items-center pb-6 border-b border-slate-50">
                        <span className="text-[11px] font-bold text-black uppercase tracking-widest">Section 4: Eligible ITC</span>
                        <span className="px-3 py-1 bg-slate-50 text-slate-400 text-[9px] font-bold rounded-lg uppercase">Credit</span>
                     </div>
                     <div className="space-y-4">
                        <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 uppercase">
                           <span>Inward Turnover</span>
                           <span className="text-black font-black">₹ {display.purchasesTaxable.toLocaleString()}</span>
                        </div>
                        <div className="space-y-2 pt-4">
                           <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                              <span>IGST</span>
                              <span className="text-black">₹ {display.purchasesIgst.toLocaleString()}</span>
                           </div>
                           <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                              <span>CGST / SGST</span>
                              <span className="text-black">₹ {display.purchasesCgst.toLocaleString()} × 2</span>
                           </div>
                        </div>
                        <div className="pt-6 border-t border-slate-50">
                           <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">ITC Available</span>
                           <h3 className="text-3xl font-black text-black tracking-tight">₹ {display.purchasesTotalGst.toLocaleString()}</h3>
                        </div>
                     </div>
                  </div>
               </div>

               {/* Net Result Panel */}
               <div className="lg:col-span-4 bg-black rounded-3xl p-10 flex flex-col justify-between shadow-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-10 text-white/5 font-black text-8xl tracking-tighter select-none group-hover:scale-110 transition-transform duration-700">GST</div>
                  <div className="relative z-10">
                     <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em] mb-4">Compliance Status</p>
                     <h2 className="text-5xl font-black text-white tracking-tighter">
                        ₹ {Math.abs(display.netTotal).toLocaleString()}
                     </h2>
                     <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mt-2">{display.netTotal < 0 ? 'Surplus Credit' : 'Net Tax Payable'}</p>
                  </div>

                  <div className="relative z-10 grid grid-cols-3 gap-4 pt-10 border-t border-white/10">
                     {['CGST', 'SGST', 'IGST'].map(tax => (
                        <div key={tax}>
                           <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">{tax}</p>
                           <p className="text-[11px] font-black text-white tracking-tight">₹ {Math.abs(display.netTotal / 3).toFixed(0)}</p>
                        </div>
                     ))}
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
      <Modal isOpen={isOpen} onClose={onClose} title="GSTR-2B ITC Matching" className="max-w-6xl h-[92vh] bg-white rounded-[2.5rem] p-0 border-none shadow-2xl">
         <div className="flex flex-col h-full p-10 space-y-8">
            <div className="flex items-center justify-between gap-4">
               <div>
                  <h2 className="text-4xl font-black text-black tracking-tight italic">Purchase GST Register<span className="text-slate-300">.</span></h2>
                  <p className="text-slate-400 text-[11px] font-bold uppercase tracking-[0.2em] mt-2">ERP source of truth · Portal matching not connected</p>
               </div>
               <button
                  type="button"
                  onClick={() => toast.unavailable('GSTR-2B portal reconciliation')}
                  className="px-8 py-3 bg-slate-200 text-slate-600 rounded-xl text-[11px] font-bold uppercase tracking-widest flex items-center gap-3 cursor-not-allowed"
                  title="Requires GSTN/GSP integration (Stage 4)"
               >
                  <ShieldCheck size={14} />
                  Portal Match (Soon)
               </button>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-[12px] text-amber-900 font-medium">
               Fake match scores and fabricated portal values have been removed. This screen lists live purchase invoices from your company database. GSTR-2B portal download &amp; matching ships in the Compliance Engine stage.
            </div>

            <div className="grid grid-cols-3 gap-6">
               {[
                  { label: 'ERP Bills', val: String(totals.count) },
                  { label: 'ERP Taxable', val: `₹ ${totals.taxable.toLocaleString('en-IN')}` },
                  { label: 'ERP GST', val: `₹ ${totals.gst.toLocaleString('en-IN')}` }
               ].map((s, idx) => (
                  <div key={idx} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center">
                     <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-400">{s.label}</span>
                     <p className="text-3xl font-black mt-2 tracking-tighter text-black">{s.val}</p>
                  </div>
               ))}
            </div>

            <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
               <div className="overflow-auto flex-1 custom-scrollbar">
                  {loading && <SkeletonTable rows={8} cols={5} className="m-4" />}
                  {!loading && listData.length === 0 && (
                     <p className="p-8 text-[12px] text-slate-400 text-center">No purchase invoices found for this company.</p>
                  )}
                  <table className="w-full text-left">
                     <thead>
                        <tr className="border-b border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                           <th className="px-8 py-5">Reference</th>
                           <th className="px-8 py-5">Supplier</th>
                           <th className="px-8 py-5">GSTIN</th>
                           <th className="px-8 py-5 text-right">ERP Taxable</th>
                           <th className="px-8 py-5 text-right">ERP GST</th>
                           <th className="px-8 py-5 text-center">Portal</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                        {listData.map((row) => (
                              <tr key={row.id} className="hover:bg-slate-50/50 transition-all border-l-4 border-transparent">
                                 <td className="px-8 py-5">
                                    <p className="text-[11px] font-black text-black uppercase tracking-widest">{row.invoiceNo}</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{row.date ? String(row.date).slice(0, 10) : '—'}</p>
                                 </td>
                                 <td className="px-8 py-5 text-[10px] font-bold text-slate-500 uppercase">{row.supplier}</td>
                                 <td className="px-8 py-5 text-[10px] font-mono text-slate-500">{row.gstin}</td>
                                 <td className="px-8 py-5 text-right font-bold text-[11px] text-black">₹ {row.erpTaxable.toLocaleString('en-IN')}</td>
                                 <td className="px-8 py-5 text-right font-bold text-[11px] text-black">₹ {row.erpGst.toLocaleString('en-IN')}</td>
                                 <td className="px-8 py-5 text-center">
                                    <span className="px-4 py-1 text-[9px] font-bold uppercase rounded-lg border bg-slate-50 text-slate-400 border-slate-100">
                                       Not linked
                                    </span>
                                 </td>
                              </tr>
                        ))}
                     </tbody>
                  </table>
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
      <Modal isOpen={isOpen} onClose={onClose} title="GST Ledger Detail" className="max-w-[95vw] h-[92vh] bg-white rounded-[2.5rem] p-0 border-none shadow-2xl">
         <div className="flex flex-col h-full p-10 space-y-8">
            <div>
               <h2 className="text-4xl font-black text-black tracking-tight italic">Drilldown Analysis<span className="text-slate-300">.</span></h2>
               <p className="text-slate-400 text-[11px] font-bold uppercase tracking-[0.2em] mt-2">Atomic Audit Inspection • Transaction Integrity</p>
            </div>

            <div className="flex gap-4 p-1 bg-slate-100 rounded-xl self-start">
               <button
                  onClick={() => setActiveTab('outward')}
                  className={`px-8 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${activeTab === 'outward' ? 'bg-white text-black shadow-sm' : 'text-slate-400 hover:text-black'}`}
               >
                  Outward Liabilities
               </button>
               <button
                  onClick={() => setActiveTab('inward')}
                  className={`px-8 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${activeTab === 'inward' ? 'bg-white text-black shadow-sm' : 'text-slate-400 hover:text-black'}`}
               >
                  Inward ITC Eligible
               </button>
            </div>

            <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
               <div className="overflow-auto flex-1 custom-scrollbar">
                  <table className="w-full text-left">
                     <thead>
                        <tr className="border-b border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                           <th className="px-8 py-5">Audit Reference</th>
                           <th className="px-8 py-5">Entity ID</th>
                           <th className="px-8 py-5 text-right">Taxable Base</th>
                           <th className="px-8 py-5 text-right">CGST</th>
                           <th className="px-8 py-5 text-right">SGST</th>
                           <th className="px-8 py-5 text-right">IGST</th>
                           <th className="px-8 py-5 text-right">Net GST</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                        {(activeTab === 'outward' ? sales : purchases).map((row, idx) => (
                           <tr key={idx} className="hover:bg-slate-50/50 transition-all group">
                              <td className="px-8 py-5 font-bold text-black uppercase tracking-widest text-[11px]">{row.invoiceNo}</td>
                              <td className="px-8 py-5 text-[10px] font-bold text-slate-500 uppercase">{row.partyName || row.supplierId?.name || 'GENERIC ENTITY'}</td>
                              <td className="px-8 py-5 text-right font-bold text-slate-400 text-[11px]">₹ {(row.totals?.subtotal || 0).toLocaleString()}</td>
                              <td className="px-8 py-5 text-right font-bold text-slate-400 text-[10px]">₹ {(row.totals?.cgst || 0).toLocaleString()}</td>
                              <td className="px-8 py-5 text-right font-bold text-slate-400 text-[10px]">₹ {(row.totals?.sgst || 0).toLocaleString()}</td>
                              <td className="px-8 py-5 text-right font-bold text-slate-400 text-[10px]">₹ {(row.totals?.igst || 0).toLocaleString()}</td>
                              <td className="px-8 py-5 text-right font-black text-black text-[12px]">₹ {(row.totals?.totalGst || 0).toLocaleString()}</td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
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
      <Modal isOpen={isOpen} onClose={onClose} title="GSTR-1 Compliance Audit" className="max-w-6xl h-[92vh] bg-white rounded-[2.5rem] p-0 border-none shadow-2xl">
         <div className="flex flex-col h-full p-10 space-y-8">
            <div className="flex items-center justify-between">
               <div>
                  <h2 className="text-4xl font-black text-black tracking-tight italic">Compliance Audit<span className="text-slate-300">.</span></h2>
                  <p className="text-slate-400 text-[11px] font-bold uppercase tracking-[0.2em] mt-2">Atomic Inspection • Error Validation</p>
               </div>
               <div className="flex gap-4">
                  {!scanning && audited && issuesList.length > 0 && !fixedStatus && (
                     <button
                        onClick={handleAutoFix}
                        className="px-8 py-3 bg-white text-black border border-slate-100 rounded-xl text-[11px] font-bold uppercase tracking-widest shadow-sm hover:shadow-md transition-all flex items-center gap-3"
                     >
                        <Sparkles size={14} /> Auto-Fix Issues
                     </button>
                  )}
                  <button
                     onClick={runAudit}
                     disabled={scanning}
                     className="px-8 py-3 bg-black text-white rounded-xl text-[11px] font-bold uppercase tracking-widest shadow-lg flex items-center gap-3 hover:bg-slate-800 transition-all"
                  >
                     {scanning ? <RefreshCw className="animate-spin" size={14} /> : <Play size={14} />}
                     {scanning ? 'Auditing...' : 'Start Scan Engine'}
                  </button>
               </div>
            </div>

            <div className="flex-1 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col items-center justify-center p-12">
               {scanning ? (
                  <div className="text-center animate-pulse">
                     <div className="w-24 h-24 border-4 border-slate-100 border-t-black rounded-full animate-spin mx-auto mb-8"></div>
                     <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-black">Scanning Records</h4>
                     <p className="text-[10px] font-bold text-slate-400 mt-4 uppercase tracking-widest">Validating GSTIN, POS and HSN Integrity...</p>
                  </div>
               ) : !audited ? (
                  <div className="text-center space-y-6">
                     <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto">
                        <ShieldAlert size={32} className="text-slate-200" />
                     </div>
                     <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-black">Engine Ready</h4>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Initiate scan to verify filing compliance.</p>
                  </div>
               ) : fixedStatus || issuesList.length === 0 ? (
                  <div className="text-center space-y-6">
                     <div className="w-20 h-20 bg-black rounded-3xl flex items-center justify-center mx-auto shadow-xl">
                        <Check size={32} className="text-white" />
                     </div>
                     <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-black">Compliance Verified</h4>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">All anomalies resolved. Ready for filing.</p>
                  </div>
               ) : (
                  <div className="w-full h-full flex flex-col space-y-8">
                     <div className="flex gap-6">
                        <div className="flex items-center gap-3 px-6 py-3 bg-black text-white rounded-xl border border-black">
                           <AlertCircle size={14} />
                           <span className="text-[10px] font-bold uppercase tracking-widest">{errorsCount} Severe Errors</span>
                        </div>
                        <div className="flex items-center gap-3 px-6 py-3 bg-slate-100 text-black rounded-xl border border-slate-200">
                           <AlertTriangle size={14} />
                           <span className="text-[10px] font-bold uppercase tracking-widest">{warningsCount} Warnings</span>
                        </div>
                     </div>
                     <div className="flex-1 overflow-auto space-y-4 custom-scrollbar">
                        {issuesList.map((issue, idx) => (
                           <div key={idx} className="p-6 rounded-3xl border border-slate-50 bg-white/50 hover:bg-white hover:shadow-sm transition-all flex items-start gap-6 group">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${issue.type === 'ERROR' ? 'bg-black text-white' : 'bg-slate-100 text-slate-400'}`}>
                                 {issue.type === 'ERROR' ? <AlertCircle size={20} /> : <AlertTriangle size={20} />}
                              </div>
                              <div className="space-y-2">
                                 <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-black text-black uppercase tracking-widest">{issue.invoiceNo}</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">{issue.partyName}</span>
                                    <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 bg-slate-100 rounded-md text-slate-500">{issue.code}</span>
                                 </div>
                                 <p className="text-[11px] font-bold text-slate-600 uppercase tracking-widest leading-relaxed">{issue.message}</p>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               )}
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
      <Modal isOpen={isOpen} onClose={onClose} title="GST Compliance" className="max-w-2xl h-auto bg-white rounded-[2rem] p-0 border-none shadow-2xl overflow-hidden">
         <div className="flex flex-col">
            <div className="p-8 bg-slate-950 text-white">
               <h2 className="text-2xl font-black tracking-tight uppercase">Use live GST reports<span className="text-slate-500">.</span></h2>
               <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                  This screen no longer shows demo scores. File and review from your books via
                  GSTR-1, GSTR-3B, CA Desk, and GSTIN reports — then have your CA upload to the portal.
               </p>
            </div>
            <div className="p-8 space-y-4 text-sm text-slate-700">
               <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-xs font-semibold">
                  Fake “98% health / ₹14.2K gap / all months filed” metrics have been removed so they cannot be mistaken for live compliance.
               </div>
               <ul className="list-disc pl-5 space-y-2 text-xs text-slate-600">
                  <li>GSTR-1 / GSTR-3B exports are books-derived helpers — verify with your CA before portal filing.</li>
                  <li>GSTR-2B portal matching is not auto-connected to GSTN in this build.</li>
                  <li>E-invoice / e-way bill filing may be partial depending on your plan and setup.</li>
               </ul>
            </div>
            <div className="p-6 bg-slate-50 flex justify-end">
               <button onClick={onClose} className="px-10 py-3 bg-black text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all rounded-xl">
                  Close
               </button>
            </div>
         </div>
      </Modal>
   );
};
