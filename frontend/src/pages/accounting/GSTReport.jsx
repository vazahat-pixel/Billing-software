import React, { useMemo, useState } from 'react';
import useStore from '../../store/useStore';
import { ERPButton, ERPInput, ERPSelect } from '../../components/forms/FormElements';
import { FileSpreadsheet, FileDown, Printer, Search, Calendar, Filter, ArrowRight } from 'lucide-react';

const GSTReport = () => {
  const { sales, purchases, currentCompany } = useStore();
  const [filterText, setFilterText] = useState('');
  const [startDate, setStartDate] = useState('2026-04-01');
  const [endDate, setEndDate] = useState('2026-05-05');
  const [gstType, setGstType] = useState('All');

  const gstr1 = useMemo(() => {
    return sales
      .filter(s => {
        const matchesSearch = s.invoiceNo?.toLowerCase().includes(filterText.toLowerCase()) || 
                              s.customerId?.toLowerCase().includes(filterText.toLowerCase());
        const matchesGst = gstType === 'All' || 
                           (gstType === 'IGST' && parseFloat(s.totals.igst) > 0) ||
                           (gstType === 'CGST/SGST' && parseFloat(s.totals.cgst) > 0);
        return matchesSearch && matchesGst;
      })
      .map(s => ({
        date: s.date,
        invoice: s.invoiceNo,
        party: s.customerId,
        taxable: parseFloat(s.totals.taxableValue) || 0,
        cgst: parseFloat(s.totals.cgst) || 0,
        sgst: parseFloat(s.totals.sgst) || 0,
        igst: parseFloat(s.totals.igst) || 0,
        total: parseFloat(s.totals.total) || 0
      }));
  }, [sales, filterText, gstType]);

  const gstr2 = useMemo(() => {
    return purchases.map(p => ({
      date: p.date,
      invoice: p.invoiceNo,
      party: p.supplierId,
      taxable: parseFloat(p.totals.taxableValue) || 0,
      cgst: parseFloat(p.totals.cgst) || 0,
      sgst: parseFloat(p.totals.sgst) || 0,
      igst: 0, // Simplified for now
      total: parseFloat(p.totals.total) || 0
    }));
  }, [purchases]);

  const summary = useMemo(() => {
    const outputTax = gstr1.reduce((acc, s) => acc + s.cgst + s.sgst + s.igst, 0);
    const inputTax = gstr2.reduce((acc, p) => acc + p.cgst + p.sgst + p.igst, 0);
    return {
      outputTax,
      inputTax,
      netPayable: outputTax - inputTax
    };
  }, [gstr1, gstr2]);

  const exportToJSON = () => {
    const data = { gstr1, gstr2, summary, company: currentCompany };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GST_Report_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  return (
    <div className="space-y-10 animate-fadeIn pb-10">
      
      {/* Summary Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         <div className="bg-white p-8 border-2 border-black shadow-xl">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em]">Output Tax Liability</p>
            <h3 className="text-3xl font-black text-black mt-4">₹{summary.outputTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            <div className="h-1 bg-black mt-6 w-12"></div>
            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-4">Regulatory Obligation</p>
         </div>
         <div className="bg-white p-8 border-2 border-black shadow-xl">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em]">Input Tax Credit (ITC)</p>
            <h3 className="text-3xl font-black text-black mt-4">₹{summary.inputTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            <div className="h-1 bg-black mt-6 w-12"></div>
            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-4">Available Fiscal Asset</p>
         </div>
         <div className="bg-black p-8 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
               <FileSpreadsheet size={80} strokeWidth={1} />
            </div>
            <div className="relative z-10">
               <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.4em]">Net Position</p>
               <h3 className="text-3xl font-black mt-4 tracking-tighter">₹{Math.abs(summary.netPayable).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-8 flex items-center gap-2">
                  {summary.netPayable > 0 ? 'Protocol: Immediate Settlement' : 'Protocol: Carry Forward Credit'}
                  <ArrowRight size={10} />
               </p>
            </div>
         </div>
      </div>

      {/* Rigid Inline Filter Architecture */}
      <div className="bg-slate-50 border-2 border-black p-6 flex flex-wrap items-center justify-between gap-8 shadow-xl">
         <div className="flex flex-wrap items-center gap-6 flex-1">
            <div className="flex items-center gap-4">
               <label className="text-[9px] font-black text-black uppercase tracking-widest">Window</label>
               <div className="flex items-center gap-2">
                  <ERPInput 
                     type="date" 
                     value={startDate}
                     onChange={e => setStartDate(e.target.value)}
                     className="h-12 border-2 border-black font-black uppercase text-[10px] bg-white w-40 text-center"
                  />
                  <ArrowRight size={14} className="text-slate-300" />
                  <ERPInput 
                     type="date" 
                     value={endDate}
                     onChange={e => setEndDate(e.target.value)}
                     className="h-12 border-2 border-black font-black uppercase text-[10px] bg-white w-40 text-center"
                  />
               </div>
            </div>

            <div className="h-8 w-[2px] bg-black opacity-10 hidden md:block" />

            <div className="relative flex-1 max-w-[320px]">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
               <input 
                  type="text"
                  placeholder="SEARCH REGISTRY REFERENCE..."
                  value={filterText}
                  onChange={e => setFilterText(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 border-2 border-black font-black text-[10px] uppercase tracking-widest bg-white focus:outline-none"
               />
            </div>

            <div className="relative">
               <ERPSelect 
                  className="h-12 border-2 border-black font-black uppercase text-[10px] bg-white w-64" 
                  value={gstType} 
                  onChange={e => setGstType(e.target.value)} 
                  options={[
                     { value: 'All', label: 'GLOBAL REGISTRY' },
                     { value: 'CGST/SGST', label: 'INTRA-STATE PROTOCOL' },
                     { value: 'IGST', label: 'INTER-STATE PROTOCOL' }
                  ]}
               />
            </div>
         </div>

         <button 
            type="button" 
            onClick={() => { setFilterText(''); setGstType('All'); }}
            className="h-12 px-8 bg-white border-2 border-black text-black font-black text-[10px] uppercase tracking-widest hover:bg-black hover:text-white transition-all"
         >
            Reset Matrix
         </button>
      </div>

      {/* High-Contrast Registry Section */}
      <div className="bg-white border-2 border-black shadow-2xl overflow-hidden flex flex-col">
         
         <div className="p-8 border-b-2 border-black flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-6">
               <div className="p-3 bg-black text-white">
                  <FileText size={20} />
               </div>
               <div>
                  <h2 className="text-[11px] font-black text-black uppercase tracking-[0.4em]">GSTR-1 Ledger Registry</h2>
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-1">Found {gstr1.length} Verified Entries</p>
               </div>
            </div>
            
            <div className="flex items-center gap-3">
               <button 
                  onClick={exportToJSON}
                  className="p-3 border-2 border-black text-black hover:bg-black hover:text-white transition-all"
                  title="XLS EXPORT"
               >
                  <FileSpreadsheet size={16} />
               </button>
               <button 
                  onClick={exportToJSON}
                  className="p-3 border-2 border-black text-black hover:bg-black hover:text-white transition-all"
                  title="PDF EXPORT"
               >
                  <FileDown size={16} />
               </button>
               <button 
                  onClick={() => window.print()}
                  className="p-3 bg-black text-white border-2 border-black hover:bg-slate-800 transition-all"
                  title="HARD COPY PRINT"
               >
                  <Printer size={16} />
               </button>
            </div>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-black text-white text-[9px] font-black uppercase tracking-[0.3em] h-14">
                     <th className="px-8 border-r border-white/10">Voucher Ref</th>
                     <th className="px-6 text-center border-r border-white/10 w-32">Audit Date</th>
                     <th className="px-8 text-right border-r border-white/10 w-44">Taxable Quantum</th>
                     <th className="px-6 text-right border-r border-white/10 w-32">CGST</th>
                     <th className="px-6 text-right border-r border-white/10 w-32">SGST</th>
                     <th className="px-6 text-right border-r border-white/10 w-32">IGST</th>
                     <th className="px-8 text-right w-48 bg-white text-black border-l-2 border-black">Net Protocol Sum</th>
                  </tr>
               </thead>
               <tbody className="divide-y-2 divide-slate-50">
                  {gstr1.map((s, i) => (
                     <tr key={i} className="h-16 hover:bg-slate-50 transition-all">
                        <td className="px-8 font-black text-black text-[10px] uppercase tracking-widest border-r-2 border-slate-50">{s.invoice}</td>
                        <td className="text-center text-[10px] font-black text-slate-400 border-r-2 border-slate-50 uppercase">{s.date}</td>
                        <td className="text-right px-8 font-black text-black text-[11px] border-r-2 border-slate-50 bg-slate-50/30">₹{s.taxable.toLocaleString()}</td>
                        <td className="text-right px-6 font-black text-slate-400 text-[10px] border-r-2 border-slate-50">₹{s.cgst.toLocaleString()}</td>
                        <td className="text-right px-6 font-black text-slate-400 text-[10px] border-r-2 border-slate-50">₹{s.sgst.toLocaleString()}</td>
                        <td className="text-right px-6 font-black text-black text-[11px] border-r-2 border-slate-50">₹{s.igst.toLocaleString()}</td>
                        <td className="text-right px-8 font-black text-black text-[12px] bg-slate-100/50 tracking-tighter">₹{s.total.toLocaleString()}</td>
                     </tr>
                  ))}
                  {gstr1.length === 0 && (
                     <tr>
                        <td colSpan="7" className="text-center py-32">
                           <Search size={48} className="mx-auto text-slate-100 mb-6" />
                           <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">Zero Entry Mismatch</p>
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

export default GSTReport;
