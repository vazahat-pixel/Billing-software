import React, { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import { ERPInput } from '../../components/forms/FormElements';
import { ERPSearchableSelect } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';

const OpeningStockModal = ({ isOpen, onClose, readOnly = false }) => {
  const { items, fetchItems, createOpeningStock } = useStore();
  const [itemId, setItemId] = useState('');
  const [pcs, setPcs] = useState('0');
  const [mts, setMts] = useState('');
  const [remarks, setRemarks] = useState('Opening stock entry');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchItems();
      setItemId('');
      setPcs('0');
      setMts('');
      setRemarks('Opening stock entry');
    }
  }, [isOpen, fetchItems]);

  const handleSave = async () => {
    if (!itemId) return alert('Select an item');
    if (!mts || Number(mts) <= 0) return alert('Enter quantity in meters');
    setSaving(true);
    try {
      await createOpeningStock({
        itemId,
        pcs: Number(pcs || 0),
        mts: Number(mts),
        remarks
      });
      alert('Opening stock lot created');
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Opening Stock Entry" className="max-w-lg">
      <div className="p-8 space-y-6">
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Item</label>
          <ERPSearchableSelect
            className="w-full mt-1"
            value={itemId}
            onChange={setItemId}
            options={items.map(i => ({ value: i._id || i.id, label: i.itemName || i.name }))}
            label="Item"
            placeholder="Search item..."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pieces</label>
            <ERPInput className="w-full mt-1" type="number" value={pcs} onChange={e => setPcs(e.target.value)} disabled={readOnly} />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Meters (Mts)</label>
            <ERPInput className="w-full mt-1" type="number" value={mts} onChange={e => setMts(e.target.value)} disabled={readOnly} />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Remarks</label>
          <ERPInput className="w-full mt-1" value={remarks} onChange={e => setRemarks(e.target.value)} disabled={readOnly} />
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-black text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Opening Stock Lot'}
          </button>
        )}
      </div>
    </Modal>
  );
};

export default OpeningStockModal;
