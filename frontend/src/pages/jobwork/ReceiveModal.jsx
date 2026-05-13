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
      <div className="flex border-b border-[#E2E8F0] p-1 bg-slate-50 gap-1 shrink-0">
         {['Mill Receive', 'View Mill Rec'].map(tab => (
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
        
        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
           {/* Left Form Column (70%) */}
           <div className="flex-[3] flex flex-col overflow-y-auto p-5 space-y-4 no-scrollbar">
              
              <div className="flex items-center gap-3">
                 <span className="text-[12px] font-bold uppercase tracking-wider text-[#64748B] whitespace-nowrap">Receive Specs & Logistics</span>
                 <div className="h-[1px] flex-1 bg-[#E2E8F0]" />
              </div>

              {/* Form Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="flex flex-col gap-1">
                    <label className="text-[12px] font-bold text-slate-700">Processing Party</label>
                    <ERPSearchableSelect 
                      className="w-full h-[38px]" 
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
                    <label className="text-[12px] font-bold text-slate-700">Billing Group / No</label>
                    <ERPInput className="w-full h-[38px] text-sm" value={header.billGpNo} onChange={e => setHeader({...header, billGpNo: e.target.value})} />
                 </div>

                 <div className="flex flex-col gap-1">
                    <label className="text-[12px] font-bold text-slate-700">Address</label>
                    <ERPInput className="w-full h-[38px] text-sm" value={header.add} onChange={e => setHeader({...header, add: e.target.value})} />
                 </div>

                 <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                       <label className="text-[12px] font-bold text-slate-700">Receive Date</label>
                       <input 
                         type="date" 
                         className="w-full h-[38px] px-3 border border-[#CBD5E1] rounded-md focus:outline-none focus:ring-2 focus:ring-[#0D7377] text-slate-800 text-sm bg-white" 
                         value={header.date} 
                         onChange={e => setHeader({...header, date: e.target.value})} 
                       />
                    </div>
                    <div className="flex flex-col gap-1">
                       <label className="text-[12px] font-bold text-slate-700">Voucher No</label>
                       <ERPInput className="w-full h-[38px] text-sm font-bold text-slate-600 bg-slate-50" value={header.vno} readOnly />
                    </div>
                 </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                 <span className="text-[12px] font-bold uppercase tracking-wider text-[#64748B] whitespace-nowrap">Receive Line Items Grid</span>
                 <div className="h-[1px] flex-1 bg-[#E2E8F0]" />
              </div>

              {/* Grid Table */}
              <div className="border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
                 <table className="w-full text-xs border-collapse">
                    <thead className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E2E8F0]">
                       <tr className="h-10">
                          <th className="px-2 font-semibold text-center uppercase tracking-[0.05em] text-[11px] w-12">#</th>
                          <th className="px-3 text-left font-semibold uppercase tracking-[0.05em] text-[11px] w-36">Challan No</th>
                          <th className="px-3 text-left font-semibold uppercase tracking-[0.05em] text-[11px] w-32">Lot No</th>
                          <th className="px-3 text-left font-semibold uppercase tracking-[0.05em] text-[11px]">Item Received</th>
                          <th className="px-2 text-center font-semibold uppercase tracking-[0.05em] text-[11px] w-20">Issued (Mts)</th>
                          <th className="px-2 text-center font-semibold uppercase tracking-[0.05em] text-[11px] w-20">Rec (Mts)</th>
                          <th className="px-2 text-right font-semibold uppercase tracking-[0.05em] text-[11px] w-24">Rate</th>
                          <th className="px-2 text-right font-semibold uppercase tracking-[0.05em] text-[11px] w-24">Amt</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9]">
                       {gridItems.map((row, idx) => (
                          <tr key={row.id || idx} className={`h-[44px] hover:bg-[#F8FAFC] transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'}`}>
                             <td className="text-center text-slate-400 font-bold">{idx + 1}</td>
                             <td className="px-2">
                                <input 
                                   type="text" 
                                   className="w-full h-[32px] px-1 bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#0D7377] transition-all rounded text-xs outline-none font-semibold text-slate-700" 
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
                                   className="w-full h-[32px] px-1 bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#0D7377] transition-all rounded text-xs outline-none font-semibold text-slate-700" 
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
                                  className="w-full h-[32px] border-none bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#0D7377] transition-all rounded-md px-1" 
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
                                   className="w-full h-[32px] text-center border-none bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#0D7377] transition-all rounded text-xs outline-none font-semibold text-slate-600 bg-slate-50" 
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
                                   className="w-full h-[32px] text-center border-none bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#0D7377] transition-all rounded text-xs outline-none font-bold text-[#0D7377] bg-teal-50/30" 
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
                                   className="w-full h-[32px] text-right border-none bg-transparent hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#0D7377] transition-all rounded text-xs outline-none" 
                                   value={row.jobRate || ''} 
                                   onChange={e => {
                                      const updated = [...gridItems];
                                      updated[idx].jobRate = Number(e.target.value);
                                      updated[idx].jobAmt = (row.recMts || 0) * Number(e.target.value);
                                      setGridItems(updated);
                                   }} 
                                />
                             </td>
                             <td className="text-right font-bold text-slate-700 bg-slate-50 pr-3">₹ {parseFloat(row.jobAmt || 0).toFixed(2)}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>

           </div>

           {/* Yield & Wastage Monitor (Right Column 30%) */}
           <div className="flex-1 flex flex-col bg-slate-50 border-l border-[#E2E8F0] overflow-hidden">
              <div className="bg-[#1B3A6B] text-white text-xs px-4 h-[56px] flex justify-between items-center font-semibold shrink-0">
                 <span>Yield & Wastage Monitor</span>
                 <span className="px-2 py-0.5 bg-white/15 rounded text-[10px]">Real-time audit</span>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">
                 
                 <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm space-y-3">
                    <span className="text-[10px] uppercase font-bold text-[#64748B] tracking-wider">Metrics Overview</span>
                    
                    <div className="flex justify-between items-center py-1">
                       <span className="text-xs text-slate-500 font-medium">Issued (Grey Fabric)</span>
                       <span className="text-sm font-bold text-[#1B3A6B]">{totals.totalIssued.toFixed(2)} mts</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-t border-[#F1F5F9]">
                       <span className="text-xs text-slate-500 font-medium">Received (Finished)</span>
                       <span className="text-sm font-bold text-[#0D7377]">{totals.totalReceived.toFixed(2)} mts</span>
                    </div>
                 </div>

                 {/* Wastage Alert Box */}
                 <div className={`border rounded-xl p-4 shadow-sm transition-all ${
                    totals.isWastageHigh 
                       ? 'bg-rose-50 border-rose-200 text-rose-900 animate-pulse' 
                       : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                 }`}>
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-[10px] uppercase font-bold tracking-wider">Computed Wastage</span>
                       {totals.isWastageHigh ? (
                          <span className="px-2 py-0.5 bg-rose-600 text-white text-[9px] font-bold rounded-full uppercase tracking-widest">
                             High Warning ({'>'}10%)
                          </span>
                       ) : (
                          <span className="px-2 py-0.5 bg-emerald-600 text-white text-[9px] font-bold rounded-full uppercase tracking-widest">
                             Acceptable
                          </span>
                       )}
                    </div>

                    <div className="text-2xl font-black mb-1">
                       {totals.wastagePercentage.toFixed(1)}%
                    </div>
                    <p className="text-xs opacity-80 font-medium">
                       Wastage quantity is {totals.wastageMeters.toFixed(2)} meters of issued fabric.
                    </p>
                 </div>

                 {/* Diagnostic Helper Info */}
                 <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 text-[11px] text-slate-400 leading-relaxed shadow-sm">
                    <p className="font-semibold text-slate-500 mb-1">Wastage Tolerance Policy:</p>
                    Maximum allowable shrinkage/wastage during process is 10%. Over-wastage will deduct processing charges automatically.
                 </div>

              </div>
           </div>
        </div>

        {/* Action Footer */}
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
              onClick={onClose}
              className="h-[38px] px-6 bg-[#1B3A6B] hover:bg-[#142d56] text-white font-medium rounded-lg transition-all text-sm shadow-sm"
           >
              Save Receipt
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
