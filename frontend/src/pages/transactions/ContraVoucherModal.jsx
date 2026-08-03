import React, { useState, useEffect, useMemo } from 'react';
import useStore from '../../store/useStore';
import { ERPSelect } from '../../components/forms/FormElements';
import { toast } from '../../store/useToastStore';
import { ErpBusyOverlay, SaveButtonLabel } from '../../components/ui/loaders';

const todayISO = () => new Date().toISOString().split('T')[0];

/**
 * Voucher Entry — Contra: transfer between two Cash/Bank ledgers
 * (e.g. Cash deposited into Bank, Bank-to-Bank transfer). Not a party transaction.
 */
const ContraVoucherModal = ({ isOpen, onClose }) => {
  const { ledgers, fetchLedgers, postContra } = useStore();

  const [date, setDate] = useState(todayISO());
  const [fromLedgerId, setFromLedgerId] = useState('');
  const [toLedgerId, setToLedgerId] = useState('');
  const [amount, setAmount] = useState('');
  const [narration, setNarration] = useState('');
  const [saving, setSaving] = useState(false);
  const [bootLoading, setBootLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setBootLoading(true);
    fetchLedgers().finally(() => setBootLoading(false));
    setDate(todayISO());
    setFromLedgerId('');
    setToLedgerId('');
    setAmount('');
    setNarration('');
  }, [isOpen, fetchLedgers]);

  const cashBankLedgers = useMemo(() => {
    const list = (ledgers || []).filter((l) => {
      const n = (l.name || '').toLowerCase();
      const g = (l.group || l.accountType || l.subGroup || '').toLowerCase();
      return n.includes('cash') || n.includes('bank') || g.includes('cash') || g.includes('bank');
    });
    return list.length ? list : ledgers || [];
  }, [ledgers]);

  const ledgerOptions = useMemo(
    () => cashBankLedgers.map((l) => ({ value: l._id || l.id, label: l.name })),
    [cashBankLedgers]
  );

  const handleSave = async (e) => {
    e.preventDefault();
    if (!fromLedgerId || !toLedgerId) {
      toast.error('Select both From and To ledgers');
      return;
    }
    if (fromLedgerId === toLedgerId) {
      toast.error('From and To ledgers must be different');
      return;
    }
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    setSaving(true);
    try {
      await postContra({ fromLedgerId, toLedgerId, amount: amt, entryDate: date, narration });
      toast.success('Contra voucher posted');
      setFromLedgerId('');
      setToLedgerId('');
      setAmount('');
      setNarration('');
    } catch (err) {
      toast.error(err, { fallback: 'Failed to post contra voucher' });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
      <div className="classic-erp-window w-full max-w-lg flex flex-col overflow-hidden relative">
        <ErpBusyOverlay show={bootLoading} message="Loading ledgers…" />
        <ErpBusyOverlay show={!bootLoading && saving} message="Posting contra voucher…" />

        <div className="classic-erp-header shrink-0">
          <span>Voucher Entry [ CONTRA ]</span>
          <button className="classic-erp-close-btn" onClick={onClose}>X</button>
        </div>

        <form onSubmit={handleSave} className="p-3 space-y-3 bg-[#d4d0c8] flex-1">
          <div className="classic-erp-frame flex items-center gap-2">
            <span className="classic-erp-label red-label w-20">Date:</span>
            <input
              type="date"
              className="classic-erp-input flex-1"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="classic-erp-frame flex items-center gap-2">
            <span className="classic-erp-label red-label w-20">From:</span>
            <ERPSelect
              className="classic-erp-select flex-1"
              value={fromLedgerId}
              onChange={(e) => setFromLedgerId(e.target.value)}
              options={ledgerOptions}
              placeholder="- Select source Cash/Bank ledger -"
              recentKey="contra-from"
            />
          </div>

          <div className="classic-erp-frame flex items-center gap-2">
            <span className="classic-erp-label red-label w-20">To:</span>
            <ERPSelect
              className="classic-erp-select flex-1"
              value={toLedgerId}
              onChange={(e) => setToLedgerId(e.target.value)}
              options={ledgerOptions}
              placeholder="- Select destination Cash/Bank ledger -"
              recentKey="contra-to"
            />
          </div>

          <div className="classic-erp-frame flex items-center gap-2">
            <span className="classic-erp-label red-label w-20">Amount:</span>
            <input
              type="number"
              step="0.01"
              className="classic-erp-input flex-1 text-right font-bold"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          <div className="classic-erp-frame flex flex-col gap-1">
            <span className="classic-erp-label">Narration:</span>
            <textarea
              rows={2}
              className="classic-erp-textarea w-full"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="e.g. Cash deposited into HDFC Bank"
            />
          </div>

          <div className="classic-erp-form-footer pt-3 border-t border-[#808080]">
            <button type="button" onClick={onClose} className="classic-erp-btn" disabled={saving}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="classic-erp-btn btn-blue">
              <SaveButtonLabel saving={saving} label="Post" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ContraVoucherModal;
