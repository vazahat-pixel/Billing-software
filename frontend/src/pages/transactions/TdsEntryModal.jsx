import React, { useState, useEffect, useMemo } from 'react';
import useStore from '../../store/useStore';
import { ERPSelect } from '../../components/forms/FormElements';
import { toast } from '../../store/useToastStore';
import { ErpBusyOverlay, SaveButtonLabel } from '../../components/ui/loaders';

const todayISO = () => new Date().toISOString().split('T')[0];

/** Tds Entry — deduct TDS on a payment to a contractor/professional/landlord etc. (sections 194C/H/J/Q/A/I). */
const TdsEntryModal = ({ isOpen, onClose }) => {
  const { parties, fetchParties, fetchTdsSections, postTds } = useStore();

  const [sections, setSections] = useState({});
  const [section, setSection] = useState('194C');
  const [partyId, setPartyId] = useState('');
  const [pan, setPan] = useState('');
  const [taxableAmount, setTaxableAmount] = useState('');
  const [rate, setRate] = useState('');
  const [date, setDate] = useState(todayISO());
  const [refNo, setRefNo] = useState('');
  const [narration, setNarration] = useState('');
  const [saving, setSaving] = useState(false);
  const [bootLoading, setBootLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setBootLoading(true);
    Promise.all([fetchParties(), fetchTdsSections()])
      .then(([, secRes]) => setSections(secRes?.tds || {}))
      .finally(() => setBootLoading(false));
    setSection('194C');
    setPartyId('');
    setPan('');
    setTaxableAmount('');
    setRate('');
    setDate(todayISO());
    setRefNo('');
    setNarration('');
  }, [isOpen, fetchParties, fetchTdsSections]);

  const partyOptions = useMemo(
    () => (parties || []).map((p) => ({ value: p._id || p.id, label: p.name })),
    [parties]
  );

  const sectionOptions = useMemo(
    () => Object.entries(sections).map(([code, meta]) => ({
      value: code,
      label: `${code} — ${meta.name} (${meta.defaultRate}%)`,
    })),
    [sections]
  );

  const selectedParty = useMemo(
    () => (parties || []).find((p) => String(p._id || p.id) === String(partyId)),
    [parties, partyId]
  );

  useEffect(() => {
    if (selectedParty) setPan(selectedParty.pan || '');
  }, [selectedParty]);

  const effectiveRate = useMemo(() => {
    if (rate !== '') return Number(rate);
    const meta = sections[section];
    if (!meta) return 0;
    // Higher rate without a valid 10-char PAN — mirrors backend computeTds exactly.
    return pan && String(pan).length === 10 ? meta.defaultRate : Math.max(meta.defaultRate, 20);
  }, [rate, section, sections, pan]);

  const tdsPreview = useMemo(
    () => Number(((Number(taxableAmount) || 0) * effectiveRate) / 100).toFixed(2),
    [taxableAmount, effectiveRate]
  );

  const handleSave = async (e) => {
    e.preventDefault();
    if (!partyId) return toast.error('Select party');
    const amt = Number(taxableAmount);
    if (!amt || amt <= 0) return toast.error('Enter a valid taxable amount');

    setSaving(true);
    try {
      await postTds({
        partyId,
        section,
        taxableAmount: amt,
        pan: pan || undefined,
        rate: rate !== '' ? Number(rate) : undefined,
        transactionDate: date,
        refNo,
        narration,
      });
      toast.success(`TDS ₹${tdsPreview} deducted u/s ${section}`);
      setTaxableAmount('');
      setRefNo('');
      setNarration('');
    } catch (err) {
      toast.error(err, { fallback: 'Failed to post TDS entry' });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
      <div className="classic-erp-window w-full max-w-xl flex flex-col overflow-hidden relative">
        <ErpBusyOverlay show={bootLoading} message="Loading…" />
        <ErpBusyOverlay show={!bootLoading && saving} message="Posting TDS…" />

        <div className="classic-erp-header shrink-0">
          <span>Tds Entry [ TAX DEDUCTED AT SOURCE ]</span>
          <button className="classic-erp-close-btn" onClick={onClose}>X</button>
        </div>

        <form onSubmit={handleSave} className="p-3 space-y-3 bg-[#d4d0c8] flex-1">
          <div className="classic-erp-frame flex items-center gap-2">
            <span className="classic-erp-label red-label w-24">Party:</span>
            <ERPSelect
              className="classic-erp-select flex-1"
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
              options={partyOptions}
              placeholder="- Select Party -"
              recentKey="tds-party"
            />
          </div>

          <div className="classic-erp-frame grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <span className="classic-erp-label red-label w-20">Section:</span>
              <ERPSelect
                className="classic-erp-select flex-1"
                value={section}
                onChange={(e) => { setSection(e.target.value); setRate(''); }}
                options={sectionOptions}
                placeholder="- Select Section -"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="classic-erp-label w-20">Date:</span>
              <input type="date" className="classic-erp-input flex-1" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>

          <div className="classic-erp-frame grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <span className="classic-erp-label red-label w-20">Taxable Amt:</span>
              <input
                type="number"
                className="classic-erp-input flex-1 text-right font-bold"
                value={taxableAmount}
                onChange={(e) => setTaxableAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="classic-erp-label w-20">PAN:</span>
              <input
                type="text"
                className="classic-erp-input flex-1 uppercase font-mono"
                value={pan}
                onChange={(e) => setPan(e.target.value.toUpperCase())}
                placeholder="ABCDE1234F"
                maxLength={10}
                title="Without a valid 10-char PAN, higher TDS rate (20%) applies automatically"
              />
            </div>
          </div>

          <div className="classic-erp-frame grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <span className="classic-erp-label w-20">Rate %:</span>
              <input
                type="number"
                step="0.01"
                className="classic-erp-input flex-1 text-right"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder={String(effectiveRate)}
                title="Leave blank to use the section default (or 20% if PAN missing)"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="classic-erp-label w-20">Ref No:</span>
              <input type="text" className="classic-erp-input flex-1" value={refNo} onChange={(e) => setRefNo(e.target.value)} placeholder="Bill/Voucher No" />
            </div>
          </div>

          {Number(taxableAmount) > 0 && (
            <div className="classic-erp-frame text-[11px] font-mono bg-slate-50">
              TDS @ {effectiveRate}% on ₹{Number(taxableAmount).toFixed(2)} = <b>₹{tdsPreview}</b>
              {pan.length !== 10 && <span className="text-red-600 ml-2">(no valid PAN — higher rate applied)</span>}
            </div>
          )}

          <div className="classic-erp-frame flex flex-col gap-1">
            <span className="classic-erp-label">Narration:</span>
            <textarea
              rows={2}
              className="classic-erp-textarea w-full"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="Optional remarks…"
            />
          </div>

          <div className="classic-erp-form-footer pt-3 border-t border-[#808080]">
            <button type="button" onClick={onClose} className="classic-erp-btn" disabled={saving}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="classic-erp-btn btn-blue">
              <SaveButtonLabel saving={saving} label="Post TDS" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TdsEntryModal;
