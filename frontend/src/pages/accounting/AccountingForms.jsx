import React, { useState, useEffect } from 'react';
import useStore from '../../store/useStore';
import { ERPInput, ERPSelect } from '../../components/forms/FormElements';
import Modal from '../../components/ui/Modal';
import { ArrowRight, Save, X, Banknote, FileText, Hash, Calendar, Layout } from 'lucide-react';

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
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-[95vw] h-[90vh] border-4 border-black shadow-[20px_20px_0px_0px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden">
         
         {/* Architectural Tab Navigation */}
         <div className="flex justify-between items-center border-b-4 border-black bg-white shrink-0">
            <div className="flex">
               <div className="bg-black text-white px-10 py-6 flex items-center gap-4">
                  <Banknote size={20} />
                  <span className="text-[11px] font-black uppercase tracking-[0.4em]">
                     {type} Protocol Entry
                  </span>
               </div>
               <div className="px-10 py-6 border-r-2 border-black flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  Ref: #00{type === 'Receipt' ? '3' : '4'}
               </div>
            </div>
            <div className="flex items-center gap-6 pr-8">
               <button 
                  type="button"
                  onClick={() => setType(type === 'Receipt' ? 'Payment' : 'Receipt')} 
                  className="text-[10px] bg-white border-2 border-black text-black px-8 py-3 font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all"
               >
                  Invert To {type === 'Receipt' ? 'Payment' : 'Receipt'}
               </button>
               <button onClick={onClose} className="p-2 border-2 border-black text-black hover:bg-black hover:text-white transition-all">
                  <X size={20} />
               </button>
            </div>
         </div>

         <div className="flex flex-1 overflow-hidden bg-white">
            
            {/* Left Column: Voucher Specs (Architectural Parameters) */}
            <div className="w-[38%] border-r-4 border-black p-10 overflow-y-auto space-y-8 bg-slate-50/50 custom-scrollbar">
               <div className="flex items-center gap-6">
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-black">Voucher Schema</span>
                  <div className="h-[2px] flex-1 bg-black" />
               </div>

               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Settlement Repository</label>
                  <ERPSelect className="w-full h-12 border-2 border-black font-black uppercase text-[10px]" options={parties.filter(p => p.group === 'Bank').map(p => ({value: p.id, label: p.name}))} />
               </div>

               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Register Index</label>
                     <ERPInput className="w-full h-12 bg-slate-100 border-2 border-black font-black text-center" readOnly value="1" />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocol Date</label>
                     <ERPInput type="date" className="w-full h-12 border-2 border-black font-black uppercase text-[10px]" defaultValue="2026-05-05" />
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cheque / UTR Ref</label>
                     <ERPInput className="w-full h-12 border-2 border-black font-black uppercase text-[10px]" placeholder="REF_ID" value={header.chqNo} onChange={e => setHeader({ ...header, chqNo: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Clearance Date</label>
                     <ERPInput type="date" className="w-full h-12 border-2 border-black font-black uppercase text-[10px]" defaultValue="2026-05-05" />
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Slip Reference</label>
                     <ERPInput className="w-full h-12 border-2 border-black font-black uppercase text-[10px]" placeholder="SLIP_ID" value={header.slipNo} onChange={e => setHeader({...header, slipNo: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantum Amount (₹)</label>
                     <ERPInput className="w-full h-12 border-2 border-black font-black text-xl text-center bg-black text-white" placeholder="0.00" value={header.amount} onChange={e => setHeader({...header, amount: e.target.value})} />
                  </div>
               </div>

               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Account Type (Dr / Cr)</label>
                  <div className="flex border-2 border-black p-1 bg-white">
                     {['Dr', 'Cr'].map(mode => (
                        <button
                           key={mode}
                           type="button"
                           onClick={() => setDcType(mode)}
                           className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                              dcType === mode 
                                 ? 'bg-black text-white' 
                                 : 'text-slate-300 hover:text-black'
                           }`}
                        >
                           {mode === 'Dr' ? 'Debit (Dr)' : 'Credit (Cr)'}
                        </button>
                     ))}
                  </div>
               </div>

               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Audit Narrative</label>
                  <textarea 
                     rows={3}
                     className="w-full p-4 border-2 border-black font-black text-[10px] uppercase tracking-widest focus:outline-none bg-white resize-none"
                     placeholder="ENTER TRANSACTION NARRATIVE..."
                     value={header.remark}
                     onChange={e => setHeader({ ...header, remark: e.target.value })}
                  />
               </div>
            </div>

            {/* Right Column: Ledger Grid Table (Atomic Adjustments) */}
            <div className="w-[62%] flex flex-col overflow-hidden bg-white">
               
               <div className="p-8 border-b-2 border-black flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-4">
                     <FileText size={20} />
                     <h3 className="text-[11px] font-black uppercase tracking-[0.4em]">Ledger Balance Adjustments</h3>
                  </div>
                  <div className="px-6 py-2 bg-slate-50 border-2 border-black text-[10px] font-black text-black uppercase tracking-widest">
                     Cur. Bal: ₹ {header.curBal}
                  </div>
               </div>

               {/* High Density High Contrast Grid */}
               <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                     <thead className="bg-black text-white sticky top-0 z-10">
                        <tr className="h-14">
                           <th className="px-6 font-black uppercase tracking-[0.2em] text-[9px] w-16 text-center border-r border-white/10">IDX</th>
                           <th className="px-8 font-black uppercase tracking-[0.2em] text-[9px] border-r border-white/10">Bill Registry Ref</th>
                           <th className="px-6 text-center font-black uppercase tracking-[0.2em] text-[9px] w-32 border-r border-white/10">Audit Date</th>
                           <th className="px-8 text-right font-black uppercase tracking-[0.2em] text-[9px] w-40 border-r border-white/10">Quantum</th>
                           <th className="px-8 text-right font-black uppercase tracking-[0.2em] text-[9px] w-40">Applied</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y-2 divide-slate-50">
                        {[...Array(12)].map((_, idx) => (
                           <tr key={idx} className="h-16 hover:bg-slate-50 transition-all group">
                              <td className="text-center text-[10px] font-black text-slate-300 border-r-2 border-slate-50">{(idx + 1).toString().padStart(2, '0')}</td>
                              <td className="px-8 font-black text-black uppercase tracking-widest text-[10px]">INV_SCHEMA_2026_00{idx + 10}</td>
                              <td className="text-center text-[10px] font-black text-slate-400 uppercase">05 / 05 / 26</td>
                              <td className="px-8 text-right text-[11px] font-black text-black bg-slate-50/50">₹ {((idx + 1) * 14500).toFixed(2)}</td>
                              <td className="px-8">
                                 <input 
                                    type="number" 
                                    className="w-full h-10 text-right border-2 border-black bg-transparent group-hover:bg-white focus:bg-white transition-all px-4 text-[11px] font-black outline-none" 
                                    placeholder="0.00" 
                                 />
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>

               {/* Grid totals card */}
               <div className="p-10 bg-white border-t-4 border-black grid grid-cols-3 gap-10 shrink-0">
                  <div className="border-2 border-black p-6">
                     <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest block mb-2">Aggregate Quantum</span>
                     <span className="text-xl font-black text-black">₹ {header.amount}</span>
                  </div>
                  <div className="border-2 border-black p-6">
                     <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest block mb-2">Pending Adjustment</span>
                     <span className="text-xl font-black text-black">₹ 0.00</span>
                  </div>
                  <div className="bg-black p-6 shadow-2xl">
                     <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest block mb-2">Applied Quantum</span>
                     <span className="text-xl font-black text-white">₹ 0.00</span>
                  </div>
               </div>

            </div>
         </div>

         {/* Architectural Footer */}
         <div className="p-10 border-t-4 border-black bg-white flex justify-end gap-6 shrink-0">
            <button 
               type="button" 
               onClick={onClose}
               className="px-14 py-4 bg-white border-2 border-black text-black text-[10px] font-black uppercase tracking-[0.3em] hover:bg-slate-50 transition-all"
            >
               Abort Protocol
            </button>
            <button 
               type="button"
               onClick={onClose}
               className="px-14 py-4 bg-black text-white text-[10px] font-black uppercase tracking-[0.3em] hover:bg-slate-800 transition-all flex items-center gap-3 shadow-[10px_10px_0px_0px_rgba(0,0,0,0.1)]"
            >
               <Save size={16} /> Commit Voucher
            </button>
         </div>

      </div>
    </div>
  );
};

  );
};
