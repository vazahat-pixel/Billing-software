import React, { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import { ERPInput, ERPSelect } from '../../components/forms/FormElements';
import { ERPSearchableSelect } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';

const OpeningBalanceModal = ({ isOpen, onClose, readOnly = false }) => {
  const { parties, fetchParties, updateParty } = useStore();
  const [partyId, setPartyId] = useState('');
  const [amount, setAmount] = useState('');
  const [balanceType, setBalanceType] = useState('Dr');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchParties();
      setPartyId('');
      setAmount('');
      setBalanceType('Dr');
    }
  }, [isOpen, fetchParties]);

  useEffect(() => {
    if (!partyId) return;
    const party = parties.find(p => (p._id || p.id) === partyId);
    if (party) {
      setAmount(String(party.openingBalance || 0));
      setBalanceType(party.openingBalanceType || 'Dr');
    }
  }, [partyId, parties]);

  const handleSave = async () => {
    if (!partyId) return alert('Select a party');
    if (!amount) return alert('Enter opening balance amount');
    setSaving(true);
    try {
      await updateParty(partyId, {
        openingBalance: Number(amount),
        openingBalanceType: balanceType
      });
      alert('Opening balance saved');
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Opening Balance Entry" className="max-w-lg">
      <div className="p-8 space-y-6">
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Party / Account</label>
          <ERPSearchableSelect
            className="w-full mt-1"
            value={partyId}
            onChange={setPartyId}
            options={parties.map(p => ({ value: p._id || p.id, label: p.name }))}
            label="Party"
            placeholder="Search party..."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Amount (₹)</label>
            <ERPInput className="w-full mt-1" type="number" value={amount} onChange={e => setAmount(e.target.value)} disabled={readOnly} />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Balance Type</label>
            <ERPSelect
              className="w-full mt-1"
              value={balanceType}
              onChange={e => setBalanceType(e.target.value)}
              disabled={readOnly}
              options={[{ value: 'Dr', label: 'Debit (Dr)' }, { value: 'Cr', label: 'Credit (Cr)' }]}
            />
          </div>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-black text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Opening Balance'}
          </button>
        )}
      </div>
    </Modal>
  );
};

export default OpeningBalanceModal;
