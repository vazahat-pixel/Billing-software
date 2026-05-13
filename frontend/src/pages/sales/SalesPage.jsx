import React, { useState, useEffect } from 'react';
import useStore from '../../store/useStore';
import { Plus, Search, Filter, ShoppingBag, CreditCard, User, MoreVertical, Printer, ArrowRight } from 'lucide-react';
import { ERPButton } from '../../components/forms/FormElements';
import SalesModal from './SalesModal';

const SalesPage = () => {
  const { sales, parties, fetchSales, fetchParties } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchSales();
    fetchParties();
  }, [fetchSales, fetchParties]);

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Architectural Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-10 border-2 border-black shadow-2xl">
        <div className="flex items-center gap-6">
           <div className="p-4 bg-black text-white">
              <ShoppingBag size={28} />
           </div>
           <div>
              <h1 className="text-3xl font-black text-black uppercase tracking-tighter">Sales Registry</h1>
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">
                 <span>Revenue</span>
                 <ArrowRight size={10} />
                 <span className="text-black">Tax Invoices</span>
              </div>
           </div>
        </div>
        <ERPButton 
           variant="indigo" 
           icon={Plus} 
           onClick={() => setIsModalOpen(true)}
           className="px-10"
        >
          Initialize Invoice
        </ERPButton>
      </div>

      {/* Main Ledger Table */}
      <div className="bg-white border-2 border-black overflow-hidden flex flex-col shadow-2xl">
         <div className="p-4 border-b-2 border-black bg-white flex items-center justify-between">
            <div className="relative">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-black" size={14} />
               <input 
                 placeholder="Search Audit (Invoice, Customer, Destination)..." 
                 className="pl-12 pr-6 py-2.5 bg-white border-2 border-black text-[10px] font-black uppercase tracking-widest outline-none w-96 transition-all focus:w-[500px]"
               />
            </div>
            <button className="p-2.5 bg-white border-2 border-black text-black hover:bg-slate-50 transition-all"><Filter size={18} /></button>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-black text-[9px] font-black text-white uppercase tracking-[0.3em] sticky top-0 z-10">
                     <th className="px-8 py-5">Audit Reference & Date</th>
                     <th className="px-8 py-5">Counterparty Intelligence</th>
                     <th className="px-8 py-5 text-right">Quantum (MTRS)</th>
                     <th className="px-8 py-5 text-right">Taxable Base</th>
                     <th className="px-8 py-5 text-right">Settlement Total</th>
                     <th className="px-8 py-5 text-right">Audit</th>
                  </tr>
               </thead>
               <tbody className="divide-y-2 divide-slate-50">
                  {sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50 transition-all">
                       <td className="px-8 py-5">
                          <p className="text-[11px] font-black text-black uppercase tracking-widest">{sale.invoiceNo}</p>
                          <p className="text-[9px] text-slate-400 font-black uppercase mt-1 tracking-widest">{sale.date}</p>
                       </td>
                       <td className="px-8 py-5">
                          <p className="text-[10px] font-black text-black uppercase tracking-widest">{parties.find(p => p.id === sale.customerId)?.name || 'UNREGISTERED'}</p>
                          <p className="text-[9px] text-slate-400 uppercase font-black mt-1 tracking-widest">{sale.destination || 'LOCAL JURISDICTION'}</p>
                       </td>
                       <td className="px-8 py-5 text-right text-[10px] font-black text-slate-400 tracking-widest">
                          {sale.items.reduce((acc, i) => acc + parseFloat(i.mtrs || 0), 0).toFixed(2)}
                       </td>
                       <td className="px-8 py-5 text-right text-[10px] font-black text-black tracking-widest">
                          ₹ {sale.totals.subtotal.toLocaleString()}
                       </td>
                       <td className="px-8 py-5 text-right text-[12px] font-black text-black tracking-tighter">
                          ₹ {sale.totals.total.toLocaleString()}
                       </td>
                       <td className="px-8 py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                             <button className="p-3 bg-white border-2 border-black text-black hover:bg-black hover:text-white transition-all shadow-sm">
                                <Printer size={16} />
                             </button>
                             <button className="p-3 border-2 border-slate-100 text-slate-300 hover:border-black hover:text-black transition-all">
                                <MoreVertical size={16} />
                             </button>
                          </div>
                       </td>
                    </tr>
                  ))}
                  {sales.length === 0 && (
                    <tr>
                       <td colSpan="6" className="px-8 py-24 text-center">
                          <ShoppingBag size={48} className="mx-auto text-slate-100 mb-6" />
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">Zero Registry Entries</p>
                       </td>
                    </tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>

      <SalesModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};

export default SalesPage;
