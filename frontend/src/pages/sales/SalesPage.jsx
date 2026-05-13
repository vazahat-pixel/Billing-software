import React, { useState, useEffect } from 'react';
import useStore from '../../store/useStore';
import { Plus, Search, Filter, ShoppingBag, CreditCard, User, MoreVertical, Printer } from 'lucide-react';
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div>
           <h1 className="text-2xl font-black text-slate-900 tracking-tight">Sales Invoices</h1>
           <p className="text-slate-500 text-sm">Generate tax invoices and track customer billing.</p>
        </div>
        <ERPButton variant="indigo" icon={Plus} onClick={() => setIsModalOpen(true)}>
          New Sales Invoice
        </ERPButton>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
         <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
            <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
               <input 
                 placeholder="Search by invoice or customer..." 
                 className="pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 w-80"
               />
            </div>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                     <th className="px-6 py-4">Invoice Details</th>
                     <th className="px-6 py-4">Customer</th>
                     <th className="px-6 py-4 text-right">Qty (Mtrs)</th>
                     <th className="px-6 py-4 text-right">Tax Value</th>
                     <th className="px-6 py-4 text-right">Net Payable</th>
                     <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                       <td className="px-6 py-4">
                          <p className="text-xs font-bold text-slate-800">{sale.invoiceNo}</p>
                          <p className="text-[10px] text-slate-400 font-bold">{sale.date}</p>
                       </td>
                       <td className="px-6 py-4">
                          <p className="text-xs font-bold text-slate-700">{parties.find(p => p.id === sale.customerId)?.name || 'Unknown'}</p>
                          <p className="text-[10px] text-slate-400 uppercase font-black">{sale.destination || 'Local'}</p>
                       </td>
                       <td className="px-6 py-4 text-right text-xs font-black text-slate-500">
                          {sale.items.reduce((acc, i) => acc + parseFloat(i.mtrs || 0), 0).toFixed(2)}
                       </td>
                       <td className="px-6 py-4 text-right text-xs font-bold text-slate-700">
                          ₹ {sale.totals.subtotal}
                       </td>
                       <td className="px-6 py-4 text-right text-xs font-black text-emerald-600">
                          ₹ {sale.totals.total}
                       </td>
                       <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                             <button className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"><Printer size={16} /></button>
                             <button className="p-1.5 text-slate-400 hover:text-slate-900 transition-colors"><MoreVertical size={16} /></button>
                          </div>
                       </td>
                    </tr>
                  ))}
                  {sales.length === 0 && (
                    <tr>
                       <td colSpan="6" className="px-6 py-20 text-center text-slate-400">
                          <ShoppingBag size={40} className="mx-auto opacity-10 mb-4" />
                          <p className="text-sm font-medium">No sales records found.</p>
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
