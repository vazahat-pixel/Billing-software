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
      <div className="flex border-b border-[#E2E8F0] p-1 bg-slate-50 gap-1 shrink-0">
         {['Purchase Invoice', 'View Purchase Bill'].map(tab => (
            <button 
             key={tab}
             type="button"
             onClick={() => setActiveTab(tab)}
             className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === tab 
                   ? 'bg-white text-[#1B3A6B] shadow-sm border border-[#E2E8F0]' 
                   : 'text-slate-500 hover:bg-slate-100'
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
              <span className="text-[12px] font-bold uppercase tracking-wider text-[#64748B] whitespace-nowrap">Supplier & Booking Details</span>
              <div className="h-[1px] flex-1 bg-[#E2E8F0]" />
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                 <div className="flex items-center justify-between">
                    <label className="text-[12px] font-bold text-slate-700">Supplier / Vendor</label>
                    <span className="px-2.5 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-bold rounded-full shadow-sm">
                       GRN Ref: GRN-2026-904
                    </span>
                 </div>
                 <ERPSearchableSelect 
                   className="w-full h-[38px]" 
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
                    <p className="text-[11px] text-slate-400 mt-0.5">GSTIN: {header.gstin}</p>
                 )}
              </div>

              <div className="flex flex-col gap-1">
                 <label className="text-[12px] font-bold text-slate-700">Address</label>
                 <ERPInput className="w-full h-[38px] text-sm" value={header.add} onChange={e => setHeader({...header, add: e.target.value})} />
              </div>

              <div className="flex flex-col gap-1">
                 <label className="text-[12px] font-bold text-slate-700">Broker</label>
                 <ERPSearchableSelect 
                   className="w-full h-[38px]" 
                   value={header.broker}
                   onChange={(val) => setHeader({...header, broker: val})}
                   options={parties.filter(p => p.group === 'Broker').map(p => ({value: p._id || p.id, label: p.name}))} 
                   label="Broker"
                 />
              </div>

              <div className="flex flex-col gap-1">
                 <label className="text-[12px] font-bold text-slate-700">Purchase Book</label>
                  <ERPSelect className="w-full h-[38px] text-sm font-bold text-[#1B3A6B] bg-slate-50" value={header.book} onChange={e => setHeader({...header, book: e.target.value})} options={[{value: 'FINISH PURCHASE', label: 'FINISH PURCHASE'}, ...(header.book && header.book !== 'FINISH PURCHASE' ? [{value: header.book, label: header.book}] : [])]} />
              </div>
           </div>

           <div className="flex items-center gap-3 pt-2">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[#64748B] whitespace-nowrap">Logistics & Invoicing Specs</span>
              <div className="h-[1px] flex-1 bg-[#E2E8F0]" />
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid grid-cols-2 gap-3">
                 <div className="flex flex-col gap-1">
                    <label className="text-[12px] font-bold text-slate-700">Invoice No</label>
                    <ERPInput className="w-full h-[38px] text-sm" value={header.billNo} onChange={e => setHeader({...header, billNo: e.target.value})} />
                 </div>
                 <div className="flex flex-col gap-1">
                    <label className="text-[12px] font-bold text-slate-700">Invoice Date</label>
                    <input 
                      type="date" 
                      className="w-full h-[38px] px-3 border border-[#CBD5E1] rounded-md focus:outline-none focus:ring-2 focus:ring-[#0D7377] text-slate-800 text-sm bg-white" 
                      value={header.billDate} 
                      onChange={e => setHeader({...header, billDate: e.target.value})} 
                    />
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                 <div className="flex flex-col gap-1">
                    <label className="text-[12px] font-bold text-slate-700">Challan No</label>
                    <ERPInput className="w-full h-[38px] text-sm" value={header.challanNo} onChange={e => setHeader({...header, challanNo: e.target.value})} />
                 </div>
                 <div className="flex flex-col gap-1">
                    <label className="text-[12px] font-bold text-slate-700">Challan Date</label>
                    <input 
                      type="date" 
                      className="w-full h-[38px] px-3 border border-[#CBD5E1] rounded-md focus:outline-none focus:ring-2 focus:ring-[#0D7377] text-slate-800 text-sm bg-white" 
                      value={header.chDate} 
                      onChange={e => setHeader({...header, chDate: e.target.value})} 
                    />
                 </div>
              </div>

              <div className="flex flex-col gap-1">
                 <label className="text-[12px] font-bold text-slate-700">GST Computation Type</label>
                 <ERPSelect className="w-full h-[38px] text-sm" value={header.gstType} onChange={e => setHeader({...header, gstType: e.target.value})} options={[{value: 'GST 5%', label: 'GST 5%'}, {value: 'GST 12%', label: 'GST 12%'}, {value: 'GST 18%', label: 'GST 18%'}]} />
              </div>

              <div className="flex flex-col gap-1">
                 <label className="text-[12px] font-bold text-slate-700">Voucher No</label>
                 <ERPInput className="w-full h-[38px] text-sm font-bold text-slate-600 bg-slate-50" value={header.vNo} readOnly />
              </div>
           </div>

           <div className="flex items-center gap-3 pt-2">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[#64748B] whitespace-nowrap">Purchase Line Items</span>
              <div className="h-[1px] flex-1 bg-[#E2E8F0]" />
           </div>

           {/* Grid Table */}
           <div className="border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-xs border-collapse">
                 <thead className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E2E8F0]">
                    <tr className="h-10">
                       <th className="px-2 font-semibold text-center uppercase tracking-[0.05em] text-[11px] w-12">#</th>
                       <th className="px-3 text-left font-semibold uppercase tracking-[0.05em] text-[11px]">Item</th>
                       <th className="px-2 text-center font-semibold uppercase tracking-[0.05em] text-[11px] w-24">HSN</th>
                       <th className="px-2 text-center font-semibold uppercase tracking-[0.05em] text-[11px] w-20">Unit</th>
                       <th className="px-2 text-center font-semibold uppercase tracking-[0.05em] text-[11px] w-20">Pcs</th>
                       <th className="px-2 text-center font-semibold uppercase tracking-[0.05em] text-[11px] w-28">Cut</th>
                       <th className="px-2 text-center font-semibold uppercase tracking-[0.05em] text-[11px] w-24">Qty (Mts)</th>
                       <th className="px-2 text-right font-semibold uppercase tracking-[0.05em] text-[11px] w-28">Rate</th>
                       <th className="px-2 text-right font-semibold uppercase tracking-[0.05em] text-[11px] w-28">Amount</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-[#F1F5F9]">
                    {gridItems.map((row, idx) => (
                       <tr key={row.id || idx} className={`h-[44px] hover:bg-[#F8FAFC] transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'}`}>
                          <td className="text-center text-slate-400 font-bold">{idx + 1}</td>
                          <td className="px-2">
                             <ERPSearchableSelect 
                               className="w-full h-[32px] border-none bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#0D7377] transition-all rounded-md px-1" 
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
                          <td className="text-center text-slate-500">{row.hsnCode || '—'}</td>
                          <td className="text-center font-semibold text-slate-500 bg-slate-50">{row.unit}</td>
                          <td className="px-2">
                             <input 
                                type="number" 
                                className="w-full h-[32px] text-center border-none bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#0D7377] transition-all rounded-md px-1 text-xs outline-none" 
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
                             {/* Amber Cut Highlight input with suffix mts */}
                             <div className="relative flex items-center bg-amber-50/50 rounded-md border border-amber-100 hover:bg-amber-50 focus-within:ring-1 focus-within:ring-[#0D7377] transition-all pr-2">
                                <input 
                                   type="number" 
                                   className="w-full h-[32px] text-center border-none bg-transparent text-xs outline-none font-semibold text-amber-900" 
                                   value={row.cut || ''} 
                                   onChange={e => {
                                      const updated = [...gridItems];
                                      updated[idx].cut = Number(e.target.value);
                                      updated[idx].mts = Number(e.target.value) * (updated[idx].pcs || 1);
                                      updated[idx].amount = updated[idx].mts * updated[idx].rate;
                                      setGridItems(updated);
                                   }} 
                                />
                                <span className="text-[10px] font-bold text-amber-500 uppercase">mts</span>
                             </div>
                          </td>
                          <td className="text-center font-semibold text-slate-600 bg-slate-50">{row.mts || 0}</td>
                          <td className="px-2">
                             <input 
                                type="number" 
                                className="w-full h-[32px] text-right border-none bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#0D7377] transition-all rounded-md px-1 text-xs outline-none" 
                                value={row.rate || ''} 
                                onChange={e => {
                                   const updated = [...gridItems];
                                   updated[idx].rate = Number(e.target.value);
                                   updated[idx].amount = updated[idx].mts * Number(e.target.value);
                                   setGridItems(updated);
                                }} 
                             />
                          </td>
                          <td className="text-right font-bold text-slate-700 bg-slate-50 pr-4">₹ {parseFloat(row.amount || 0).toFixed(2)}</td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>

           {/* Totals & Bottom cards */}
           <div className="flex flex-col md:flex-row justify-between items-start gap-4 pt-4 border-t border-[#E2E8F0]">
              <div className="flex-1 w-full" />
              
              <div className="w-80 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-2 shrink-0 shadow-sm">
                 <div className="flex justify-between text-xs text-slate-500">
                    <span>Subtotal Gross Amount</span>
                    <span className="font-semibold text-slate-700">₹ {calculations.gross.toFixed(2)}</span>
                 </div>
                 <div className="flex justify-between text-xs text-slate-500 border-b border-[#E2E8F0] pb-2">
                    <span>Estimated GST (5%)</span>
                    <span className="font-semibold text-slate-700">₹ {(calculations.gross * 0.05).toFixed(2)}</span>
                 </div>
                 <div className="flex justify-between items-center pt-1">
                    <span className="text-sm font-bold text-[#1B3A6B]">Total Amount</span>
                    <span className="text-lg font-bold text-[#0D7377]">₹ {calculations.net.toFixed(2)}</span>
                 </div>
              </div>
           </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex justify-end gap-3 shrink-0 rounded-b-xl">
           <button 
              type="button" 
              onClick={onClose}
              className="h-[38px] px-6 bg-white border border-[#1B3A6B] text-[#1B3A6B] font-medium rounded-lg hover:bg-slate-50 transition-all text-sm"
           >
              Cancel
           </button>
           <button 
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="h-[38px] px-6 bg-[#1B3A6B] hover:bg-[#142d56] text-white font-medium rounded-lg transition-all text-sm shadow-sm disabled:opacity-50"
           >
              {saving ? 'Saving...' : 'Save Purchase'}
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
