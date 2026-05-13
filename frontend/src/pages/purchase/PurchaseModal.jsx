import React, { useState, useMemo, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import { FormField, ERPInput, ERPSelect, ERPButton, ERPSearchableSelect } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';
import AccountMasterModal from '../masters/AccountMasterModal';
import ItemMasterModal from '../masters/ItemMasterModal';
import { Trash2, Plus, Calculator, Truck, FileText, XCircle, Save, Printer, Search } from 'lucide-react';

const PurchaseModal = ({ isOpen, onClose, selectedBook = null }) => {
  const { parties, items, addPurchase } = useStore();
  
  const [activeTab, setActiveTab] = useState('Purchase Invoice');
  const [header, setHeader] = useState({
    party: '',
    add: '',
    broker: '',
    book: 'FINISH PURCHASE',
    gstin: '',
    city: '',
    vNo: '1',
    billNo: '',
    billDate: new Date().toISOString().split('T')[0],
    challanNo: '',
    chDate: new Date().toISOString().split('T')[0],
    gstType: 'GST 5%',
  });

  useEffect(() => {
    if (isOpen && selectedBook) {
      setHeader(prev => ({ ...prev, book: selectedBook }));
    }
  }, [isOpen, selectedBook]);

  const [gridItems, setGridItems] = useState([
    { id: 1, itemId: '', itemName: '', hsnCode: '', fold: '0.00', unit: 'MTRS', pcs: 0, cut: 0, mts: 0, rate: 0, amount: 0 }
  ]);

  const [inlineModal, setInlineModal] = useState({
    type: null, // 'account' or 'item'
    initialData: null,
    rowIndex: null
  });

  const calculations = useMemo(() => {
    const gross = gridItems.reduce((acc, item) => acc + (parseFloat(item.mts || 0) * parseFloat(item.rate || 0)), 0);
    const tax = gross * 0.05;
    const net = gross + tax;
    return { gross, tax, net };
  }, [gridItems]);

  const handleCreateAccount = (search) => {
    setInlineModal({ type: 'account', initialData: { name: search } });
  };

  const handleCreateItem = (search, index) => {
    setInlineModal({ type: 'item', initialData: { itemName: search }, rowIndex: index });
  };

  const handleAccountSuccess = (newAccount) => {
    setHeader(prev => ({ 
      ...prev, 
      party: newAccount._id || newAccount.id,
      add: newAccount.address || '',
      gstin: newAccount.gstin || '',
      city: newAccount.station || ''
    }));
  };

  const handleItemSuccess = (newItem) => {
    const updatedGrid = [...gridItems];
    updatedGrid[inlineModal.rowIndex] = { 
      ...updatedGrid[inlineModal.rowIndex], 
      itemId: newItem._id || newItem.id,
      itemName: newItem.itemName,
      unit: newItem.unit,
      rate: newItem.purRate
    };
    setGridItems(updatedGrid);
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!header.party) return alert('Please select a party');
    setSaving(true);
    try {
      await addPurchase({
        supplierId: header.party,
        invoiceNo: header.billNo,
        date: header.billDate,
        totalAmount: calculations.gross,
        items: gridItems.filter(i => i.itemId).map(i => ({
          itemId: i.itemId,
          item: i.itemName,
          pcs: Number(i.pcs || 0),
          cut: Number(i.cut || 0),
          mts: Number(i.mts || 0),
          rate: Number(i.rate || 0),
          amount: Number(i.amount || 0)
        })),
        totals: {
          subtotal: calculations.gross,
          total: calculations.net
        }
      });
      alert('Purchase saved successfully!');
      onClose();
    } catch (err) {
      alert('Failed to save purchase: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const addRow = () => {
    setGridItems([
      ...gridItems,
      { id: Date.now(), itemId: '', itemName: '', hsnCode: '', fold: '0.00', unit: 'MTRS', pcs: 0, cut: 0, mts: 0, rate: 0, amount: 0 }
    ]);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Purchase Invoice Entry" className="max-w-[95vw] h-[90vh] p-0 overflow-hidden">
      
      {/* Dynamic Tab Navigation */}
      <div className="flex border-b border-slate-100 p-0 bg-white gap-0 shrink-0">
         {['Purchase Invoice', 'Purchase Registry'].map(tab => (
            <button 
             key={tab}
             type="button"
             onClick={() => setActiveTab(tab)}
             className={`px-10 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab 
                   ? 'bg-black text-white' 
                   : 'text-slate-400 hover:bg-slate-50'
             }`}
            >
              {tab}
            </button>
         ))}
      </div>

      <div className="flex flex-col h-full overflow-hidden bg-white">
        <div className="p-10 flex-1 overflow-y-auto space-y-8 no-scrollbar">
           
           <div className="flex items-center gap-4">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black whitespace-nowrap">Supplier Specification</span>
              <div className="h-[1px] flex-1 bg-slate-100" />
              <div className="px-4 py-1.5 bg-slate-100 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500">
                GRN: 2026-904
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase text-black tracking-widest ml-1">Vendor / Supplier</label>
                 <ERPSearchableSelect 
                   className="w-full" 
                   value={header.party}
                   onChange={(val) => {
                     const party = parties.find(p => p._id === val || p.id === val);
                     setHeader({...header, party: val, add: party?.address || '', gstin: party?.gstin || '', city: party?.station || ''});
                   }}
                   onCreateNew={handleCreateAccount}
                   options={parties.map(p => ({value: p._id || p.id, label: p.name}))} 
                   label="Party"
                 />
                 {header.gstin && (
                    <p className="text-[10px] font-bold text-slate-400 mt-2 px-1">GSTIN: {header.gstin}</p>
                 )}
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase text-black tracking-widest ml-1">Office Address</label>
                 <ERPInput className="w-full" value={header.add} onChange={e => setHeader({...header, add: e.target.value})} placeholder="VENDER ADDRESS..." />
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase text-black tracking-widest ml-1">Commission Broker</label>
                 <ERPSearchableSelect 
                   className="w-full" 
                   value={header.broker}
                   onChange={(val) => setHeader({...header, broker: val})}
                   options={parties.filter(p => p.group === 'Broker').map(p => ({value: p._id || p.id, label: p.name}))} 
                   label="Broker"
                 />
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase text-black tracking-widest ml-1">Purchase Ledger</label>
                  <ERPSelect className="w-full" value={header.book} onChange={e => setHeader({...header, book: e.target.value})} options={[{value: 'FINISH PURCHASE', label: 'FINISH PURCHASE'}]} />
              </div>
           </div>

           <div className="flex items-center gap-4">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black whitespace-nowrap">Logistic Specs</span>
              <div className="h-[1px] flex-1 bg-slate-100" />
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                     <label className="text-[10px] font-black uppercase text-black tracking-widest ml-1">Invoice No</label>
                     <ERPInput className="w-full" value={header.billNo} onChange={e => setHeader({...header, billNo: e.target.value})} placeholder="INV-001" />
                  </div>
                  <div className="space-y-1">
                     <label className="text-[10px] font-black uppercase text-black tracking-widest ml-1">Date</label>
                     <input 
                       type="date" 
                       className="w-full h-12 px-4 border border-slate-200 rounded-2xl focus:border-black outline-none font-bold text-xs bg-white transition-all uppercase" 
                       value={header.billDate} 
                       onChange={e => setHeader({...header, billDate: e.target.value})} 
                     />
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                     <label className="text-[10px] font-black uppercase text-black tracking-widest ml-1">Challan No</label>
                     <ERPInput className="w-full" value={header.challanNo} onChange={e => setHeader({...header, challanNo: e.target.value})} placeholder="CH-001" />
                  </div>
                  <div className="space-y-1">
                     <label className="text-[10px] font-black uppercase text-black tracking-widest ml-1">Voucher No</label>
                     <ERPInput className="w-full bg-slate-50" value={header.vNo} readOnly />
                  </div>
               </div>

               <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-black tracking-widest ml-1">Tax Slab</label>
                  <ERPSelect className="w-full" value={header.gstType} onChange={e => setHeader({...header, gstType: e.target.value})} options={[{value: 'GST 5%', label: 'GST 5%'}, {value: 'GST 12%', label: 'GST 12%'}, {value: 'GST 18%', label: 'GST 18%'}]} />
               </div>
            </div>

           <div className="flex items-center gap-4">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black whitespace-nowrap">Line Item Registry</span>
              <div className="h-[1px] flex-1 bg-slate-100" />
              <button 
                type="button" 
                onClick={addRow}
                className="flex items-center gap-2 px-4 py-2 bg-black text-white text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all rounded-full"
              >
                <Plus size={12} />
                Add Entry
              </button>
           </div>

            <div className="border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
               <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100">
                     <tr className="h-14">
                        <th className="px-6 font-black text-left uppercase tracking-widest text-[9px] w-12 text-slate-400">#</th>
                        <th className="px-4 text-left font-black uppercase tracking-widest text-[9px] text-black">Product / Item</th>
                        <th className="px-4 text-center font-black uppercase tracking-widest text-[9px] text-black w-24">Unit</th>
                        <th className="px-4 text-center font-black uppercase tracking-widest text-[9px] text-black w-24">Pcs</th>
                        <th className="px-4 text-center font-black uppercase tracking-widest text-[9px] text-black w-32">Cut (Mts)</th>
                        <th className="px-4 text-center font-black uppercase tracking-widest text-[9px] text-black w-24">Total Mts</th>
                        <th className="px-4 text-right font-black uppercase tracking-widest text-[9px] text-black w-32">Rate</th>
                        <th className="px-4 text-right font-black uppercase tracking-widest text-[9px] text-black w-32">Amount</th>
                        <th className="px-6 text-center font-black uppercase tracking-widest text-[9px] text-black w-16"></th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                     {gridItems.map((row, idx) => (
                        <tr key={row.id || idx} className="h-16 hover:bg-slate-50/50 transition-colors">
                           <td className="px-6 text-slate-400 font-bold">{idx + 1}</td>
                           <td className="px-4">
                              <ERPSearchableSelect 
                                className="w-full h-10 border-none bg-transparent" 
                                value={row.itemId}
                                onChange={(val) => {
                                  const item = items.find(i => i._id === val || i.id === val);
                                  const updated = [...gridItems];
                                  updated[idx] = { ...updated[idx], itemId: val, itemName: item?.itemName || '', unit: item?.unit || 'MTRS', rate: item?.purRate || 0 };
                                  setGridItems(updated);
                                }}
                                onCreateNew={(search) => handleCreateItem(search, idx)}
                                options={items.map(i => ({value: i._id || i.id, label: i.itemName}))} 
                                label="Item"
                              />
                           </td>
                           <td className="px-4 text-center">
                              <span className="px-2 py-1 bg-slate-100 rounded text-[9px] font-black uppercase text-slate-500">{row.unit}</span>
                           </td>
                           <td className="px-4">
                              <input 
                                 type="number" 
                                 className="w-full h-10 text-center border border-transparent hover:border-slate-200 focus:border-black rounded-xl bg-transparent transition-all outline-none font-bold" 
                                 value={row.pcs || ''} 
                                 onChange={e => {
                                    const updated = [...gridItems];
                                    updated[idx].pcs = Number(e.target.value);
                                    updated[idx].mts = Number(e.target.value) * (updated[idx].cut || 1);
                                    updated[idx].amount = updated[idx].mts * updated[idx].rate;
                                    setGridItems(updated);
                                 }} 
                              />
                           </td>
                           <td className="px-4">
                              <input 
                                 type="number" 
                                 className="w-full h-10 text-center border border-transparent hover:border-slate-200 focus:border-black rounded-xl bg-transparent transition-all outline-none font-bold" 
                                 value={row.cut || ''} 
                                 onChange={e => {
                                    const updated = [...gridItems];
                                    updated[idx].cut = Number(e.target.value);
                                    updated[idx].mts = Number(e.target.value) * (updated[idx].pcs || 1);
                                    updated[idx].amount = updated[idx].mts * updated[idx].rate;
                                    setGridItems(updated);
                                 }} 
                              />
                           </td>
                           <td className="px-4 text-center font-black text-black">{row.mts || 0}</td>
                           <td className="px-4">
                              <input 
                                 type="number" 
                                 className="w-full h-10 text-right border border-transparent hover:border-slate-200 focus:border-black rounded-xl bg-transparent transition-all outline-none font-black" 
                                 value={row.rate || ''} 
                                 onChange={e => {
                                    const updated = [...gridItems];
                                    updated[idx].rate = Number(e.target.value);
                                    updated[idx].amount = updated[idx].mts * Number(e.target.value);
                                    setGridItems(updated);
                                 }} 
                              />
                           </td>
                           <td className="px-4 text-right font-black text-black">₹ {parseFloat(row.amount || 0).toFixed(2)}</td>
                           <td className="px-6 text-center">
                              <button 
                                onClick={() => setGridItems(gridItems.filter((_, i) => i !== idx))}
                                className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>

            <div className="flex flex-col md:flex-row justify-end items-start gap-10 pt-10">
               <div className="w-96 bg-[#000000] rounded-[2.5rem] p-10 space-y-6 shadow-2xl">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-white/40">
                     <span>Subtotal (Gross)</span>
                     <span className="text-white font-heading text-sm">₹ {calculations.gross.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-white/40 border-b border-white/10 pb-6">
                     <span>GST Computation</span>
                     <span className="text-white font-heading text-sm">₹ {calculations.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                     <span className="text-[12px] font-black uppercase tracking-[0.2em] text-white">Net Payable</span>
                     <span className="text-3xl font-black text-white font-heading">₹ {calculations.net.toFixed(2)}</span>
                  </div>
               </div>
            </div>

        </div>

        {/* Footer Actions */}
        <div className="p-8 bg-white border-t border-slate-100 flex justify-end gap-4 shrink-0">
           <button 
              type="button" 
              onClick={onClose}
              className="px-8 py-3 bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all rounded-2xl"
           >
              Discard Changes
           </button>
           <button 
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="px-14 py-3 bg-black text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all rounded-2xl shadow-xl disabled:opacity-50"
           >
              {saving ? 'Saving...' : 'Finalize Purchase (F12)'}
           </button>
        </div>
      </div>

      <AccountMasterModal 
        isOpen={inlineModal.type === 'account'} 
        onClose={() => setInlineModal({ type: null, initialData: null, rowIndex: null })}
        initialData={inlineModal.initialData}
        onSuccess={handleAccountSuccess}
      />
      <ItemMasterModal 
        isOpen={inlineModal.type === 'item'} 
        onClose={() => setInlineModal({ type: null, initialData: null, rowIndex: null })}
        initialData={inlineModal.initialData}
        onSuccess={handleItemSuccess}
      />

    </Modal>
  );
};

export default PurchaseModal;
