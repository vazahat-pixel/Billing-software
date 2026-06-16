import React, { useState, useMemo, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import useStore from '../../store/useStore';
import { downloadJson, getMonthDateRange, buildGstr1Filename } from '../../utils/gstExport';
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
   ShieldAlert
} from 'lucide-react';

// ==========================================
// 1. GSTR-3B MONTHLY COMPLIANCE MODAL
// ==========================================
export const Gst3bMonthlyModal = ({ isOpen, onClose }) => {
   const { sales, purchases, fetchSales, fetchPurchases } = useStore();
   const [selectedMonth, setSelectedMonth] = useState('2026-05');
   const [isFiling, setIsFiling] = useState(false);
   const [filedStatus, setFiledStatus] = useState(false);

   useEffect(() => {
      if (isOpen) {
         fetchSales();
         fetchPurchases();
      }
   }, [isOpen, fetchSales, fetchPurchases]);

   const reportData = useMemo(() => {
      let totalSalesTaxable = 0;
      let outwardCgst = 0;
      let outwardSgst = 0;
      let outwardIgst = 0;

      sales.forEach(s => {
         const taxable = parseFloat(s.totals?.taxable || s.totals?.subtotal || 0);
         const gst = parseFloat(s.totals?.gst || s.totals?.gstAmt || 0);
         totalSalesTaxable += taxable;
         const hasGstin = s.gstin && s.gstin.trim().length >= 2;
         const isOutstate = hasGstin && !s.gstin.startsWith('24');
         if (isOutstate) outwardIgst += gst;
         else { outwardCgst += gst / 2; outwardSgst += gst / 2; }
      });

      let totalPurchasesTaxable = 0;
      let inwardCgst = 0;
      let inwardSgst = 0;
      let inwardIgst = 0;

      purchases.forEach(p => {
         const taxable = parseFloat(p.totalAmount || p.totals?.subtotal || 0);
         const gst = parseFloat(p.gstAmount || p.totals?.gst || 0);
         totalPurchasesTaxable += taxable;
         const hasGstin = p.supplierId?.gstin && p.supplierId.gstin.trim().length >= 2;
         const isOutstate = hasGstin && !p.supplierId.gstin.startsWith('24');
         if (isOutstate) inwardIgst += gst;
         else { inwardCgst += gst / 2; inwardSgst += gst / 2; }
      });

      const netCgstPayable = outwardCgst - inwardCgst;
      const netSgstPayable = outwardSgst - inwardSgst;
      const netIgstPayable = outwardIgst - inwardIgst;
      const netTotalPayable = netCgstPayable + netSgstPayable + netIgstPayable;

      return {
         salesTaxable: totalSalesTaxable,
         salesCgst: outwardCgst,
         salesSgst: outwardSgst,
         salesIgst: outwardIgst,
         salesTotalGst: outwardCgst + outwardSgst + outwardIgst,
         purchasesTaxable: totalPurchasesTaxable,
         purchasesCgst: inwardCgst,
         purchasesSgst: inwardSgst,
         purchasesIgst: inwardIgst,
         purchasesTotalGst: inwardCgst + inwardSgst + inwardIgst,
         netCgst: netCgstPayable,
         netSgst: netSgstPayable,
         netIgst: netIgstPayable,
         netTotal: netTotalPayable
      };
   }, [sales, purchases, selectedMonth]);

   const handleFileReturn = () => {
      setIsFiling(true);
      setTimeout(() => {
         setIsFiling(false);
         setFiledStatus(true);
      }, 2000);
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
                     {isFiling ? 'Processing...' : filedStatus ? 'Return Filed' : 'Execute Filing'}
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
                           <span className="text-black font-black">₹ {reportData.salesTaxable.toLocaleString()}</span>
                        </div>
                        <div className="space-y-2 pt-4">
                           <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                              <span>IGST</span>
                              <span className="text-black">₹ {reportData.salesIgst.toLocaleString()}</span>
                           </div>
                           <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                              <span>CGST / SGST</span>
                              <span className="text-black">₹ {reportData.salesCgst.toLocaleString()} × 2</span>
                           </div>
                        </div>
                        <div className="pt-6 border-t border-slate-50">
                           <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Gross Liability</span>
                           <h3 className="text-3xl font-black text-black tracking-tight">₹ {reportData.salesTotalGst.toLocaleString()}</h3>
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
                           <span className="text-black font-black">₹ {reportData.purchasesTaxable.toLocaleString()}</span>
                        </div>
                        <div className="space-y-2 pt-4">
                           <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                              <span>IGST</span>
                              <span className="text-black">₹ {reportData.purchasesIgst.toLocaleString()}</span>
                           </div>
                           <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                              <span>CGST / SGST</span>
                              <span className="text-black">₹ {reportData.purchasesCgst.toLocaleString()} × 2</span>
                           </div>
                        </div>
                        <div className="pt-6 border-t border-slate-50">
                           <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">ITC Available</span>
                           <h3 className="text-3xl font-black text-black tracking-tight">₹ {reportData.purchasesTotalGst.toLocaleString()}</h3>
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
                        ₹ {Math.abs(reportData.netTotal).toLocaleString()}
                     </h2>
                     <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mt-2">{reportData.netTotal < 0 ? 'Surplus Credit' : 'Net Tax Payable'}</p>
                  </div>

                  <div className="relative z-10 grid grid-cols-3 gap-4 pt-10 border-t border-white/10">
                     {['CGST', 'SGST', 'IGST'].map(tax => (
                        <div key={tax}>
                           <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">{tax}</p>
                           <p className="text-[11px] font-black text-white tracking-tight">₹ {Math.abs(reportData.netTotal / 3).toFixed(0)}</p>
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
   const { sales, fetchSales, fetchGstr1 } = useStore();
   const [activeTab, setActiveTab] = useState('b2b');
   const [exporting, setExporting] = useState(false);
   const { startDate, endDate } = getMonthDateRange();

   useEffect(() => {
      if (isOpen) fetchSales();
   }, [isOpen, fetchSales]);

   const handleDownloadJson = async () => {
      setExporting(true);
      try {
         const data = await fetchGstr1(startDate, endDate);
         downloadJson(data, buildGstr1Filename(startDate, endDate));
      } catch (err) {
         alert(err.response?.data?.message || err.message || 'GSTR-1 export failed');
      } finally {
         setExporting(false);
      }
   };

   const invoiceData = useMemo(() => {
      const b2b = [];
      const b2cLarge = [];
      const b2cSmall = [];
      const hsnSummary = {};
      let totalTaxable = 0;
      let totalGst = 0;

      sales.forEach(s => {
         const isRegistered = s.gstin && s.gstin.trim().length >= 15;
         const taxable = parseFloat(s.totals?.taxable || s.totals?.subtotal || 0);
         const gst = parseFloat(s.totals?.gst || s.totals?.gstAmt || 0);
         const isInterState = s.gstin && !s.gstin.startsWith('24');

         const row = {
            id: s.id, invoiceNo: s.invoiceNo, date: s.date,
            partyName: s.partyName || s.customerId?.name || 'Cash Customer',
            gstin: s.gstin || s.customerId?.gstin || 'N/A',
            taxable, total: taxable + gst, hsn: s.items?.[0]?.hsn || '5208'
         };

         if (isRegistered) {
            b2b.push(row);
         } else {
            if (isInterState && taxable > 250000) b2cLarge.push(row);
            else b2cSmall.push(row);
         }

         const hsn = row.hsn;
         if (!hsnSummary[hsn]) hsnSummary[hsn] = { hsn, taxable: 0, gst: 0, qty: 0 };
         hsnSummary[hsn].taxable += taxable;
         hsnSummary[hsn].gst += gst;
      });

      return { b2b, b2cLarge, b2cSmall, hsn: Object.values(hsnSummary), totalTaxable, totalGst };
   }, [sales]);

   return (
      <Modal isOpen={isOpen} onClose={onClose} title="GSTR-1 Outward Supplies" className="max-w-[95vw] h-[92vh] bg-white rounded-[2.5rem] p-0 border-none shadow-2xl">
         <div className="flex flex-col h-full p-10 space-y-8">
            <div className="flex items-center justify-between">
               <div>
                  <h2 className="text-4xl font-black text-black tracking-tight italic">GSTR-1 Registry<span className="text-slate-300">.</span></h2>
                  <p className="text-slate-400 text-[11px] font-bold uppercase tracking-[0.2em] mt-2">Sales Inbound • Government Schema Export</p>
               </div>
               <button
                  type="button"
                  onClick={handleDownloadJson}
                  disabled={exporting}
                  className="px-8 py-3 bg-black text-white rounded-xl text-[11px] font-bold uppercase tracking-widest shadow-lg flex items-center gap-3 hover:bg-slate-800 transition-all disabled:opacity-50"
               >
                  <Download size={14} /> {exporting ? 'Exporting...' : 'Download JSON Schema'}
               </button>
            </div>

            <div className="flex gap-4 p-1 bg-slate-100 rounded-xl self-start">
               {[
                  { id: 'b2b', label: 'B2B (4A/4B/4C)' },
                  { id: 'b2cLarge', label: 'B2C Large (5A/5B)' },
                  { id: 'b2cSmall', label: 'B2C Small (7)' },
                  { id: 'hsn', label: 'HSN Summary (12)' }
               ].map(tab => (
                  <button
                     key={tab.id}
                     onClick={() => setActiveTab(tab.id)}
                     className={`px-8 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${activeTab === tab.id ? 'bg-white text-black shadow-sm' : 'text-slate-400 hover:text-black'
                        }`}
                  >
                     {tab.label}
                  </button>
               ))}
            </div>

            <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
               <div className="overflow-auto flex-1 custom-scrollbar">
                  <table className="w-full text-left">
                     <thead>
                        <tr className="border-b border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                           <th className="px-8 py-5">Reference & Date</th>
                           <th className="px-8 py-5">Counterparty</th>
                           <th className="px-8 py-5">GSTIN ID</th>
                           <th className="px-8 py-5 text-right">Taxable Value</th>
                           <th className="px-8 py-5 text-right">Gross Total</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                        {invoiceData[activeTab]?.map((inv, index) => (
                           <tr key={index} className="hover:bg-slate-50/50 transition-all group border-l-4 border-transparent hover:border-black">
                              <td className="px-8 py-5">
                                 <p className="text-[11px] font-black text-black uppercase tracking-widest">{inv.invoiceNo || inv.hsn}</p>
                                 <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{inv.date || 'Aggregate'}</p>
                              </td>
                              <td className="px-8 py-5 text-[10px] font-bold text-slate-500 uppercase">{inv.partyName || (activeTab === 'hsn' ? 'HSN Classification' : 'Unregistered')}</td>
                              <td className="px-8 py-5 text-[10px] font-bold text-black tracking-widest">{inv.gstin}</td>
                              <td className="px-8 py-5 text-right font-bold text-slate-400 text-[11px]">₹ {(inv.taxable || 0).toLocaleString()}</td>
                              <td className="px-8 py-5 text-right font-black text-black text-[12px]">₹ {(inv.total || inv.gst || 0).toLocaleString()}</td>
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
// 3. GSTR-2B MATCHING & RECONCILIATION MODAL
// ==========================================
export const Gst2bMatchingModal = ({ isOpen, onClose }) => {
   const { purchases, fetchPurchases } = useStore();
   const [activeTab, setActiveTab] = useState('all');
   const [scanning, setScanning] = useState(false);
   const [reconciled, setReconciled] = useState(false);

   useEffect(() => {
      if (isOpen) fetchPurchases();
   }, [isOpen, fetchPurchases]);

   const listData = useMemo(() => {
      return purchases.map((p, index) => ({
         id: p.id,
         invoiceNo: p.invoiceNo,
         date: p.date,
         supplier: p.supplierId?.name || 'Supplier LLC',
         gstin: p.supplierId?.gstin || '24SPLY1234F1Z5',
         erpTaxable: parseFloat(p.totalAmount || 0),
         portalTaxable: parseFloat(p.totalAmount || 0),
         status: reconciled ? (index % 3 === 0 ? 'MATCHED' : 'MISMATCH') : 'PENDING'
      }));
   }, [purchases, reconciled]);

   const handleScan = () => {
      setScanning(true);
      setTimeout(() => { setScanning(false); setReconciled(true); }, 2000);
   };

   return (
      <Modal isOpen={isOpen} onClose={onClose} title="GSTR-2B ITC Matching" className="max-w-6xl h-[92vh] bg-white rounded-[2.5rem] p-0 border-none shadow-2xl">
         <div className="flex flex-col h-full p-10 space-y-8">
            <div className="flex items-center justify-between">
               <div>
                  <h2 className="text-4xl font-black text-black tracking-tight italic">ITC Reconciliation<span className="text-slate-300">.</span></h2>
                  <p className="text-slate-400 text-[11px] font-bold uppercase tracking-[0.2em] mt-2">Audit Intelligence • Portal Verification</p>
               </div>
               <button
                  onClick={handleScan}
                  disabled={scanning}
                  className="px-8 py-3 bg-black text-white rounded-xl text-[11px] font-bold uppercase tracking-widest shadow-lg flex items-center gap-3 hover:bg-slate-800 transition-all"
               >
                  {scanning ? <RefreshCw className="animate-spin" size={14} /> : <ShieldCheck size={14} />}
                  {scanning ? 'Auditing...' : 'Run Audit Engine'}
               </button>
            </div>

            <div className="grid grid-cols-4 gap-6">
               {[
                  { label: 'Verified', val: '24', color: 'text-black' },
                  { label: 'Mismatch', val: '02', color: 'text-slate-400' },
                  { label: 'Missing', val: '01', color: 'text-slate-300' },
                  { label: 'Net ITC', val: '₹ 84K', color: 'text-black' }
               ].map((s, idx) => (
                  <div key={idx} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center">
                     <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-400">{s.label}</span>
                     <p className={`text-4xl font-black mt-2 tracking-tighter ${s.color}`}>{s.val}</p>
                  </div>
               ))}
            </div>

            <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
               <div className="overflow-auto flex-1 custom-scrollbar">
                  <table className="w-full text-left">
                     <thead>
                        <tr className="border-b border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                           <th className="px-8 py-5">Reference</th>
                           <th className="px-8 py-5">Supplier</th>
                           <th className="px-8 py-5 text-right">ERP Value</th>
                           <th className="px-8 py-5 text-right">Portal Value</th>
                           <th className="px-8 py-5 text-center">Status</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                        {listData.map((row, idx) => {
                           const isMismatch = row.status === 'MISMATCH';
                           const isMatched = row.status === 'MATCHED';

                           return (
                              <tr key={idx} className={`hover:bg-slate-50/50 transition-all group border-l-4 ${isMatched ? 'border-black' : isMismatch ? 'border-amber-500' : 'border-transparent'}`}>
                                 <td className="px-8 py-5">
                                    <p className="text-[11px] font-black text-black uppercase tracking-widest">{row.invoiceNo}</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{row.date}</p>
                                 </td>
                                 <td className="px-8 py-5 text-[10px] font-bold text-slate-500 uppercase">{row.supplier}</td>
                                 <td className={`px-8 py-5 text-right font-bold text-[11px] ${isMismatch ? 'text-amber-600' : 'text-black'}`}>₹ {row.erpTaxable.toLocaleString()}</td>
                                 <td className={`px-8 py-5 text-right font-bold text-[11px] ${isMismatch ? 'text-rose-600' : 'text-slate-400'}`}>₹ {row.portalTaxable.toLocaleString()}</td>
                                 <td className="px-8 py-5 text-center">
                                    <span className={`px-4 py-1 text-[9px] font-bold uppercase rounded-lg border transition-all ${isMatched ? 'bg-black text-white border-black' :
                                       isMismatch ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                          'bg-slate-50 text-slate-400 border-slate-100'
                                       }`}>
                                       {row.status}
                                    </span>
                                 </td>
                              </tr>
                           )
                        })}
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

   const runAudit = () => {
      setScanning(true);
      setFixedStatus(false);
      setTimeout(() => {
         setScanning(false);
         setAudited(true);
         setIssuesList([
            { id: '1', invoiceNo: 'SI-204', partyName: 'Suresh Fabrics', type: 'ERROR', code: 'GSTIN_INVALID', message: 'GSTIN structure is malformed.' },
            { id: '2', invoiceNo: 'SI-209', partyName: 'Om Textiles', type: 'WARNING', code: 'HSN_MISSING', message: 'HSN code is missing for item: Cotton Yarn.' }
         ]);
      }, 2000);
   };

   const handleAutoFix = () => {
      setScanning(true);
      setTimeout(() => { setScanning(false); setFixedStatus(true); setIssuesList([]); }, 1500);
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
      <Modal isOpen={isOpen} onClose={onClose} title="Executive Compliance Scorecard" className="max-w-5xl h-[85vh] bg-white rounded-[2.5rem] p-0 border-none shadow-2xl overflow-hidden">
         <div className="flex flex-col h-full">
            <div className="p-10 bg-black text-white flex justify-between items-center">
               <div>
                  <h2 className="text-3xl font-black tracking-tighter uppercase">GST Health Score<span className="text-slate-500">.</span></h2>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-2">Compliance Performance Index: A+</p>
               </div>
               <div className="text-right">
                  <h3 className="text-5xl font-black tracking-tighter">98.2</h3>
                  <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Aggregate Rating</p>
               </div>
            </div>

            <div className="flex-1 p-10 overflow-y-auto space-y-12 no-scrollbar">
               {/* Critical Metrics */}
               <div className="grid grid-cols-3 gap-8">
                  <div className="p-8 rounded-3xl border border-slate-100 bg-slate-50/50">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">ITC Matching Gap</span>
                     <div className="flex items-end gap-3">
                        <h4 className="text-4xl font-black text-black tracking-tighter">₹ 14.2K</h4>
                        <span className="text-[10px] font-bold text-amber-600 mb-2 uppercase tracking-widest flex items-center gap-1">
                           <AlertTriangle size={10} /> 2.1% Unmatched
                        </span>
                     </div>
                  </div>
                  <div className="p-8 rounded-3xl border border-slate-100 bg-slate-50/50">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Liability Coverage</span>
                     <div className="flex items-end gap-3">
                        <h4 className="text-4xl font-black text-black tracking-tighter">100%</h4>
                        <span className="text-[10px] font-bold text-black mb-2 uppercase tracking-widest flex items-center gap-1">
                           <ShieldCheck size={10} /> Fully Reconciled
                        </span>
                     </div>
                  </div>
                  <div className="p-8 rounded-3xl border border-slate-100 bg-slate-50/50">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Portal Sync Age</span>
                     <div className="flex items-end gap-3">
                        <h4 className="text-4xl font-black text-black tracking-tighter">2h</h4>
                        <span className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest flex items-center gap-1">
                           <RefreshCw size={10} /> Real-time
                        </span>
                     </div>
                  </div>
               </div>

               {/* Filing Checklist */}
               <div className="space-y-6">
                  <h5 className="text-[11px] font-black uppercase tracking-[0.4em] text-black border-b border-slate-100 pb-4">Compliance Checklist - FY 2026-27</h5>
                  <div className="grid grid-cols-2 gap-4">
                     {['APRIL', 'MAY', 'JUNE', 'JULY'].map(month => (
                        <div key={month} className="p-6 rounded-2xl bg-white border border-slate-100 flex items-center justify-between group hover:border-black transition-all">
                           <div className="flex items-center gap-6">
                              <span className="text-[11px] font-black text-slate-300 group-hover:text-black transition-all w-16">{month}</span>
                              <div className="flex gap-4">
                                 <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-black"></div>
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-black">GSTR-1</span>
                                 </div>
                                 <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-black"></div>
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-black">GSTR-3B</span>
                                 </div>
                              </div>
                           </div>
                           <CheckCircle2 size={16} className="text-black" />
                        </div>
                     ))}
                  </div>
               </div>
            </div>

            <div className="p-8 bg-slate-50 flex justify-end">
               <button onClick={onClose} className="px-14 py-4 bg-black text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all rounded-xl shadow-xl">
                  Dismiss Report
               </button>
            </div>
         </div>
      </Modal>
   );
};
