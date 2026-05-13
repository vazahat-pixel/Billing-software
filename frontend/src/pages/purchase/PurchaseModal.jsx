import React, { useState, useMemo } from 'react';
import Modal from '../../components/ui/Modal';
import { FormField, ERPInput, ERPSelect, ERPButton, ERPSearchableSelect } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';
import AccountMasterModal from '../masters/AccountMasterModal';
import ItemMasterModal from '../masters/ItemMasterModal';

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
    billDate: '05/05/2026',
    challanNo: '',
    chDate: '05/05/2026',
    gstType: '--Select GstType--',
  });

  React.useEffect(() => {
    if (isOpen && selectedBook) {
      setHeader(prev => ({ ...prev, book: selectedBook }));
    }
  }, [isOpen, selectedBook]);

  const [gridItems, setGridItems] = useState([
    { id: 1, itemId: '', itemName: '', hsnCode: '', fold: '0.00', unit: 'MTRS', pcs: 0, cut: 0, mts: 0, mts1: 0, rate: 0, amount: 0, disPer: 0, disAmt: 0, dis1Per: 0, dis1Amt: 0 }
  ]);

  // Inline Modal State
  const [inlineModal, setInlineModal] = useState({
    type: null, // 'account' or 'item'
    initialData: null,
    rowIndex: null
  });

  const calculations = useMemo(() => {
    const gross = gridItems.reduce((acc, item) => acc + (parseFloat(item.mts || 0) * parseFloat(item.rate || 0)), 0);
    const net = gross * 1.05; // Simplified
    return { gross, net };
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
        items: gridItems.map(i => ({
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

  // Auto append row if last row is filled
  React.useEffect(() => {
    const lastRow = gridItems[gridItems.length - 1];
    if (lastRow && (lastRow.itemId || lastRow.itemName)) {
      setGridItems(prev => [
        ...prev,
        { id: Date.now(), itemId: '', itemName: '', hsnCode: '', fold: '0.00', unit: 'MTRS', pcs: 0, cut: 0, mts: 0, mts1: 0, rate: 0, amount: 0, disPer: 0, disAmt: 0, dis1Per: 0, dis1Amt: 0 }
      ]);
    }
  }, [gridItems]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Purchase Invoice Entry" className="max-w-[95vw] h-[90vh] p-0 overflow-hidden">
      
      {/* Dynamic Tab Navigation */}
      <div className="flex border-b-2 border-black p-0 bg-white gap-0 shrink-0">
         {['Purchase Invoice', 'View Purchase Bill'].map(tab => (
            <button 
             key={tab}
             type="button"
             onClick={() => setActiveTab(tab)}
             className={`px-8 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${
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
        {/* Header */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4 no-scrollbar">
           
           <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black whitespace-nowrap">Supplier & Booking Details</span>
              <div className="h-[2px] flex-1 bg-black" />
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                 <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase text-black tracking-widest">Supplier / Vendor</label>
                    <span className="px-3 py-1 bg-black text-white text-[9px] font-black uppercase tracking-widest border border-black shadow-none">
                       GRN Ref: GRN-2026-904
                    </span>
                 </div>
                 <ERPSearchableSelect 
                   className="w-full h-11 border-2 border-slate-100 focus:border-black transition-all font-bold" 
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
                    <p className="text-[10px] font-black uppercase text-slate-400 mt-1">GSTIN: {header.gstin}</p>
                 )}
              </div>

              <div className="flex flex-col gap-1">
                 <label className="text-[10px] font-black uppercase text-black tracking-widest">Address</label>
                 <ERPInput className="w-full h-11 border-2 border-slate-100 focus:border-black transition-all font-bold" value={header.add} onChange={e => setHeader({...header, add: e.target.value})} />
              </div>

              <div className="flex flex-col gap-1">
                 <label className="text-[10px] font-black uppercase text-black tracking-widest">Broker</label>
                 <ERPSearchableSelect 
                   className="w-full h-11 border-2 border-slate-100 focus:border-black transition-all font-bold" 
                   value={header.broker}
                   onChange={(val) => setHeader({...header, broker: val})}
                   options={parties.filter(p => p.group === 'Broker').map(p => ({value: p._id || p.id, label: p.name}))} 
                   label="Broker"
                 />
              </div>

              <div className="flex flex-col gap-1">
                 <label className="text-[10px] font-black uppercase text-black tracking-widest">Purchase Book</label>
                  <ERPSelect className="w-full h-11 border-2 border-slate-100 focus:border-black transition-all font-black bg-slate-50" value={header.book} onChange={e => setHeader({...header, book: e.target.value})} options={[{value: 'FINISH PURCHASE', label: 'FINISH PURCHASE'}, ...(header.book && header.book !== 'FINISH PURCHASE' ? [{value: header.book, label: header.book}] : [])]} />
              </div>
           </div>

           <div className="flex items-center gap-3 pt-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black whitespace-nowrap">Logistics & Invoicing Specs</span>
              <div className="h-[2px] flex-1 bg-black" />
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                     <label className="text-[10px] font-black uppercase text-black tracking-widest">Invoice No</label>
                     <ERPInput className="w-full h-11 border-2 border-slate-100 focus:border-black font-bold transition-all" value={header.billNo} onChange={e => setHeader({...header, billNo: e.target.value})} />
                  </div>
                  <div className="flex flex-col gap-1">
                     <label className="text-[10px] font-black uppercase text-black tracking-widest">Invoice Date</label>
                     <input 
                       type="date" 
                       className="w-full h-11 px-3 border-2 border-slate-100 focus:border-black outline-none font-bold text-sm bg-white transition-all" 
                       value={header.billDate} 
                       onChange={e => setHeader({...header, billDate: e.target.value})} 
                     />
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                     <label className="text-[10px] font-black uppercase text-black tracking-widest">Challan No</label>
                     <ERPInput className="w-full h-11 border-2 border-slate-100 focus:border-black font-bold transition-all" value={header.challanNo} onChange={e => setHeader({...header, challanNo: e.target.value})} />
                  </div>
                  <div className="flex flex-col gap-1">
                     <label className="text-[10px] font-black uppercase text-black tracking-widest">Challan Date</label>
                     <input 
                       type="date" 
                       className="w-full h-11 px-3 border-2 border-slate-100 focus:border-black outline-none font-bold text-sm bg-white transition-all" 
                       value={header.chDate} 
                       onChange={e => setHeader({...header, chDate: e.target.value})} 
                     />
                  </div>
               </div>

               <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase text-black tracking-widest">GST Computation Type</label>
                  <ERPSelect className="w-full h-11 border-2 border-slate-100 focus:border-black font-black transition-all" value={header.gstType} onChange={e => setHeader({...header, gstType: e.target.value})} options={[{value: 'GST 5%', label: 'GST 5%'}, {value: 'GST 12%', label: 'GST 12%'}, {value: 'GST 18%', label: 'GST 18%'}]} />
               </div>

               <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase text-black tracking-widest">Voucher No</label>
                  <ERPInput className="w-full h-11 border-2 border-slate-100 bg-slate-50 font-black text-black" value={header.vNo} readOnly />
               </div>
            </div>

           <div className="flex items-center gap-3 pt-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black whitespace-nowrap">Purchase Line Items</span>
              <div className="h-[2px] flex-1 bg-black" />
           </div>

            {/* Grid Table */}
            <div className="border-2 border-black overflow-hidden shadow-none">
               <table className="w-full text-xs border-collapse">
                  <thead className="bg-black text-white border-b-2 border-black">
                     <tr className="h-10">
                        <th className="px-2 font-black text-center uppercase tracking-widest text-[10px] w-12">#</th>
                        <th className="px-3 text-left font-black uppercase tracking-widest text-[10px]">Item</th>
                        <th className="px-2 text-center font-black uppercase tracking-widest text-[10px] w-24">HSN</th>
                        <th className="px-2 text-center font-black uppercase tracking-widest text-[10px] w-20">Unit</th>
                        <th className="px-2 text-center font-black uppercase tracking-widest text-[10px] w-20">Pcs</th>
                        <th className="px-2 text-center font-black uppercase tracking-widest text-[10px] w-28">Cut</th>
                        <th className="px-2 text-center font-black uppercase tracking-widest text-[10px] w-24">Qty (Mts)</th>
                        <th className="px-2 text-right font-black uppercase tracking-widest text-[10px] w-28">Rate</th>
                        <th className="px-2 text-right font-black uppercase tracking-widest text-[10px] w-28">Amount</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-slate-100">
                     {gridItems.map((row, idx) => (
                        <tr key={row.id || idx} className={`h-[44px] hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'}`}>
                           <td className="text-center text-black font-black">{idx + 1}</td>
                           <td className="px-2">
                              <ERPSearchableSelect 
                                className="w-full h-9 border-none bg-transparent hover:bg-slate-100 focus:bg-white transition-all px-1 font-bold" 
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
                           <td className="text-center text-black font-bold uppercase tracking-widest">{row.hsnCode || '—'}</td>
                           <td className="text-center font-black text-black bg-slate-100 text-[10px]">{row.unit}</td>
                           <td className="px-2">
                              <input 
                                 type="number" 
                                 className="w-full h-9 text-center border-none bg-transparent hover:bg-slate-100 focus:bg-white transition-all px-1 text-xs outline-none font-bold" 
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
                           <td className="px-2">
                              <div className="relative flex items-center bg-slate-50 border-2 border-slate-100 hover:border-black transition-all pr-2">
                                 <input 
                                    type="number" 
                                    className="w-full h-8 text-center border-none bg-transparent text-xs outline-none font-black text-black" 
                                    value={row.cut || ''} 
                                    onChange={e => {
                                       const updated = [...gridItems];
                                       updated[idx].cut = Number(e.target.value);
                                       updated[idx].mts = Number(e.target.value) * (updated[idx].pcs || 1);
                                       updated[idx].amount = updated[idx].mts * updated[idx].rate;
                                       setGridItems(updated);
                                    }} 
                                 />
                                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">mts</span>
                              </div>
                           </td>
                           <td className="text-center font-black text-black bg-slate-100">{row.mts || 0}</td>
                           <td className="px-2">
                              <input 
                                 type="number" 
                                 className="w-full h-9 text-right border-none bg-transparent hover:bg-slate-100 focus:bg-white transition-all px-1 text-xs outline-none font-black" 
                                 value={row.rate || ''} 
                                 onChange={e => {
                                    const updated = [...gridItems];
                                    updated[idx].rate = Number(e.target.value);
                                    updated[idx].amount = updated[idx].mts * Number(e.target.value);
                                    setGridItems(updated);
                                 }} 
                              />
                           </td>
                           <td className="text-right font-black text-black bg-slate-100 pr-4">₹ {parseFloat(row.amount || 0).toFixed(2)}</td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>

            {/* Totals & Bottom cards */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-10 pt-8 border-t-2 border-black">
               <div className="flex-1 w-full" />
               
               <div className="w-96 bg-black text-white p-8 space-y-3 shrink-0 shadow-none">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                     <span>Subtotal Gross Amount</span>
                     <span className="text-white">₹ {calculations.gross.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-white/20 pb-4">
                     <span>Estimated GST (5%)</span>
                     <span className="text-white">₹ {(calculations.gross * 0.05).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                     <span className="text-[12px] font-black uppercase tracking-[0.2em]">Total Amount</span>
                     <span className="text-2xl font-black">₹ {calculations.net.toFixed(2)}</span>
                  </div>
               </div>
            </div>

        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-black flex justify-end gap-4 shrink-0">
           <button 
              type="button" 
              onClick={onClose}
              className="px-8 py-2 bg-transparent border border-white/20 text-white text-[11px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
           >
              Cancel
           </button>
           <button 
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="px-12 py-2 bg-white text-black text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all shadow-none disabled:opacity-50"
           >
              {saving ? 'Processing...' : 'Save Purchase (F12)'}
           </button>
        </div>
      </div>

      {/* Inline Creation Modals */}
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
