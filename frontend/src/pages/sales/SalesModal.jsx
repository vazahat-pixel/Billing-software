import React, { useState, useMemo, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import { FormField, ERPInput, ERPSelect, ERPButton, ERPSearchableSelect } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';
import api from '../../utils/api';
import { Trash2, Plus, Calculator, Truck, FileText, XCircle, Save, Printer, Search } from 'lucide-react';
import AccountMasterModal from '../masters/AccountMasterModal';
import ItemMasterModal from '../masters/ItemMasterModal';

const today = () => new Date().toISOString().split('T')[0];

const SalesModal = ({ isOpen, onClose, initialData = null, selectedBook = null }) => {
  const { parties, items, sales, inventoryLots, addSale, fetchParties, fetchItems } = useStore();
  const [activeTab, setActiveTab] = useState('Generate Sales Bill');
  const [rowLots, setRowLots] = useState({});

  useEffect(() => {
    if (isOpen) {
      fetchParties();
      fetchItems();
      const nextBillNo = String((sales?.length || 0) + 1);
      setHeader(prev => ({
        ...prev,
        billNo: nextBillNo,
        billDate: today(),
        chDate: today(),
        book: selectedBook || prev.book
      }));
      setFooter(prev => ({ ...prev, dueDate: today(), lrDate: today(), lrRecDate: today() }));
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
    billNo: '1',
    billDate: today(),
    challanNo: '',
    chDate: today(),
    gstType: '--Select GstType--',
  });

  const [gridItems, setGridItems] = useState([
    { id: 1, itemId: '', itemName: '', desc: '', packingType: '', unit: 'PCS', pcs: 0, cut: 0, mts: 0, saleRate: 0, amount: 0, disPer: 0, disAmt: 0, addAmt: 0, gstRate: 0 }
  ]);

  const [footer, setFooter] = useState({
    remarks: '',
    remark1: '',
    dueDays: 0,
    dueDate: today(),
    trnChrg: '',
    ccAttach: '',
    transport: '',
    lrNo: '',
    station: '',
    eway: '',
    lrDate: today(),
    lrRecDate: today(),
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
    target: 'party', // 'party' | 'broker'
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
    setInlineModal({ type: 'account', target: 'party', initialData: { name: search } });
  };

  const handleCreateBroker = (search) => {
    setInlineModal({ type: 'account', target: 'broker', initialData: { name: search, group: 'BROKER' } });
  };

  const handleCreateItem = (search, index) => {
    setInlineModal({ type: 'item', initialData: { itemName: search }, rowIndex: index });
  };

  const handleAccountSuccess = (newAccount) => {
    const id = newAccount._id || newAccount.id;
    if (inlineModal.target === 'broker') {
      setHeader(prev => ({ ...prev, broker: id }));
      return;
    }
    setHeader(prev => ({ 
      ...prev, 
      party: id,
      add: newAccount.address || '',
      gstin: newAccount.gstin || '',
      city: newAccount.station || newAccount.city || ''
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
      <div className="flex border-b-2 border-black p-0 bg-white gap-0 shrink-0">
         {['Generate Sales Bill', 'View Sales Bill'].map(tab => (
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

      <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden bg-white">
        
        {/* Header Section */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4 no-scrollbar">
           
           <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black whitespace-nowrap">Party & Broker Details</span>
              <div className="h-[2px] flex-1 bg-black" />
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase text-black tracking-widest">Party / Customer</label>
                  <ERPSearchableSelect 
                    className="w-full h-11 border-2 border-slate-100 focus:border-black transition-all font-bold" 
                    value={header.party}
                    onChange={(val) => {
                      const party = parties.find(p => p._id === val || p.id === val);
                      setHeader({...header, party: val, add: party?.address || '', gstin: party?.gstin || '', city: party?.station || party?.city || ''});
                    }}
                    onCreateNew={handleCreateAccount}
                    options={parties.filter(p => p.type !== 'Broker').map(p => ({value: p._id || p.id, label: p.name}))} 
                    label="Party"
                    createLabel="Party"
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
                    onCreateNew={handleCreateBroker}
                    options={parties.filter(p => p.type === 'Broker' || p.group === 'BROKER').map(p => ({value: p._id || p.id, label: p.name}))} 
                    label="Broker"
                    createLabel="Broker"
                  />
               </div>

               <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase text-black tracking-widest">Book / Sub-ledger</label>
                   <ERPSelect className="w-full h-11 border-2 border-slate-100 focus:border-black transition-all font-black bg-slate-50" value={header.book} onChange={e => setHeader({...header, book: e.target.value})} options={[{value: 'FINISH SALES', label: 'FINISH SALES'}, ...(header.book && header.book !== 'FINISH SALES' ? [{value: header.book, label: header.book}] : [])]} />
               </div>
           </div>

           <div className="flex items-center gap-3 pt-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black whitespace-nowrap">Invoice & Logistics Specs</span>
              <div className="h-[2px] flex-1 bg-black" />
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                     <label className="text-[10px] font-black uppercase text-black tracking-widest">Invoice No</label>
                     <ERPInput className="w-full h-11 border-2 border-slate-100 bg-slate-50 font-black text-black" value={header.billNo} readOnly />
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
                  <label className="text-[10px] font-black uppercase text-black tracking-widest">GST Type Toggle</label>
                  <div className="flex bg-slate-100 p-0 w-max border-2 border-black">
                     {['CGST+SGST', 'IGST'].map(type => (
                        <button
                           key={type}
                           type="button"
                           onClick={() => setHeader({ ...header, gstType: type })}
                           className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                              header.gstType === type 
                                 ? 'bg-black text-white' 
                                 : 'text-black hover:bg-slate-200'
                           }`}
                        >
                           {type}
                        </button>
                     ))}
                  </div>
               </div>

               <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase text-black tracking-widest">Payment Terms</label>
                  <select
                     className="w-full h-11 px-3 border-2 border-slate-100 focus:border-black outline-none font-bold text-sm bg-white transition-all"
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
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black whitespace-nowrap">Invoice Line Items</span>
              <div className="h-[2px] flex-1 bg-black" />
           </div>

           {/* High Density Grid */}
           <div className="border-2 border-black overflow-hidden shadow-none">
              <table className="w-full text-xs border-collapse">
                 <thead className="bg-black text-white border-b-2 border-black">
                    <tr className="h-10">
                       <th className="px-2 font-black text-center uppercase tracking-widest text-[10px] w-12">#</th>
                       <th className="px-3 text-left font-black uppercase tracking-widest text-[10px]">Item</th>
                       <th className="px-2 text-left font-black uppercase tracking-widest text-[10px] w-36">Lot</th>
                       <th className="px-2 text-center font-black uppercase tracking-widest text-[10px] w-20">Pcs</th>
                       <th className="px-2 text-center font-black uppercase tracking-widest text-[10px] w-20">Cut</th>
                       <th className="px-2 text-center font-black uppercase tracking-widest text-[10px] w-24">Qty (Mts)</th>
                       <th className="px-2 text-right font-black uppercase tracking-widest text-[10px] w-28">Rate</th>
                       <th className="px-2 text-right font-black uppercase tracking-widest text-[10px] w-28">Amount</th>
                       <th className="px-2 text-center font-black uppercase tracking-widest text-[10px] w-16">Action</th>
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
                               options={items.map(i => ({value: i._id || i.id, label: i.itemName || i.name}))} 
                               label="Item"
                               createLabel="Item"
                             />
                          </td>
                           <td className="px-2">
                              <select 
                                 className="w-full h-9 border-none bg-transparent hover:bg-slate-100 focus:bg-white transition-all px-1 text-xs outline-none font-black text-black"
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
                                 className="w-full h-9 text-center border-none bg-transparent hover:bg-slate-100 focus:bg-white transition-all px-1 text-xs outline-none font-bold" 
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
                                 className="w-full h-9 text-center border-none bg-transparent hover:bg-slate-100 focus:bg-white transition-all px-1 text-xs outline-none font-bold" 
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
                           <td className="px-2 text-center font-black text-black bg-slate-100">{row.mts || 0}</td>
                           <td className="px-2">
                              <input 
                                 type="number"
                                 className="w-full h-9 text-right border-none bg-transparent hover:bg-slate-100 focus:bg-white transition-all px-1 text-xs outline-none font-black" 
                                 value={row.saleRate || ''} 
                                 onChange={e => {
                                    const updated = [...gridItems];
                                    updated[idx].saleRate = Number(e.target.value);
                                    updated[idx].amount = updated[idx].mts * Number(e.target.value);
                                    setGridItems(updated);
                                 }} 
                              />
                           </td>
                           <td className="px-2 text-right font-black text-black bg-slate-100">₹ {parseFloat(row.amount || 0).toFixed(2)}</td>
                           <td className="px-2 text-center">
                              <button 
                                 type="button" 
                                 onClick={() => {
                                    const updated = gridItems.filter((_, i) => i !== idx);
                                    setGridItems(updated.length ? updated : [{ id: Date.now(), itemId: '', itemName: '', desc: '', packingType: '', unit: 'PCS', pcs: 0, cut: 0, mts: 0, saleRate: 0, amount: 0, disPer: 0, disAmt: 0, addAmt: 0, gstRate: 0 }]);
                                 }}
                                 className="p-1.5 text-black hover:bg-black hover:text-white transition-all rounded-none"
                              >
                                 <Trash2 size={14} />
                              </button>
                           </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>

           {/* Totals Section */}
           <div className="flex flex-col md:flex-row justify-between items-start gap-10 pt-8 border-t-2 border-black">
              <div className="flex-1 w-full">
                 <label className="text-[10px] font-black uppercase text-black tracking-widest">Remarks / Narration</label>
                 <textarea 
                    className="w-full p-4 border-2 border-slate-100 focus:border-black outline-none font-bold text-sm bg-white transition-all" 
                    rows={3} 
                    value={footer.remarks}
                    onChange={e => setFooter({ ...footer, remarks: e.target.value })}
                    placeholder="ENTER INVOICE NARRATION..."
                 />
              </div>

              {/* Gorgeous Totals Panel */}
              <div className="w-96 bg-black text-white p-8 space-y-3 shrink-0 shadow-none">
                 <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <span>Subtotal (Taxable)</span>
                    <span className="text-white">₹ {calculations.taxable.toFixed(2)}</span>
                 </div>
                 {header.gstType === 'IGST' ? (
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                       <span>IGST (5%)</span>
                       <span className="text-white">₹ {calculations.gstAmt.toFixed(2)}</span>
                    </div>
                 ) : (
                    <>
                       <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                          <span>CGST (2.5%)</span>
                          <span className="text-white">₹ {(calculations.gstAmt / 2).toFixed(2)}</span>
                       </div>
                       <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                          <span>SGST (2.5%)</span>
                          <span className="text-white">₹ {(calculations.gstAmt / 2).toFixed(2)}</span>
                       </div>
                    </>
                 )}
                 <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-white/20 pb-4">
                    <span>Round-off</span>
                    <span className="text-white">₹ 0.00</span>
                 </div>
                 <div className="flex justify-between items-center pt-2">
                    <span className="text-[12px] font-black uppercase tracking-[0.2em]">Net Amount</span>
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
              type="submit"
              disabled={saving}
              className="px-12 py-2 bg-white text-black text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all shadow-none disabled:opacity-50"
           >
              {saving ? 'Processing...' : 'Complete Invoice (F12)'}
           </button>
        </div>

      </form>

      {/* Inline Creation Modals */}
      <AccountMasterModal 
        isOpen={inlineModal.type === 'account'} 
        onClose={() => setInlineModal({ type: null, target: 'party', initialData: null, rowIndex: null })}
        initialData={inlineModal.initialData}
        onSuccess={handleAccountSuccess}
      />
      <ItemMasterModal 
        isOpen={inlineModal.type === 'item'} 
        onClose={() => setInlineModal({ type: null, target: 'party', initialData: null, rowIndex: null })}
        initialData={inlineModal.initialData}
        onSuccess={handleItemSuccess}
      />

    </Modal>
  );
};

export default SalesModal;
