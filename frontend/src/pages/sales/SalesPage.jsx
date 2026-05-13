import React, { useState, useEffect } from 'react';
import useStore from '../../store/useStore';
import { Plus, Search, Filter, ShoppingBag, CreditCard, User, MoreVertical, Printer, ArrowRight, History, TrendingUp } from 'lucide-react';
import SalesModal from './SalesModal';

const SalesPage = () => {
   const { sales, parties, fetchSales, fetchParties } = useStore();
   const [isModalOpen, setIsModalOpen] = useState(false);
   const [activeTab, setActiveTab] = useState('ALL');

   useEffect(() => {
      fetchSales();
      fetchParties();
   }, [fetchSales, fetchParties]);

   const tabs = ['ALL', 'PAID', 'UNPAID', 'DUE'];

   return (
      <div className="p-8 space-y-8 bg-[#FDFCF9] min-h-screen">
         {/* Header Section */}
         <div className="flex items-center justify-between">
            <div>
               <h1 className="text-4xl font-black text-black tracking-tight italic">Sales Registry<span className="text-slate-300">.</span></h1>
               <p className="text-slate-400 text-[11px] font-bold uppercase tracking-[0.2em] mt-2">Revenue Tracking • Tax Invoice Management</p>
            </div>
            <div className="flex gap-4">
               <button className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-lg text-[11px] font-bold uppercase tracking-widest text-black hover:bg-slate-50 transition-all shadow-sm">
                  <History size={14} /> Analytics
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
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
               <div className="flex justify-between items-start mb-10">
                  <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-black group-hover:text-white transition-all duration-300">
                     <ShoppingBag size={24} />
                  </div>
                  <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Growth</span>
               </div>
               <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Monthly Sales</p>
               <h3 className="text-3xl font-black text-black mt-1">₹ 12,84,500</h3>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
               <div className="flex justify-between items-start mb-10">
                  <div className="p-4 bg-slate-50 rounded-2xl">
                     <TrendingUp size={24} />
                  </div>
                  <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest">Active</span>
               </div>
               <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Open Invoices</p>
               <h3 className="text-3xl font-black text-black mt-1">{sales.length}</h3>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
               <div className="flex justify-between items-start mb-10">
                  <div className="p-4 bg-slate-50 rounded-2xl">
                     <CreditCard size={24} />
                  </div>
                  <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Alert</span>
               </div>
               <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Overdue</p>
               <h3 className="text-3xl font-black text-black mt-1">₹ 2,14,000</h3>
            </div>
         </div>

         {/* Main Ledger Table */}
         <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-white">
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
                        className="pl-12 pr-6 py-2.5 bg-slate-50 border-none rounded-xl text-[10px] font-bold uppercase tracking-widest outline-none w-80 transition-all focus:bg-white focus:ring-1 focus:ring-black"
                     />
                  </div>
                  <button className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-black transition-all">
                     <Filter size={18} />
                  </button>
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
                     {sales.map((sale) => (
                        <tr key={sale.id} className="hover:bg-slate-50/50 transition-all group">
                           <td className="px-8 py-6">
                              <p className="text-[11px] font-black text-black uppercase tracking-widest">{sale.invoiceNo}</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{sale.date}</p>
                           </td>
                           <td className="px-8 py-6">
                              <p className="text-[10px] font-bold text-black uppercase tracking-widest">{parties.find(p => p.id === sale.customerId)?.name || 'UNREGISTERED'}</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{sale.destination || 'LOCAL'}</p>
                           </td>
                           <td className="px-8 py-6 text-right font-bold text-slate-400 text-[11px]">
                              ₹ {sale.totals.subtotal.toLocaleString()}
                           </td>
                           <td className="px-8 py-6 text-right font-black text-black text-[12px]">
                              ₹ {sale.totals.total.toLocaleString()}
                           </td>
                           <td className="px-8 py-6 text-center">
                              <span className={`px-3 py-1 bg-slate-50 text-slate-400 text-[10px] font-bold uppercase rounded-md border border-slate-100`}>
                                 SETTLED
                              </span>
                           </td>
                           <td className="px-8 py-6 text-right">
                              <div className="flex items-center justify-end gap-2">
                                 <button className="p-2 text-slate-300 hover:text-black transition-all">
                                    <Printer size={16} />
                                 </button>
                                 <button className="p-2 text-slate-300 hover:text-black transition-all">
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

         <SalesModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </div>
   );
};

export default SalesPage;
