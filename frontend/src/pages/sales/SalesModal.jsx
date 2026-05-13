import React, { useState, useMemo, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import { FormField, ERPInput, ERPSelect, ERPButton, ERPSearchableSelect } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';
import api from '../../utils/api';
import { Trash2, Plus, Calculator, Truck, FileText, XCircle, Save, Printer, Search } from 'lucide-react';
import AccountMasterModal from '../masters/AccountMasterModal';
import ItemMasterModal from '../masters/ItemMasterModal';

const SalesModal = ({ isOpen, onClose, initialData = null, selectedBook = null }) => {
  const { parties, items, inventoryLots, addSale } = useStore();
  const [activeTab, setActiveTab] = useState('Generate Sales Bill');
  const [rowLots, setRowLots] = useState({});

  useEffect(() => {
    if (isOpen) {
      if (selectedBook) {
        setHeader(prev => ({ ...prev, book: selectedBook }));
      }
      const fetchAllLots = async () => {
        const itemIds = [...new Set(gridItems.map(item => item.itemId).filter(Boolean))];
        for (const id of itemIds) {
          try {
            const res = await api.get(`/inventory/lots?itemId=${id}`);
            const lots = res.data.data || res.data;
            setRowLots(prev => ({ ...prev, [id]: lots }));
          } catch (err) {
            console.error('Failed to fetch lots:', err);
          }
        }
      };
      fetchAllLots();
    }
  }, [isOpen, selectedBook]);

  const [header, setHeader] = useState({
    party: '',
    add: '',
    broker: '',
    book: 'FINISH SALES',
    gstin: '',
    city: '',
    haste: '',
    billNo: '2',
    billDate: '05/05/2026',
    challanNo: '2',
    chDate: '05/05/2026',
    gstType: '--Select GstType--',
  });

  const [gridItems, setGridItems] = useState([
    { id: 1, itemId: '', itemName: '', desc: '', packingType: '', unit: 'PCS', pcs: 0, cut: 0, mts: 0, saleRate: 0, amount: 0, disPer: 0, disAmt: 0, addAmt: 0, gstRate: 0 }
  ]);

  const [footer, setFooter] = useState({
    remarks: '',
    remark1: '',
    dueDays: 0,
    dueDate: '05/05/2026',
    trnChrg: '',
    ccAttach: '',
    transport: '',
    lrNo: '',
    station: '',
    eway: '',
    lrDate: '05/05/2026',
    lrRecDate: '05/05/2026',
    vehicle: '',
    baleNo: '',
    weight: 0,
    freight: 0,
    dis: 0, amt: 0,
    dis1: 0, amt1: 0,
    dis2: 0, amt2: 0,
    rd: 0, rdAmt: 0,
    rd1: 0, rd1Amt: 0,
    add: 0, add1: 0
  });

  // Inline Modal State
  const [inlineModal, setInlineModal] = useState({
    type: null, // 'account' or 'item'
    initialData: null,
    rowIndex: null
  });

  const calculations = useMemo(() => {
    const gross = gridItems.reduce((acc, item) => acc + (parseFloat(item.mts || 0) * parseFloat(item.saleRate || 0)), 0);
    const totDis = gridItems.reduce((acc, item) => acc + (parseFloat(item.disAmt || 0)), 0);
    const taxable = gross - totDis;
    const gstAmt = taxable * 0.05;
    const net = taxable + gstAmt;
    return { gross, totDis, taxable, gstAmt, net };
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

  const handleItemSuccess = async (newItem) => {
    const itemId = newItem._id || newItem.id;
    const updatedGrid = [...gridItems];
    updatedGrid[inlineModal.rowIndex] = { 
      ...updatedGrid[inlineModal.rowIndex], 
      itemId: itemId,
      itemName: newItem.itemName,
      unit: newItem.unit,
      saleRate: newItem.salesRate
    };
    setGridItems(updatedGrid);

    if (itemId) {
      try {
        const res = await api.get(`/inventory/lots?itemId=${itemId}`);
        const lots = res.data.data || res.data;
        setRowLots(prev => ({ ...prev, [itemId]: lots }));
      } catch (err) {
        console.error('Failed to fetch lots:', err);
      }
    }
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!header.party) return alert('Please select a customer');
    
    setSaving(true);
    try {
      await addSale({
        customerId: header.party,
        invoiceNo: header.billNo,
        date: header.billDate,
        items: gridItems.map(i => ({
          lotId: i.lotId,
          itemId: i.itemId,
          item: i.itemName,
          pcs: Number(i.pcs || 0),
          mts: Number(i.mts || 0),
          rate: Number(i.saleRate || 0),
          amount: Number(i.amount || 0)
        })),
        taxableAmount: calculations.taxable,
        gstAmount: calculations.gstAmt,
        netAmount: calculations.net,
        footer: footer
      });
      alert('Sales Invoice saved successfully!');
      onClose();
    } catch (err) {
      alert('Failed to save sales: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSave(e);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Generate Sales Invoice" className="max-w-[95vw] h-[90vh] p-0 overflow-hidden">
      
      {/* Dynamic Tab Navigation */}
      <div className="flex border-b border-[#E2E8F0] p-1 bg-slate-50 gap-1 shrink-0">
         {['Generate Sales Bill', 'View Sales Bill'].map(tab => (
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

      <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden bg-white">
        
        {/* Header Section */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4 no-scrollbar">
           
           <div className="flex items-center gap-3">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[#64748B] whitespace-nowrap">Party & Broker Details</span>
              <div className="h-[1px] flex-1 bg-[#E2E8F0]" />
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                 <label className="text-[12px] font-bold text-slate-700">Party / Customer</label>
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
                 <label className="text-[12px] font-bold text-slate-700">Book / Sub-ledger</label>
                  <ERPSelect className="w-full h-[38px] text-sm font-bold text-[#1B3A6B] bg-slate-50" value={header.book} onChange={e => setHeader({...header, book: e.target.value})} options={[{value: 'FINISH SALES', label: 'FINISH SALES'}, ...(header.book && header.book !== 'FINISH SALES' ? [{value: header.book, label: header.book}] : [])]} />
              </div>
           </div>

           <div className="flex items-center gap-3 pt-2">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[#64748B] whitespace-nowrap">Invoice & Logistics Specs</span>
              <div className="h-[1px] flex-1 bg-[#E2E8F0]" />
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid grid-cols-2 gap-3">
                 <div className="flex flex-col gap-1">
                    <label className="text-[12px] font-bold text-slate-700">Invoice No</label>
                    <ERPInput className="w-full h-[38px] text-sm font-bold text-[#0D7377] bg-slate-50 border border-slate-200" value={header.billNo} readOnly />
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
                 <label className="text-[12px] font-bold text-slate-700">GST Type Toggle</label>
                 <div className="flex bg-slate-100 p-1 rounded-lg w-max border border-slate-200">
                    {['CGST+SGST', 'IGST'].map(type => (
                       <button
                          key={type}
                          type="button"
                          onClick={() => setHeader({ ...header, gstType: type })}
                          className={`px-4 py-1 text-xs font-bold rounded-md transition-all ${
                             header.gstType === type 
                                ? 'bg-[#0D7377] text-white shadow-sm' 
                                : 'text-slate-500 hover:text-slate-800'
                          }`}
                       >
                          {type}
                       </button>
                    ))}
                 </div>
              </div>

              <div className="flex flex-col gap-1">
                 <label className="text-[12px] font-bold text-slate-700">Payment Terms</label>
                 <select
                    className="w-full h-[38px] px-3 border border-[#CBD5E1] rounded-md focus:outline-none focus:ring-2 focus:ring-[#0D7377] text-slate-800 text-sm bg-white"
                    value={footer.dueDays}
                    onChange={e => setFooter({ ...footer, dueDays: Number(e.target.value) })}
                 >
                    <option value={0}>Immediate</option>
                    <option value={7}>7 days</option>
                    <option value={15}>15 days</option>
                    <option value={30}>30 days</option>
                    <option value={45}>45 days</option>
                    <option value={60}>60 days</option>
                 </select>
              </div>
           </div>

           <div className="flex items-center gap-3 pt-2">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[#64748B] whitespace-nowrap">Invoice Line Items</span>
              <div className="h-[1px] flex-1 bg-[#E2E8F0]" />
           </div>

           {/* High Density Grid */}
           <div className="border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-xs border-collapse">
                 <thead className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E2E8F0]">
                    <tr className="h-10">
                       <th className="px-2 font-semibold text-center uppercase tracking-[0.05em] text-[11px] w-12">#</th>
                       <th className="px-3 text-left font-semibold uppercase tracking-[0.05em] text-[11px]">Item</th>
                       <th className="px-2 text-left font-semibold uppercase tracking-[0.05em] text-[11px] w-36">Lot</th>
                       <th className="px-2 text-center font-semibold uppercase tracking-[0.05em] text-[11px] w-20">Pcs</th>
                       <th className="px-2 text-center font-semibold uppercase tracking-[0.05em] text-[11px] w-20">Cut</th>
                       <th className="px-2 text-center font-semibold uppercase tracking-[0.05em] text-[11px] w-24">Qty (Mts)</th>
                       <th className="px-2 text-right font-semibold uppercase tracking-[0.05em] text-[11px] w-28">Rate</th>
                       <th className="px-2 text-right font-semibold uppercase tracking-[0.05em] text-[11px] w-28">Amount</th>
                       <th className="px-2 text-center font-semibold uppercase tracking-[0.05em] text-[11px] w-16">Action</th>
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
                                 updated[idx] = { ...updated[idx], itemId: val, itemName: item?.itemName || '', unit: item?.unit || 'PCS', saleRate: item?.salesRate || 0 };
                                 setGridItems(updated);
                                 if (val) {
                                   try {
                                     api.get(`/inventory/lots?itemId=${val}`).then(res => {
                                        const lots = res.data.data || res.data;
                                        setRowLots(prev => ({ ...prev, [val]: lots }));
                                     });
                                   } catch (err) {
                                     console.error('Failed to fetch lots:', err);
                                   }
                                 }
                               }}
                               onCreateNew={(search) => handleCreateItem(search, idx)}
                               options={items.map(i => ({value: i._id || i.id, label: i.itemName}))} 
                               label="Item"
                             />
                          </td>
                           <td className="px-2">
                              <select 
                                 className="w-full h-[32px] border-none bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#0D7377] transition-all rounded-md px-1 text-xs outline-none font-bold text-slate-700"
                                 value={row.lotId || ''}
                                 onChange={(e) => {
                                    const updated = [...gridItems];
                                    updated[idx].lotId = e.target.value;
                                    setGridItems(updated);
                                 }}
                              >
                                 <option value="">--Select Lot--</option>
                                 {(rowLots[row.itemId] || []).map(lot => (
                                    <option key={lot._id} value={lot._id}>
                                       {lot.lotId} ({lot.remainingMtrs} Mtrs)
                                    </option>
                                 ))}
                              </select>
                           </td>
                           <td className="px-2">
                              <input 
                                 type="number"
                                 className="w-full h-[32px] text-center border-none bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#0D7377] transition-all rounded-md px-1 text-xs outline-none" 
                                 value={row.pcs || ''} 
                                 onChange={e => {
                                    const updated = [...gridItems];
                                    updated[idx].pcs = Number(e.target.value);
                                    updated[idx].mts = Number(e.target.value) * (updated[idx].cut || 1);
                                    updated[idx].amount = updated[idx].mts * updated[idx].saleRate;
                                    setGridItems(updated);
                                 }} 
                              />
                           </td>
                           <td className="px-2">
                              <input 
                                 type="number"
                                 className="w-full h-[32px] text-center border-none bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#0D7377] transition-all rounded-md px-1 text-xs outline-none" 
                                 value={row.cut || ''} 
                                 onChange={e => {
                                    const updated = [...gridItems];
                                    updated[idx].cut = Number(e.target.value);
                                    updated[idx].mts = Number(e.target.value) * (updated[idx].pcs || 1);
                                    updated[idx].amount = updated[idx].mts * updated[idx].saleRate;
                                    setGridItems(updated);
                                 }} 
                              />
                           </td>
                           <td className="px-2 text-center font-semibold text-slate-600 bg-slate-50">{row.mts || 0}</td>
                           <td className="px-2">
                              <input 
                                 type="number"
                                 className="w-full h-[32px] text-right border-none bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#0D7377] transition-all rounded-md px-1 text-xs outline-none" 
                                 value={row.saleRate || ''} 
                                 onChange={e => {
                                    const updated = [...gridItems];
                                    updated[idx].saleRate = Number(e.target.value);
                                    updated[idx].amount = updated[idx].mts * Number(e.target.value);
                                    setGridItems(updated);
                                 }} 
                              />
                           </td>
                           <td className="px-2 text-right font-bold text-slate-700 bg-slate-50">₹ {parseFloat(row.amount || 0).toFixed(2)}</td>
                           <td className="px-2 text-center">
                              <button 
                                 type="button" 
                                 onClick={() => {
                                    const updated = gridItems.filter((_, i) => i !== idx);
                                    setGridItems(updated.length ? updated : [{ id: Date.now(), itemId: '', itemName: '', desc: '', packingType: '', unit: 'PCS', pcs: 0, cut: 0, mts: 0, saleRate: 0, amount: 0, disPer: 0, disAmt: 0, addAmt: 0, gstRate: 0 }]);
                                 }}
                                 className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                              >
                                 <Trash2 size={15} />
                              </button>
                           </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>

           {/* Totals Section */}
           <div className="flex flex-col md:flex-row justify-between items-start gap-4 pt-4 border-t border-[#E2E8F0]">
              <div className="flex-1 w-full">
                 <label className="text-[12px] font-bold text-slate-700">Remarks / Narration</label>
                 <textarea 
                    className="w-full p-2.5 border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D7377] text-slate-800 text-sm bg-white" 
                    rows={2} 
                    value={footer.remarks}
                    onChange={e => setFooter({ ...footer, remarks: e.target.value })}
                    placeholder="Enter invoice narration..."
                 />
              </div>

              {/* Gorgeous Totals Panel */}
              <div className="w-80 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-2 shrink-0 shadow-sm">
                 <div className="flex justify-between text-xs text-slate-500">
                    <span>Subtotal (Taxable)</span>
                    <span className="font-semibold text-slate-700">₹ {calculations.taxable.toFixed(2)}</span>
                 </div>
                 {header.gstType === 'IGST' ? (
                    <div className="flex justify-between text-xs text-slate-500">
                       <span>IGST (5%)</span>
                       <span className="font-semibold text-slate-700">₹ {calculations.gstAmt.toFixed(2)}</span>
                    </div>
                 ) : (
                    <>
                       <div className="flex justify-between text-xs text-slate-500">
                          <span>CGST (2.5%)</span>
                          <span className="font-semibold text-slate-700">₹ {(calculations.gstAmt / 2).toFixed(2)}</span>
                       </div>
                       <div className="flex justify-between text-xs text-slate-500">
                          <span>SGST (2.5%)</span>
                          <span className="font-semibold text-slate-700">₹ {(calculations.gstAmt / 2).toFixed(2)}</span>
                       </div>
                    </>
                 )}
                 <div className="flex justify-between text-xs text-slate-500 border-b border-[#E2E8F0] pb-2">
                    <span>Round-off</span>
                    <span className="font-semibold text-slate-700">₹ 0.00</span>
                 </div>
                 <div className="flex justify-between items-center pt-1">
                    <span className="text-sm font-bold text-[#1B3A6B]">Net Amount</span>
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
              type="submit"
              disabled={saving}
              className="h-[38px] px-6 bg-[#1B3A6B] hover:bg-[#142d56] text-white font-medium rounded-lg transition-all text-sm shadow-sm disabled:opacity-50"
           >
              {saving ? 'Saving...' : 'Save Invoice'}
           </button>
        </div>

      </form>

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

export default SalesModal;
