import React, { useState, useEffect, useMemo } from 'react';
import useStore from '../../store/useStore';
import { ERPInput, ERPSelect } from '../../components/forms/FormElements';
import { X, Save, Plus, Trash, BookOpen } from 'lucide-react';

const JournalEntryModal = ({ isOpen, onClose }) => {
  const { ledgers, fetchLedgers, addJournalEntry } = useStore();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState([]);
  
  // Line inputs
  const [selectedLedgerId, setSelectedLedgerId] = useState('');
  const [type, setType] = useState('Dr'); // Dr or Cr
  const [amount, setAmount] = useState('');
  const [lineNarration, setLineNarration] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchLedgers();
      setDate(new Date().toISOString().split('T')[0]);
      setNarration('');
      setLines([]);
      setSelectedLedgerId('');
      setType('Dr');
      setAmount('');
      setLineNarration('');
      setErrorMsg('');
    }
  }, [isOpen]);

  const selectedLedgerObj = useMemo(() => {
    return ledgers.find(l => l._id === selectedLedgerId);
  }, [ledgers, selectedLedgerId]);

  const handleAddLine = () => {
    if (!selectedLedgerId) return;
    const numAmt = parseFloat(amount) || 0;
    if (numAmt <= 0) return;

    setLines(prev => [
      ...prev,
      {
        ledgerId: selectedLedgerId,
        ledgerName: selectedLedgerObj?.name,
        type,
        amount: numAmt,
        narration: lineNarration
      }
    ]);

    // Reset line input
    setSelectedLedgerId('');
    setAmount('');
    setLineNarration('');
  };

  const handleRemoveLine = (index) => {
    setLines(prev => prev.filter((_, idx) => idx !== index));
  };

  const totals = useMemo(() => {
    const dr = lines.filter(l => l.type === 'Dr').reduce((sum, l) => sum + l.amount, 0);
    const cr = lines.filter(l => l.type === 'Cr').reduce((sum, l) => sum + l.amount, 0);
    return {
      dr,
      cr,
      diff: Math.abs(dr - cr)
    };
  }, [lines]);

  const handleSave = async () => {
    setErrorMsg('');
    if (lines.length < 2) {
      setErrorMsg('A journal entry must contain at least 2 lines');
      return;
    }
    if (totals.diff > 0.01) {
      setErrorMsg(`Journal entry is unbalanced. Imbalance amount: ₹ ${totals.diff.toFixed(2)}`);
      return;
    }

    setIsSubmitting(true);
    try {
      await addJournalEntry({
        entryDate: date,
        lines: lines.map(l => ({
          ledgerId: l.ledgerId,
          ledgerName: l.ledgerName,
          type: l.type,
          amount: l.amount,
          narration: l.narration
        })),
        narration: narration || 'Manual Journal entry'
      });
      onClose();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to post journal entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6 backdrop-blur-md">
      <div className="bg-[#FDFCF9] w-full max-w-5xl h-[85vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-white/20 animate-fadeIn">
        
        {/* Header */}
        <div className="px-10 py-6 flex justify-between items-center bg-white border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-black text-white rounded-2xl shadow-lg">
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-black tracking-tight italic">Journal Entry Protocol<span className="text-slate-200">.</span></h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Double-Entry Audit System</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-black transition-all">
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 border-b border-rose-100 px-10 py-3 text-rose-600 font-bold text-xs uppercase tracking-wider">
            Error: {errorMsg}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar bg-white">
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Entry Date</label>
              <ERPInput 
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">General Audit Narration</label>
              <ERPInput 
                value={narration}
                onChange={e => setNarration(e.target.value)}
                placeholder="Narrative explanation for this double entry transaction..."
                className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]"
              />
            </div>
          </div>

          <div className="h-[1px] bg-slate-100" />

          {/* Add Line Form */}
          <div className="space-y-4">
            <h3 className="text-[11px] font-bold text-black uppercase tracking-widest">Post Entry Line</h3>
            <div className="grid grid-cols-5 gap-6 items-end">
              <div className="space-y-2 col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ledger Account</label>
                <ERPSelect 
                  value={selectedLedgerId}
                  onChange={e => setSelectedLedgerId(e.target.value)}
                  options={ledgers.map(l => ({ value: l._id, label: `${l.name} (${l.group})` }))}
                  className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]"
                  label="Ledger"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Post Type</label>
                <ERPSelect 
                  value={type}
                  onChange={e => setType(e.target.value)}
                  options={[
                    { value: 'Dr', label: 'Debit (Dr)' },
                    { value: 'Cr', label: 'Credit (Cr)' }
                  ]}
                  className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]"
                  label="Type"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount (₹)</label>
                <ERPInput 
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Line Narration</label>
                <div className="flex gap-2">
                  <ERPInput 
                    placeholder="Specific remarks..."
                    value={lineNarration}
                    onChange={e => setLineNarration(e.target.value)}
                    className="flex-1 h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]"
                  />
                  <button 
                    type="button"
                    onClick={handleAddLine}
                    className="h-12 w-12 bg-black text-white hover:bg-slate-800 transition-all rounded-xl flex items-center justify-center shadow-lg"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Grid list of posted lines */}
          <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-white">
                  <th className="px-8 py-4">Ledger Account</th>
                  <th className="px-8 py-4 text-center">Debits (Dr)</th>
                  <th className="px-8 py-4 text-center">Credits (Cr)</th>
                  <th className="px-8 py-4">Line Remarks</th>
                  <th className="px-8 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {lines.map((line, index) => (
                  <tr key={index} className="hover:bg-slate-50/50 transition-all">
                    <td className="px-8 py-4 font-bold text-black uppercase tracking-wider text-[10px]">{line.ledgerName}</td>
                    <td className="px-8 py-4 text-center font-bold text-emerald-600 text-[10px]">
                      {line.type === 'Dr' ? `₹ ${line.amount.toFixed(2)}` : ''}
                    </td>
                    <td className="px-8 py-4 text-center font-bold text-rose-600 text-[10px]">
                      {line.type === 'Cr' ? `₹ ${line.amount.toFixed(2)}` : ''}
                    </td>
                    <td className="px-8 py-4 text-slate-500 font-bold uppercase text-[9px]">{line.narration || '-'}</td>
                    <td className="px-8 py-4 text-right">
                      <button 
                        type="button" 
                        onClick={() => handleRemoveLine(index)}
                        className="text-slate-300 hover:text-rose-500 transition-all p-1"
                      >
                        <Trash size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {lines.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-8 py-10 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white">
                      No lines added yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-10 py-6 bg-white border-t border-slate-100 flex justify-between items-center shrink-0">
          <div className="flex gap-10">
            <div className="text-right">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Total Debits</span>
              <span className="text-xl font-black text-emerald-600">₹ {totals.dr.toFixed(2)}</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Total Credits</span>
              <span className="text-xl font-black text-rose-600">₹ {totals.cr.toFixed(2)}</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Imbalance Difference</span>
              <span className={`text-xl font-black ${totals.diff > 0.01 ? 'text-rose-500' : 'text-slate-300'}`}>
                ₹ {totals.diff.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="flex gap-4">
            <button 
              type="button" 
              onClick={onClose}
              className="px-8 py-3.5 bg-white border border-slate-200 rounded-xl text-black text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-all"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button 
              type="button"
              onClick={handleSave}
              disabled={isSubmitting || totals.diff > 0.01}
              className="px-10 py-3.5 bg-black text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-3 shadow-lg disabled:opacity-50"
            >
              <Save size={16} /> {isSubmitting ? 'Posting...' : 'Post Journal'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default JournalEntryModal;
