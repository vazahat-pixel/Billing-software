import React, { useMemo } from 'react';
import useStore from '../../store/useStore';
import { FileText, Download, TrendingUp, TrendingDown, Landmark, PieChart } from 'lucide-react';

const GSTPage = () => {
  const { sales, purchases } = useStore();

  const gstSummary = useMemo(() => {
    const outputTax = sales.reduce((acc, s) => acc + (parseFloat(s.totals.igst || 0) + parseFloat(s.totals.cgst || 0) + parseFloat(s.totals.sgst || 0)), 0);
    const inputTax = purchases.reduce((acc, p) => acc + (parseFloat(p.totals.igst || 0) + parseFloat(p.totals.cgst || 0) + parseFloat(p.totals.sgst || 0)), 0);
    const netPayable = outputTax - inputTax;

    return { outputTax, inputTax, netPayable };
  }, [sales, purchases]);

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-2xl font-black text-slate-900 tracking-tight">GST Compliance Dashboard</h1>
           <p className="text-slate-500 text-sm">GSTR-1, GSTR-2 tracking and Input Tax Credit (ITC) management.</p>
        </div>
        <div className="flex gap-3">
           <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
             <Download size={14} /> Download GSTR-1 JSON
           </button>
        </div>
      </div>

      {/* ITC Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 text-indigo-500/10 group-hover:scale-125 transition-transform"><TrendingUp size={80} /></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Output Tax Liability</p>
            <h3 className="text-3xl font-black text-slate-900">₹ {gstSummary.outputTax.toLocaleString()}</h3>
            <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-slate-400">
               <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">GSTR-1</span>
               <span>From Total Sales</span>
            </div>
         </div>
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 text-emerald-500/10 group-hover:scale-125 transition-transform"><TrendingDown size={80} /></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Input Tax Credit (ITC)</p>
            <h3 className="text-3xl font-black text-emerald-600">₹ {gstSummary.inputTax.toLocaleString()}</h3>
            <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-slate-400">
               <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded">GSTR-2</span>
               <span>Available for Offset</span>
            </div>
         </div>
         <div className="bg-slate-900 p-6 rounded-2xl shadow-xl shadow-slate-200 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 text-white/5"><Landmark size={80} /></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Net GST Payable</p>
            <h3 className={`text-3xl font-black ${gstSummary.netPayable >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
               ₹ {Math.abs(gstSummary.netPayable).toLocaleString()}
               {gstSummary.netPayable < 0 ? ' (Carry Forward)' : ''}
            </h3>
            <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-slate-500">
               <span className="px-1.5 py-0.5 bg-white/10 text-white rounded">PAYABLE</span>
               <span>After ITC Adjustment</span>
            </div>
         </div>
      </div>

      {/* GSTR-1 Preview Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
         <div className="p-5 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700 font-bold">
               <FileText size={18} className="text-indigo-600" />
               <span>GSTR-1 Invoice-wise Details</span>
            </div>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                     <th className="px-6 py-4">Invoice No & Date</th>
                     <th className="px-6 py-4">GSTIN / UIN</th>
                     <th className="px-6 py-4 text-right">Taxable Value</th>
                     <th className="px-6 py-4 text-right">CGST</th>
                     <th className="px-6 py-4 text-right">SGST</th>
                     <th className="px-6 py-4 text-right">IGST</th>
                     <th className="px-6 py-4 text-right">Total Invoice</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                       <td className="px-6 py-4">
                          <p className="text-xs font-bold text-slate-800">{sale.invoiceNo}</p>
                          <p className="text-[10px] text-slate-400 font-bold">{sale.date}</p>
                       </td>
                       <td className="px-6 py-4 text-xs font-medium text-slate-600">
                          {sale.gstin || '24ABCDE1234F1Z5'}
                       </td>
                       <td className="px-6 py-4 text-right text-xs font-black text-slate-700">
                          ₹ {parseFloat(sale.totals.subtotal).toLocaleString()}
                       </td>
                       <td className="px-6 py-4 text-right text-xs font-bold text-slate-400">
                          {sale.totals.cgst || '0.00'}
                       </td>
                       <td className="px-6 py-4 text-right text-xs font-bold text-slate-400">
                          {sale.totals.sgst || '0.00'}
                       </td>
                       <td className="px-6 py-4 text-right text-xs font-bold text-slate-400">
                          {sale.totals.igst || '0.00'}
                       </td>
                       <td className="px-6 py-4 text-right text-xs font-black text-slate-900">
                          ₹ {parseFloat(sale.totals.total).toLocaleString()}
                       </td>
                    </tr>
                  ))}
                  {sales.length === 0 && (
                    <tr>
                       <td colSpan="7" className="px-6 py-20 text-center text-slate-400">
                          <PieChart size={40} className="mx-auto opacity-10 mb-4" />
                          <p className="text-sm font-medium">No sales data available for GSTR-1.</p>
                       </td>
                    </tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};

export default GSTPage;
