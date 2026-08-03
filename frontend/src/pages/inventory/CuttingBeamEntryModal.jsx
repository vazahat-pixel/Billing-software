import React, { useState, useEffect, useMemo } from 'react';
import ErpWindowedModal from '../../components/erp/ErpWindowedModal';
import { ERPCombobox } from '../../components/erp';
import useStore from '../../store/useStore';
import { toast } from '../../store/useToastStore';
import { ErpBusyOverlay, SaveButtonLabel } from '../../components/ui/loaders';

const today = () => new Date().toISOString().split('T')[0];

/**
 * Cutting Entry / Beam Entry — basic record-keeping for both, opened via `mode` prop.
 * Cutting Entry deducts real stock from the source lot (real StockMovement posted).
 * Beam Entry is a pre-weaving log only — no yarn stock model exists in this system yet,
 * so it doesn't touch inventory; it's a plain record of what's been prepared.
 */
const CuttingBeamEntryModal = ({ isOpen, onClose, mode = 'cutting' }) => {
  const {
    inventoryLots, parties, items, fetchInventory, fetchParties, fetchItems,
    fetchCuttingEntries, addCuttingEntry, fetchBeamEntries, addBeamEntry,
  } = useStore();

  const [bootLoading, setBootLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [list, setList] = useState([]);

  // Cutting fields
  const [lotId, setLotId] = useState('');
  const [cutQty, setCutQty] = useState('');
  const [cutPieces, setCutPieces] = useState('');
  const [wastageQty, setWastageQty] = useState('');

  // Beam fields
  const [beamNo, setBeamNo] = useState('');
  const [itemId, setItemId] = useState('');
  const [yarnDetails, setYarnDetails] = useState('');
  const [quantityKg, setQuantityKg] = useState('');
  const [lengthMtrs, setLengthMtrs] = useState('');
  const [loomNo, setLoomNo] = useState('');
  const [partyId, setPartyId] = useState('');

  const [date, setDate] = useState(today());
  const [remark, setRemark] = useState('');

  const isCutting = mode === 'cutting';
  const title = isCutting ? 'Cutting Entry' : 'Beam Entry';

  const reload = async () => {
    setList(isCutting ? await fetchCuttingEntries() : await fetchBeamEntries());
  };

  useEffect(() => {
    if (!isOpen) return;
    setBootLoading(true);
    Promise.all([fetchInventory(), fetchParties(), fetchItems()])
      .then(reload)
      .finally(() => setBootLoading(false));
    setDate(today());
    setRemark('');
    setLotId(''); setCutQty(''); setCutPieces(''); setWastageQty('');
    setBeamNo(''); setItemId(''); setYarnDetails(''); setQuantityKg(''); setLengthMtrs(''); setLoomNo(''); setPartyId('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode]);

  const availableLots = useMemo(
    () => (inventoryLots || []).filter((l) => Number(l.remainingMtrs || 0) > 0 && l.status !== 'Closed'),
    [inventoryLots]
  );
  const lotOptions = useMemo(
    () => availableLots.map((l) => ({ value: l._id || l.id, label: `${l.lotId} · ${l.itemName || l.itemId?.name || 'Item'} · ${Number(l.remainingMtrs || 0).toFixed(2)}m` })),
    [availableLots]
  );
  const itemOptions = useMemo(() => (items || []).map((i) => ({ value: i._id || i.id, label: i.name })), [items]);
  const partyOptions = useMemo(() => (parties || []).map((p) => ({ value: p._id || p.id, label: p.name })), [parties]);
  const selectedLot = useMemo(() => availableLots.find((l) => String(l._id || l.id) === String(lotId)), [availableLots, lotId]);

  const handleSaveCutting = async () => {
    if (!lotId) return toast.error('Select a lot');
    const qty = Number(cutQty) || 0;
    if (qty <= 0) return toast.error('Enter Cut Qty');
    setSaving(true);
    try {
      await addCuttingEntry({
        lotId, date, cutQty: qty, cutPieces: Number(cutPieces) || 0, wastageQty: Number(wastageQty) || 0, remark,
      });
      toast.success('Cutting entry saved — stock updated');
      setLotId(''); setCutQty(''); setCutPieces(''); setWastageQty(''); setRemark('');
      await Promise.all([fetchInventory(), reload()]);
    } catch (err) {
      toast.error(err, { fallback: 'Failed to save cutting entry' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBeam = async () => {
    if (!quantityKg && !lengthMtrs) return toast.error('Enter quantity (Kg) or length (Mtrs)');
    setSaving(true);
    try {
      await addBeamEntry({
        beamNo: beamNo || undefined, date, itemId: itemId || undefined, yarnDetails,
        quantityKg: Number(quantityKg) || 0, lengthMtrs: Number(lengthMtrs) || 0,
        loomNo, partyId: partyId || undefined, remark,
      });
      toast.success('Beam entry saved');
      setBeamNo(''); setYarnDetails(''); setQuantityKg(''); setLengthMtrs(''); setLoomNo(''); setRemark('');
      await reload();
    } catch (err) {
      toast.error(err, { fallback: 'Failed to save beam entry' });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ErpWindowedModal isOpen={isOpen} onClose={onClose} title={title} windowId={`cuttingBeam-${mode}`} bare>
      {({ WindowControls }) => (
        <div className="classic-erp-window erp-density flex flex-col h-full min-h-0 !max-h-none">
          <ErpBusyOverlay show={bootLoading} message="Loading…" />
          <ErpBusyOverlay show={saving} message="Saving…" />
          <div className="classic-erp-header shrink-0">
            <span className="erp-window-title truncate">{title}</span>
            <WindowControls />
          </div>

          <div className="classic-erp-body flex-1 overflow-y-auto min-h-0 flex flex-col gap-2 p-2">
            {isCutting ? (
              <div className="classic-erp-frame flex flex-col gap-2 text-[11px]">
                <div className="classic-erp-field classic-erp-field--lg">
                  <span className="classic-erp-label red-label">Lot No:</span>
                  <ERPCombobox value={lotId} onChange={setLotId} options={lotOptions} placeholder="Select lot to cut…" recentKey="cutting-lot" />
                </div>
                {selectedLot && <div className="text-slate-500">Available: {Number(selectedLot.remainingMtrs || 0).toFixed(2)}m / {selectedLot.remainingPcs || 0}pcs</div>}
                <div className="flex flex-wrap gap-3">
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">Date:</span>
                    <input type="date" className="classic-erp-input" value={date} onChange={(e) => setDate(e.target.value)} />
                  </div>
                  <div className="classic-erp-field">
                    <span className="classic-erp-label red-label">Cut Qty (m):</span>
                    <input type="number" className="classic-erp-input w-24 text-right" value={cutQty} onChange={(e) => setCutQty(e.target.value)} />
                  </div>
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">Cut Pieces:</span>
                    <input type="number" className="classic-erp-input w-20 text-right" value={cutPieces} onChange={(e) => setCutPieces(e.target.value)} />
                  </div>
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">Wastage (m):</span>
                    <input type="number" className="classic-erp-input w-20 text-right" value={wastageQty} onChange={(e) => setWastageQty(e.target.value)} />
                  </div>
                </div>
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Remark:</span>
                  <input type="text" className="classic-erp-input flex-1" value={remark} onChange={(e) => setRemark(e.target.value)} />
                </div>
                <button type="button" className="classic-erp-btn btn-blue w-fit" onClick={handleSaveCutting} disabled={saving}>
                  <SaveButtonLabel saving={saving} label="Save Cutting Entry" />
                </button>
              </div>
            ) : (
              <div className="classic-erp-frame flex flex-col gap-2 text-[11px]">
                <div className="flex flex-wrap gap-3">
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">Beam No:</span>
                    <input type="text" className="classic-erp-input w-32" value={beamNo} onChange={(e) => setBeamNo(e.target.value)} placeholder="AUTO" />
                  </div>
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">Date:</span>
                    <input type="date" className="classic-erp-input" value={date} onChange={(e) => setDate(e.target.value)} />
                  </div>
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">Loom No:</span>
                    <input type="text" className="classic-erp-input w-24" value={loomNo} onChange={(e) => setLoomNo(e.target.value)} />
                  </div>
                </div>
                <div className="classic-erp-field classic-erp-field--lg">
                  <span className="classic-erp-label">Yarn Item:</span>
                  <ERPCombobox value={itemId} onChange={setItemId} options={itemOptions} placeholder="Select yarn/item…" recentKey="beam-item" allowClear />
                </div>
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Yarn Details:</span>
                  <input type="text" className="classic-erp-input flex-1" value={yarnDetails} onChange={(e) => setYarnDetails(e.target.value)} placeholder="e.g. 40s Cotton" />
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">Qty (Kg):</span>
                    <input type="number" className="classic-erp-input w-24 text-right" value={quantityKg} onChange={(e) => setQuantityKg(e.target.value)} />
                  </div>
                  <div className="classic-erp-field">
                    <span className="classic-erp-label">Length (Mtrs):</span>
                    <input type="number" className="classic-erp-input w-24 text-right" value={lengthMtrs} onChange={(e) => setLengthMtrs(e.target.value)} />
                  </div>
                </div>
                <div className="classic-erp-field classic-erp-field--lg">
                  <span className="classic-erp-label">Party:</span>
                  <ERPCombobox value={partyId} onChange={setPartyId} options={partyOptions} placeholder="Weaver / party (optional)…" recentKey="beam-party" allowClear />
                </div>
                <div className="classic-erp-field">
                  <span className="classic-erp-label">Remark:</span>
                  <input type="text" className="classic-erp-input flex-1" value={remark} onChange={(e) => setRemark(e.target.value)} />
                </div>
                <button type="button" className="classic-erp-btn btn-blue w-fit" onClick={handleSaveBeam} disabled={saving}>
                  <SaveButtonLabel saving={saving} label="Save Beam Entry" />
                </button>
              </div>
            )}

            <div className="classic-erp-frame flex flex-col gap-1 text-[11px] flex-1 min-h-0">
              <div className="font-bold">Recent {title} Records ({list.length})</div>
              <div className="overflow-auto max-h-64 border border-slate-300 rounded">
                <table className="w-full border-collapse">
                  <thead className="bg-slate-200 sticky top-0">
                    {isCutting ? (
                      <tr><th className="border px-1 py-1 text-left">Entry No</th><th className="border px-1 py-1 text-left">Date</th><th className="border px-1 py-1 text-left">Lot</th><th className="border px-1 py-1 text-right">Cut Qty</th><th className="border px-1 py-1 text-right">Pieces</th><th className="border px-1 py-1 text-right">Wastage</th></tr>
                    ) : (
                      <tr><th className="border px-1 py-1 text-left">Beam No</th><th className="border px-1 py-1 text-left">Date</th><th className="border px-1 py-1 text-left">Item</th><th className="border px-1 py-1 text-right">Kg</th><th className="border px-1 py-1 text-right">Mtrs</th><th className="border px-1 py-1 text-left">Loom</th></tr>
                    )}
                  </thead>
                  <tbody>
                    {list.map((r) => isCutting ? (
                      <tr key={r._id}>
                        <td className="border px-1 py-0.5 font-bold">{r.entryNo}</td>
                        <td className="border px-1 py-0.5">{new Date(r.date).toLocaleDateString('en-IN')}</td>
                        <td className="border px-1 py-0.5">{r.lotCode}</td>
                        <td className="border px-1 py-0.5 text-right font-mono">{r.cutQty}</td>
                        <td className="border px-1 py-0.5 text-right font-mono">{r.cutPieces}</td>
                        <td className="border px-1 py-0.5 text-right font-mono">{r.wastageQty}</td>
                      </tr>
                    ) : (
                      <tr key={r._id}>
                        <td className="border px-1 py-0.5 font-bold">{r.beamNo}</td>
                        <td className="border px-1 py-0.5">{new Date(r.date).toLocaleDateString('en-IN')}</td>
                        <td className="border px-1 py-0.5">{r.itemId?.name || ''}</td>
                        <td className="border px-1 py-0.5 text-right font-mono">{r.quantityKg}</td>
                        <td className="border px-1 py-0.5 text-right font-mono">{r.lengthMtrs}</td>
                        <td className="border px-1 py-0.5">{r.loomNo}</td>
                      </tr>
                    ))}
                    {list.length === 0 && <tr><td colSpan={6} className="text-center py-3 text-slate-400">No records yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="classic-erp-form-footer flex-wrap">
            <button type="button" className="classic-erp-btn" onClick={onClose}>Exit</button>
          </div>
        </div>
      )}
    </ErpWindowedModal>
  );
};

export default CuttingBeamEntryModal;
