import React, { useState, useMemo } from 'react';
import Modal from '../../components/ui/Modal';
import { ERPInput, ERPSelect } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';

const JobReceiptModal = ({ isOpen, onClose, selectedBook = null }) => {
  const { parties, items } = useStore();
  const [activeTab, setActiveTab] = useState('Job Receive');

  const [header, setHeader] = useState({
    book: 'EMB. JOBWORK',
    jobParty: '',
    add: '',
    broker: '',
    partyGstin: '',
    panNo: '',
    hsnCode: '9988',
    vno: '1',
    date: '05/05/2026',
    billChNo: '',
    type: '--Select GstType--',
  });

  React.useEffect(() => {
    if (isOpen && selectedBook) {
      setHeader(prev => ({ ...prev, book: selectedBook }));
    }
  }, [isOpen, selectedBook]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Job Receipt" className="max-w-[98vw] h-[95vh] p-0 overflow-hidden bg-[#e1e9f5]">
      
      <div className="flex bg-[#cbd5e1] border-b border-slate-400 p-0.5 gap-0.5">
         {['Job Receive', 'View Job Rec'].map(tab => (
           <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1 text-[11px] font-bold border-t-2 ${activeTab === tab ? 'bg-white border-indigo-600 text-slate-900' : 'bg-slate-200 border-transparent text-slate-500'}`}
           >
             {tab}
           </button>
         ))}
      </div>

      <div className="flex flex-col h-full overflow-hidden">
        
        {/* Header */}
        <div className="p-2 grid grid-cols-12 gap-x-6 gap-y-1 bg-[#f8fafc] border-b border-slate-300">
           <div className="col-span-1 flex items-center">
              <ERPInput className="h-6 text-[11px]" value="1" />
           </div>
           <div className="col-span-6 space-y-1">
              <div className="flex items-center gap-2">
                 <label className="text-[11px] font-black w-20 uppercase">Book</label>
                 <ERPSelect className="flex-1 h-6 text-[11px] bg-orange-100 font-bold" value={header.book} onChange={e => setHeader({...header, book: e.target.value})} options={[{value: header.book, label: header.book}]} />
              </div>
              <div className="flex items-center gap-2">
                 <label className="text-[11px] font-black w-20 uppercase">Job Party</label>
                 <ERPSelect className="flex-1 h-6 text-[11px]" options={parties.map(p => ({value: p.id, label: p.name}))} />
              </div>
              <div className="flex items-center gap-2">
                 <label className="text-[11px] font-black w-20 uppercase">Add.</label>
                 <ERPInput className="flex-1 h-6 text-[11px]" />
              </div>
              <div className="flex items-center gap-2">
                 <label className="text-[11px] font-black w-20 uppercase">Broker</label>
                 <ERPSelect className="flex-1 h-6 text-[11px]" options={parties.filter(p => p.group === 'Broker').map(p => ({value: p.id, label: p.name}))} />
              </div>
           </div>

           <div className="col-span-5 space-y-1 border-l border-slate-200 pl-4">
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                    <div className="flex items-center gap-2">
                       <label className="text-[11px] font-black w-20 text-rose-600 uppercase">Party Gstin</label>
                       <ERPInput className="flex-1 h-6 text-[11px]" />
                    </div>
                    <div className="flex items-center gap-2">
                       <label className="text-[11px] font-black w-20 text-rose-600 uppercase">Pan No</label>
                       <ERPInput className="flex-1 h-6 text-[11px]" />
                    </div>
                    <div className="flex items-center gap-2">
                       <label className="text-[11px] font-black w-20 uppercase">HsnCode</label>
                       <ERPInput className="w-32 h-6 text-[11px]" value="9988" />
                    </div>
                 </div>
                 <div className="space-y-1">
                    <div className="flex items-center gap-2">
                       <label className="text-[11px] font-black w-24 text-right uppercase">Vno.</label>
                       <ERPInput className="w-24 h-6 text-[11px]" value="1" />
                    </div>
                    <div className="flex items-center gap-2">
                       <label className="text-[11px] font-black w-24 text-right uppercase">Date.</label>
                       <ERPInput className="w-24 h-6 text-[11px]" value="05/05/2026" />
                    </div>
                    <div className="flex items-center gap-2">
                       <label className="text-[11px] font-black w-24 text-right uppercase">Bill/Ch No.</label>
                       <ERPInput className="w-24 h-6 text-[11px]" />
                    </div>
                    <div className="flex items-center gap-2">
                       <label className="text-[11px] font-black w-24 text-right uppercase">Type</label>
                       <ERPSelect className="w-24 h-6 text-[11px]" options={[{value: '--Select GstType--', label: '--Select GstType--'}]} />
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto bg-[#8e97a3] border-b border-slate-400">
           <table className="w-full text-[9px] border-collapse border border-slate-500">
              <thead className="bg-[#1e293b] text-white sticky top-0">
                 <tr>
                    {['Sr No.', 'Challan No.', 'JobChal', 'Item Name', 'Finish Item', 'Unit', 'Rec Pcs', 'Cut', 'Rec Mts.', 'RecKgs', 'Plain', 'Damage', 'Short', 'Fresh Qty.', 'Consump tion', 'Job Rate', 'Job Amt.'].map(h => (
                       <th key={h} className="border border-slate-600 px-1 py-1 font-bold whitespace-nowrap">{h}</th>
                    ))}
                 </tr>
              </thead>
              <tbody className="bg-white">
                 {[...Array(12)].map((_, idx) => (
                    <tr key={idx} className="h-6 odd:bg-slate-50">
                       <td className="border border-slate-300 text-center bg-slate-100">{idx + 1}</td>
                       <td className="border border-slate-300 px-1"></td>
                       <td className="border border-slate-300 px-1"></td>
                       <td className="border border-slate-300 px-1"><ERPSelect className="w-full h-4 border-none p-0 text-[10px]" options={items.map(i => ({value: i.id, label: i.itemName}))} /></td>
                       <td className="border border-slate-300 px-1"><ERPSelect className="w-full h-4 border-none p-0 text-[10px]" options={items.map(i => ({value: i.id, label: i.itemName}))} /></td>
                       <td className="border border-slate-300 px-1 text-center">MTRS</td>
                       <td className="border border-slate-300 px-1 text-center bg-indigo-50 font-bold">0</td>
                       <td className="border border-slate-300 px-1 text-center">0.00</td>
                       <td className="border border-slate-300 px-1 text-center bg-indigo-50 font-bold">0.00</td>
                       <td className="border border-slate-300 px-1 text-center">0.000</td>
                       <td className="border border-slate-300 px-1 text-center">0.00</td>
                       <td className="border border-slate-300 px-1 text-center text-rose-600">0.00</td>
                       <td className="border border-slate-300 px-1 text-center text-rose-600">0.00</td>
                       <td className="border border-slate-300 px-1 text-center font-bold bg-emerald-50">0.00</td>
                       <td className="border border-slate-300 px-1 text-center">0.00</td>
                       <td className="border border-slate-300 px-1 text-right">0.00</td>
                       <td className="border border-slate-300 px-1 text-right">0.00</td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>

        {/* Summary Row */}
        <div className="bg-[#cbd5e1] border-b border-slate-400 p-1 flex justify-between text-[11px] font-black uppercase text-center">
           <div className="flex gap-4">
              <span>Total Pcs</span>
              <span className="bg-white px-8 border border-slate-400">0</span>
              <span>Total Qty</span>
              <span className="bg-white px-8 border border-slate-400">0.00</span>
           </div>
           <div className="flex gap-4">
              <span>Total FreshQty</span>
              <span className="bg-emerald-900 text-white px-8">0.00</span>
              <span className="bg-white px-8 border border-slate-400">0.00</span>
           </div>
        </div>

        {/* Bottom Details */}
        <div className="bg-[#f1f5f9] p-2 border-t border-slate-400">
           <div className="grid grid-cols-12 gap-4">
              <div className="col-span-4 bg-white border border-slate-300 rounded shadow-sm">
                 <div className="flex bg-slate-100 border-b border-slate-200 p-0.5 text-[9px] font-black uppercase">
                    {['Add/Less', 'Gst Details'].map(t => (
                       <span key={t} className="px-2 border-r border-slate-300">{t}</span>
                    ))}
                 </div>
                 <div className="p-2 space-y-1 text-[11px]">
                    <div className="flex items-center justify-between gap-1">
                       <label className="w-16">Disc %</label>
                       <ERPInput className="w-16 h-5 bg-rose-50" value="0.00" />
                       <label className="w-12">Amt :</label>
                       <ERPInput className="w-24 h-5 bg-slate-50" readOnly value="0.00" />
                    </div>
                    <div className="flex items-center justify-between gap-1">
                       <label className="w-16">Oth Less %</label>
                       <ERPInput className="w-16 h-5" value="0.00" />
                       <label className="w-12">Amt :</label>
                       <ERPInput className="w-24 h-5 bg-slate-50" readOnly value="0.00" />
                    </div>
                    <div className="flex items-center justify-between gap-1">
                       <label className="w-16">Oth Add %</label>
                       <ERPInput className="w-16 h-5" value="0.00" />
                       <label className="w-12">Amt :</label>
                       <ERPInput className="w-24 h-5 bg-slate-50" readOnly value="0.00" />
                    </div>
                 </div>
              </div>

              <div className="col-span-4 space-y-1 text-[11px]">
                 <div className="bg-slate-200/50 p-2 border border-slate-300 rounded">
                    <div className="flex items-center gap-2">
                       <label className="text-[11px] font-black w-20 uppercase">Tds A/c</label>
                       <ERPSelect className="flex-1 h-6 text-[11px] bg-orange-100" options={[]} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                       <div className="flex items-center gap-2">
                          <label className="text-[10px] font-black w-16">Tds on Amt :</label>
                          <ERPInput className="flex-1 h-5 bg-slate-50 font-bold" value="0.00" />
                       </div>
                       <div className="flex items-center gap-2">
                          <label className="text-[10px] font-black w-12">Tds %</label>
                          <ERPInput className="w-10 h-5" value="0.00" />
                          <ERPInput className="w-20 h-5 bg-slate-50 font-bold" value="0.00" />
                       </div>
                    </div>
                 </div>
                 <div className="pt-2">
                    <div className="flex items-center gap-2 mt-1">
                       <label className="text-[11px] font-black w-16 uppercase">Remark</label>
                       <ERPInput className="flex-1 h-5" />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                       <label className="text-[11px] font-black w-16 uppercase">Remark1</label>
                       <ERPInput className="flex-1 h-5" />
                    </div>
                 </div>
              </div>

              <div className="col-span-4 bg-slate-100 border border-slate-300 p-2 space-y-1 text-[11px] font-black">
                 <div className="flex justify-between"><span>Tot Amt :</span><span>0.00</span></div>
                 <div className="flex justify-between"><span>Tot Less Amt :</span><span>0.00</span></div>
                 <div className="flex justify-between"><span>Tot Add Amt :</span><span>0.00</span></div>
                 <div className="flex justify-between"><span>Taxble Amt :</span><span>0.00</span></div>
                 <div className="flex justify-between"><span>Total Gst Amt :</span><span>0.00</span></div>
                 <div className="flex justify-between border-t border-slate-300 pt-1">
                    <span>Net Amount :</span>
                    <span>0.00</span>
                 </div>
                 <div className="flex justify-between text-indigo-700 text-lg">
                    <span>Final Amount :</span>
                    <span>0.00</span>
                 </div>
                 <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-300">
                    <label className="text-[10px] font-black uppercase">RoundOff :</label>
                    <ERPInput className="w-20 h-6 text-right font-bold" value="0.00" />
                 </div>
              </div>
           </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-900 p-1 flex justify-between gap-1 border-t border-slate-700 mt-auto">
           <div className="flex gap-1 overflow-x-auto no-scrollbar">
              {['Add', 'Edit', 'Save', 'Cancel', 'Find', 'Print', 'Delete', 'Exit'].map(btn => (
                 <button key={btn} className={`px-5 py-1.5 text-[10px] font-black uppercase tracking-tighter ${btn === 'Save' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-800'} border border-slate-400`}>
                    {btn}
                 </button>
              ))}
           </div>
           <div className="flex gap-1">
              <button className="px-3 py-1.5 bg-rose-600 text-white text-[10px] font-black uppercase border border-rose-700">Close Bill</button>
              <button className="px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-black uppercase border border-indigo-700">Pay Details</button>
              <button className="px-3 py-1.5 bg-slate-600 text-white text-[10px] font-black uppercase border border-slate-700">JobIss Details</button>
              <button className="px-3 py-1.5 bg-slate-600 text-white text-[10px] font-black uppercase border border-slate-700">Old Year</button>
           </div>
        </div>

      </div>
    </Modal>
  );
};

export default JobReceiptModal;
