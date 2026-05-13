import React, { useState, useMemo } from 'react';
import Modal from '../../components/ui/Modal';
import { ERPInput, ERPSelect, ERPSearchableSelect } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';
import AccountMasterModal from '../masters/AccountMasterModal';
import ItemMasterModal from '../masters/ItemMasterModal';

const IssueModal = ({ isOpen, onClose, selectedBook = null }) => {
  const { parties, items } = useStore();
  const [activeTab, setActiveTab] = useState('Mill Issue');

  const [header, setHeader] = useState({
    book: 'PROCESS',
    challanNo: '1',
    date: '05/05/2026',
    jobParty: '',
    add: '',
    item: ''
  });

  React.useEffect(() => {
    if (isOpen && selectedBook) {
      setHeader(prev => ({ ...prev, book: selectedBook }));
    }
  }, [isOpen, selectedBook]);

  const [gridItems, setGridItems] = useState([
    { id: 1, purVno: '', billNo: '', partyName: '', totPcs: 0, totQty: 0, totKgs: 0, issPcs: 0, issQty: 0, issKgs: 0, purRate: 0 }
  ]);

  const [takaItems, setTakaItems] = useState([
    { sr: 1, purSr: 0, mts: 0.000, kgs: 0.000, cp: '' }
  ]);

  // Inline Modal State
  const [inlineModal, setInlineModal] = useState({
    type: null, // 'account' or 'item'
    initialData: null
  });

  const handleCreateAccount = (search) => {
    setInlineModal({ type: 'account', initialData: { name: search, group: 'SUNDRY CREDITORS' } });
  };

  const handleCreateItem = (search) => {
    setInlineModal({ type: 'item', initialData: { itemName: search, group: 'GREY' } });
  };

  const handleAccountSuccess = (newAccount) => {
    setHeader(prev => ({ 
      ...prev, 
      jobParty: newAccount.id,
      add: newAccount.address || ''
    }));
  };

  const handleItemSuccess = (newItem) => {
    setHeader(prev => ({ 
      ...prev, 
      item: newItem.id
    }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Issue to Mill (Process Work)" className="max-w-[95vw] h-[90vh] p-0 overflow-hidden">
      
      {/* Dynamic Tab Navigation */}
      <div className="flex border-b border-[#E2E8F0] p-1 bg-slate-50 gap-1 shrink-0">
         {['Mill Issue', 'View Mill Issue'].map(tab => (
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
           {/* Left Form (70%) */}
           <div className="flex-[3] flex flex-col overflow-y-auto p-5 space-y-4 no-scrollbar">
              
              <div className="flex items-center gap-3">
                 <span className="text-[12px] font-bold uppercase tracking-wider text-[#64748B] whitespace-nowrap">Process Specifications</span>
                 <div className="h-[1px] flex-1 bg-[#E2E8F0]" />
              </div>

              {/* Form details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="flex flex-col gap-1">
                    <label className="text-[12px] font-bold text-slate-700">Challan / Order No</label>
                    <ERPInput className="w-full h-[38px] text-sm font-bold text-[#1B3A6B] bg-slate-50 border border-slate-200" value={header.challanNo} readOnly />
                 </div>

                 <div className="flex flex-col gap-1">
                    <label className="text-[12px] font-bold text-slate-700">Challan Date</label>
                    <input 
                      type="date" 
                      className="w-full h-[38px] px-3 border border-[#CBD5E1] rounded-md focus:outline-none focus:ring-2 focus:ring-[#0D7377] text-slate-800 text-sm bg-white" 
                      value={header.date} 
                      onChange={e => setHeader({...header, date: e.target.value})} 
                    />
                 </div>

                 <div className="flex flex-col gap-1">
                    <label className="text-[12px] font-bold text-slate-700">Job Worker / Mill Party</label>
                    <ERPSearchableSelect 
                      className="w-full h-[38px]" 
                      value={header.jobParty}
                      onChange={(val) => {
                         const party = parties.find(p => p.id === val);
                         setHeader({...header, jobParty: val, add: party?.address || ''});
                      }}
                      onCreateNew={handleCreateAccount}
                      options={parties.map(p => ({value: p.id, label: p.name}))} 
                      label="Job Party"
                    />
                 </div>

                 <div className="flex flex-col gap-1">
                    <label className="text-[12px] font-bold text-slate-700">Item Fabric (Grey)</label>
                    <ERPSearchableSelect 
                      className="w-full h-[38px]" 
                      value={header.item}
                      onChange={(val) => setHeader({...header, item: val})}
                      onCreateNew={handleCreateItem}
                      options={items.map(i => ({value: i.id, label: i.itemName}))} 
                      label="Item"
                    />
                 </div>
              </div>

              {/* Process type colored button group selection */}
              <div className="flex flex-col gap-2 pt-2">
                 <label className="text-[12px] font-bold text-slate-700 uppercase tracking-wider">Process Type Selection</label>
                 <div className="flex gap-2 flex-wrap">
                    {[
                       { name: 'Bleaching', color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100', activeColor: 'bg-blue-600 text-white border-blue-600' },
                       { name: 'Dyeing', color: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100', activeColor: 'bg-indigo-600 text-white border-indigo-600' },
                       { name: 'Printing', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100', activeColor: 'bg-emerald-600 text-white border-emerald-600' },
                       { name: 'Calendar', color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100', activeColor: 'bg-amber-600 text-white border-amber-600' }
                    ].map(proc => {
                       const isActive = header.book === proc.name.toUpperCase();
                       return (
                          <button
                             key={proc.name}
                             type="button"
                             onClick={() => setHeader({ ...header, book: proc.name.toUpperCase() })}
                             className={`px-4 py-2 border text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shadow-sm ${
                                isActive ? proc.activeColor : proc.color
                             }`}
                          >
                             {proc.name}
                          </button>
                       );
                    })}
                 </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                 <span className="text-[12px] font-bold uppercase tracking-wider text-[#64748B] whitespace-nowrap">Challan Allocation Grid</span>
                 <div className="h-[1px] flex-1 bg-[#E2E8F0]" />
              </div>

              {/* Grid Table */}
              <div className="border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
                 <table className="w-full text-xs border-collapse">
                    <thead className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E2E8F0]">
                       <tr className="h-10">
                          <th className="px-2 font-semibold text-center uppercase tracking-[0.05em] text-[11px] w-12">#</th>
                          <th className="px-3 text-left font-semibold uppercase tracking-[0.05em] text-[11px]">PurVno</th>
                          <th className="px-2 text-center font-semibold uppercase tracking-[0.05em] text-[11px] w-24">Bill No</th>
                          <th className="px-2 text-center font-semibold uppercase tracking-[0.05em] text-[11px] w-20">Tot Pcs</th>
                          <th className="px-2 text-center font-semibold uppercase tracking-[0.05em] text-[11px] w-24">Tot Qty</th>
                          <th className="px-2 text-center font-semibold uppercase tracking-[0.05em] text-[11px] w-24">Iss Qty</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9]">
                       {[...Array(4)].map((_, idx) => (
                          <tr key={idx} className={`h-[40px] hover:bg-[#F8FAFC] transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'}`}>
                             <td className="text-center text-slate-400 font-bold">{idx + 1}</td>
                             <td className="px-3 font-semibold text-[#1b3a6b]">PUR-2026-00{idx + 1}</td>
                             <td className="text-center text-slate-500">B-108{idx}</td>
                             <td className="text-center font-bold text-slate-600 bg-slate-50">12</td>
                             <td className="text-center font-bold text-slate-600 bg-slate-50">240.00</td>
                             <td className="px-2">
                                <input 
                                   type="number" 
                                   className="w-full h-[28px] text-center border border-slate-200 bg-transparent focus:bg-white focus:ring-1 focus:ring-[#0D7377] transition-all rounded px-1 text-xs outline-none" 
                                   placeholder="0.00" 
                                />
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>

           </div>

           {/* Lot Selector Card Grid (Right Column 30%) */}
           <div className="flex-1 flex flex-col bg-slate-50 border-l border-[#E2E8F0] overflow-hidden">
              <div className="bg-[#1B3A6B] text-white text-xs px-4 h-[56px] flex justify-between items-center font-semibold shrink-0">
                 <span>Available Lots selector</span>
                 <span className="px-2 py-0.5 bg-white/15 rounded text-[10px]">Select Lot to Issue</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                 {[
                    { lotNo: 'LOT-2026-A1', mtrs: '1,450 Mtrs', grade: 'Premium A+', bg: 'hover:border-[#0D7377]' },
                    { lotNo: 'LOT-2026-A2', mtrs: '820 Mtrs', grade: 'Standard A', bg: 'hover:border-[#0D7377]' },
                    { lotNo: 'LOT-2026-B1', mtrs: '2,100 Mtrs', grade: 'Commercial B', bg: 'hover:border-amber-500' }
                 ].map(lot => (
                    <div 
                       key={lot.lotNo}
                       onClick={() => setHeader({ ...header, challanNo: lot.lotNo })}
                       className={`bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-sm cursor-pointer transition-all ${lot.bg} hover:shadow-md hover:scale-[1.02]`}
                    >
                       <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-[#1B3A6B]">{lot.lotNo}</span>
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold rounded-full">
                             {lot.grade}
                          </span>
                       </div>
                       <div className="flex justify-between items-center text-xs text-slate-500">
                          <span>Available Meters</span>
                          <span className="font-bold text-[#0D7377]">{lot.mtrs}</span>
                       </div>
                    </div>
                 ))}
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
              Save & Issue
           </button>
        </div>

      </div>

      {/* Inline Creation Modals */}
      <AccountMasterModal 
        isOpen={inlineModal.type === 'account'} 
        onClose={() => setInlineModal({ type: null, initialData: null })}
        initialData={inlineModal.initialData}
        onSuccess={handleAccountSuccess}
      />
      <ItemMasterModal 
        isOpen={inlineModal.type === 'item'} 
        onClose={() => setInlineModal({ type: null, initialData: null })}
        initialData={inlineModal.initialData}
        onSuccess={handleItemSuccess}
      />

    </Modal>
  );
};

export default IssueModal;
