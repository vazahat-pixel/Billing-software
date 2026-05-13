import React, { useState, useMemo } from 'react';
import useStore from '../../store/useStore';
import { FormField, ERPInput, ERPSelect, ERPButton } from '../../components/forms/FormElements';
import Modal from '../../components/ui/Modal';
import { Wallet, Search, Filter, ArrowUpRight, ArrowDownLeft, FileText, Banknote } from 'lucide-react';

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
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-2xl font-black text-slate-900 tracking-tight">Financial Accounting</h1>
           <p className="text-slate-500 text-sm">Real-time ledger management and payment tracking.</p>
        </div>
        <div className="flex gap-3">
           <ERPButton icon={ArrowUpRight} className="bg-rose-600 border-none" onClick={() => { setPaymentType('payment'); setShowPaymentModal(true); }}>
             Record Payment
           </ERPButton>
           <ERPButton icon={ArrowDownLeft} className="bg-emerald-600 border-none" onClick={() => { setPaymentType('receipt'); setShowPaymentModal(true); }}>
             Record Receipt
           </ERPButton>
        </div>
      </div>

      {/* Filter & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
         <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 h-fit">
            <h4 className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Select Account</h4>
            <ERPSelect 
                value={selectedPartyId} 
                onChange={(e) => setSelectedPartyId(e.target.value)}
                options={parties.map(p => ({ value: p.id, label: p.name }))}
            />
            {selectedPartyId && (
              <div className="mt-8 space-y-4">
                 <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Total Debit</p>
                    <p className="text-lg font-black text-rose-600">₹ {stats.dr.toLocaleString()}</p>
                 </div>
                 <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Total Credit</p>
                    <p className="text-lg font-black text-emerald-600">₹ {stats.cr.toLocaleString()}</p>
                 </div>
                 <div className="p-4 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-100">
                    <p className="text-[10px] font-bold text-indigo-200 uppercase">Closing Balance</p>
                    <p className="text-xl font-black text-white">₹ {Math.abs(stats.bal).toLocaleString()} {stats.bal >= 0 ? 'DR' : 'CR'}</p>
                 </div>
              </div>
            )}
         </div>

         <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
               <div className="flex items-center gap-2 text-slate-700 font-bold">
                  <FileText size={18} />
                  <span>Ledger Statement</span>
               </div>
               <div className="flex gap-2">
                  <button className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 hover:text-indigo-600">PDF</button>
                  <button className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 hover:text-indigo-600">EXCEL</button>
               </div>
            </div>
            
            <div className="overflow-x-auto">
               <table className="w-full text-left">
                  <thead>
                     <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase">
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Particulars</th>
                        <th className="px-6 py-4 text-right">Debit (DR)</th>
                        <th className="px-6 py-4 text-right">Credit (CR)</th>
                        <th className="px-6 py-4 text-right">Balance</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                     {filteredLedger.map((entry) => (
                       <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-xs text-slate-500">{entry.date}</td>
                          <td className="px-6 py-4">
                             <p className="text-xs font-bold text-slate-700">{entry.particular}</p>
                             <p className="text-[9px] text-slate-400">Ref: {entry.id}</p>
                          </td>
                          <td className="px-6 py-4 text-right text-xs font-black text-rose-500">
                             {entry.debit > 0 ? `₹ ${entry.debit.toLocaleString()}` : '-'}
                          </td>
                          <td className="px-6 py-4 text-right text-xs font-black text-emerald-500">
                             {entry.credit > 0 ? `₹ ${entry.credit.toLocaleString()}` : '-'}
                          </td>
                          <td className="px-6 py-4 text-right text-xs font-black text-slate-900">
                             ₹ {Math.abs(entry.balance).toLocaleString()} {entry.balance >= 0 ? 'DR' : 'CR'}
                          </td>
                       </tr>
                     ))}
                     {!selectedPartyId && (
                       <tr>
                          <td colSpan="5" className="px-6 py-20 text-center text-slate-400">
                             <Search size={40} className="mx-auto opacity-10 mb-4" />
                             <p className="text-sm font-medium">Please select a party account to view ledger statement.</p>
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Record ${type === 'payment' ? 'Payment' : 'Receipt'}`} className="max-w-md">
       <form onSubmit={handleSubmit} className="space-y-5">
          <FormField label="Select Account" icon={User}>
             <ERPSelect 
               value={formData.partyId}
               onChange={(e) => setFormData({...formData, partyId: e.target.value})}
               options={parties.map(p => ({ value: p.id, label: p.name }))}
             />
          </FormField>
          <FormField label="Amount" icon={Banknote}>
             <ERPInput 
               type="number" 
               value={formData.amount} 
               onChange={(e) => setFormData({...formData, amount: e.target.value})} 
               placeholder="0.00"
             />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
             <FormField label="Payment Mode">
                <ERPSelect 
                   value={formData.mode}
                   onChange={(e) => setFormData({...formData, mode: e.target.value})}
                   options={[
                     { value: 'Bank Transfer', label: 'Bank Transfer' },
                     { value: 'Cash', label: 'Cash' },
                     { value: 'Cheque', label: 'Cheque' },
                     { value: 'UPI', label: 'UPI' }
                   ]}
                />
             </FormField>
             <FormField label="Date">
                <ERPInput type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
             </FormField>
          </div>
          <FormField label="Reference / Note">
             <ERPInput value={formData.ref} onChange={(e) => setFormData({...formData, ref: e.target.value})} placeholder="e.g. Inv #123 Part Payment" />
          </FormField>
          
          <div className="flex gap-2 pt-4">
             <ERPButton variant="secondary" className="flex-1" onClick={onClose}>Discard</ERPButton>
             <ERPButton type="submit" className={`flex-1 border-none ${type === 'payment' ? 'bg-rose-600' : 'bg-emerald-600'}`}>
                Post Entry
             </ERPButton>
          </div>
       </form>
    </Modal>
  );
};

export default AccountingPage;
