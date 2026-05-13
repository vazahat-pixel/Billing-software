import React, { useState } from 'react';
import useStore from '../../store/useStore';
import { ERPInput, ERPSelect } from '../../components/forms/FormElements';

const SalesOutstanding = ({ isOpen, onClose }) => {
  const { parties } = useStore();

  const [formData, setFormData] = useState({
    fromDate: '01/04/2026',
    toDate: '05/05/2026',
    company: 'MAHAVEER IMPEX',
    book: '--Select Sale Type--',
    selectParty: '',
    group: '',
    city: '',
    state: '',
    broker: '',
    transport: '',
    haste: '',
    area: '',
    fromBill: '0',
    toBill: '0',
    fromPayDate: '01/04/2026',
    toPayDate: '05/05/2026',
    dueDaysMin: '0',
    dueDaysMax: '0',
    dis: '0.00',
    unit: '--Select Unit--',
    subBook: 'All',
    salesMan: '',
    orderNo: ''
  });

  const checkboxes = [
    { label: 'Show Adjustment Entry', checked: true },
    { label: 'Show Previous Year Entry', checked: true },
    { label: 'Show Party Address in Print', checked: false },
    { label: 'Show City Only', checked: false },
    { label: 'Show Party Mobile in Print', checked: true },
    { label: 'Show Broker Address in Print', checked: false },
    { label: 'Show Broker Mobile in Print', checked: false },
    { label: 'Show Print Date', checked: true },
    { label: 'NewPage After Group', checked: false },
    { label: 'AsOn Pending', checked: false },
    { label: 'Show Zero Amt', checked: false },
    { label: 'Show LedgerBal', checked: false },
    { label: 'DueDays On Payment', checked: false }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1e293b] w-full max-w-5xl rounded shadow-2xl border-2 border-slate-600 overflow-hidden font-['Outfit']">
         
         {/* Header */}
         <div className="bg-slate-800 text-white px-3 py-1 flex justify-between items-center border-b border-slate-700">
            <h2 className="text-[11px] font-black uppercase tracking-wider flex items-center gap-2">
               📊 Sales Outstanding
            </h2>
            <div className="flex gap-4 text-[10px] font-black text-yellow-500 italic">
               <span>( Press F3 to Select Group. )</span>
               <span>( F5 for Multiple Selection )</span>
            </div>
         </div>

         {/* Content */}
         <div className="p-4 bg-[#f1f5f9] grid grid-cols-12 gap-6">
            
            {/* Left Column: Primary Filters */}
            <div className="col-span-7 space-y-1 text-[11px]">
               <div className="flex items-center gap-2">
                  <label className="w-24 font-black text-right">From Date :</label>
                  <ERPInput className="w-32 h-6 bg-orange-100 font-bold" value={formData.fromDate} />
                  <label className="w-20 font-black text-right">To Date :</label>
                  <ERPInput className="w-32 h-6" value={formData.toDate} />
               </div>
               <div className="flex items-center gap-2">
                  <label className="w-24 font-black text-right">Company :</label>
                  <ERPSelect className="flex-1 h-6" value={formData.company} options={[{value: 'MAHAVEER IMPEX', label: 'MAHAVEER IMPEX'}]} />
               </div>
               <div className="flex items-center gap-2">
                  <label className="w-24 font-black text-right">Book :</label>
                  <ERPSelect className="flex-1 h-6" value={formData.book} options={[]} />
               </div>
               <div className="flex items-center gap-2">
                  <label className="w-24 font-black text-right">Select Party :</label>
                  <ERPSelect className="flex-1 h-6" options={parties.map(p => ({value: p.id, label: p.name}))} />
               </div>
               {['Group', 'City', 'State', 'Broker', 'Transport', 'Haste', 'Area'].map(f => (
                  <div key={f} className="flex items-center gap-2">
                     <label className="w-24 font-black text-right">{f} :</label>
                     <ERPSelect className="flex-1 h-6" options={[]} />
                  </div>
               ))}
               <div className="flex items-center gap-2 pt-1">
                  <label className="w-24 font-black text-right">From Bill</label>
                  <ERPInput className="w-24 h-6 text-center" value="0" />
                  <div className="flex-1"></div>
                  <label className="w-20 font-black text-right">To Bill</label>
                  <ERPInput className="w-24 h-6 text-center" value="0" />
               </div>
               <div className="flex items-center gap-2">
                  <label className="w-24 font-black text-right">From Pay Date :</label>
                  <ERPInput className="w-24 h-6 text-center" value="01/04/2026" />
                  <div className="flex-1"></div>
                  <label className="w-20 font-black text-right">To Pay Date :</label>
                  <ERPInput className="w-24 h-6 text-center" value="05/05/2026" />
               </div>
               <div className="flex items-center gap-2">
                  <label className="w-24 font-black text-right">DueDays {'>'}</label>
                  <ERPInput className="w-24 h-6 text-center" value="0" />
                  <div className="flex-1"></div>
                  <label className="w-20 font-black text-right">DueDays {'<'}</label>
                  <ERPInput className="w-24 h-6 text-center" value="0" />
               </div>
               <div className="flex items-center gap-2">
                  <label className="w-24 font-black text-right">Dis(%)</label>
                  <ERPInput className="w-24 h-6 text-center" value="0.00" />
                  <div className="flex-1"></div>
                  <label className="w-20 font-black text-right">Unit</label>
                  <ERPSelect className="w-32 h-6" value="--Select Unit--" options={[]} />
               </div>
               <div className="flex items-center gap-2">
                  <label className="w-24 font-black text-right">Sub Book :</label>
                  <ERPSelect className="w-32 h-6" value="All" options={[]} />
               </div>
            </div>

            {/* Right Column: Options and Subtotals */}
            <div className="col-span-5 space-y-4">
               <div className="bg-white p-3 border border-slate-300 rounded shadow-sm space-y-2">
                  <h4 className="text-[10px] font-black uppercase text-rose-600 border-b border-slate-100">Select Group / SubTotal :</h4>
                  <div className="flex items-center gap-2">
                     <label className="w-4 font-bold text-slate-400">1 :</label>
                     <ERPSelect className="flex-1 h-6 text-[10px]" value="None" options={[]} />
                  </div>
                  <div className="flex items-center gap-2">
                     <label className="w-4 font-bold text-slate-400">2 :</label>
                     <ERPSelect className="flex-1 h-6 text-[10px]" value="None" options={[]} />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                     <input type="checkbox" className="w-3 h-3" />
                     <label className="text-[10px] font-black uppercase">Summary</label>
                     <div className="flex-1"></div>
                     <ERPSelect className="w-32 h-6 text-[10px]" value="Pending" options={[]} />
                  </div>
               </div>

               <div className="grid grid-cols-1 gap-1 text-[10px] font-bold text-indigo-900">
                  {checkboxes.map(cb => (
                     <label key={cb.label} className="flex items-center gap-2 hover:bg-white/50 px-1 py-0.5 rounded cursor-pointer">
                        <input type="checkbox" className="w-3 h-3" defaultChecked={cb.checked} />
                        {cb.label}
                     </label>
                  ))}
               </div>

               <div className="space-y-1 pt-4 border-t border-slate-200">
                  <div className="flex items-center gap-2">
                     <label className="w-20 font-black text-right text-[10px]">SalesMan :</label>
                     <ERPInput className="flex-1 h-6" />
                  </div>
                  <div className="flex items-center gap-2">
                     <label className="w-20 font-black text-right text-[10px]">OrderNo :</label>
                     <ERPInput className="flex-1 h-6" />
                  </div>
               </div>
            </div>
         </div>

         {/* Footer Actions */}
         <div className="bg-slate-900 p-2 flex justify-center gap-2 border-t border-slate-700">
            <button className="px-12 py-1.5 bg-slate-200 text-slate-800 text-[11px] font-black uppercase border border-slate-400 hover:bg-white transition-all">Preview</button>
            <button className="px-12 py-1.5 bg-slate-200 text-slate-800 text-[11px] font-black uppercase border border-slate-400 hover:bg-white transition-all" onClick={onClose}>Cancel</button>
            <button className="px-12 py-1.5 bg-slate-200 text-slate-800 text-[11px] font-black uppercase border border-slate-400 hover:bg-white transition-all" onClick={onClose}>Exit</button>
         </div>

      </div>
    </div>
  );
};

export default SalesOutstanding;
