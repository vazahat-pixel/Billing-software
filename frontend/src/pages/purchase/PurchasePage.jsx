import React, { useState, useEffect } from 'react';
import useStore from '../../store/useStore';
import { Plus, Search, Filter, FileText, Calendar, User, MoreVertical, Printer, ArrowRight, History, TrendingUp, Package } from 'lucide-react';
import PurchaseModal from './PurchaseModal';
import PurchasePrint from './PurchasePrint';

const PurchasePage = () => {
  const { purchases, parties, fetchPurchases, fetchParties } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [printInvoiceId, setPrintInvoiceId] = useState(null);
  const [activeTab, setActiveTab] = useState('ALL');

  useEffect(() => {
    fetchPurchases();
    fetchParties();
  }, [fetchPurchases, fetchParties]);

  const tabs = ['ALL', 'STAGED', 'COMPLETED', 'PENDING'];

  return (
    <div className="p-8 space-y-8 bg-[#FDFCF9] min-h-screen">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
           <h1 className="text-4xl font-black text-black tracking-tight italic">Procurement Registry<span className="text-slate-300">.</span></h1>
           <p className="text-slate-400 text-[11px] font-bold uppercase tracking-[0.2em] mt-2">Inbound Inventory • Supplier Ledger</p>
        </div>
        <div className="flex gap-4">
           <button className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-lg text-[11px] font-bold uppercase tracking-widest text-black hover:bg-slate-50 transition-all shadow-sm">
             <History size={14} /> Suppliers
           </button>
           <button 
             onClick={() => setIsModalOpen(true)}
             className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-lg text-[11px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
           >
             <Plus size={14} /> Record Inbound
           </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="flex justify-between items-start mb-10">
               <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-black group-hover:text-white transition-all duration-300">
                  <Package size={24} />
               </div>
               <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest">Inbound</span>
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Total Procurement</p>
            <h3 className="text-3xl font-black text-black mt-1">₹ 24,18,000</h3>
         </div>

         <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="flex justify-between items-start mb-10">
               <div className="p-4 bg-slate-50 rounded-2xl">
                  <TrendingUp size={24} />
               </div>
               <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Active</span>
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Open Orders</p>
            <h3 className="text-3xl font-black text-black mt-1">{purchases.length}</h3>
         </div>

         <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="flex justify-between items-start mb-10">
               <div className="p-4 bg-slate-50 rounded-2xl">
                  <FileText size={24} />
               </div>
               <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Review</span>
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Awaiting Verification</p>
            <h3 className="text-3xl font-black text-black mt-1">5 Items</h3>
         </div>
      </div>

      {/* Main Procurement Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
         <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-white">
            <div className="flex p-1 bg-slate-50 rounded-xl">
               {tabs.map(tab => (
                 <button
                   key={tab}
                   onClick={() => setActiveTab(tab)}
                   className={`px-6 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${
                     activeTab === tab ? 'bg-black text-white shadow-md' : 'text-slate-400 hover:text-black'
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
                    placeholder="SEARCH PROCUREMENT..." 
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
                     <th className="px-8 py-5">Audit Ref & Date</th>
                     <th className="px-8 py-5">Supplier</th>
                     <th className="px-8 py-5 text-right">Volume (MTRS)</th>
                     <th className="px-8 py-5 text-right">Taxable Cap</th>
                     <th className="px-8 py-5 text-right">Liability Total</th>
                     <th className="px-8 py-5 text-right">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {purchases.map((pur) => (
                    <tr key={pur.id} className="hover:bg-slate-50/50 transition-all group">
                       <td className="px-8 py-6">
                          <p className="text-[11px] font-black text-black uppercase tracking-widest">Vch: {pur.invoiceNo}</p>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Bill: {pur.supplierInvoiceNo || 'N/A'}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{pur.date ? new Date(pur.date).toLocaleDateString() : ''}</p>
                       </td>
                       <td className="px-8 py-6">
                          <p className="text-[10px] font-bold text-black uppercase tracking-widest">{parties.find(p => p.id === pur.supplierId)?.name || 'UNREGISTERED'}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{pur.transport || 'SELF LOGISTICS'}</p>
                       </td>
                       <td className="px-8 py-6 text-right font-bold text-slate-400 text-[11px]">
                          {pur.items.reduce((acc, i) => acc + parseFloat(i.mtrs || 0), 0).toFixed(2)}
                       </td>
                       <td className="px-8 py-6 text-right font-bold text-slate-400 text-[11px]">
                          ₹ {(pur.taxableAmount || pur.totals?.subtotal || 0).toLocaleString()}
                       </td>
                       <td className="px-8 py-6 text-right font-black text-black text-[12px]">
                          ₹ {(pur.netAmount || pur.totals?.total || 0).toLocaleString()}
                       </td>
                       <td className="px-8 py-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                             <button onClick={() => setPrintInvoiceId(pur.id || pur._id)} className="p-2 text-slate-300 hover:text-black transition-all" title="Print Voucher">
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

      <PurchaseModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      {printInvoiceId && <PurchasePrint invoiceId={printInvoiceId} onClose={() => setPrintInvoiceId(null)} />}
    </div>
  );
};

export default PurchasePage;
