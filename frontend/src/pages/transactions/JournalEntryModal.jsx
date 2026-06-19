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
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
      <div className="classic-erp-window w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="classic-erp-header shrink-0">
          <span>Journal Entry (GST) [ DOUBLE ENTRY CHALLAN ]</span>
          <button className="classic-erp-close-btn" onClick={onClose}>X</button>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 border-b border-rose-200 px-3 py-1.5 text-red-800 font-bold text-xs font-mono">
            Error: {errorMsg}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#d4d0c8]">
          <div className="classic-erp-frame grid grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <span className="classic-erp-label red-label w-24">Entry Date:</span>
              <input 
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="classic-erp-input flex-1"
              />
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <span className="classic-erp-label w-24">Narration:</span>
              <input 
                type="text"
                value={narration}
                onChange={e => setNarration(e.target.value)}
                placeholder="Narrative explanation..."
                className="classic-erp-input flex-1"
              />
            </div>
          </div>

          {/* Add Line Form */}
          <div className="classic-erp-frame space-y-2">
            <div className="classic-erp-frame-title">Post Entry Line</div>
            <div className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-4 flex items-center gap-1">
                <span className="classic-erp-label red-label text-[10px]">Ledger:</span>
                <select 
                  value={selectedLedgerId}
                  onChange={e => setSelectedLedgerId(e.target.value)}
                  className="classic-erp-select flex-1"
                >
                  <option value="">- Select Ledger Account -</option>
                  {ledgers.map(l => (
                    <option key={l._id} value={l._id}>{l.name} ({l.group})</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 flex items-center gap-1">
                <span className="classic-erp-label red-label text-[10px]">Type:</span>
                <select 
                  value={type}
                  onChange={e => setType(e.target.value)}
                  className="classic-erp-select flex-1"
                >
                  <option value="Dr">Dr (Debit)</option>
                  <option value="Cr">Cr (Credit)</option>
                </select>
              </div>
              <div className="col-span-2 flex items-center gap-1">
                <span className="classic-erp-label red-label text-[10px]">Amt:</span>
                <input 
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="classic-erp-input flex-1 text-right font-bold"
                />
              </div>
              <div className="col-span-4 flex items-center gap-1">
                <span className="classic-erp-label text-[10px]">Remarks:</span>
                <input 
                  type="text"
                  placeholder="Line remarks..."
                  value={lineNarration}
                  onChange={e => setLineNarration(e.target.value)}
                  className="classic-erp-input flex-1"
                />
                <button 
                  type="button"
                  onClick={handleAddLine}
                  className="classic-erp-btn"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Grid list of posted lines */}
          <div className="classic-erp-table-container max-h-64">
            <table className="classic-erp-table">
              <thead>
                <tr>
                  <th>Ledger Account</th>
                  <th className="w-36 text-right">Debits (Dr)</th>
                  <th className="w-36 text-right">Credits (Cr)</th>
                  <th>Line Remarks</th>
                  <th className="w-16 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={index}>
                    <td className="font-bold uppercase text-blue-900">{line.ledgerName}</td>
                    <td className="text-right font-mono font-bold text-green-800">
                      {line.type === 'Dr' ? `₹${line.amount.toFixed(2)}` : ''}
                    </td>
                    <td className="text-right font-mono font-bold text-red-800">
                      {line.type === 'Cr' ? `₹${line.amount.toFixed(2)}` : ''}
                    </td>
                    <td className="text-slate-700 uppercase font-mono">{line.narration || '-'}</td>
                    <td className="text-center">
                      <button 
                        type="button" 
                        onClick={() => handleRemoveLine(index)}
                        className="text-red-700 hover:text-red-950 font-bold"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {lines.length === 0 && (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-500 font-bold uppercase">
                      No lines added yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="classic-erp-form-footer border-t border-[#808080] p-2 bg-[#d4d0c8] flex justify-between items-center shrink-0">
          <div className="flex gap-4 text-xs font-mono font-bold">
            <div>
              Total Dr: <span className="text-green-800">₹{totals.dr.toFixed(2)}</span>
            </div>
            <div>
              Total Cr: <span className="text-red-800">₹{totals.cr.toFixed(2)}</span>
            </div>
            <div>
              Diff: <span className={totals.diff > 0.01 ? 'text-red-700' : 'text-slate-600'}>₹{totals.diff.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              type="button" 
              onClick={onClose}
              className="classic-erp-btn"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button 
              type="button"
              onClick={handleSave}
              disabled={isSubmitting || totals.diff > 0.01}
              className="classic-erp-btn btn-blue"
            >
              {isSubmitting ? 'Posting...' : 'Post Journal'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default JournalEntryModal;
