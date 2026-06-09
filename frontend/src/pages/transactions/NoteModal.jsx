import React, { useState, useEffect } from 'react';
import useStore from '../../store/useStore';
import { ERPInput, ERPSelect } from '../../components/forms/FormElements';
import { X, Save, Edit } from 'lucide-react';

const NoteModal = ({ isOpen, onClose, initialType = 'Credit' }) => {
  const { parties, addNote, fetchParties } = useStore();
  const [type, setType] = useState(initialType);
  const [partyId, setPartyId] = useState('');
  const [noteNo, setNoteNo] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [againstInvoiceNo, setAgainstInvoiceNo] = useState('');
  const [reason, setReason] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setType(initialType);
      fetchParties();
      setPartyId('');
      setNoteNo('');
      setDate(new Date().toISOString().split('T')[0]);
      setAmount('');
      setAgainstInvoiceNo('');
      setReason('');
      setErrorMsg('');
    }
  }, [isOpen, initialType]);

  const handleSave = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!partyId) {
      setErrorMsg('Please select a party');
      return;
    }
    const numAmount = parseFloat(amount) || 0;
    if (numAmount <= 0) {
      setErrorMsg('Adjustment amount must be greater than zero');
      return;
    }

    setIsSubmitting(true);
    try {
      await addNote({
        noteType: type,
        noteNo: noteNo || undefined,
        partyLedgerId: partyId,
        date,
        amount: numAmount,
        againstInvoiceNo,
        reason,
        status: 'Posted'
      });
      onClose();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to save note');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6 backdrop-blur-md">
      <div className="bg-[#FDFCF9] w-full max-w-xl rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-white/20 animate-fadeIn">
        
        {/* Header */}
        <div className="px-10 py-6 flex justify-between items-center bg-white border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-black text-white rounded-2xl shadow-lg">
              <Edit size={20} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-black tracking-tight italic">{type} Note Registry<span className="text-slate-200">.</span></h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Note Adjustment Manager</p>
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

        <form onSubmit={handleSave} className="p-10 space-y-6 flex-1 bg-white">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selected Counterparty</label>
            <ERPSelect 
              value={partyId}
              onChange={e => setPartyId(e.target.value)}
              options={parties.map(p => ({ value: p._id, label: `${p.name} (${p.type})` }))}
              className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]"
              label="Party"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Note Ref No</label>
              <ERPInput 
                value={noteNo}
                onChange={e => setNoteNo(e.target.value)}
                placeholder="AUTO-GENERATED"
                className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Adjustment Date</label>
              <ERPInput 
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quantum Amount (₹)</label>
              <ERPInput 
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full h-12 bg-black text-white border-none rounded-xl font-black text-lg text-center"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Against Invoice Reference</label>
              <ERPInput 
                value={againstInvoiceNo}
                onChange={e => setAgainstInvoiceNo(e.target.value)}
                placeholder="INV-2026-0045"
                className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Narrative / Reason</label>
            <textarea 
              rows={3}
              className="w-full p-4 bg-slate-50 border-none rounded-xl font-bold text-[10px] uppercase tracking-widest focus:outline-none focus:ring-1 focus:ring-black resize-none text-black"
              placeholder="ENTER REASON OR NARRATIVE DETAILS..."
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>

          <div className="flex gap-4 pt-6 border-t border-slate-100">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-4 bg-white border border-slate-200 rounded-xl text-black text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-all"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-4 bg-black text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-lg disabled:opacity-50"
            >
              <Save size={16} /> {isSubmitting ? 'Posting...' : 'Commit Note'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default NoteModal;
