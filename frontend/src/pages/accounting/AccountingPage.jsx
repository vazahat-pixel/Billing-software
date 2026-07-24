import React, { useState, useEffect, useMemo } from 'react';
import useStore from '../../store/useStore';
import { ERPSelect } from '../../components/forms/FormElements';
import { accountingApi } from '../../api';
import { Banknote, FileText, Search, ArrowUpRight, ArrowDownLeft, ArrowRight, X } from 'lucide-react';
import CashBankBookModal from './CashBankBookModal';

const AccountingPage = () => {
  const { parties, currentLedgerStatement, fetchLedgerStatement, fetchParties } = useStore();
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentType, setPaymentType] = useState('payment'); // payment or receipt

  // Fetch parties on mount
  useEffect(() => {
    fetchParties();
  }, []);

  const resolveLedgerForParty = async (partyId) => {
    const ledgers = await accountingApi.listLedgers({ partyId });
    return ledgers?.[0] || null;
  };

  // Fetch the ledger statement when selected party changes
  useEffect(() => {
    if (selectedPartyId) {
      resolveLedgerForParty(selectedPartyId)
        .then((ledger) => {
          if (ledger) {
            fetchLedgerStatement({ ledgerId: ledger._id });
          } else {
            useStore.setState({ currentLedgerStatement: null });
          }
        })
        .catch((err) => {
          console.error('Error fetching ledger for party:', err);
          useStore.setState({ currentLedgerStatement: null });
        });
    } else {
      useStore.setState({ currentLedgerStatement: null });
    }
  }, [selectedPartyId]);

  const filteredLedger = useMemo(() => {
    return currentLedgerStatement?.statement || [];
  }, [currentLedgerStatement]);

  const stats = useMemo(() => {
    if (!currentLedgerStatement) {
      return { dr: 0, cr: 0, bal: 0, balType: 'Dr' };
    }
    const dr = filteredLedger.reduce((acc, e) => acc + (e.debit || 0), 0);
    const cr = filteredLedger.reduce((acc, e) => acc + (e.credit || 0), 0);
    const bal = currentLedgerStatement.closingBalance || 0;
    const balType = currentLedgerStatement.closingBalanceType || 'Dr';
    return { dr, cr, bal, balType };
  }, [currentLedgerStatement, filteredLedger]);

  const refreshStatement = () => {
    if (selectedPartyId) {
      resolveLedgerForParty(selectedPartyId).then((ledger) => {
        if (ledger) {
          fetchLedgerStatement({ ledgerId: ledger._id });
        }
      });
    }
  };

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
                    options={parties.map(p => ({ value: p._id || p.id, label: p.name }))}
                    className="h-12 border-2 border-black font-black uppercase text-[10px]"
                    label="Account"
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
                       <p className="text-3xl font-black text-white mt-2 tracking-tighter">
                         ₹ {stats.bal.toLocaleString()} <span className="text-xs opacity-50">{stats.balType}</span>
                       </p>
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
            </div>
            
            <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                  <thead>
                     <tr className="bg-black text-[9px] font-black text-white uppercase tracking-[0.3em] sticky top-0 z-10">
                        <th className="px-8 py-5">Audit Date</th>
                        <th className="px-8 py-5">Particular Intelligence</th>
                        <th className="px-8 py-5 text-right">Debit (DR)</th>
                        <th className="px-8 py-5 text-right">Credit (CR)</th>
                        <th className="px-8 py-5 text-right">Net Position</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-slate-50">
                     {filteredLedger.map((entry) => (
                        <tr key={entry._id} className="hover:bg-slate-50 transition-all">
                           <td className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                             {entry.date ? new Date(entry.date).toLocaleDateString() : ''}
                           </td>
                           <td className="px-8 py-5">
                              <p className="text-[11px] font-black text-black uppercase tracking-widest">{entry.narration}</p>
                              <p className="text-[9px] text-slate-300 font-black uppercase mt-1 tracking-widest">
                                REF: {entry.voucherNo} ({entry.voucherType})
                              </p>
                           </td>
                           <td className="px-8 py-5 text-right text-[11px] font-black text-black">
                              {entry.debit > 0 ? `₹ ${entry.debit.toLocaleString()}` : '-'}
                           </td>
                           <td className="px-8 py-5 text-right text-[11px] font-black text-black">
                              {entry.credit > 0 ? `₹ ${entry.credit.toLocaleString()}` : '-'}
                           </td>
                           <td className="px-8 py-5 text-right text-[12px] font-black text-black tracking-tighter">
                              ₹ {entry.runningBalance?.toLocaleString()} <span className="text-[9px] opacity-30">{entry.balanceType}</span>
                           </td>
                        </tr>
                     ))}
                     {(!selectedPartyId || filteredLedger.length === 0) && (
                        <tr>
                           <td colSpan="5" className="px-8 py-32 text-center">
                              <Search size={48} className="mx-auto text-slate-100 mb-6" />
                              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">
                                {selectedPartyId ? 'Zero Statement Entries' : 'Zero Dataset Selected'}
                              </p>
                           </td>
                        </tr>
                     )}
                  </tbody>
               </table>
            </div>
         </div>
      </div>

      <CashBankBookModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          refreshStatement();
        }}
        bookKind="bank"
        initialType={paymentType === 'receipt' ? 'Receipt' : 'Payment'}
      />
    </div>
  );
};

export default AccountingPage;
