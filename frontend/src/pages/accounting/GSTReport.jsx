import React, { useMemo, useState } from 'react';
import useStore from '../../store/useStore';
import { ERPButton, ERPInput, ERPSelect } from '../../components/forms/FormElements';
import { FileSpreadsheet, FileDown, Printer, Search, Calendar, Filter } from 'lucide-react';

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
    <div className="space-y-6 animate-fadeIn pb-10">
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
         <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Output Tax (Sales)</p>
            <h3 className="text-2xl font-black text-rose-600 mt-1">₹{summary.outputTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            <p className="text-[10px] text-slate-500 mt-2">Liability to government</p>
         </div>
         <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Input Tax (Purchase)</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">₹{summary.inputTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            <p className="text-[10px] text-slate-500 mt-2">Available Credit (ITC)</p>
         </div>
         <div className={`p-5 rounded-2xl border shadow-sm ${summary.netPayable > 0 ? 'bg-[#1B3A6B] text-white border-[#1B3A6B]' : 'bg-[#0D7377] text-white border-[#0D7377]'}`}>
            <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Net GST Payable</p>
            <h3 className="text-2xl font-black mt-1">₹{Math.abs(summary.netPayable).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            <p className="text-[10px] opacity-80 mt-2">{summary.netPayable > 0 ? 'To be paid to portal' : 'Refund / Carry Forward'}</p>
         </div>
      </div>

      {/* Single Grey Inline Filter Bar */}
      <div className="bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl p-3 flex flex-wrap items-center justify-between gap-4 shadow-sm">
         <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative">
               <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
               <input 
                  type="date" 
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="h-[38px] pl-9 pr-3 border border-[#CBD5E1] rounded-lg text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#0D7377]"
               />
            </div>
            <span className="text-slate-400 text-xs font-bold">to</span>
            <div className="relative">
               <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
               <input 
                  type="date" 
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="h-[38px] pl-9 pr-3 border border-[#CBD5E1] rounded-lg text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#0D7377]"
               />
            </div>

            <div className="h-6 w-[1px] bg-slate-300 hidden md:block" />

            <div className="relative flex-1 max-w-[240px]">
               <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
               <input 
                  type="text"
                  placeholder="Search Invoice or Party..."
                  value={filterText}
                  onChange={e => setFilterText(e.target.value)}
                  className="w-full h-[38px] pl-9 pr-3 border border-[#CBD5E1] rounded-lg text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#0D7377]"
               />
            </div>

            <div className="relative">
               <ERPSelect 
                  className="h-[38px] text-xs font-semibold bg-white" 
                  value={gstType} 
                  onChange={e => setGstType(e.target.value)} 
                  options={[
                     { value: 'All', label: 'All GST Types' },
                     { value: 'CGST/SGST', label: 'Intra-State (CGST/SGST)' },
                     { value: 'IGST', label: 'Inter-State (IGST)' }
                  ]}
               />
            </div>
         </div>

         <div className="flex gap-2">
            <button 
               type="button" 
               onClick={() => { setFilterText(''); setGstType('All'); }}
               className="h-[38px] px-4 text-slate-500 bg-white border border-[#CBD5E1] hover:bg-slate-50 font-semibold rounded-lg text-xs transition-all"
            >
               Reset
            </button>
         </div>
      </div>

      {/* Report Section */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
         
         {/* Section Header with Export triggers next to titles */}
         <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-3">
               <h2 className="text-sm font-black text-[#1B3A6B] uppercase tracking-wider">GSTR-1 (Sales Tax Details)</h2>
               <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-[#1B3A6B] text-[10px] font-black rounded-md">
                  {gstr1.length} Records found
               </span>
            </div>
            
            {/* PDF / Excel / Print Export trigger buttons next to headers */}
            <div className="flex items-center gap-1.5">
               <button 
                  type="button" 
                  onClick={exportToJSON}
                  title="Export to Excel Spreadsheet"
                  className="p-2 bg-slate-50 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg border border-slate-200 transition-all shadow-sm"
               >
                  <FileSpreadsheet className="h-4 w-4" />
               </button>
               <button 
                  type="button" 
                  onClick={exportToJSON}
                  title="Export to PDF Report"
                  className="p-2 bg-slate-50 text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-slate-200 transition-all shadow-sm"
               >
                  <FileDown className="h-4 w-4" />
               </button>
               <button 
                  type="button" 
                  onClick={() => window.print()}
                  title="Print Report"
                  className="p-2 bg-slate-50 text-slate-600 hover:text-[#1B3A6B] hover:bg-indigo-50 rounded-lg border border-slate-200 transition-all shadow-sm"
               >
                  <Printer className="h-4 w-4" />
               </button>
            </div>
         </div>

         {/* High Density Table */}
         <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
               <thead className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E2E8F0] sticky top-0">
                  <tr className="h-10">
                     <th className="px-4 font-semibold text-left uppercase tracking-[0.05em] text-[11px] w-32">Invoice</th>
                     <th className="px-3 font-semibold text-center uppercase tracking-[0.05em] text-[11px] w-24">Date</th>
                     <th className="px-4 font-semibold text-right uppercase tracking-[0.05em] text-[11px] w-36">Taxable Value</th>
                     <th className="px-3 font-semibold text-right uppercase tracking-[0.05em] text-[11px] w-28">CGST</th>
                     <th className="px-3 font-semibold text-right uppercase tracking-[0.05em] text-[11px] w-28">SGST</th>
                     <th className="px-3 font-semibold text-right uppercase tracking-[0.05em] text-[11px] w-28">IGST</th>
                     <th className="px-4 font-semibold text-right uppercase tracking-[0.05em] text-[11px] w-36">Total Bill</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-[#F1F5F9]">
                  {gstr1.map((s, i) => (
                     <tr key={i} className={`h-[44px] hover:bg-[#F8FAFC] transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'}`}>
                        <td className="px-4 font-bold text-slate-800">{s.invoice}</td>
                        <td className="text-center text-slate-500">{s.date}</td>
                        <td className="text-right font-semibold text-slate-700 pr-4">₹{s.taxable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right text-slate-500 pr-3">₹{s.cgst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right text-slate-500 pr-3">₹{s.sgst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right text-[#0D7377] font-bold pr-3">₹{s.igst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right font-black text-[#1B3A6B] pr-4 bg-slate-50/50">₹{s.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                     </tr>
                  ))}
                  {gstr1.length === 0 && (
                     <tr>
                        <td colSpan="7" className="text-center py-12 text-slate-400 font-medium">
                           No matching records found for the chosen filters.
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
