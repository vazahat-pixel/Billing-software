import React, { useState, useEffect } from 'react';
import useStore from '../../store/useStore';
import { ERPInput, ERPSelect } from '../../components/forms/FormElements';
import Modal from '../../components/ui/Modal';
import { ArrowRight, Save, X, Banknote, FileText, Hash, Calendar, Layout, Landmark, History } from 'lucide-react';

export const PaymentForm = ({ isOpen, onClose, initialType = 'Receipt', selectedBook = null }) => {
  const { parties } = useStore();
  const [type, setType] = useState(initialType);

  useEffect(() => {
    setType(initialType);
    if (isOpen && selectedBook) {
      setHeader(prev => ({ ...prev, book: selectedBook }));
    }
  }, [initialType, isOpen, selectedBook]);

  const [header, setHeader] = useState({
    bankCash: '',
    curBal: '0.00',
    chqNo: '',
    drawChq: '',
    remark: '',
    book: 'BANK BOOK',
    searchByBill: '',
    chqDate: '05/05/2026',
    slipNo: '',
    vno: '1',
    recdDate: '05/05/2026',
    partyName: '',
    amount: '0.00',
    reconDate: '//',
    onAccount: 'On Account'
  });

  const [dcType, setDcType] = useState('Dr');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6 backdrop-blur-md">
      <div className="bg-[#FDFCF9] w-full max-w-[95vw] h-[92vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-white/20">
         
         {/* Modern Header Section */}
         <div className="px-10 py-8 flex justify-between items-center bg-white border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-8">
               <div className="p-5 bg-black text-white rounded-2xl shadow-lg">
                  <Banknote size={24} />
               </div>
               <div>
                  <h2 className="text-3xl font-black text-black tracking-tight italic">{type} Protocol<span className="text-slate-200">.</span></h2>
                  <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                     <span>Entry Registry</span>
                     <div className="w-1 h-1 bg-slate-200 rounded-full" />
                     <span>Ref: #00{type === 'Receipt' ? '3' : '4'}</span>
                  </div>
               </div>
            </div>
            <div className="flex items-center gap-4">
               <button 
                  type="button"
                  onClick={() => setType(type === 'Receipt' ? 'Payment' : 'Receipt')} 
                  className="px-6 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-bold uppercase tracking-widest text-black hover:bg-slate-50 transition-all shadow-sm"
               >
                  Invert To {type === 'Receipt' ? 'Payment' : 'Receipt'}
               </button>
               <button onClick={onClose} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-black transition-all">
                  <X size={20} />
               </button>
            </div>
         </div>

         <div className="flex flex-1 overflow-hidden">
            
            {/* Left Column: Form Fields */}
            <div className="w-[35%] border-r border-slate-100 p-10 overflow-y-auto space-y-8 bg-white custom-scrollbar">
               <div className="space-y-6">
                  <div className="flex items-center gap-4">
                     <h3 className="text-[11px] font-bold text-black uppercase tracking-[0.3em] whitespace-nowrap">Transaction Schema</h3>
                     <div className="h-[1px] flex-1 bg-slate-50" />
                  </div>

                  <div className="space-y-2">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Settlement Repository</label>
                     <ERPSelect className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px] focus:ring-1 focus:ring-black" options={parties.filter(p => p.group === 'Bank').map(p => ({value: p.id, label: p.name}))} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Protocol Date</label>
                        <ERPInput type="date" className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px] focus:ring-1 focus:ring-black" defaultValue="2026-05-05" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quantum Amount (₹)</label>
                        <ERPInput className="w-full h-12 bg-black text-white border-none rounded-xl font-black text-lg text-center" placeholder="0.00" value={header.amount} onChange={e => setHeader({...header, amount: e.target.value})} />
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cheque / UTR Ref</label>
                        <ERPInput className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]" placeholder="REF_ID" value={header.chqNo} onChange={e => setHeader({ ...header, chqNo: e.target.value })} />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Clearance Date</label>
                        <ERPInput type="date" className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]" defaultValue="2026-05-05" />
                     </div>
                  </div>

                  <div className="space-y-2">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Account Strategy</label>
                     <div className="flex p-1 bg-slate-50 rounded-xl">
                        {['Dr', 'Cr'].map(mode => (
                           <button
                              key={mode}
                              type="button"
                              onClick={() => setDcType(mode)}
                              className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${
                                 dcType === mode 
                                    ? 'bg-white text-black shadow-sm' 
                                    : 'text-slate-400 hover:text-black'
                              }`}
                           >
                              {mode === 'Dr' ? 'Debit (Dr)' : 'Credit (Cr)'}
                           </button>
                        ))}
                     </div>
                  </div>

                  <div className="space-y-2">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Audit Narrative</label>
                     <textarea 
                        rows={3}
                        className="w-full p-4 bg-slate-50 border-none rounded-xl font-bold text-[10px] uppercase tracking-widest focus:outline-none focus:ring-1 focus:ring-black resize-none"
                        placeholder="ENTER TRANSACTION NARRATIVE..."
                        value={header.remark}
                        onChange={e => setHeader({ ...header, remark: e.target.value })}
                     />
                  </div>
               </div>
            </div>

            {/* Right Column: Adjustment Grid */}
            <div className="w-[65%] flex flex-col overflow-hidden bg-[#FDFCF9]">
               
               <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                  <div className="flex items-center gap-4">
                     <div className="p-3 bg-slate-50 rounded-xl text-slate-400">
                        <History size={18} />
                     </div>
                     <h3 className="text-[11px] font-bold text-black uppercase tracking-widest">Ledger Balance Adjustments</h3>
                  </div>
                  <div className="px-6 py-2 bg-slate-50 rounded-xl text-[10px] font-bold text-black uppercase tracking-widest">
                     Cur. Bal: ₹ {header.curBal}
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                     <table className="w-full text-left">
                        <thead>
                           <tr className="border-b border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              <th className="px-8 py-5">Reference</th>
                              <th className="px-8 py-5 text-center">Date</th>
                              <th className="px-8 py-5 text-right">Quantum</th>
                              <th className="px-8 py-5 text-right">Applied</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                           {[...Array(8)].map((_, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50 transition-all group">
                                 <td className="px-8 py-5 font-bold text-black uppercase tracking-widest text-[10px]">INV_2026_0{idx + 10}</td>
                                 <td className="px-8 py-5 text-center text-[10px] font-bold text-slate-400 uppercase">05/05/26</td>
                                 <td className="px-8 py-5 text-right text-[11px] font-bold text-black">₹ {((idx + 1) * 14500).toFixed(2)}</td>
                                 <td className="px-8 py-5 text-right">
                                    <input 
                                       type="number" 
                                       className="w-32 h-10 text-right bg-slate-50 border-none rounded-lg focus:bg-white focus:ring-1 focus:ring-black transition-all px-4 text-[11px] font-bold outline-none" 
                                       placeholder="0.00" 
                                    />
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>

               {/* Grid totals card */}
               <div className="px-10 py-8 bg-white border-t border-slate-100 grid grid-cols-3 gap-6 shrink-0">
                  <div className="bg-slate-50 p-6 rounded-2xl">
                     <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Aggregate Quantum</span>
                     <span className="text-xl font-black text-black tracking-tight">₹ {header.amount}</span>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-2xl">
                     <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Pending Balance</span>
                     <span className="text-xl font-black text-black tracking-tight">₹ 0.00</span>
                  </div>
                  <div className="bg-black p-6 rounded-2xl shadow-xl">
                     <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Applied Total</span>
                     <span className="text-xl font-black text-white tracking-tight">₹ 0.00</span>
                  </div>
               </div>
            </div>
         </div>

         {/* Compact Footer */}
         <div className="px-10 py-8 bg-white border-t border-slate-100 flex justify-end gap-4 shrink-0">
            <button 
               type="button" 
               onClick={onClose}
               className="px-10 py-4 bg-white border border-slate-200 rounded-xl text-black text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
            >
               Abort Entry
            </button>
            <button 
               type="button"
               onClick={onClose}
               className="px-12 py-4 bg-black text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-3 shadow-lg"
            >
               <Save size={16} /> Commit Voucher
            </button>
         </div>

      </div>
    </div>
  );
};
