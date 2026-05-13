import React, { useState, useMemo } from 'react';
import Modal from '../../components/ui/Modal';
import { ERPInput, ERPSelect, ERPSearchableSelect } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';
import AccountMasterModal from '../masters/AccountMasterModal';
import ItemMasterModal from '../masters/ItemMasterModal';

const ReceiveModal = ({ isOpen, onClose, selectedBook = null }) => {
  const { parties, items } = useStore();
  const [activeTab, setActiveTab] = useState('Mill Receive');

  const [header, setHeader] = useState({
    book: 'PROCESS',
    jobParty: '',
    add: '',
    hsnCode: '9988',
    gstin: '',
    panNo: '',
    vno: '1',
    date: '05/05/2026',
    billGpNo: '',
    type: '--Select GstType--'
  });

  React.useEffect(() => {
    if (isOpen && selectedBook) {
      setHeader(prev => ({ ...prev, book: selectedBook }));
    }
  }, [isOpen, selectedBook]);

  const [gridItems, setGridItems] = useState([
    { id: 1, challanNo: '', lotNo: '', itemId: '', itemName: '', greyPcs: 0, greyQty: 0, recPcs: 0, recMts: 0, jobRate: 0, jobAmt: 0 }
  ]);

  // Inline Modal State
  const [inlineModal, setInlineModal] = useState({
    type: null, // 'account' or 'item'
    initialData: null,
    rowIndex: null
  });

  const handleCreateAccount = (search) => {
    setInlineModal({ type: 'account', initialData: { name: search, group: 'SUNDRY CREDITORS' } });
  };

  const handleCreateItem = (search, index) => {
    setInlineModal({ type: 'item', initialData: { itemName: search, group: 'FINISHED' }, rowIndex: index });
  };

  const handleAccountSuccess = (newAccount) => {
    setHeader(prev => ({ 
      ...prev, 
      jobParty: newAccount.id,
      add: newAccount.address || '',
      gstin: newAccount.gstin || ''
    }));
  };

  const handleItemSuccess = (newItem) => {
    const updatedGrid = [...gridItems];
    updatedGrid[inlineModal.rowIndex] = { 
      ...updatedGrid[inlineModal.rowIndex], 
      itemId: newItem.id,
      itemName: newItem.itemName
    };
    setGridItems(updatedGrid);
  };

  const totals = useMemo(() => {
    const totalIssued = gridItems.reduce((acc, row) => acc + (parseFloat(row.greyQty) || 0), 0);
    const totalReceived = gridItems.reduce((acc, row) => acc + (parseFloat(row.recMts) || 0), 0);
    const wastageMeters = Math.max(0, totalIssued - totalReceived);
    const wastagePercentage = totalIssued > 0 ? (wastageMeters / totalIssued) * 100 : 0;
    const isWastageHigh = wastagePercentage > 10;
    return {
      totalIssued,
      totalReceived,
      wastageMeters,
      wastagePercentage,
      isWastageHigh
    };
  }, [gridItems]);

  // Auto append row if last row is filled
  React.useEffect(() => {
    const lastRow = gridItems[gridItems.length - 1];
    if (lastRow && (lastRow.itemId || lastRow.lotNo || lastRow.challanNo)) {
      setGridItems(prev => [
        ...prev,
        { id: Date.now(), challanNo: '', lotNo: '', itemId: '', itemName: '', greyPcs: 0, greyQty: 0, recPcs: 0, recMts: 0, jobRate: 0, jobAmt: 0 }
      ]);
    }
  }, [gridItems]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mill Receive Receipt" className="max-w-[95vw] h-[90vh] p-0 overflow-hidden">
      
      {/* Dynamic Tab Navigation */}
      <div className="flex border-b-2 border-black p-0 bg-white gap-0 shrink-0">
         {['Mill Receive', 'View Mill Rec'].map(tab => (
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
        
        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
           {/* Left Form Column (70%) */}
           <div className="flex-[3] flex flex-col overflow-y-auto p-5 space-y-4 no-scrollbar">
              
               <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black whitespace-nowrap">Receive Specs & Logistics</span>
                  <div className="h-[2px] flex-1 bg-black" />
               </div>

              {/* Form Info */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                     <label className="text-[10px] font-black uppercase text-black tracking-widest">Processing Party</label>
                     <ERPSearchableSelect 
                       className="w-full h-11 border-2 border-slate-100 focus:border-black transition-all font-bold" 
                       value={header.jobParty}
                       onChange={(val) => {
                          const party = parties.find(p => p.id === val);
                          setHeader({...header, jobParty: val, add: party?.address || '', gstin: party?.gstin || ''});
                       }}
                       onCreateNew={handleCreateAccount}
                       options={parties.map(p => ({value: p.id, label: p.name}))} 
                       label="Job Party"
                     />
                  </div>

                  <div className="flex flex-col gap-1">
                     <label className="text-[10px] font-black uppercase text-black tracking-widest">Billing Group / No</label>
                     <ERPInput className="w-full h-11 border-2 border-slate-100 focus:border-black font-bold transition-all" value={header.billGpNo} onChange={e => setHeader({...header, billGpNo: e.target.value})} />
                  </div>

                  <div className="flex flex-col gap-1">
                     <label className="text-[10px] font-black uppercase text-black tracking-widest">Address</label>
                     <ERPInput className="w-full h-11 border-2 border-slate-100 focus:border-black font-bold transition-all" value={header.add} onChange={e => setHeader({...header, add: e.target.value})} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                     <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black uppercase text-black tracking-widest">Receive Date</label>
                        <input 
                          type="date" 
                          className="w-full h-11 px-3 border-2 border-slate-100 focus:border-black outline-none font-bold text-sm bg-white transition-all" 
                          value={header.date} 
                          onChange={e => setHeader({...header, date: e.target.value})} 
                        />
                     </div>
                     <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black uppercase text-black tracking-widest">Voucher No</label>
                        <ERPInput className="w-full h-11 border-2 border-slate-100 bg-slate-50 font-black text-black" value={header.vno} readOnly />
                     </div>
                  </div>
               </div>

               <div className="flex items-center gap-3 pt-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black whitespace-nowrap">Receive Line Items Grid</span>
                  <div className="h-[2px] flex-1 bg-black" />
               </div>

               {/* Grid Table */}
               <div className="border-2 border-black overflow-hidden shadow-none">
                  <table className="w-full text-xs border-collapse">
                     <thead className="bg-black text-white border-b-2 border-black">
                        <tr className="h-10">
                           <th className="px-2 font-black text-center uppercase tracking-widest text-[10px] w-12">#</th>
                           <th className="px-3 text-left font-black uppercase tracking-widest text-[10px] w-36">Challan No</th>
                           <th className="px-3 text-left font-black uppercase tracking-widest text-[10px] w-32">Lot No</th>
                           <th className="px-3 text-left font-black uppercase tracking-widest text-[10px]">Item Received</th>
                           <th className="px-2 text-center font-black uppercase tracking-widest text-[10px] w-20">Issued (Mts)</th>
                           <th className="px-2 text-center font-black uppercase tracking-widest text-[10px] w-20">Rec (Mts)</th>
                           <th className="px-2 text-right font-black uppercase tracking-widest text-[10px] w-24">Rate</th>
                           <th className="px-2 text-right font-black uppercase tracking-widest text-[10px] w-24">Amt</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y-2 divide-slate-100">
                        {gridItems.map((row, idx) => (
                           <tr key={row.id || idx} className={`h-[44px] hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'}`}>
                              <td className="text-center text-black font-black">{idx + 1}</td>
                              <td className="px-2">
                                 <input 
                                    type="text" 
                                    className="w-full h-8 px-1 bg-transparent hover:bg-slate-100 focus:bg-white transition-all text-xs outline-none font-bold text-black" 
                                    value={row.challanNo} 
                                    onChange={e => {
                                       const updated = [...gridItems];
                                       updated[idx].challanNo = e.target.value;
                                       setGridItems(updated);
                                    }} 
                                 />
                              </td>
                              <td className="px-2">
                                 <input 
                                    type="text" 
                                    className="w-full h-8 px-1 bg-transparent hover:bg-slate-100 focus:bg-white transition-all text-xs outline-none font-bold text-black" 
                                    value={row.lotNo} 
                                    onChange={e => {
                                       const updated = [...gridItems];
                                       updated[idx].lotNo = e.target.value;
                                       setGridItems(updated);
                                    }} 
                                 />
                              </td>
                              <td className="px-2">
                                 <ERPSearchableSelect 
                                   className="w-full h-8 border-none bg-transparent hover:bg-slate-100 focus:bg-white transition-all px-1 font-bold" 
                                   value={row.itemId}
                                   onChange={(val) => {
                                      const item = items.find(i => i.id === val);
                                      const updated = [...gridItems];
                                      updated[idx].itemId = val;
                                      updated[idx].itemName = item?.itemName || '';
                                      setGridItems(updated);
                                   }}
                                   onCreateNew={(search) => handleCreateItem(search, idx)}
                                   options={items.map(i => ({value: i.id, label: i.itemName}))} 
                                   label="Item"
                                 />
                              </td>
                              <td className="px-2">
                                 <input 
                                    type="number" 
                                    className="w-full h-8 text-center border-none bg-slate-100 transition-all text-xs outline-none font-black text-black" 
                                    value={row.greyQty || ''} 
                                    onChange={e => {
                                       const updated = [...gridItems];
                                       updated[idx].greyQty = Number(e.target.value);
                                       updated[idx].jobAmt = (row.recMts || 0) * (row.jobRate || 0);
                                       setGridItems(updated);
                                    }} 
                                 />
                              </td>
                              <td className="px-2">
                                 <input 
                                    type="number" 
                                    className="w-full h-8 text-center border-none bg-black text-white transition-all text-xs outline-none font-black" 
                                    value={row.recMts || ''} 
                                    onChange={e => {
                                       const updated = [...gridItems];
                                       updated[idx].recMts = Number(e.target.value);
                                       updated[idx].jobAmt = Number(e.target.value) * (row.jobRate || 0);
                                       setGridItems(updated);
                                    }} 
                                 />
                              </td>
                              <td className="px-2">
                                 <input 
                                    type="number" 
                                    className="w-full h-8 text-right border-none bg-transparent hover:bg-slate-100 focus:bg-white transition-all text-xs outline-none font-black" 
                                    value={row.jobRate || ''} 
                                    onChange={e => {
                                       const updated = [...gridItems];
                                       updated[idx].jobRate = Number(e.target.value);
                                       updated[idx].jobAmt = (row.recMts || 0) * Number(e.target.value);
                                       setGridItems(updated);
                                    }} 
                                 />
                              </td>
                              <td className="text-right font-black text-black bg-slate-100 pr-3">₹ {parseFloat(row.jobAmt || 0).toFixed(2)}</td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
           </div>

           {/* Yield & Wastage Monitor (Right Column 30%) */}
            <div className="flex-1 flex flex-col bg-white border-l-2 border-black overflow-hidden">
               <div className="bg-black text-white text-[10px] px-6 h-[56px] flex justify-between items-center font-black uppercase tracking-widest shrink-0">
                  <span>Yield & Wastage Monitor</span>
                  <span className="px-3 py-1 bg-white text-black rounded-none">Real-time audit</span>
               </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">
                 
                  <div className="bg-white border-2 border-black p-5 space-y-4 shadow-none">
                     <span className="text-[10px] font-black uppercase text-black tracking-[0.2em]">Metrics Overview</span>
                     
                     <div className="flex justify-between items-center py-1">
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Issued (Grey Fabric)</span>
                        <span className="text-sm font-black text-black">{totals.totalIssued.toFixed(2)} mts</span>
                     </div>

                     <div className="flex justify-between items-center py-1 border-t border-slate-100">
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Received (Finished)</span>
                        <span className="text-sm font-black text-black">{totals.totalReceived.toFixed(2)} mts</span>
                     </div>
                  </div>
                  {/* Wastage Alert Box */}
                  <div className={`border-2 p-5 transition-all ${
                     totals.isWastageHigh 
                        ? 'bg-black border-black text-white' 
                        : 'bg-white border-black text-black'
                  }`}>
                     <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest">Computed Wastage</span>
                        {totals.isWastageHigh ? (
                           <span className="px-3 py-1 bg-white text-black text-[9px] font-black uppercase tracking-widest">
                              CRITICAL ALERT ({'>'}10%)
                           </span>
                        ) : (
                           <span className="px-3 py-1 bg-black text-white text-[9px] font-black uppercase tracking-widest">
                              OPTIMAL
                           </span>
                        )}
                     </div>

                     <div className="text-4xl font-black mb-2">
                        {totals.wastagePercentage.toFixed(1)}%
                     </div>
                     <p className={`text-[10px] font-black uppercase tracking-widest leading-relaxed ${totals.isWastageHigh ? 'text-slate-400' : 'text-slate-500'}`}>
                        Wastage quantity is {totals.wastageMeters.toFixed(2)} meters of issued fabric.
                     </p>
                  </div>

                  {/* Diagnostic Helper Info */}
                  <div className="bg-slate-50 border-2 border-slate-100 p-5 text-[10px] text-slate-500 font-black uppercase tracking-widest leading-relaxed">
                     <p className="text-black mb-2 border-b border-slate-200 pb-2">Wastage Tolerance Policy:</p>
                     Maximum allowable shrinkage/wastage during process is 10%. Over-wastage will deduct processing charges automatically.
                  </div>

              </div>
           </div>
        </div>

         {/* Action Footer */}
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
               onClick={onClose}
               className="px-12 py-2 bg-white text-black text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
            >
               Save Receipt (F12)
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

export default ReceiveModal;
