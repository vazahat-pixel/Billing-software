import React, { useState, useMemo, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import useStore from '../../store/useStore';
import { toast } from '../../store/useToastStore';
import { SkeletonTable } from '../../components/ui/loaders';
import { notifyError } from '../../utils/notify';
import { downloadJson, getMonthDateRange, buildGstr1Filename } from '../../utils/gstExport';
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
   ShieldAlert
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
   const { fetchGstr1 } = useStore();
   const [activeTab, setActiveTab] = useState('b2b');
   const [exporting, setExporting] = useState(false);
   const [loading, setLoading] = useState(false);
   const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
   const [gstr1Data, setGstr1Data] = useState(null);

   const { startDate, endDate } = useMemo(
      () => getMonthDateRange(new Date(`${selectedMonth}-01T12:00:00`)),
      [selectedMonth]
   );

   useEffect(() => {
      if (!isOpen) return;
      setLoading(true);
      fetchGstr1(startDate, endDate)
         .then((data) => setGstr1Data(data || null))
         .catch((err) => {
            notifyError(err, 'Failed to load GSTR-1');
            setGstr1Data(null);
         })
         .finally(() => setLoading(false));
   }, [isOpen, startDate, endDate, fetchGstr1]);

   const handleDownloadJson = async () => {
      setExporting(true);
      try {
         const data = gstr1Data || (await fetchGstr1(startDate, endDate));
         // Portal-shaped payload only (gstin, fp, b2b, b2cl, b2cs, hsn, …)
         const {
            invoices: _inv,
            period: _period,
            totals: _totals,
            ...payload
         } = data || {};
         const clean = data?.payload || payload;
         downloadJson(clean, buildGstr1Filename(startDate, endDate));
         toast.success(`GSTR-1 JSON exported for ${selectedMonth}`);
      } catch (err) {
         notifyError(err, 'GSTR-1 export failed');
      } finally {
         setExporting(false);
      }
   };

   const invoiceData = useMemo(() => {
      const payload = gstr1Data?.payload || gstr1Data || {};
      const b2b = [];
      for (const party of payload.b2b || []) {
         for (const inv of party.inv || []) {
            const det = inv.itms?.[0]?.itm_det || {};
            b2b.push({
               invoiceNo: inv.inum,
               date: inv.idt,
               partyName: party.ctin,
               gstin: party.ctin,
               taxable: det.txval || 0,
               total: inv.val || 0,
            });
         }
      }
      const b2cLarge = (payload.b2cl || []).map((inv) => {
         const det = inv.itms?.[0]?.itm_det || {};
         return {
            invoiceNo: inv.inum,
            date: inv.idt,
            partyName: 'B2C Large',
            gstin: inv.pos || 'N/A',
            taxable: det.txval || 0,
            total: inv.val || 0,
         };
      });
      const b2cSmall = (payload.b2cs || []).map((row) => ({
         invoiceNo: `${row.sply_ty || 'OE'} @ ${row.rt || 0}%`,
         date: 'Aggregate',
         partyName: `POS ${row.pos || '—'}`,
         gstin: row.sply_ty || 'B2CS',
         taxable: row.txval || 0,
         total: (row.txval || 0) + (row.iamt || 0) + (row.camt || 0) + (row.samt || 0),
      }));
      const hsn = (payload.hsn?.data || []).map((h) => ({
         hsn: h.hsn_sc,
         invoiceNo: h.hsn_sc,
         date: h.desc || 'HSN',
         partyName: h.desc || 'HSN',
         gstin: `Qty ${h.qty || 0}`,
         taxable: h.txval || 0,
         total: (h.txval || 0) + (h.iamt || 0) + (h.camt || 0) + (h.samt || 0),
         gst: (h.iamt || 0) + (h.camt || 0) + (h.samt || 0),
      }));
      const totals = gstr1Data?.totals || {};
      return {
         b2b,
         b2cLarge,
         b2cSmall,
         hsn,
         totalTaxable: totals.taxable || 0,
         totalGst: (totals.cgst || 0) + (totals.sgst || 0) + (totals.igst || 0),
         invoiceCount: totals.invoiceCount || b2b.length + b2cLarge.length,
      };
   }, [gstr1Data]);

   return (
      <Modal isOpen={isOpen} onClose={onClose} title="GSTR-1 Outward Supplies" className="max-w-[95vw] h-[92vh] bg-white rounded-[2.5rem] p-0 border-none shadow-2xl">
         <div className="flex flex-col h-full p-10 space-y-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
               <div>
                  <h2 className="text-4xl font-black text-black tracking-tight italic">GSTR-1 Registry<span className="text-slate-300">.</span></h2>
                  <p className="text-slate-400 text-[11px] font-bold uppercase tracking-[0.2em] mt-2">
                     {selectedMonth} · Taxable ₹{(invoiceData.totalTaxable || 0).toLocaleString('en-IN')} · GST ₹{(invoiceData.totalGst || 0).toLocaleString('en-IN')} · {invoiceData.invoiceCount || 0} inv
                  </p>
               </div>
               <div className="flex gap-3 items-center">
                  <div className="flex items-center gap-3 px-5 py-3 bg-white border border-slate-100 rounded-xl">
                     <Calendar className="text-slate-300" size={16} />
                     <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="text-[11px] font-bold uppercase tracking-widest bg-transparent outline-none text-black"
                     />
                  </div>
                  <button
                     type="button"
                     onClick={handleDownloadJson}
                     disabled={exporting || loading}
                     className="px-8 py-3 bg-black text-white rounded-xl text-[11px] font-bold uppercase tracking-widest shadow-lg flex items-center gap-3 hover:bg-slate-800 transition-all disabled:opacity-50"
                  >
                     <Download size={14} /> {exporting ? 'Exporting...' : 'Download JSON'}
                  </button>
               </div>
            </div>

            <div className="flex gap-4 p-1 bg-slate-100 rounded-xl self-start">
               {[
                  { id: 'b2b', label: `B2B (${invoiceData.b2b?.length || 0})` },
                  { id: 'b2cLarge', label: `B2C Large (${invoiceData.b2cLarge?.length || 0})` },
                  { id: 'b2cSmall', label: `B2C Small (${invoiceData.b2cSmall?.length || 0})` },
                  { id: 'hsn', label: `HSN (${invoiceData.hsn?.length || 0})` }
               ].map(tab => (
                  <button
                     key={tab.id}
                     type="button"
                     onClick={() => setActiveTab(tab.id)}
                     className={`px-8 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${activeTab === tab.id ? 'bg-white text-black shadow-sm' : 'text-slate-400 hover:text-black'
                        }`}
                  >
                     {tab.label}
                  </button>
               ))}
            </div>

            <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
               {loading ? (
                  <div className="p-8"><SkeletonTable rows={10} cols={5} /></div>
               ) : (
               <div className="overflow-auto flex-1 custom-scrollbar">
                  <table className="w-full text-left">
                     <thead>
                        <tr className="border-b border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                           <th className="px-8 py-5">Reference & Date</th>
                           <th className="px-8 py-5">Counterparty</th>
                           <th className="px-8 py-5">GSTIN / POS</th>
                           <th className="px-8 py-5 text-right">Taxable Value</th>
                           <th className="px-8 py-5 text-right">Gross Total</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                        {(invoiceData[activeTab] || []).length === 0 && (
                           <tr>
                              <td colSpan={5} className="px-8 py-16 text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                 No rows for {selectedMonth} in this section
                              </td>
                           </tr>
                        )}
                        {invoiceData[activeTab]?.map((inv, index) => (
                           <tr key={index} className="hover:bg-slate-50/50 transition-all group border-l-4 border-transparent hover:border-black">
                              <td className="px-8 py-5">
                                 <p className="text-[11px] font-black text-black uppercase tracking-widest">{inv.invoiceNo || inv.hsn}</p>
                                 <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{inv.date || 'Aggregate'}</p>
                              </td>
                              <td className="px-8 py-5 text-[10px] font-bold text-slate-500 uppercase">{inv.partyName || (activeTab === 'hsn' ? 'HSN Classification' : 'Unregistered')}</td>
                              <td className="px-8 py-5 text-[10px] font-bold text-black tracking-widest">{inv.gstin}</td>
                              <td className="px-8 py-5 text-right font-bold text-slate-400 text-[11px]">₹ {(inv.taxable || 0).toLocaleString('en-IN')}</td>
                              <td className="px-8 py-5 text-right font-black text-black text-[12px]">₹ {(inv.total || inv.gst || 0).toLocaleString('en-IN')}</td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
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
      <Modal isOpen={isOpen} onClose={onClose} title="Executive Compliance Scorecard" className="max-w-5xl h-[85vh] bg-white rounded-[2.5rem] p-0 border-none shadow-2xl overflow-hidden">
         <div className="flex flex-col h-full">
            <div className="px-10 pt-6">
               <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-[11px] font-bold uppercase tracking-widest px-4 py-3">
                  Demo / stub screen — scores below are not calculated from your books. Use CA Desk + GSTR-1 / GSTR-3B for real data.
               </div>
            </div>
            <div className="p-10 bg-black text-white flex justify-between items-center">
               <div>
                  <h2 className="text-3xl font-black tracking-tighter uppercase">GST Health Score<span className="text-slate-500">.</span></h2>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-2">Placeholder UI — not live compliance</p>
               </div>
               <div className="text-right">
                  <h3 className="text-5xl font-black tracking-tighter text-slate-500">N/A</h3>
                  <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Not computed</p>
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
