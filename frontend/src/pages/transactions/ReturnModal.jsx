import React, { useState, useEffect, useMemo } from 'react';
import useStore from '../../store/useStore';
import { ERPInput, ERPSelect } from '../../components/forms/FormElements';
import { X, Save, Plus, Trash } from 'lucide-react';

const ReturnModal = ({ isOpen, onClose, initialType = 'Sales' }) => {
  const { parties, items, inventoryLots, addReturn, fetchParties, fetchItems, fetchInventory } = useStore();
  const [type, setType] = useState(initialType);
  const [partyId, setPartyId] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [originalInvoiceNo, setOriginalInvoiceNo] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnItems, setReturnItems] = useState([]);
  
  // Row Input State
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedLotId, setSelectedLotId] = useState('');
  const [pcs, setPcs] = useState('');
  const [mts, setMts] = useState('');
  const [rate, setRate] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setType(initialType);
      fetchParties();
      fetchItems();
      fetchInventory?.();
      setPartyId('');
      setInvoiceNo('');
      setOriginalInvoiceNo('');
      setDate(new Date().toISOString().split('T')[0]);
      setReturnItems([]);
      setSelectedItemId('');
      setSelectedLotId('');
      setPcs('');
      setMts('');
      setRate('');
      setErrorMsg('');
    }
  }, [isOpen, initialType]);

  const selectedItemObj = useMemo(() => {
    return items.find(i => i._id === selectedItemId);
  }, [items, selectedItemId]);

  const openLotsForItem = useMemo(() => {
    if (!selectedItemId) return [];
    return (inventoryLots || []).filter((lot) => {
      const lid = lot.itemId?._id || lot.itemId || '';
      if (String(lid) !== String(selectedItemId)) return false;
      const st = String(lot.status || 'Available').toLowerCase();
      if (st === 'closed' || st === 'exhausted') return false;
      return Number(lot.remainingMtrs ?? lot.mts ?? 0) > 0;
    });
  }, [inventoryLots, selectedItemId]);

  const handleAddItem = () => {
    if (!selectedItemId) return;
    if (type === 'Purchase' && !selectedLotId) {
      setErrorMsg('Purchase Return requires a Stock Lot on every line');
      return;
    }
    const numPcs = parseFloat(pcs) || 0;
    const numMts = parseFloat(mts) || 0;
    const numRate = parseFloat(rate) || parseFloat(selectedItemObj?.salesRate) || 0;
    const lot = openLotsForItem.find((l) => String(l._id || l.id) === String(selectedLotId));

    const amount = numMts > 0 ? (numMts * numRate) : (numPcs * numRate);

    setReturnItems(prev => [
      ...prev,
      {
        itemId: selectedItemId,
        lotId: selectedLotId || null,
        lotLabel: lot ? (lot.lotId || String(lot._id).slice(-6)) : '',
        name: selectedItemObj?.name,
        pcs: numPcs,
        mts: numMts,
        rate: numRate,
        amount
      }
    ]);

    setSelectedItemId('');
    setSelectedLotId('');
    setPcs('');
    setMts('');
    setRate('');
    setErrorMsg('');
  };

  const handleRemoveItem = (index) => {
    setReturnItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const taxableAmount = useMemo(() => {
    return returnItems.reduce((sum, item) => sum + item.amount, 0);
  }, [returnItems]);

  // Standard textile rate is 5% GST (or 12%). We default to 5% and let the UI show it clearly
  const gstAmount = useMemo(() => {
    return taxableAmount * 0.05;
  }, [taxableAmount]);

  const netAmount = useMemo(() => {
    return taxableAmount + gstAmount;
  }, [taxableAmount, gstAmount]);

  const handleSave = async () => {
    setErrorMsg('');
    if (!partyId) {
      setErrorMsg('Please select a party');
      return;
    }
    if (returnItems.length === 0) {
      setErrorMsg('Please add at least one item');
      return;
    }
    if (type === 'Purchase' && returnItems.some((i) => !i.lotId)) {
      setErrorMsg('Purchase Return: every line must have a Stock Lot');
      return;
    }

    setIsSubmitting(true);
    try {
      await addReturn({
        returnType: type,
        invoiceNo: invoiceNo || undefined,
        originalInvoiceNo,
        partyId,
        date,
        items: returnItems.map(item => ({
          itemId: item.itemId,
          lotId: item.lotId || null,
          pcs: item.pcs,
          mts: item.mts,
          rate: item.rate,
          amount: item.amount
        })),
        taxableAmount,
        gstAmount,
        netAmount
      });
      onClose();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to save return invoice');
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
              <Plus size={20} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-black tracking-tight italic">{type} Return Registry<span className="text-slate-200">.</span></h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Return Invoicing Flow</p>
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
          {/* Top Info Bar */}
          <div className="grid grid-cols-5 gap-6">
            <div className="space-y-2 col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selected Counterparty</label>
              <ERPSelect 
                value={partyId}
                onChange={e => setPartyId(e.target.value)}
                options={parties.map(p => ({ value: p._id, label: `${p.name} (${p.type})` }))}
                className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]"
                label="Party"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Return Slip No</label>
              <ERPInput 
                value={invoiceNo}
                onChange={e => setInvoiceNo(e.target.value)}
                placeholder="AUTO-GENERATED"
                className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ref. Original Invoice</label>
              <ERPInput 
                value={originalInvoiceNo}
                onChange={e => setOriginalInvoiceNo(e.target.value)}
                placeholder="INV-0001"
                className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Return Date</label>
              <ERPInput 
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]"
              />
            </div>
          </div>

          <div className="h-[1px] bg-slate-100" />

          {/* Add Item Form Grid */}
          <div className="space-y-4">
            <h3 className="text-[11px] font-bold text-black uppercase tracking-widest">Add Item Rows</h3>
            <div className="grid grid-cols-6 gap-4 items-end">
              <div className="space-y-2 col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Item Selector</label>
                <ERPSelect 
                  value={selectedItemId}
                  onChange={e => { setSelectedItemId(e.target.value); setSelectedLotId(''); }}
                  options={items.map(i => ({ value: i._id, label: `${i.name} (${i.category})` }))}
                  className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]"
                  label="Item"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Lot {type === 'Purchase' ? '*' : '(opt)'}
                </label>
                <ERPSelect
                  value={selectedLotId}
                  onChange={e => setSelectedLotId(e.target.value)}
                  options={[
                    { value: '', label: type === 'Purchase' ? '— Select Lot —' : 'New return lot' },
                    ...openLotsForItem.map((l) => ({
                      value: l._id || l.id,
                      label: `${l.lotId || String(l._id).slice(-6)} · ${Number(l.remainingMtrs ?? 0).toFixed(2)} m`,
                    })),
                  ]}
                  className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]"
                  label="Lot"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pieces (Pcs)</label>
                <ERPInput 
                  type="number"
                  placeholder="0"
                  value={pcs}
                  onChange={e => setPcs(e.target.value)}
                  className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Meters (Mts)</label>
                <ERPInput 
                  type="number"
                  placeholder="0.00"
                  value={mts}
                  onChange={e => setMts(e.target.value)}
                  className="w-full h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rate (₹)</label>
                <div className="flex gap-2">
                  <ERPInput 
                    type="number"
                    placeholder={selectedItemObj ? (selectedItemObj.salesRate || selectedItemObj.purchaseRate) : "0.00"}
                    value={rate}
                    onChange={e => setRate(e.target.value)}
                    className="flex-1 h-12 bg-slate-50 border-none rounded-xl font-bold uppercase text-[10px]"
                  />
                  <button 
                    type="button"
                    onClick={handleAddItem}
                    className="h-12 w-12 bg-black text-white hover:bg-slate-800 transition-all rounded-xl flex items-center justify-center shadow-lg"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Grid of added items */}
          <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-white">
                  <th className="px-8 py-4">Item Name</th>
                  <th className="px-8 py-4">Lot</th>
                  <th className="px-8 py-4 text-center">Pieces</th>
                  <th className="px-8 py-4 text-center">Meters</th>
                  <th className="px-8 py-4 text-right">Rate</th>
                  <th className="px-8 py-4 text-right">Total Amount</th>
                  <th className="px-8 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {returnItems.map((item, index) => (
                  <tr key={index} className="hover:bg-slate-50/50 transition-all">
                    <td className="px-8 py-4 font-bold text-black uppercase tracking-wider text-[10px]">{item.name}</td>
                    <td className="px-8 py-4 font-bold text-slate-600 text-[10px]">{item.lotLabel || '—'}</td>
                    <td className="px-8 py-4 text-center font-bold text-slate-600 text-[10px]">{item.pcs || '-'}</td>
                    <td className="px-8 py-4 text-center font-bold text-slate-600 text-[10px]">{item.mts ? `${item.mts.toFixed(2)} M` : '-'}</td>
                    <td className="px-8 py-4 text-right font-bold text-black text-[10px]">₹ {item.rate.toFixed(2)}</td>
                    <td className="px-8 py-4 text-right font-black text-black text-[10px]">₹ {item.amount.toFixed(2)}</td>
                    <td className="px-8 py-4 text-right">
                      <button 
                        type="button" 
                        onClick={() => handleRemoveItem(index)}
                        className="text-slate-300 hover:text-rose-500 transition-all p-1"
                      >
                        <Trash size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {returnItems.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-8 py-10 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white">
                      Grid is empty. Add rows above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-10 py-6 bg-white border-t border-slate-100 flex justify-between items-center shrink-0 animate-fadeIn">
          <div className="flex gap-10">
            <div className="text-right">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Taxable Subtotal</span>
              <span className="text-lg font-black text-slate-600">₹ {taxableAmount.toFixed(2)}</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">GST (5%)</span>
              <span className="text-lg font-black text-slate-600">₹ {gstAmount.toFixed(2)}</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Aggregate Net Total</span>
              <span className="text-2xl font-black text-black">₹ {netAmount.toFixed(2)}</span>
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
              disabled={isSubmitting}
              className="px-10 py-3.5 bg-black text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-3 shadow-lg disabled:opacity-50"
            >
              <Save size={16} /> {isSubmitting ? 'Posting...' : 'Commit Return'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ReturnModal;
