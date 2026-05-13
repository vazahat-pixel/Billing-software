import React, { useState, useMemo } from 'react';
import Modal from '../../components/ui/Modal';
import { ERPInput, ERPSelect } from '../../components/forms/FormElements';
import useStore from '../../store/useStore';

const UpdateModal = ({ isOpen, onClose, selectedBook = null }) => {
  const { parties, items } = useStore();
  const [activeTab, setActiveTab] = useState('Job Issue');

  const [header, setHeader] = useState({
    book: 'EMB. JOBWORK',
    party: '',
    broker: '',
    partyGstin: '',
    panNo: '',
    hsnCode: '9988',
    type: '--Select GstType--',
    challanNo: '1',
    challanDate: '01/04/2026',
    challan2: '',
    jobType: ''
  });

  React.useEffect(() => {
    if (isOpen && selectedBook) {
      setHeader(prev => ({ ...prev, book: selectedBook }));
    }
  }, [isOpen, selectedBook]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Job Issue" className="max-w-[98vw] h-[95vh] p-0 overflow-hidden bg-[#e1e9f5]">
      
      <div className="flex bg-[#cbd5e1] border-b border-slate-400 p-0.5 gap-0.5">
         {['Job Issue', 'View Job Issue'].map(tab => (
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
           <div className="col-span-5 space-y-1">
              <div className="flex items-center gap-2">
                 <label className="text-[11px] font-black w-20 uppercase">Book</label>
                 <ERPSelect className="flex-1 h-6 text-[11px] bg-orange-100 font-bold" value={header.book} onChange={e => setHeader({...header, book: e.target.value})} options={[{value: header.book, label: header.book}]} />
              </div>
              <div className="flex items-center gap-2">
                 <label className="text-[11px] font-black w-20 uppercase">Party</label>
                 <ERPSelect className="flex-1 h-6 text-[11px]" options={parties.map(p => ({value: p.id, label: p.name}))} />
              </div>
              <div className="flex items-center gap-2 h-6"></div> {/* Spacer */}
              <div className="flex items-center gap-2">
                 <label className="text-[11px] font-black w-20 uppercase">Broker</label>
                 <ERPSelect className="flex-1 h-6 text-[11px]" options={parties.filter(p => p.group === 'Broker').map(p => ({value: p.id, label: p.name}))} />
              </div>
           </div>

           <div className="col-span-6 space-y-1 pl-4">
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
                    <div className="flex items-center gap-2">
                       <label className="text-[11px] font-black w-20 uppercase">Type</label>
                       <ERPSelect className="flex-1 h-6 text-[11px]" options={[{value: '--Select GstType--', label: '--Select GstType--'}]} />
                    </div>
                 </div>
                 <div className="space-y-1">
                    <div className="flex items-center gap-2">
                       <label className="text-[11px] font-black w-24 text-right uppercase">Challan No</label>
                       <ERPInput className="w-24 h-6 text-[11px]" value="1" />
                    </div>
                    <div className="flex items-center gap-2">
                       <label className="text-[11px] font-black w-24 text-right uppercase">Challan Date</label>
                       <ERPInput className="w-24 h-6 text-[11px]" value="01/04/2026" />
                    </div>
                    <div className="flex items-center gap-2">
                       <label className="text-[11px] font-black w-24 text-right uppercase">Challan2</label>
                       <ERPInput className="w-24 h-6 text-[11px]" />
                    </div>
                    <div className="flex items-center gap-2">
                       <label className="text-[11px] font-black w-24 text-right uppercase">Job Type</label>
                       <ERPSelect className="w-24 h-6 text-[11px]" options={[]} />
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto bg-[#8e97a3] border-b border-slate-400">
           <table className="w-full text-[10px] border-collapse border border-slate-500">
              <thead className="bg-[#1e293b] text-white sticky top-0">
                 <tr>
                    {['Sr No.', 'Item Name', 'Fin Item', 'Unit', 'Pcs', 'Cut', 'Mts', 'Kgs', 'Rate', 'Amount', 'Fab.Rate', 'Remark'].map(h => (
                       <th key={h} className="border border-slate-600 px-1 py-1 font-bold whitespace-nowrap">{h}</th>
                    ))}
                 </tr>
              </thead>
              <tbody className="bg-white">
                 {[...Array(12)].map((_, idx) => (
                    <tr key={idx} className="h-6 odd:bg-slate-50">
                       <td className="border border-slate-300 text-center bg-slate-100">{idx + 1}</td>
                       <td className="border border-slate-300 px-1"><ERPSelect className="w-full h-4 border-none p-0 text-[10px]" options={items.map(i => ({value: i.id, label: i.itemName}))} /></td>
                       <td className="border border-slate-300 px-1"><ERPSelect className="w-full h-4 border-none p-0 text-[10px]" options={items.map(i => ({value: i.id, label: i.itemName}))} /></td>
                       <td className="border border-slate-300 px-1 text-center font-bold">MTRS</td>
                       <td className="border border-slate-300 px-1 text-center font-bold">0</td>
                       <td className="border border-slate-300 px-1 text-center">0.00</td>
                       <td className="border border-slate-300 px-1 text-center">0.00</td>
                       <td className="border border-slate-300 px-1 text-center">0.000</td>
                       <td className="border border-slate-300 px-1 text-right">0.00</td>
                       <td className="border border-slate-300 px-1 text-right bg-slate-50">0.00</td>
                       <td className="border border-slate-300 px-1 text-right">0.00</td>
                       <td className="border border-slate-300 px-1"></td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>

        {/* Summary Row */}
        <div className="bg-[#cbd5e1] border-b border-slate-400 p-1 grid grid-cols-10 gap-1 text-[11px] font-black uppercase text-center">
           <div className="col-span-2 text-right px-4">Total Quan :</div>
           <div className="bg-white border border-slate-400">0.00</div>
           <div className="text-right px-4">Total Pcs :</div>
           <div className="bg-white border border-slate-400">0.00</div>
           <div className="text-right px-4">Total Qty :</div>
           <div className="bg-white border border-slate-400">0.00</div>
           <div className="text-right px-4">Total Kgs :</div>
           <div className="bg-white border border-slate-400">0.00</div>
           <div className="text-right px-4">Total Amt :</div>
           <div className="bg-white border border-slate-400">0.00</div>
        </div>

        {/* Bottom */}
        <div className="bg-[#f1f5f9] p-2 border-t border-slate-400">
           <div className="grid grid-cols-12 gap-4">
              <div className="col-span-4 bg-white border border-slate-300 rounded p-2">
                 <div className="text-[10px] font-black uppercase text-slate-500 mb-2 border-b border-slate-200">Gst Details</div>
                 <div className="space-y-1 text-[11px]">
                    <div className="flex items-center justify-between">
                       <label>CGST %</label>
                       <div className="flex gap-2">
                          <ERPInput className="w-12 h-5" value="0.00" />
                          <label>Amt :</label>
                          <ERPInput className="w-20 h-5 bg-slate-50" readOnly value="0.00" />
                       </div>
                    </div>
                    <div className="flex items-center justify-between">
                       <label>SGST %</label>
                       <div className="flex gap-2">
                          <ERPInput className="w-12 h-5" value="0.00" />
                          <label>Amt :</label>
                          <ERPInput className="w-20 h-5 bg-slate-50" readOnly value="0.00" />
                       </div>
                    </div>
                    <div className="flex items-center justify-between">
                       <label>IGST %</label>
                       <div className="flex gap-2">
                          <ERPInput className="w-12 h-5" value="0.00" />
                          <label>Amt :</label>
                          <ERPInput className="w-20 h-5 bg-slate-50" readOnly value="0.00" />
                       </div>
                    </div>
                 </div>
              </div>

              <div className="col-span-5 space-y-1 text-[11px]">
                 <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1">
                       <label className="w-20 font-bold">Transport :</label>
                       <ERPInput className="flex-1 h-5" />
                    </div>
                    <div className="flex items-center gap-1">
                       <label className="w-12">L.R. No :</label>
                       <ERPInput className="flex-1 h-5" />
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1">
                       <label className="w-20">Vehical No :</label>
                       <ERPSelect className="flex-1 h-5" options={[]} />
                    </div>
                    <div className="flex items-center gap-1">
                       <label className="w-12 font-bold">Remark :</label>
                       <ERPInput className="flex-1 h-5" />
                    </div>
                 </div>
                 <div className="flex items-center gap-2">
                    <label className="w-20 uppercase font-bold">Remark1</label>
                    <ERPInput className="flex-1 h-5" />
                 </div>
              </div>

              <div className="col-span-3 bg-slate-100 border border-slate-300 p-2 space-y-1 text-[11px] font-black">
                 <div className="flex justify-between"><span>Total Gst Amt :</span><span>0.00</span></div>
                 <div className="flex justify-between text-indigo-700 text-lg border-t border-slate-300 mt-2 pt-2">
                    <span>Net Amount :</span>
                    <span>0.00</span>
                 </div>
                 <div className="flex items-center gap-2 pt-4">
                    <label className="uppercase text-[10px]">E-Way :</label>
                    <ERPInput className="flex-1 h-6" />
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
              <button className="px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-black uppercase border border-indigo-700">Rec.Detail</button>
              <button className="px-3 py-1.5 bg-rose-600 text-white text-[10px] font-black uppercase border border-rose-700">Close Bill</button>
              <button className="px-3 py-1.5 bg-slate-600 text-white text-[10px] font-black uppercase border border-slate-700">Old Year</button>
           </div>
        </div>

      </div>
    </Modal>
  );
};

export default UpdateModal;
