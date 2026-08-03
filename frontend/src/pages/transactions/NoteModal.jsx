import React, { useState, useEffect, useMemo } from 'react';
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
  const [gstRate, setGstRate] = useState(0);
  const [gstType, setGstType] = useState('CGST+SGST');
  const [againstInvoiceNo, setAgainstInvoiceNo] = useState('');
  const [reason, setReason] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const partyOptions = useMemo(
    () => parties.map((p) => ({ value: p._id, label: `${p.name} (${p.type})` })),
    [parties]
  );

  // Mirrors backend noteController.createNote exactly: Amount is Gross (GST-inclusive)
  // when a rate is set, and the backend back-calculates Taxable from it.
  const gstPreview = useMemo(() => {
    const gross = parseFloat(amount) || 0;
    const rate = Number(gstRate) || 0;
    const taxable = rate > 0 ? gross / (1 + rate / 100) : gross;
    const gstAmt = gross - taxable;
    return {
      taxable: Number(taxable.toFixed(2)),
      gstAmt: Number(gstAmt.toFixed(2)),
      cgst: gstType === 'IGST' ? 0 : Number((gstAmt / 2).toFixed(2)),
      sgst: gstType === 'IGST' ? 0 : Number((gstAmt / 2).toFixed(2)),
      igst: gstType === 'IGST' ? Number(gstAmt.toFixed(2)) : 0,
    };
  }, [amount, gstRate, gstType]);

  useEffect(() => {
    if (isOpen) {
      setType(initialType);
      fetchParties();
      setPartyId('');
      setNoteNo('');
      setDate(new Date().toISOString().split('T')[0]);
      setAmount('');
      setGstRate(0);
      setGstType('CGST+SGST');
      setAgainstInvoiceNo('');
      setReason('');
      setErrorMsg('');
    }
  }, [isOpen, initialType, fetchParties]);

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
        gstRate: Number(gstRate) || 0,
        gstType,
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
            <ERPSelect
              className="classic-erp-select flex-1"
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
              options={partyOptions}
              placeholder="- Select Party / Account -"
              recentKey="note-party"
            />
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
                title="Gross amount — GST-inclusive if a GST% is set below"
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

          <div className="classic-erp-frame grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <span className="classic-erp-label w-20">GST%:</span>
              <input
                type="number"
                step="0.01"
                value={gstRate || ''}
                onChange={e => setGstRate(e.target.value)}
                placeholder="0"
                className="classic-erp-input flex-1 text-right"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="classic-erp-label w-20">GST Type:</span>
              <select
                className="classic-erp-select flex-1"
                value={gstType}
                onChange={e => setGstType(e.target.value)}
                disabled={!gstRate}
              >
                <option value="CGST+SGST">CGST+SGST</option>
                <option value="IGST">IGST</option>
              </select>
            </div>
          </div>

          {Number(gstRate) > 0 && amount > 0 && (
            <div className="classic-erp-frame text-[11px] font-mono flex flex-wrap gap-x-4 gap-y-1 bg-slate-50">
              <span>Taxable: <b>₹{gstPreview.taxable.toFixed(2)}</b></span>
              {gstType === 'IGST' ? (
                <span>IGST: <b>₹{gstPreview.igst.toFixed(2)}</b></span>
              ) : (
                <>
                  <span>CGST: <b>₹{gstPreview.cgst.toFixed(2)}</b></span>
                  <span>SGST: <b>₹{gstPreview.sgst.toFixed(2)}</b></span>
                </>
              )}
            </div>
          )}

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
