import React, { useState, useEffect, useMemo } from 'react';
import useStore from '../../store/useStore';
import { ERPInput, ERPSelect } from '../../components/forms/FormElements';
import api from '../../api/client';
import { Save, X, Banknote, History, Plus, Trash2 } from 'lucide-react';
import { formatPaymentSplits, PAYMENT_MODE_OPTIONS, buildSplitsPayload } from '../../utils/paymentFormat';

const DEFAULT_SPLITS = () => ([
  { mode: 'Cash', amount: '', reference: '' },
  { mode: 'Card', amount: '', reference: '' }
]);

export const PaymentForm = ({ isOpen, onClose, initialType = 'Receipt', selectedBook = null }) => {
  const { 
    parties, 
    ledgers, 
    sales, 
    purchases, 
    fetchParties, 
    fetchLedgers, 
    fetchSales, 
    fetchPurchases,
    addPayment,
    addReceipt,
    fetchVouchers,
    vouchers
  } = useStore();

  const [activeTab, setActiveTab] = useState('Entry');
  const [type, setType] = useState(initialType);
  const [bankLedgerId, setBankLedgerId] = useState('');
  const [partyId, setPartyId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('0.00');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [useSplitPayment, setUseSplitPayment] = useState(false);
  const [paymentSplits, setPaymentSplits] = useState(DEFAULT_SPLITS());
  const [chequeNo, setChequeNo] = useState('');
  const [utrNo, setUtrNo] = useState('');
  const [chequeDate, setChequeDate] = useState(new Date().toISOString().split('T')[0]);
  const [narration, setNarration] = useState('');
  const [adjustments, setAdjustments] = useState({});
  const [vouchersList, setVouchersList] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Fetch data on open
  useEffect(() => {
    if (isOpen) {
      setType(initialType);
      setActiveTab('Entry');
      fetchParties();
      fetchLedgers();
      fetchSales();
      fetchPurchases();
      fetchVouchers();
      setFormError('');
      setAdjustments({});
      setAmount('0.00');
      setBankLedgerId('');
      setPartyId('');
      setChequeNo('');
      setUtrNo('');
      setNarration('');
      setUseSplitPayment(false);
      setPaymentSplits(DEFAULT_SPLITS());
    }
  }, [isOpen, initialType]);

  useEffect(() => {
    if (isOpen) {
      api.get('/accounting/payments')
        .then(res => {
          setVouchersList(res.data.data || []);
        })
        .catch(err => {
          console.error('Error fetching vouchers:', err);
        });
    }
  }, [isOpen, vouchers]);

  // Fallback / Filter Cash and Bank accounts from ledgers
  const bankCashLedgers = useMemo(() => {
    let list = ledgers.filter(l => 
      l.name.toLowerCase().includes('cash') || 
      l.name.toLowerCase().includes('bank') || 
      l.group === 'Assets'
    );
    if (list.length === 0) list = ledgers;
    return list;
  }, [ledgers]);

  // Compute Outstanding Invoices for selected counterparty
  const partyInvoices = useMemo(() => {
    if (!partyId) return [];

    let docs = [];
    if (type === 'Receipt') {
      // Receipt: customer owes us money (Sales)
      docs = sales.filter(s => s.customerId === partyId);
    } else {
      // Payment: we owe supplier/worker money (Purchase)
      docs = purchases.filter(p => p.supplierId === partyId);
    }

    return docs.map(doc => {
      const docTotal = doc.netAmount || doc.totalAmount || 0;
      // Sum the paid amount across all posted vouchers for this invoice
      const paid = vouchersList
        .filter(v => v.status === 'Posted')
        .reduce((sum, v) => {
          const match = v.againstInvoices?.find(item => item.invoiceId === doc._id);
          return sum + (match ? match.amount : 0);
        }, 0);

      return {
        _id: doc._id,
        invoiceNo: doc.invoiceNo,
        date: doc.date ? new Date(doc.date).toISOString().split('T')[0] : '',
        total: docTotal,
        paid: paid,
        outstanding: Math.max(0, docTotal - paid)
      };
    }).filter(inv => inv.outstanding > 0.01);
  }, [partyId, type, sales, purchases, vouchersList]);

  // Get total outstanding balance
  const totalOutstanding = useMemo(() => {
    return partyInvoices.reduce((sum, inv) => sum + inv.outstanding, 0);
  }, [partyInvoices]);

  // Sum of applied amounts
  const totalApplied = useMemo(() => {
    return Object.values(adjustments).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
  }, [adjustments]);

  const splitTotal = useMemo(() => {
    return paymentSplits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  }, [paymentSplits]);

  const effectiveAmount = useMemo(() => {
    if (useSplitPayment) return splitTotal;
    return parseFloat(amount) || 0;
  }, [useSplitPayment, splitTotal, amount]);

  const viewVouchers = useMemo(() => {
    return (vouchersList.length ? vouchersList : vouchers)
      .filter(v => v.voucherType === type)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [vouchersList, vouchers, type]);

  const updateSplit = (index, field, value) => {
    setPaymentSplits(prev => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const addSplitRow = () => {
    setPaymentSplits(prev => [...prev, { mode: 'UPI', amount: '', reference: '' }]);
  };

  const removeSplitRow = (index) => {
    setPaymentSplits(prev => prev.filter((_, i) => i !== index));
  };

  // Auto-allocate payment to oldest invoices first
  const handleAutoAllocate = () => {
    const amt = parseFloat(amount) || 0;
    let remaining = amt;
    const newAdjustments = {};

    // Sort invoices by date ascending
    const sortedInvoices = [...partyInvoices].sort((a, b) => new Date(a.date) - new Date(b.date));

    for (const inv of sortedInvoices) {
      if (remaining <= 0) break;
      const allocate = Math.min(remaining, inv.outstanding);
      newAdjustments[inv._id] = allocate.toFixed(2);
      remaining -= allocate;
    }
    setAdjustments(newAdjustments);
  };

  const handleAdjustmentChange = (invoiceId, val) => {
    setAdjustments(prev => ({
      ...prev,
      [invoiceId]: val
    }));
  };

  const handleCommit = async () => {
    setFormError('');
    if (!partyId) {
      setFormError('Please select a counterparty');
      return;
    }
    if (!bankLedgerId) {
      setFormError('Please select a Cash/Bank ledger repository');
      return;
    }
    let numericAmount = parseFloat(amount) || 0;
    let splitsPayload = null;

    if (useSplitPayment) {
      splitsPayload = buildSplitsPayload(paymentSplits);
      if (splitsPayload.length === 0) {
        setFormError('Enter amount in at least one payment mode (Cash, Card, UPI, etc.)');
        return;
      }
      for (const split of splitsPayload) {
        if (split.mode === 'Cheque' && !split.reference) {
          setFormError('Cheque number is required for cheque split');
          return;
        }
        if (['NEFT', 'RTGS', 'UPI'].includes(split.mode) && !split.reference) {
          setFormError(`Reference/UTR is required for ${split.mode} split`);
          return;
        }
      }
      numericAmount = splitsPayload.reduce((sum, s) => sum + s.amount, 0);
    } else {
      if (numericAmount <= 0) {
        setFormError('Voucher amount must be greater than zero');
        return;
      }
      if (paymentMode === 'Cheque' && !chequeNo) {
        setFormError('Cheque number is required');
        return;
      }
      if (['NEFT', 'RTGS', 'UPI'].includes(paymentMode) && !utrNo) {
        setFormError('UTR/Reference number is required');
        return;
      }
    }

    if (numericAmount <= 0) {
      setFormError('Voucher amount must be greater than zero');
      return;
    }

    setIsSubmitting(true);

    try {
      const againstInvoices = Object.entries(adjustments)
        .map(([invoiceId, appliedAmt]) => {
          const amt = parseFloat(appliedAmt) || 0;
          if (amt <= 0) return null;
          const inv = partyInvoices.find(i => i._id === invoiceId);
          return {
            invoiceId,
            invoiceNo: inv ? inv.invoiceNo : '',
            amount: amt
          };
        })
        .filter(Boolean);

      const payload = {
        date,
        partyLedgerId: partyId,
        amount: numericAmount,
        bankLedgerId,
        narration: narration || `${type} — ${parties.find(p => p._id === partyId)?.name}`,
        againstInvoices,
        status: 'Posted'
      };

      if (useSplitPayment) {
        payload.paymentSplits = splitsPayload;
      } else {
        payload.paymentMode = paymentMode;
        payload.chequeNo = paymentMode === 'Cheque' ? chequeNo : undefined;
        payload.utrNo = ['NEFT', 'RTGS', 'UPI'].includes(paymentMode) ? utrNo : undefined;
        payload.chequeDate = paymentMode === 'Cheque' ? chequeDate : undefined;
      }

      if (type === 'Receipt') {
        await addReceipt(payload);
      } else {
        await addPayment(payload);
      }

      await fetchVouchers();
      setActiveTab('View');
      setUseSplitPayment(false);
      setPaymentSplits(DEFAULT_SPLITS());
      setAmount('0.00');
      setAdjustments({});
    } catch (err) {
      console.error(err);
      setFormError(err.response?.data?.message || err.message || 'Error creating voucher');
    } finally {
      setIsSubmitting(false);
    }
  };

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

         {formError && (
           <div className="bg-rose-50 border-b border-rose-100 px-10 py-3 text-rose-600 font-bold text-xs uppercase tracking-wider">
             Error: {formError}
           </div>
         )}

         <div className="flex border-b border-slate-100 px-10 pt-3 gap-2 shrink-0 bg-white">
            {['Entry', 'View'].map(tab => (
               <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${
                     activeTab === tab ? 'bg-black text-white' : 'text-slate-400 hover:bg-slate-50'
                  }`}
               >
                  {tab === 'Entry' ? `${type} Entry` : `View ${type}s (${viewVouchers.length})`}
               </button>
            ))}
         </div>

         {activeTab === 'View' ? (
            <div className="flex-1 overflow-y-auto p-8 bg-[#FDFCF9]">
               <table className="w-full text-left bg-white rounded-2xl border border-slate-100 overflow-hidden">
                  <thead className="text-[9px] uppercase tracking-widest text-slate-400 border-b border-slate-50">
                     <tr>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Voucher No</th>
                        <th className="px-6 py-4">Party</th>
                        <th className="px-6 py-4">Payment Mode (Split Details)</th>
                        <th className="px-6 py-4 text-right">Amount</th>
                        <th className="px-6 py-4">Against Invoices</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-[11px]">
                     {viewVouchers.map(v => (
                        <tr key={v._id} className="hover:bg-slate-50/50">
                           <td className="px-6 py-4">{new Date(v.date).toLocaleDateString('en-IN')}</td>
                           <td className="px-6 py-4 font-bold">{v.voucherNo}</td>
                           <td className="px-6 py-4 font-semibold">{v.partyName}</td>
                           <td className="px-6 py-4">
                              <span className="font-semibold text-black">{formatPaymentSplits(v)}</span>
                           </td>
                           <td className="px-6 py-4 text-right font-black">₹ {Number(v.amount).toLocaleString('en-IN')}</td>
                           <td className="px-6 py-4 text-slate-500">
                              {(v.againstInvoices || []).map(i => i.invoiceNo).filter(Boolean).join(', ') || '—'}
                           </td>
                        </tr>
                     ))}
                     {viewVouchers.length === 0 && (
                        <tr>
                           <td colSpan={6} className="px-6 py-16 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                              No {type.toLowerCase()} vouchers found
                           </td>
                        </tr>
                     )}
                  </tbody>
               </table>
            </div>
         ) : (
         <div className="flex flex-1 overflow-hidden">
            
            {/* Left Column: Form Fields */}
            <div className="w-[35%] border-r border-slate-100 p-10 overflow-y-auto space-y-8 bg-white custom-scrollbar animate-fadeIn">
               <div className="space-y-6">
                  <div className="flex items-center gap-4">
                     <h3 className="text-[11px] font-bold text-black uppercase tracking-[0.3em] whitespace-nowrap">Transaction Schema</h3>
                     <div className="h-[1px] flex-1 bg-slate-50" />
                  </div>

                  <div className="space-y-2">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Counterparty Account</label>
                     <ERPSelect 
                       className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px] focus:ring-1 focus:ring-black"
                       label="Counterparty"
                       value={partyId}
                       onChange={e => {
                         setPartyId(e.target.value);
                         setAdjustments({});
                       }}
                       options={parties.map(p => ({ value: p._id, label: `${p.name} (${p.type})` }))}
                     />
                  </div>

                  <div className="space-y-2">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Settlement Repository</label>
                     <ERPSelect 
                       className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px] focus:ring-1 focus:ring-black"
                       label="Settlement Ledger"
                       value={bankLedgerId}
                       onChange={e => setBankLedgerId(e.target.value)}
                       options={bankCashLedgers.map(l => ({ value: l._id, label: l.name }))}
                     />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Protocol Date</label>
                        <ERPInput 
                          type="date" 
                          className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px] focus:ring-1 focus:ring-black" 
                          value={date}
                          onChange={e => setDate(e.target.value)}
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                           {useSplitPayment ? 'Total (Auto from splits)' : 'Quantum Amount (₹)'}
                        </label>
                        <ERPInput 
                          className="w-full h-12 bg-black text-white border-none rounded-xl font-black text-lg text-center focus:ring-2 focus:ring-slate-500" 
                          placeholder="0.00" 
                          value={useSplitPayment ? splitTotal.toFixed(2) : amount} 
                          readOnly={useSplitPayment}
                          onChange={e => {
                            setAmount(e.target.value);
                            setAdjustments({});
                          }}
                        />
                     </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                     <input
                        type="checkbox"
                        id="splitPayment"
                        checked={useSplitPayment}
                        onChange={e => {
                           setUseSplitPayment(e.target.checked);
                           if (e.target.checked) setPaymentSplits(DEFAULT_SPLITS());
                        }}
                        className="w-4 h-4"
                     />
                     <label htmlFor="splitPayment" className="text-[10px] font-bold text-black uppercase tracking-widest cursor-pointer">
                        Split Payment (Cash + Card + UPI mix)
                     </label>
                  </div>

                  {useSplitPayment ? (
                    <div className="space-y-3">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Payment Breakdown</label>
                       {paymentSplits.map((split, index) => (
                          <div key={index} className="grid grid-cols-12 gap-2 items-end">
                             <div className="col-span-4">
                                <ERPSelect
                                  className="w-full h-10 text-[10px] font-bold"
                                  value={split.mode}
                                  onChange={e => updateSplit(index, 'mode', e.target.value)}
                                  options={PAYMENT_MODE_OPTIONS}
                                />
                             </div>
                             <div className="col-span-3">
                                <ERPInput
                                  type="number"
                                  className="w-full h-10 text-[11px] font-bold text-right"
                                  placeholder="Amount"
                                  value={split.amount}
                                  onChange={e => updateSplit(index, 'amount', e.target.value)}
                                />
                             </div>
                             <div className="col-span-4">
                                <ERPInput
                                  className="w-full h-10 text-[10px]"
                                  placeholder={['Cheque', 'NEFT', 'RTGS', 'UPI', 'Card'].includes(split.mode) ? 'Ref / UTR / Chq No' : 'Optional ref'}
                                  value={split.reference}
                                  onChange={e => updateSplit(index, 'reference', e.target.value)}
                                />
                             </div>
                             <div className="col-span-1 flex justify-center">
                                {paymentSplits.length > 1 && (
                                  <button type="button" onClick={() => removeSplitRow(index)} className="text-slate-300 hover:text-red-500">
                                     <Trash2 size={14} />
                                  </button>
                                )}
                             </div>
                          </div>
                       ))}
                       <button type="button" onClick={addSplitRow} className="flex items-center gap-1 text-[9px] font-bold uppercase text-slate-500 hover:text-black">
                          <Plus size={12} /> Add mode
                       </button>
                       <p className="text-[9px] text-slate-400 font-semibold">
                          Example: Cash ₹5000 + Card ₹3000 = Total ₹8000
                       </p>
                    </div>
                  ) : (
                  <>
                  <div className="space-y-2">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Payment Mode</label>
                     <ERPSelect 
                       className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px] focus:ring-1 focus:ring-black"
                       label="Mode"
                       value={paymentMode}
                       onChange={e => setPaymentMode(e.target.value)}
                       options={PAYMENT_MODE_OPTIONS}
                     />
                  </div>

                  {paymentMode === 'Cheque' && (
                    <div className="grid grid-cols-2 gap-4 animate-slideDown">
                       <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cheque No</label>
                          <ERPInput 
                            className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]" 
                            placeholder="Cheque No" 
                            value={chequeNo} 
                            onChange={e => setChequeNo(e.target.value)} 
                          />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cheque Date</label>
                          <ERPInput 
                            type="date" 
                            className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]" 
                            value={chequeDate}
                            onChange={e => setChequeDate(e.target.value)}
                          />
                       </div>
                    </div>
                  )}

                  {['NEFT', 'RTGS', 'UPI'].includes(paymentMode) && (
                    <div className="space-y-2 animate-slideDown">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">UTR / Reference No</label>
                       <ERPInput 
                         className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]" 
                         placeholder="UTR / Transaction reference ID" 
                         value={utrNo} 
                         onChange={e => setUtrNo(e.target.value)} 
                       />
                    </div>
                  )}
                  </>
                  )}

                  <div className="space-y-2">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Audit Narrative</label>
                     <textarea 
                        rows={3}
                        className="w-full p-4 bg-slate-50 border-none rounded-xl font-bold text-[10px] uppercase tracking-widest focus:outline-none focus:ring-1 focus:ring-black resize-none"
                        placeholder="ENTER TRANSACTION NARRATIVE..."
                        value={narration}
                        onChange={e => setNarration(e.target.value)}
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
                     Outstanding Balance: ₹ {totalOutstanding.toFixed(2)}
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                  {partyInvoices.length > 0 ? (
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                       <table className="w-full text-left">
                          <thead>
                             <tr className="border-b border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                <th className="px-8 py-5">Reference Invoice</th>
                                <th className="px-8 py-5 text-center">Date</th>
                                <th className="px-8 py-5 text-right">Invoice Total</th>
                                <th className="px-8 py-5 text-right">Remaining Outstanding</th>
                                <th className="px-8 py-5 text-right">Applied Amount (₹)</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                             {partyInvoices.map((inv) => (
                                <tr key={inv._id} className="hover:bg-slate-50/50 transition-all group">
                                   <td className="px-8 py-5 font-bold text-black uppercase tracking-widest text-[10px]">{inv.invoiceNo}</td>
                                   <td className="px-8 py-5 text-center text-[10px] font-bold text-slate-400 uppercase">{inv.date}</td>
                                   <td className="px-8 py-5 text-right text-[11px] font-bold text-slate-400">₹ {inv.total.toFixed(2)}</td>
                                   <td className="px-8 py-5 text-right text-[11px] font-bold text-black">₹ {inv.outstanding.toFixed(2)}</td>
                                   <td className="px-8 py-5 text-right">
                                      <input 
                                         type="number" 
                                         className="w-32 h-10 text-right bg-slate-50 border-none rounded-lg focus:bg-white focus:ring-1 focus:ring-black transition-all px-4 text-[11px] font-bold outline-none" 
                                         placeholder="0.00" 
                                         value={adjustments[inv._id] || ''}
                                         onChange={e => handleAdjustmentChange(inv._id, e.target.value)}
                                         max={inv.outstanding}
                                      />
                                   </td>
                                </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20">
                      <Banknote size={48} className="opacity-20 mb-4" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">
                        {partyId ? 'No outstanding invoices found for this party' : 'Select a counterparty to load outstanding invoices'}
                      </p>
                    </div>
                  )}
               </div>

               {/* Grid totals card */}
               <div className="px-10 py-8 bg-white border-t border-slate-100 grid grid-cols-3 gap-6 shrink-0">
                  <div className="bg-slate-50 p-6 rounded-2xl">
                     <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Aggregate Quantum</span>
                     <span className="text-xl font-black text-black tracking-tight">₹ {effectiveAmount.toFixed(2)}</span>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-2xl flex flex-col justify-between">
                     <div>
                       <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Unallocated Balance</span>
                       <span className="text-xl font-black text-black tracking-tight">
                         ₹ {Math.max(0, effectiveAmount - totalApplied).toFixed(2)}
                       </span>
                     </div>
                     {partyInvoices.length > 0 && (
                       <button
                         type="button"
                         onClick={handleAutoAllocate}
                         className="mt-2 text-[9px] font-black text-left text-slate-500 hover:text-black uppercase tracking-widest hover:underline transition-all"
                       >
                         Auto Apply Payments
                       </button>
                     )}
                  </div>
                  <div className="bg-black p-6 rounded-2xl shadow-xl">
                     <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Applied Total</span>
                     <span className="text-xl font-black text-white tracking-tight">₹ {totalApplied.toFixed(2)}</span>
                  </div>
               </div>
            </div>
         </div>
         )}

         {/* Compact Footer */}
         {activeTab === 'Entry' && (
         <div className="px-10 py-8 bg-white border-t border-slate-100 flex justify-end gap-4 shrink-0">
            <button 
               type="button" 
               onClick={onClose}
               className="px-10 py-4 bg-white border border-slate-200 rounded-xl text-black text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
               disabled={isSubmitting}
            >
               Abort Entry
            </button>
            <button 
               type="button"
               onClick={handleCommit}
               disabled={isSubmitting}
               className="px-12 py-4 bg-black text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-3 shadow-lg disabled:opacity-50"
            >
               <Save size={16} /> {isSubmitting ? 'Posting...' : 'Commit Voucher'}
            </button>
         </div>
         )}

      </div>
    </div>
  );
};

