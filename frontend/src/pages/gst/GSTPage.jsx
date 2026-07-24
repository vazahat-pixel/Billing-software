import React, { useMemo, useState } from 'react';
import useStore from '../../store/useStore';
import { downloadJson, getMonthDateRange, buildGstr1Filename } from '../../utils/gstExport';
import { FileText, Download, TrendingUp, TrendingDown, Landmark, PieChart, ArrowRight } from 'lucide-react';
import { notifyError } from '../../utils/notify';

const GSTPage = () => {
  const { sales, purchases, fetchGstr1 } = useStore();
  const [exporting, setExporting] = useState(false);
  const { startDate, endDate } = getMonthDateRange();

  const handleGstr1Export = async () => {
    setExporting(true);
    try {
      const data = await fetchGstr1(startDate, endDate);
      downloadJson(data, buildGstr1Filename(startDate, endDate));
    } catch (err) {
      notifyError(err, 'GSTR-1 export failed');
    } finally {
      setExporting(false);
    }
  };

  const gstSummary = useMemo(() => {
    const outputTax = sales.reduce((acc, s) => acc + (parseFloat(s.totals.igst || 0) + parseFloat(s.totals.cgst || 0) + parseFloat(s.totals.sgst || 0)), 0);
    const inputTax = purchases.reduce((acc, p) => acc + (parseFloat(p.totals.igst || 0) + parseFloat(p.totals.cgst || 0) + parseFloat(p.totals.sgst || 0)), 0);
    const netPayable = outputTax - inputTax;

    return { outputTax, inputTax, netPayable };
  }, [sales, purchases]);

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Architectural Header */}
      <div className="bg-white p-10 border-2 border-black flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl">
        <div className="flex items-center gap-6">
           <div className="p-4 bg-black text-white">
              <Landmark size={28} />
           </div>
           <div>
              <h1 className="text-3xl font-black text-black uppercase tracking-tighter">Compliance Intelligence</h1>
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">
                 <span>Taxation</span>
                 <ArrowRight size={10} />
                 <span className="text-black">GST Audit Framework</span>
              </div>
           </div>
        </div>
        <div className="flex gap-4">
           <button
             type="button"
             onClick={handleGstr1Export}
             disabled={exporting}
             className="flex items-center gap-3 px-10 py-3 bg-black text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50"
           >
             <Download size={14} /> {exporting ? 'Exporting...' : 'GSTR-1 Schema JSON'}
           </button>
        </div>
      </div>

      {/* ITC Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-8 border-2 border-black relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-10 text-slate-50 opacity-50"><TrendingUp size={120} /></div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] mb-4">Output Liability</p>
            <h3 className="text-4xl font-black text-black tracking-tighter">₹ {gstSummary.outputTax.toLocaleString()}</h3>
            <div className="mt-8 flex items-center gap-4">
               <span className="px-3 py-1 bg-black text-white text-[9px] font-black uppercase tracking-widest">GSTR-1</span>
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sales Registry</span>
            </div>
         </div>
         <div className="bg-white p-8 border-2 border-black relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-10 text-slate-50 opacity-50"><TrendingDown size={120} /></div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] mb-4">Input Credit (ITC)</p>
            <h3 className="text-4xl font-black text-black tracking-tighter">₹ {gstSummary.inputTax.toLocaleString()}</h3>
            <div className="mt-8 flex items-center gap-4">
               <span className="px-3 py-1 bg-slate-100 text-black border-2 border-black text-[9px] font-black uppercase tracking-widest">GSTR-2</span>
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Offset Capability</span>
            </div>
         </div>
         <div className="bg-black p-8 text-white relative overflow-hidden">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4">Net Fiscal Position</p>
            <h3 className="text-4xl font-black tracking-tighter">
               ₹ {Math.abs(gstSummary.netPayable).toLocaleString()}
               <span className="text-sm ml-2 opacity-50">{gstSummary.netPayable < 0 ? 'CFWD' : 'LIAB'}</span>
            </h3>
            <div className="mt-8 flex items-center gap-4">
               <span className="px-3 py-1 bg-white text-black text-[9px] font-black uppercase tracking-widest">PAYABLE</span>
               <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Post-Adjustment</span>
            </div>
         </div>
      </div>

      {/* GSTR-1 Preview Ledger */}
      <div className="bg-white border-2 border-black overflow-hidden flex flex-col shadow-2xl">
         <div className="p-6 border-b-2 border-black bg-white">
            <div className="flex items-center gap-4">
               <FileText size={20} className="text-black" />
               <h3 className="text-[10px] font-black uppercase text-black tracking-[0.4em]">Invoice-Level Audit Preview</h3>
            </div>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-black text-[9px] font-black text-white uppercase tracking-[0.3em] sticky top-0 z-10">
                     <th className="px-8 py-5">Audit Ref & Timestamp</th>
                     <th className="px-8 py-5">GSTIN / Identity</th>
                     <th className="px-8 py-5 text-right">Taxable Cap</th>
                     <th className="px-8 py-5 text-right">CGST</th>
                     <th className="px-8 py-5 text-right">SGST</th>
                     <th className="px-8 py-5 text-right">IGST</th>
                     <th className="px-8 py-5 text-right">Invoice Gross</th>
                  </tr>
               </thead>
               <tbody className="divide-y-2 divide-slate-50">
                  {sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50 transition-all">
                       <td className="px-8 py-5">
                          <p className="text-[11px] font-black text-black uppercase tracking-widest">{sale.invoiceNo}</p>
                          <p className="text-[9px] text-slate-400 font-black uppercase mt-1 tracking-widest">{sale.date}</p>
                       </td>
                       <td className="px-8 py-5 text-[10px] font-black text-black tracking-widest">
                          {sale.gstin || '24ABCDE1234F1Z5'}
                       </td>
                       <td className="px-8 py-5 text-right text-[11px] font-black text-black tracking-widest">
                          ₹ {parseFloat(sale.totals.subtotal).toLocaleString()}
                       </td>
                       <td className="px-8 py-5 text-right text-[10px] font-black text-slate-400">
                          {sale.totals.cgst || '0.00'}
                       </td>
                       <td className="px-8 py-5 text-right text-[10px] font-black text-slate-400">
                          {sale.totals.sgst || '0.00'}
                       </td>
                       <td className="px-8 py-5 text-right text-[10px] font-black text-slate-400">
                          {sale.totals.igst || '0.00'}
                       </td>
                       <td className="px-8 py-5 text-right text-[12px] font-black text-black tracking-tighter">
                          ₹ {parseFloat(sale.totals.total).toLocaleString()}
                       </td>
                    </tr>
                  ))}
                  {sales.length === 0 && (
                    <tr>
                       <td colSpan="7" className="px-8 py-24 text-center">
                          <PieChart size={48} className="mx-auto text-slate-100 mb-6" />
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">Zero Compliance Records</p>
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
