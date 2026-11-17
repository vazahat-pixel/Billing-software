import React, { useState, useEffect, useMemo } from 'react';
import useStore from '../../store/useStore';
import { Plus, Search, Filter, ShoppingBag, CreditCard, User, MoreVertical, Printer, ArrowRight, History, TrendingUp, Truck } from 'lucide-react';
import SalesModal from './SalesModal';
import SalesPrint from './SalesPrint';
import LrEntryModal from './LrEntryModal';

const SalesPage = () => {
   const { sales, parties, fetchSales, fetchParties } = useStore();
   const [isModalOpen, setIsModalOpen] = useState(false);
   const [isLrModalOpen, setIsLrModalOpen] = useState(false);
   const [billToOpen, setBillToOpen] = useState(null);
   const [printInvoiceId, setPrintInvoiceId] = useState(null);
   const [activeTab, setActiveTab] = useState('ALL');
   const [searchQuery, setSearchQuery] = useState('');

   useEffect(() => {
      fetchSales();
      fetchParties();
   }, [fetchSales, fetchParties]);

   const tabs = ['ALL', 'PAID', 'UNPAID', 'DUE'];

   const currentFy = useMemo(() => {
      const d = new Date();
      const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
      return `${y}-${y + 1}`;
   }, []);

   const [selectedFy, setSelectedFy] = useState(currentFy);

   const fyOf = useCallback((s) => {
      const d = new Date(s?.date || s?.createdAt || 0);
      if (Number.isNaN(d.getTime())) return '';
      const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
      return `${y}-${y + 1}`;
   }, []);

   const availableFys = useMemo(() => {
      const set = new Set();
      (sales || []).forEach((s) => {
         const f = fyOf(s);
         if (f) set.add(f);
      });
      if (!set.has(currentFy)) set.add(currentFy);
      return Array.from(set).sort().reverse();
   }, [sales, currentFy, fyOf]);

   const monthStart = useMemo(() => {
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth(), 1);
   }, []);

   const monthlySalesTotal = useMemo(
      () => (sales || []).reduce((sum, s) => {
         const d = new Date(s.date || s.createdAt || 0);
         if (Number.isNaN(d.getTime()) || d < monthStart) return sum;
         return sum + Number(s.netAmount || s.totals?.total || 0);
      }, 0),
      [sales, monthStart]
   );

   const fySalesTotal = useMemo(
      () => (sales || []).reduce((sum, s) => {
         if (selectedFy !== 'ALL' && fyOf(s) !== selectedFy) return sum;
         return sum + Number(s.netAmount || s.totals?.total || 0);
      }, 0),
      [sales, selectedFy, fyOf]
   );

   const fyTaxableTotal = useMemo(
      () => (sales || []).reduce((sum, s) => {
         if (selectedFy !== 'ALL' && fyOf(s) !== selectedFy) return sum;
         return sum + Number(s.taxableAmount || 0);
      }, 0),
      [sales, selectedFy, fyOf]
   );

   const overdueTotal = useMemo(
      () => (sales || []).reduce((sum, s) => {
         if (selectedFy !== 'ALL' && fyOf(s) !== selectedFy) return sum;
         const due = Number(s.balanceDue ?? s.outstanding ?? 0);
         if (due <= 0) return sum;
         return sum + due;
      }, 0),
      [sales, selectedFy, fyOf]
   );

   const filteredSales = useMemo(() => {
      return (sales || []).filter((s) => {
         if (s.status === 'cancelled') return false;
         if (selectedFy !== 'ALL' && fyOf(s) !== selectedFy) return false;

         // Tab filter
         const isPaid = Number(s.balanceDue ?? s.outstanding ?? 0) <= 0 && Number(s.paidAmount || 0) > 0;
         const hasDue = Number(s.balanceDue ?? s.outstanding ?? 0) > 0;
         if (activeTab === 'PAID' && !isPaid) return false;
         if (activeTab === 'UNPAID' && Number(s.paidAmount || 0) > 0) return false;
         if (activeTab === 'DUE' && !hasDue) return false;

         // Search query
         if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            const partyName = parties.find((p) => (p._id || p.id) === (s.customerId?._id || s.customerId))?.name || s.customerName || '';
            const invNo = String(s.invoiceNo || '');
            const dest = String(s.destination || s.station || s.city || '');
            if (!invNo.toLowerCase().includes(q) && !partyName.toLowerCase().includes(q) && !dest.toLowerCase().includes(q)) {
               return false;
            }
         }
         return true;
      });
   }, [sales, selectedFy, fyOf, activeTab, searchQuery, parties]);

   return (
      <div className="p-8 space-y-8 bg-[#FDFCF9] min-h-screen">
         {/* Header Section */}
         <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
               <h1 className="text-4xl font-black text-black tracking-tight italic">Sales Registry<span className="text-slate-300">.</span></h1>
               <p className="text-slate-400 text-[11px] font-bold uppercase tracking-[0.2em] mt-2">Revenue Tracking • Tax Invoice Management</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
               {/* Financial Year Selector */}
               <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-lg shadow-sm">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">FY:</span>
                  <select
                     value={selectedFy}
                     onChange={(e) => setSelectedFy(e.target.value)}
                     className="bg-transparent text-[11px] font-bold text-black uppercase tracking-wider focus:outline-none cursor-pointer"
                  >
                     {availableFys.map((fy) => (
                        <option key={fy} value={fy}>
                           FY {fy} {fy === currentFy ? '(Current)' : ''}
                        </option>
                     ))}
                     <option value="ALL">All Financial Years</option>
                  </select>
               </div>

               <button
                  onClick={() => setIsLrModalOpen(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-lg text-[11px] font-bold uppercase tracking-widest hover:bg-amber-600 transition-all shadow-lg"
               >
                  <Truck size={14} /> LR Entry
               </button>
               <button
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-lg text-[11px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
               >
                  <Plus size={14} /> New Invoice
               </button>
            </div>
         </div>

         {/* KPI Cards */}
         <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
               <div className="flex justify-between items-start mb-6">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                     <ShoppingBag size={20} />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                     {selectedFy === 'ALL' ? 'All Time' : `FY ${selectedFy}`}
                  </span>
               </div>
               <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  {selectedFy === 'ALL' ? 'Total Sales' : `Sales (FY ${selectedFy})`}
               </p>
               <h3 className="text-2xl font-black text-black mt-1">₹ {fySalesTotal.toLocaleString('en-IN')}</h3>
               <p className="text-[10px] text-slate-400 font-semibold mt-1">
                  Taxable: ₹ {fyTaxableTotal.toLocaleString('en-IN')}
               </p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
               <div className="flex justify-between items-start mb-6">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                     <TrendingUp size={20} />
                  </div>
                  <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Monthly</span>
               </div>
               <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">This Month Sales</p>
               <h3 className="text-2xl font-black text-black mt-1">₹ {monthlySalesTotal.toLocaleString('en-IN')}</h3>
               <p className="text-[10px] text-slate-400 font-semibold mt-1">Current Calendar Month</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
               <div className="flex justify-between items-start mb-6">
                  <div className="p-3 bg-slate-50 text-slate-700 rounded-2xl">
                     <ShoppingBag size={20} />
                  </div>
                  <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest">Invoices</span>
               </div>
               <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Invoices Count</p>
               <h3 className="text-2xl font-black text-black mt-1">{filteredSales.length}</h3>
               <p className="text-[10px] text-slate-400 font-semibold mt-1">
                  {selectedFy === 'ALL' ? 'All records' : `In FY ${selectedFy}`}
               </p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
               <div className="flex justify-between items-start mb-6">
                  <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                     <CreditCard size={20} />
                  </div>
                  <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Alert</span>
               </div>
               <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Overdue / Balance</p>
               <h3 className="text-2xl font-black text-black mt-1">₹ {overdueTotal.toLocaleString('en-IN')}</h3>
               <p className="text-[10px] text-slate-400 font-semibold mt-1">Pending Collection</p>
            </div>
         </div>

         {/* Main Ledger Table */}
         <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-white flex-wrap gap-4">
               <div className="flex p-1 bg-slate-50 rounded-xl">
                  {tabs.map(tab => (
                     <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${activeTab === tab ? 'bg-black text-white shadow-md' : 'text-slate-400 hover:text-black'
                           }`}
                     >
                        {tab}
                     </button>
                  ))}
               </div>
               <div className="flex items-center gap-4">
                  <div className="relative">
                     <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                     <input
                        placeholder="SEARCH INVOICES..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-12 pr-6 py-2.5 bg-slate-50 border-none rounded-xl text-[10px] font-bold uppercase tracking-widest outline-none w-80 transition-all focus:bg-white focus:ring-1 focus:ring-black"
                     />
                  </div>
               </div>
            </div>

            <div className="overflow-x-auto">
               <table className="w-full text-left">
                  <thead>
                     <tr className="border-b border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <th className="px-8 py-5">Reference & Date</th>
                        <th className="px-8 py-5">Counterparty</th>
                        <th className="px-8 py-5 text-right">Taxable Base</th>
                        <th className="px-8 py-5 text-right">Settlement Total</th>
                        <th className="px-8 py-5 text-center">Status</th>
                        <th className="px-8 py-5 text-right">Actions</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                     {filteredSales.map((sale) => (
                        <tr key={sale.id || sale._id} className="hover:bg-slate-50/50 transition-all group">
                           <td className="px-8 py-6">
                              <p className="text-[11px] font-black text-black uppercase tracking-widest">{sale.invoiceNo}</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                 {sale.date ? new Date(sale.date).toLocaleDateString('en-IN') : '—'}
                              </p>
                              {sale.offlinePending && (
                                 <span className="text-[8px] font-bold text-amber-600 uppercase tracking-wider">Pending Sync</span>
                              )}
                           </td>
                           <td className="px-8 py-6">
                              <p className="text-[10px] font-bold text-black uppercase tracking-widest">
                                 {parties.find(p => String(p._id || p.id) === String(sale.customerId?._id || sale.customerId))?.name || sale.customerName || 'UNREGISTERED'}
                              </p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                 {sale.destination || sale.station || sale.city || 'LOCAL'}
                              </p>
                           </td>
                           <td className="px-8 py-6 text-right font-bold text-slate-400 text-[11px]">
                              ₹ {(sale.taxableAmount || sale.totals?.subtotal || 0).toLocaleString('en-IN')}
                           </td>
                           <td className="px-8 py-6 text-right font-black text-black text-[12px]">
                              ₹ {(sale.netAmount || sale.totals?.total || 0).toLocaleString('en-IN')}
                           </td>
                           <td className="px-8 py-6 text-center">
                              <span className={`px-3 py-1 bg-slate-50 text-slate-500 text-[10px] font-bold uppercase rounded-md border border-slate-100`}>
                                 {sale.lrNo ? `LR: ${sale.lrNo}` : 'NO LR'}
                              </span>
                           </td>
                           <td className="px-8 py-6 text-right">
                              <div className="flex items-center justify-end gap-2">
                                 <button onClick={() => setPrintInvoiceId(sale.id || sale._id)} className="p-2 text-slate-300 hover:text-black transition-all" title="Print Invoice">
                                    <Printer size={16} />
                                 </button>
                                 <button onClick={() => { setBillToOpen(sale); setIsModalOpen(true); }} className="p-2 text-slate-300 hover:text-black transition-all" title="Open Bill">
                                    <MoreVertical size={18} />
                                 </button>
                              </div>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </div>

         <SalesModal
            isOpen={isModalOpen}
            initialData={billToOpen}
            onClose={() => { setIsModalOpen(false); setBillToOpen(null); }}
         />
         {printInvoiceId && <SalesPrint invoiceId={printInvoiceId} onClose={() => setPrintInvoiceId(null)} />}
         <LrEntryModal
            isOpen={isLrModalOpen}
            defaultFy={selectedFy}
            onClose={() => setIsLrModalOpen(false)}
            onOpenBill={(bill) => {
              setBillToOpen(bill);
              setIsLrModalOpen(false);
              setIsModalOpen(true);
            }}
         />
      </div>
   );
};

export default SalesPage;
