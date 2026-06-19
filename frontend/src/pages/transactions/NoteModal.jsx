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
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
      <div className="classic-erp-window w-full max-w-xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="classic-erp-header shrink-0">
          <span>{type} Note Registry [ NOTE VOUCHER ]</span>
          <button className="classic-erp-close-btn" onClick={onClose}>X</button>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 border-b border-rose-200 px-3 py-1.5 text-red-800 font-bold text-xs font-mono">
            Error: {errorMsg}
          </div>
        )}

        <form onSubmit={handleSave} className="p-3 space-y-3 bg-[#d4d0c8] flex-1">
          <div className="classic-erp-frame flex items-center gap-2">
            <span className="classic-erp-label red-label w-24">Counterparty:</span>
            <select 
              value={partyId}
              onChange={e => setPartyId(e.target.value)}
              className="classic-erp-select flex-1"
            >
              <option value="">- Select Party / Account -</option>
              {parties.map(p => (
                <option key={p._id} value={p._id}>{p.name} ({p.type})</option>
              ))}
            </select>
          </div>

          <div className="classic-erp-frame grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <span className="classic-erp-label w-20">Note No:</span>
              <input 
                type="text"
                value={noteNo}
                onChange={e => setNoteNo(e.target.value)}
                placeholder="AUTO-GENERATED"
                className="classic-erp-input flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="classic-erp-label red-label w-20">Date:</span>
              <input 
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="classic-erp-input flex-1"
              />
            </div>
          </div>

          <div className="classic-erp-frame grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <span className="classic-erp-label red-label w-20">Amount:</span>
              <input 
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="classic-erp-input flex-1 text-right font-bold"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="classic-erp-label w-20">Invoice Ref:</span>
              <input 
                type="text"
                value={againstInvoiceNo}
                onChange={e => setAgainstInvoiceNo(e.target.value)}
                placeholder="INV-XXXX"
                className="classic-erp-input flex-1"
              />
            </div>
          </div>

          <div className="classic-erp-frame flex flex-col gap-1">
            <span className="classic-erp-label">Reason / Remarks:</span>
            <textarea 
              rows={3}
              className="classic-erp-textarea w-full"
              placeholder="ENTER REASON OR NARRATIVE DETAILS..."
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>

          <div className="classic-erp-form-footer pt-3 border-t border-[#808080]">
            <button 
              type="button" 
              onClick={onClose}
              className="classic-erp-btn"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="classic-erp-btn btn-blue"
            >
              {isSubmitting ? 'Posting...' : 'Commit Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NoteModal;
