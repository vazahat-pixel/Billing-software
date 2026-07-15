import React, { useState, useEffect } from 'react';
import useStore from '../../store/useStore';
import { ERPInput, ERPSelect } from '../../components/forms/FormElements';
import { Layout, FileText, ArrowRight, Printer, X, Monitor, ChevronLeft } from 'lucide-react';
import { toast } from '../../store/useToastStore';
import useConfigStore from '../../store/useConfigStore';

const SalesOutstanding = ({ isOpen, onClose }) => {
  const { parties, fetchOutstanding } = useStore();
  const companyName = useConfigStore(
    (s) => s.companySettings?.legalName || s.company?.name || 'Company'
  );
  const [showPreview, setShowPreview] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    fromDate: '2026-04-01',
    toDate: '2026-06-06',
    company: '',
    book: '--Select Sale Type--',
    selectParty: '',
    group: '',
    city: '',
    state: '',
    broker: '',
    transport: '',
    haste: '',
    area: '',
    fromBill: '0',
    toBill: '0',
    fromPayDate: '2026-04-01',
    toPayDate: '2026-06-06',
    dueDaysMin: '0',
    dueDaysMax: '0',
    dis: '0.00',
    unit: '--Select Unit--',
    subBook: 'All',
    salesMan: '',
    orderNo: ''
  });

  useEffect(() => {
    if (companyName) {
      setFormData((prev) => ({ ...prev, company: companyName }));
    }
  }, [companyName]);

  const checkboxes = [
    { label: 'Show Adjustment Entry', checked: true },
    { label: 'Show Previous Year Entry', checked: true },
    { label: 'Show Party Address in Print', checked: false },
    { label: 'Show City Only', checked: false },
    { label: 'Show Party Mobile in Print', checked: true },
    { label: 'Show Broker Address in Print', checked: false },
    { label: 'Show Broker Mobile in Print', checked: false },
    { label: 'Show Print Date', checked: true },
    { label: 'NewPage After Group', checked: false },
    { label: 'AsOn Pending', checked: false },
    { label: 'Show Zero Amt', checked: false },
    { label: 'Show LedgerBal', checked: false },
    { label: 'DueDays On Payment', checked: false }
  ];

  const handleGeneratePreview = async () => {
    setLoading(true);
    try {
      const data = await fetchOutstanding('receivable');
      setReportData(data || []);
      setShowPreview(true);
    } catch (err) {
      toast.error(err.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const grandTotals = React.useMemo(() => {
    return reportData.reduce(
      (acc, curr) => {
        acc.total += curr.totalOutstanding || 0;
        acc.b30 += curr.aging?.bucket30 || 0;
        acc.b60 += curr.aging?.bucket60 || 0;
        acc.b90 += curr.aging?.bucket90 || 0;
        acc.b90Plus += curr.aging?.bucket90Plus || 0;
        return acc;
      },
      { total: 0, b30: 0, b60: 0, b90: 0, b90Plus: 0 }
    );
  }, [reportData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-5xl border-4 border-black shadow-[20px_20px_0px_0px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col max-h-[90vh]">
         
         {/* Architectural Header */}
         <div className="bg-black text-white px-8 py-6 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-6">
               <div className="p-3 bg-white text-black">
                  <Layout size={24} />
               </div>
               <div>
                  <h2 className="text-xl font-black uppercase tracking-[0.3em]">
                    {showPreview ? 'Audit Preview: Outstanding Receivables' : 'Sales Outstanding'}
                  </h2>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mt-1">
                    {showPreview ? 'Live Ledger Balances & Aging Buckets' : 'Audit Registry & Fiscal Aging Analytics'}
                  </p>
               </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 transition-all border-2 border-white/20">
               <X size={20} />
            </button>
         </div>

         {/* Monochromatic Grid Content */}
         <div className="flex-1 overflow-y-auto p-10 bg-white min-h-[400px]">
            {loading ? (
              <div className="py-24 text-center text-[11px] text-slate-400 font-black uppercase tracking-[0.3em] animate-pulse">
                 Recalculating Outstanding Ledgers...
              </div>
            ) : showPreview ? (
              // Live Preview Table
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                   <button 
                     onClick={() => setShowPreview(false)}
                     className="px-4 py-2 border-2 border-black text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 flex items-center gap-2"
                   >
                     <ChevronLeft size={14} /> Back to parameters
                   </button>
                   <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                     As On: {new Date().toLocaleDateString()}
                   </span>
                </div>

                <div className="border-2 border-black overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-black text-white text-[9px] font-black uppercase tracking-widest border-b border-black">
                        <th className="px-4 py-3">Counterparty</th>
                        <th className="px-4 py-3 text-right">0-30 Days</th>
                        <th className="px-4 py-3 text-right">31-60 Days</th>
                        <th className="px-4 py-3 text-right">61-90 Days</th>
                        <th className="px-4 py-3 text-right">90+ Days</th>
                        <th className="px-4 py-3 text-right">Total Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {reportData.map((row) => (
                        <tr key={row.partyId} className="hover:bg-slate-50 text-[10px] font-bold text-black group">
                          <td className="px-4 py-3">
                            <p className="font-black uppercase tracking-wider">{row.partyName}</p>
                            {row.phone && <p className="text-[8px] text-slate-400 font-medium tracking-widest mt-0.5">{row.phone}</p>}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">₹ {(row.aging?.bucket30 || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td className="px-4 py-3 text-right font-mono">₹ {(row.aging?.bucket60 || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td className="px-4 py-3 text-right font-mono">₹ {(row.aging?.bucket90 || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td className="px-4 py-3 text-right font-mono text-red-600">₹ {(row.aging?.bucket90Plus || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td className="px-4 py-3 text-right font-black font-mono">₹ {(row.totalOutstanding || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        </tr>
                      ))}
                      {reportData.length === 0 && (
                        <tr>
                          <td colSpan="6" className="px-4 py-12 text-center text-slate-400 uppercase tracking-widest text-[10px]">
                            No Outstanding Receivables Found
                          </td>
                        </tr>
                      )}
                      {/* Grand Totals */}
                      {reportData.length > 0 && (
                        <tr className="bg-slate-150 border-t-2 border-black text-[10px] font-black text-black">
                          <td className="px-4 py-3 uppercase tracking-wider">Grand Total:</td>
                          <td className="px-4 py-3 text-right font-mono">₹ {grandTotals.b30.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td className="px-4 py-3 text-right font-mono">₹ {grandTotals.b60.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td className="px-4 py-3 text-right font-mono">₹ {grandTotals.b90.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td className="px-4 py-3 text-right font-mono text-red-600">₹ {grandTotals.b90Plus.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td className="px-4 py-3 text-right font-mono">₹ {grandTotals.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              // Parameter selection screen
              <div className="grid grid-cols-12 gap-12">
                {/* Left Column: Primary Schema Filters */}
                <div className="col-span-7 space-y-4">
                   <div className="flex items-center gap-4">
                      <label className="w-32 text-[10px] font-black text-black uppercase tracking-widest text-right">Date Range :</label>
                      <div className="flex-1 flex items-center gap-2">
                         <ERPInput className="flex-1 h-10 bg-slate-50 border-2 border-black font-black uppercase text-[10px] text-center" value={formData.fromDate} onChange={(e) => setFormData({...formData, fromDate: e.target.value})} />
                         <ArrowRight size={14} className="text-slate-300" />
                         <ERPInput className="flex-1 h-10 bg-slate-50 border-2 border-black font-black uppercase text-[10px] text-center" value={formData.toDate} onChange={(e) => setFormData({...formData, toDate: e.target.value})} />
                      </div>
                   </div>

                   <div className="flex items-center gap-4">
                      <label className="w-32 text-[10px] font-black text-black uppercase tracking-widest text-right">Legal Entity :</label>
                      <ERPSelect className="flex-1 h-10 border-2 border-black font-black uppercase text-[10px]" value={formData.company} options={[{value: formData.company || companyName, label: formData.company || companyName}]} />
                   </div>

                   <div className="flex items-center gap-4">
                      <label className="w-32 text-[10px] font-black text-black uppercase tracking-widest text-right">Audit Book :</label>
                      <ERPSelect className="flex-1 h-10 border-2 border-black font-black uppercase text-[10px]" value={formData.book} options={[]} />
                   </div>

                   <div className="flex items-center gap-4">
                      <label className="w-32 text-[10px] font-black text-black uppercase tracking-widest text-right">Counterparty :</label>
                      <ERPSelect className="flex-1 h-10 border-2 border-black font-black uppercase text-[10px]" value={formData.selectParty} onChange={(e) => setFormData({...formData, selectParty: e.target.value})} options={[{value: '', label: 'ALL CUSTOMERS'}, ...parties.map(p => ({value: p._id, label: p.name}))]} />
                   </div>

                   <div className="grid grid-cols-2 gap-4 ml-36 pt-4 border-t-2 border-slate-50">
                      {['Group', 'City', 'State', 'Broker', 'Transport', 'Haste'].map(f => (
                         <div key={f} className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{f} Parameter</label>
                            <ERPSelect className="w-full h-10 border-2 border-black font-black uppercase text-[10px]" options={[]} />
                         </div>
                      ))}
                   </div>

                   <div className="pt-6 border-t-2 border-black grid grid-cols-2 gap-8">
                      <div className="space-y-4">
                         <div className="flex items-center gap-4">
                            <label className="w-20 text-[9px] font-black text-black uppercase tracking-widest text-right">Bill Range</label>
                            <div className="flex-1 flex items-center gap-2">
                               <ERPInput className="w-full h-9 border-2 border-black text-center font-black text-[10px]" value="0" />
                               <ERPInput className="w-full h-9 border-2 border-black text-center font-black text-[10px]" value="0" />
                            </div>
                         </div>
                         <div className="flex items-center gap-4">
                            <label className="w-20 text-[9px] font-black text-black uppercase tracking-widest text-right">Due Aging</label>
                            <div className="flex-1 flex items-center gap-2">
                               <ERPInput className="w-full h-9 border-2 border-black text-center font-black text-[10px]" value="0" />
                               <ERPInput className="w-full h-9 border-2 border-black text-center font-black text-[10px]" value="0" />
                            </div>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Right Column: Protocols and Sub-Registry */}
                <div className="col-span-5 space-y-8">
                   <div className="bg-slate-50 p-8 border-2 border-black shadow-xl space-y-6">
                      <h4 className="text-[10px] font-black uppercase text-black tracking-[0.4em] border-b-2 border-black pb-4 flex items-center gap-3">
                         <FileText size={16} /> Sub-Registry Logic
                      </h4>
                      <div className="space-y-4">
                         <div className="flex items-center gap-4">
                            <label className="w-6 text-[10px] font-black text-slate-300">01</label>
                            <ERPSelect className="flex-1 h-10 text-[10px] border-2 border-black font-black uppercase" value="None" options={[]} />
                         </div>
                         <div className="flex items-center gap-4">
                            <label className="w-6 text-[10px] font-black text-slate-300">02</label>
                            <ERPSelect className="flex-1 h-10 text-[10px] border-2 border-black font-black uppercase" value="None" options={[]} />
                         </div>
                      </div>
                      <div className="pt-4 border-t-2 border-slate-200 flex items-center gap-4">
                         <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" className="w-4 h-4 border-2 border-black rounded-none appearance-none checked:bg-black transition-all" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Enable Summary</span>
                         </label>
                         <div className="flex-1"></div>
                         <ERPSelect className="w-32 h-10 text-[10px] border-2 border-black font-black uppercase" value="Pending" options={[]} />
                      </div>
                   </div>

                   <div className="space-y-2 max-h-[200px] overflow-y-auto pr-4 custom-scrollbar">
                      {checkboxes.map(cb => (
                         <label key={cb.label} className="flex items-center gap-4 p-3 hover:bg-slate-50 transition-all cursor-pointer border-b border-slate-50">
                            <input 
                               type="checkbox" 
                               className="w-4 h-4 border-2 border-black rounded-none appearance-none checked:bg-black transition-all" 
                               defaultChecked={cb.checked} 
                            />
                            <span className="text-[10px] font-black text-black uppercase tracking-widest">{cb.label}</span>
                         </label>
                      ))}
                   </div>
                </div>
              </div>
            )}
         </div>

         {/* Architectural Footer */}
         <div className="bg-black p-8 flex justify-end gap-4 border-t-4 border-black shrink-0">
            {!showPreview ? (
              <button 
                onClick={handleGeneratePreview}
                className="px-14 py-4 bg-white text-black text-[10px] font-black uppercase tracking-[0.3em] hover:bg-slate-200 transition-all flex items-center gap-3"
              >
                <Monitor size={16} /> Generate Preview
              </button>
            ) : (
              <button 
                onClick={() => setShowPreview(false)}
                className="px-14 py-4 bg-white text-black text-[10px] font-black uppercase tracking-[0.3em] hover:bg-slate-200 transition-all flex items-center gap-3"
              >
                Change Parameters
              </button>
            )}
            <button className="px-14 py-4 bg-transparent border-2 border-white/30 text-white text-[10px] font-black uppercase tracking-[0.3em] hover:border-white transition-all" onClick={onClose}>
               Abort Operation
            </button>
            <button className="px-14 py-4 bg-white text-black text-[10px] font-black uppercase tracking-[0.3em] hover:bg-slate-200 transition-all flex items-center gap-3" onClick={() => window.print()}>
               <Printer size={16} /> Hard Copy Audit
            </button>
         </div>

      </div>
    </div>
  );
};

export default SalesOutstanding;
