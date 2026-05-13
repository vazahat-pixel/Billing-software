import React, { useState } from 'react';
import useStore from '../store/useStore';
import { ERPInput, ERPSelect } from '../components/forms/FormElements';
import Modal from '../components/ui/Modal';

const LedgerModal = ({ isOpen, onClose }) => {
  const { parties } = useStore();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ledger Statement" className="max-w-3xl bg-white p-0 border-none shadow-2xl">
      <div className="p-10 space-y-8">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black whitespace-nowrap">Report Parameters</span>
          <div className="h-[2px] flex-1 bg-black" />
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-6">
             <label className="w-40 text-right text-[10px] font-black uppercase tracking-widest text-black">Company Selection :</label>
             <ERPSelect className="w-96 h-11 border-2 border-slate-100 focus:border-black font-black uppercase tracking-widest text-xs transition-all" value="MAHAVEER IMPEX" options={[{value: 'MAHAVEER IMPEX', label: 'MAHAVEER IMPEX'}]} />
          </div>
          <div className="flex items-center gap-6">
             <label className="w-40 text-right text-[10px] font-black uppercase tracking-widest text-black">Select Account :</label>
             <div className="w-96">
                <ERPSelect className="w-full h-11 border-2 border-black bg-slate-50 font-black uppercase tracking-widest text-xs transition-all" options={parties.map(p => ({value: p.id, label: p.name}))} />
             </div>
          </div>
          <div className="flex items-center gap-6">
             <label className="w-40 text-right text-[10px] font-black uppercase tracking-widest text-black">Statement Period :</label>
             <div className="flex items-center gap-4">
                <ERPInput className="w-40 h-11 border-2 border-slate-100 focus:border-black text-center font-bold text-sm" value="01/04/2026" />
                <label className="text-[10px] font-black uppercase tracking-widest text-black">To</label>
                <ERPInput className="w-40 h-11 border-2 border-slate-100 focus:border-black text-center font-bold text-sm" value="31/03/2027" />
             </div>
          </div>
        </div>

        <div className="flex gap-12 border-t-2 border-black pt-8">
           <div className="space-y-3">
              {[
                { label: 'Show Remark in Print', checked: true },
                { label: 'Show Party Address in Print', checked: true },
                { label: 'Show Full Remark', checked: false },
                { label: 'View in Landscape', checked: false },
                { label: 'Show Previous Year Recon', checked: true }
              ].map(cb => (
                <label key={cb.label} className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" className="w-5 h-5 rounded-none border-2 border-black text-black focus:ring-0 transition-all" defaultChecked={cb.checked} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-black transition-all">{cb.label}</span>
                </label>
              ))}
           </div>

           <div className="flex-1 space-y-4">
              <div className="flex items-center justify-end gap-4">
                 <label className="text-[10px] font-black uppercase tracking-widest text-black">Days in Year :</label>
                 <ERPInput className="w-32 h-11 border-2 border-slate-100 focus:border-black text-center font-black" value="365" />
              </div>
              <div className="flex items-center justify-end gap-4">
                 <label className="text-[10px] font-black uppercase tracking-widest text-black">Interest Rate (%) :</label>
                 <ERPInput className="w-32 h-11 border-2 border-slate-100 focus:border-black text-center font-black" value="0.00" />
              </div>
              <div className="flex items-center justify-end gap-4">
                 <label className="text-[10px] font-black uppercase tracking-widest text-black">Grace Days :</label>
                 <ERPInput className="w-32 h-11 border-2 border-slate-100 focus:border-black text-center font-black" value="0" />
              </div>
           </div>
        </div>

        <div className="bg-black -mx-10 -mb-10 p-6 flex justify-between gap-2">
           {['Ledger', 'Confirmation', 'Interest Report', 'Bank Recon.', 'Unpresented Entries', 'Exit'].map(btn => (
             <button 
               key={btn}
               onClick={btn === 'Exit' ? onClose : undefined}
               className="flex-1 px-4 py-3 bg-white hover:bg-slate-200 text-[10px] font-black uppercase tracking-widest text-black transition-all shadow-none border-none"
             >
               {btn}
             </button>
           ))}
        </div>
      </div>
    </Modal>
  );
};

export default LedgerModal;
