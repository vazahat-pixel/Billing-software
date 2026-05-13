import React, { useState, useMemo } from 'react';
import useStore from '../../store/useStore';
import { FormField, ERPInput, ERPSelect, ERPButton } from '../../components/forms/FormElements';
import Modal from '../../components/ui/Modal';
import { Wallet, Search, Filter, ArrowUpRight, ArrowDownLeft, FileText, Banknote, ArrowRight, User, X } from 'lucide-react';

const AccountingPage = () => {
  const { ledgerEntries, parties, addPayment } = useStore();
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentType, setPaymentType] = useState('payment'); // payment or receipt

  const filteredLedger = useMemo(() => {
    if (!selectedPartyId) return [];
    return ledgerEntries.filter(e => e.partyId === selectedPartyId);
  }, [ledgerEntries, selectedPartyId]);

  const stats = useMemo(() => {
    const dr = filteredLedger.reduce((acc, e) => acc + (e.debit || 0), 0);
    const cr = filteredLedger.reduce((acc, e) => acc + (e.credit || 0), 0);
    const bal = dr - cr;
    return { dr, cr, bal };
  }, [filteredLedger]);

  return (
    <div className="space-y-6 animate-fadeIn pb-20">
      {/* Architectural Header */}
      <div className="bg-white p-10 border-2 border-black flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl">
        <div className="flex items-center gap-6">
           <div className="p-4 bg-black text-white">
              <Banknote size={28} />
           </div>
           <div>
              <h1 className="text-3xl font-black text-black uppercase tracking-tighter">Fiscal Registry</h1>
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">
                 <span>Accounting</span>
                 <ArrowRight size={10} />
                 <span className="text-black">Ledger & Settlement Intelligence</span>
              </div>
           </div>
        </div>
        <div className="flex gap-4">
           <button 
              className="px-10 py-3 bg-white text-black text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all border-2 border-black flex items-center gap-3"
              onClick={() => { setPaymentType('payment'); setShowPaymentModal(true); }}
           >
              <ArrowUpRight size={14} /> Record Payment
           </button>
           <button 
              className="px-10 py-3 bg-black text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all border-2 border-black flex items-center gap-3"
              onClick={() => { setPaymentType('receipt'); setShowPaymentModal(true); }}
           >
              <ArrowDownLeft size={14} /> Record Receipt
           </button>
        </div>
      </div>

      {/* Filter & Analytics Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
         <div className="space-y-10">
            <div className="bg-white p-8 border-2 border-black shadow-xl">
               <h4 className="text-[10px] font-black text-black uppercase mb-6 tracking-[0.4em] border-b-2 border-black pb-4">Account Protocol</h4>
               <ERPSelect 
                   value={selectedPartyId} 
                   onChange={(e) => setSelectedPartyId(e.target.value)}
                   options={parties.map(p => ({ value: p.id, label: p.name }))}
                   className="h-12 border-2 border-black font-black uppercase text-[10px]"
               />
               
               {selectedPartyId && (
                 <div className="mt-10 space-y-4">
                    <div className="p-6 bg-slate-50 border-2 border-black">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">Aggregate Debit</p>
                       <p className="text-2xl font-black text-black mt-2">₹ {stats.dr.toLocaleString()}</p>
                    </div>
                    <div className="p-6 bg-slate-50 border-2 border-black">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">Aggregate Credit</p>
                       <p className="text-2xl font-black text-black mt-2">₹ {stats.cr.toLocaleString()}</p>
                    </div>
                    <div className="p-6 bg-black text-white shadow-2xl">
                       <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Net Closing Position</p>
                       <p className="text-3xl font-black text-white mt-2 tracking-tighter">₹ {Math.abs(stats.bal).toLocaleString()} <span className="text-xs opacity-50">{stats.bal >= 0 ? 'DR' : 'CR'}</span></p>
                    </div>
                 </div>
               )}
            </div>
         </div>

         {/* Main Ledger Statement */}
         <div className="lg:col-span-3 bg-white border-2 border-black overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b-2 border-black bg-white flex items-center justify-between">
               <div className="flex items-center gap-4 text-black">
                  <FileText size={20} />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em]">Counterparty Audit Statement</h3>
               </div>
               <div className="flex gap-2">
                  <button className="px-6 py-2 bg-white border-2 border-black text-[9px] font-black text-black hover:bg-black hover:text-white transition-all uppercase tracking-widest">Generate PDF</button>
                  <button className="px-6 py-2 bg-black text-white border-2 border-black text-[9px] font-black hover:bg-slate-800 transition-all uppercase tracking-widest">Export Dataset</button>
               </div>
            </div>
            
            <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                  <thead>
                     <tr className="bg-black text-[9px] font-black text-white uppercase tracking-[0.3em] sticky top-0 z-10">
                        <th className="px-8 py-5">Audit Timestamp</th>
                        <th className="px-8 py-5">Particular Intelligence</th>
                        <th className="px-8 py-5 text-right">Debit (DR)</th>
                        <th className="px-8 py-5 text-right">Credit (CR)</th>
                        <th className="px-8 py-5 text-right">Net Position</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-slate-50">
                     {filteredLedger.map((entry) => (
                       <tr key={entry.id} className="hover:bg-slate-50 transition-all">
                          <td className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{entry.date}</td>
                          <td className="px-8 py-5">
                             <p className="text-[11px] font-black text-black uppercase tracking-widest">{entry.particular}</p>
                             <p className="text-[9px] text-slate-300 font-black uppercase mt-1 tracking-widest">REF_ID: {entry.id.substring(0, 8)}</p>
                          </td>
                          <td className="px-8 py-5 text-right text-[11px] font-black text-black">
                             {entry.debit > 0 ? `₹ ${entry.debit.toLocaleString()}` : '-'}
                          </td>
                          <td className="px-8 py-5 text-right text-[11px] font-black text-black">
                             {entry.credit > 0 ? `₹ ${entry.credit.toLocaleString()}` : '-'}
                          </td>
                          <td className="px-8 py-5 text-right text-[12px] font-black text-black tracking-tighter">
                             ₹ {Math.abs(entry.balance).toLocaleString()} <span className="text-[9px] opacity-30">{entry.balance >= 0 ? 'DR' : 'CR'}</span>
                          </td>
                       </tr>
                     ))}
                     {!selectedPartyId && (
                       <tr>
                          <td colSpan="5" className="px-8 py-32 text-center">
                             <Search size={48} className="mx-auto text-slate-100 mb-6" />
                             <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">Zero Dataset Selected</p>
                          </td>
                       </tr>
                     )}
                  </tbody>
               </table>
            </div>
         </div>
      </div>

      <PaymentModal 
        isOpen={showPaymentModal} 
        onClose={() => setShowPaymentModal(false)} 
        type={paymentType}
      />
    </div>
  );
};

const PaymentModal = ({ isOpen, onClose, type }) => {
  const { parties, addPayment } = useStore();
  const [formData, setFormData] = useState({
    partyId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    mode: 'Bank Transfer',
    ref: '',
    type: type
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.partyId || !formData.amount) return;
    addPayment({ ...formData, type });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-xl border-4 border-black shadow-[20px_20px_0px_0px_rgba(0,0,0,0.3)]">
         <div className="bg-black p-6 flex justify-between items-center text-white">
            <h3 className="text-sm font-black uppercase tracking-[0.4em]">Record Fiscal Entry : {type}</h3>
            <button onClick={onClose} className="p-1 hover:bg-white/10 transition-all"><X size={20} /></button>
         </div>

         <form onSubmit={handleSubmit} className="p-10 space-y-8">
            <div className="space-y-6">
               <FormField label="COUNTERPARTY ACCOUNT">
                  <ERPSelect 
                    value={formData.partyId}
                    onChange={(e) => setFormData({...formData, partyId: e.target.value})}
                    options={parties.map(p => ({ value: p.id, label: p.name }))}
                    className="h-12 border-2 border-black font-black uppercase text-[10px]"
                  />
               </FormField>

               <FormField label="QUANTUM AMOUNT (INR)">
                  <ERPInput 
                    type="number" 
                    value={formData.amount} 
                    onChange={(e) => setFormData({...formData, amount: e.target.value})} 
                    placeholder="0.00"
                    className="h-12 border-2 border-black font-black text-xl"
                  />
               </FormField>

               <div className="grid grid-cols-2 gap-6">
                  <FormField label="SETTLEMENT MODE">
                     <ERPSelect 
                        value={formData.mode}
                        onChange={(e) => setFormData({...formData, mode: e.target.value})}
                        options={[
                          { value: 'Bank Transfer', label: 'Bank Transfer' },
                          { value: 'Cash', label: 'Cash' },
                          { value: 'Cheque', label: 'Cheque' },
                          { value: 'UPI', label: 'UPI' }
                        ]}
                        className="h-12 border-2 border-black font-black uppercase text-[10px]"
                     />
                  </FormField>
                  <FormField label="FISCAL DATE">
                     <ERPInput type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="h-12 border-2 border-black font-black uppercase text-[10px]" />
                  </FormField>
               </div>

               <FormField label="AUDIT REFERENCE / NARRATIVE">
                  <ERPInput 
                    value={formData.ref} 
                    onChange={(e) => setFormData({...formData, ref: e.target.value})} 
                    placeholder="e.g. SETTLEMENT FOR INV_4021" 
                    className="h-12 border-2 border-black font-black uppercase text-[10px]"
                  />
               </FormField>
            </div>
            
            <div className="flex gap-4 pt-6 border-t-2 border-black">
               <button type="button" className="flex-1 py-4 bg-transparent border-2 border-black text-black font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all" onClick={onClose}>Discard</button>
               <button type="submit" className="flex-1 py-4 bg-black text-white font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-all shadow-xl">
                  Commit Entry
               </button>
            </div>
         </form>
      </div>
    </div>
  );
};

export default AccountingPage;
