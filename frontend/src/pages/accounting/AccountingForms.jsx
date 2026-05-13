import React, { useState, useEffect } from 'react';
import useStore from '../../store/useStore';
import { ERPInput, ERPSelect } from '../../components/forms/FormElements';
import Modal from '../../components/ui/Modal';

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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${type} Entry`} className="max-w-[95vw] h-[90vh] p-0 overflow-hidden">
      
      {/* Dynamic Tab Navigation & Toggle */}
      <div className="flex justify-between items-center border-b border-[#E2E8F0] px-4 py-1.5 bg-slate-50 shrink-0">
         <div className="flex gap-1">
            <span className="px-3 py-1 bg-[#1B3A6B]/10 text-[#1B3A6B] text-xs font-bold rounded-lg">
               {type} Voucher Entry
            </span>
         </div>
         <div className="flex gap-3 items-center">
            <button 
               type="button"
               onClick={() => setType(type === 'Receipt' ? 'Payment' : 'Receipt')} 
               className="text-xs bg-white border border-[#1B3A6B] text-[#1B3A6B] px-4 py-1.5 font-semibold rounded-lg hover:bg-slate-50 transition-all"
            >
               Switch to {type === 'Receipt' ? 'Payment' : 'Receipt'}
            </button>
            <span className="text-xs font-bold text-slate-400">Ref: #{type === 'Receipt' ? '3' : '4'}</span>
         </div>
      </div>

      <div className="flex flex-col h-full overflow-hidden bg-white">
         
         {/* Main 2-Column Split Workspace */}
         <div className="flex-1 flex overflow-hidden">
            
            {/* Left Column: Voucher Specs (40% width) */}
            <div className="w-[38%] border-r border-[#E2E8F0] p-5 overflow-y-auto space-y-4 no-scrollbar bg-slate-50/50">
               <div className="flex items-center gap-3">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-[#64748B] whitespace-nowrap">Voucher Parameters</span>
                  <div className="h-[1px] flex-1 bg-[#E2E8F0]" />
               </div>

               <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-bold text-slate-700">Bank / Cash Account</label>
                  <ERPSelect className="w-full h-[38px] text-sm font-semibold" options={parties.filter(p => p.group === 'Bank').map(p => ({value: p.id, label: p.name}))} />
               </div>

               <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                     <label className="text-[12px] font-bold text-slate-700">Voucher No</label>
                     <ERPInput className="w-full h-[38px] text-sm font-bold text-slate-500 bg-slate-100 border-none" readOnly value="1" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                     <label className="text-[12px] font-bold text-slate-700">Voucher Date</label>
                     <input 
                        type="date" 
                        className="w-full h-[38px] px-3 border border-[#CBD5E1] rounded-md focus:outline-none focus:ring-2 focus:ring-[#0D7377] text-slate-800 text-xs bg-white" 
                        defaultValue="2026-05-05"
                     />
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                     <label className="text-[12px] font-bold text-slate-700">Cheque / UTR No</label>
                     <ERPInput className="w-full h-[38px] text-sm" placeholder="Enter Reference" value={header.chqNo} onChange={e => setHeader({ ...header, chqNo: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                     <label className="text-[12px] font-bold text-slate-700">Cheque Date</label>
                     <input 
                        type="date" 
                        className="w-full h-[38px] px-3 border border-[#CBD5E1] rounded-md focus:outline-none focus:ring-2 focus:ring-[#0D7377] text-slate-800 text-xs bg-white" 
                        defaultValue="2026-05-05"
                     />
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                     <label className="text-[12px] font-bold text-slate-700">Slip No</label>
                     <ERPInput className="w-full h-[38px] text-sm" placeholder="Slip Ref" value={header.slipNo} onChange={e => setHeader({...header, slipNo: e.target.value})} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                     <label className="text-[12px] font-bold text-slate-700">Amount (₹)</label>
                     <ERPInput className="w-full h-[38px] text-sm font-bold text-emerald-700 bg-emerald-50/50" placeholder="0.00" value={header.amount} onChange={e => setHeader({...header, amount: e.target.value})} />
                  </div>
               </div>

               {/* Debit / Credit Selection Toggle */}
               <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-bold text-slate-700">Voucher Account Type (Dr / Cr)</label>
                  <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 w-full">
                     {['Dr', 'Cr'].map(mode => (
                        <button
                           key={mode}
                           type="button"
                           onClick={() => setDcType(mode)}
                           className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                              dcType === mode 
                                 ? 'bg-[#1B3A6B] text-white shadow-sm' 
                                 : 'text-slate-500 hover:text-slate-800'
                           }`}
                        >
                           {mode === 'Dr' ? 'Debit (Dr)' : 'Credit (Cr)'}
                        </button>
                     ))}
                  </div>
               </div>

               {/* Narration 3-Row Textarea */}
               <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-bold text-slate-700">Narration / Remark</label>
                  <textarea 
                     rows={3}
                     className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D7377] resize-none"
                     placeholder="Enter transaction narration..."
                     value={header.remark}
                     onChange={e => setHeader({ ...header, remark: e.target.value })}
                  />
               </div>
            </div>

            {/* Right Column: Ledger Grid Table (62% width) */}
            <div className="w-[62%] flex flex-col overflow-hidden bg-white">
               
               <div className="p-4 border-b border-[#E2E8F0] bg-slate-50 flex items-center justify-between shrink-0">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Ledger Bill Adjustments</span>
                  <div className="flex gap-2">
                     <span className="px-2.5 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-bold rounded-full">
                        Cur. Bal: ₹ {header.curBal}
                     </span>
                  </div>
               </div>

               {/* High Density Grid */}
               <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-xs border-collapse">
                     <thead className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E2E8F0] sticky top-0">
                        <tr className="h-10">
                           <th className="px-2 font-semibold text-center uppercase tracking-[0.05em] text-[11px] w-12">#</th>
                           <th className="px-3 text-left font-semibold uppercase tracking-[0.05em] text-[11px]">Bill Reference</th>
                           <th className="px-2 text-center font-semibold uppercase tracking-[0.05em] text-[11px] w-24">Date</th>
                           <th className="px-2 text-right font-semibold uppercase tracking-[0.05em] text-[11px] w-28">Net Amt</th>
                           <th className="px-2 text-right font-semibold uppercase tracking-[0.05em] text-[11px] w-28">Paid Amt</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-[#F1F5F9]">
                        {[...Array(6)].map((_, idx) => (
                           <tr key={idx} className={`h-[44px] hover:bg-[#F8FAFC] transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'}`}>
                              <td className="text-center text-slate-400 font-bold">{idx + 1}</td>
                              <td className="px-3 font-semibold text-slate-700">INV-2026-00{idx + 10}</td>
                              <td className="text-center text-slate-500">05/05/2026</td>
                              <td className="text-right text-slate-600 bg-slate-50 pr-2">₹ {((idx + 1) * 14500).toFixed(2)}</td>
                              <td className="px-2">
                                 <input 
                                    type="number" 
                                    className="w-full h-[32px] text-right border border-slate-200 bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#0D7377] transition-all rounded px-2 text-xs outline-none" 
                                    placeholder="0.00" 
                                 />
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>

               {/* Grid totals card */}
               <div className="p-4 bg-slate-50 border-t border-[#E2E8F0] grid grid-cols-3 gap-4 shrink-0 shadow-sm text-center">
                  <div className="bg-white border border-[#E2E8F0] rounded-xl p-3">
                     <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Gross Amount</span>
                     <span className="text-sm font-bold text-[#1B3A6B]">₹ {header.amount}</span>
                  </div>
                  <div className="bg-white border border-[#E2E8F0] rounded-xl p-3">
                     <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Adjust Pending</span>
                     <span className="text-sm font-bold text-rose-600">₹ 0.00</span>
                  </div>
                  <div className="bg-white border border-[#E2E8F0] rounded-xl p-3">
                     <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Special Discount</span>
                     <span className="text-sm font-bold text-emerald-600">₹ 0.00</span>
                  </div>
               </div>

            </div>
         </div>

         {/* Footer Actions */}
         <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex justify-end gap-3 shrink-0 rounded-b-xl">
            <button 
               type="button" 
               onClick={onClose}
               className="h-[38px] px-6 bg-white border border-[#1B3A6B] text-[#1B3A6B] font-medium rounded-lg hover:bg-slate-50 transition-all text-sm"
            >
               Close
            </button>
            <button 
               type="button"
               onClick={onClose}
               className="h-[38px] px-6 bg-[#1B3A6B] hover:bg-[#142d56] text-white font-medium rounded-lg transition-all text-sm shadow-sm"
            >
               Save Voucher
            </button>
         </div>

      </div>
    </Modal>
  );
};
