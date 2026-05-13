import React, { useState } from 'react';
import useStore from '../store/useStore';
import { ERPInput, ERPSelect } from '../components/forms/FormElements';
import Modal from '../components/ui/Modal';

const LedgerModal = ({ isOpen, onClose }) => {
  const { parties } = useStore();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ledger" className="max-w-2xl bg-[#f1f5f9] font-['Outfit'] border-t-4 border-[#1e293b]">
      <div className="p-8 space-y-6">
        <div className="space-y-3">
          <div className="flex items-center gap-4">
             <label className="w-32 text-right text-xs font-bold uppercase text-slate-600">Company :</label>
             <ERPSelect className="w-72 h-8 text-sm border-slate-300" value="MAHAVEER IMPEX" options={[{value: 'MAHAVEER IMPEX', label: 'MAHAVEER IMPEX'}]} />
          </div>
          <div className="flex items-center gap-4">
             <label className="w-32 text-right text-xs font-bold uppercase text-slate-600">Select Account :</label>
             <div className="w-72">
                <ERPSelect className="w-full h-8 text-sm bg-orange-100 border-orange-200" options={parties.map(p => ({value: p.id, label: p.name}))} />
             </div>
          </div>
          <div className="flex items-center gap-4">
             <label className="w-32 text-right text-xs font-bold uppercase text-slate-600">From Date :</label>
             <div className="flex items-center gap-2">
                <ERPInput className="w-32 h-8 text-sm text-center" value="01/04/2026" />
                <label className="text-xs font-bold uppercase text-slate-600">To Date :</label>
                <ERPInput className="w-32 h-8 text-sm text-center" value="31/03/2027" />
             </div>
          </div>
        </div>

        <div className="flex gap-8 border-t border-slate-200 pt-6">
           <div className="space-y-2">
              {[
                { label: 'Show Remark in Print', checked: true },
                { label: 'Show Party Address in Print', checked: true },
                { label: 'Show Full Remark', checked: false },
                { label: 'View in Landscape', checked: false },
                { label: 'Show Previous Year Recon', checked: true }
              ].map(cb => (
                <label key={cb.label} className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" defaultChecked={cb.checked} />
                  <span className="text-[11px] font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">{cb.label}</span>
                </label>
              ))}
           </div>

           <div className="flex-1 space-y-3">
              <div className="flex items-center justify-end gap-3">
                 <label className="text-[11px] font-bold text-slate-600 uppercase">Days in Year :</label>
                 <ERPInput className="w-24 h-7 text-sm text-center" value="365" />
              </div>
              <div className="flex items-center justify-end gap-3">
                 <label className="text-[11px] font-bold text-slate-600 uppercase">Interest Rate :</label>
                 <ERPInput className="w-24 h-7 text-sm text-center" value="0.00" />
              </div>
              <div className="flex items-center justify-end gap-3">
                 <label className="text-[11px] font-bold text-slate-600 uppercase">Grace Days :</label>
                 <ERPInput className="w-24 h-7 text-sm text-center" value="0" />
              </div>
           </div>
        </div>

        <div className="bg-slate-900 -mx-8 -mb-8 p-3 flex justify-between gap-1 border-t border-slate-700">
           {['Ledger', 'Confirmation', 'Interest Report', 'Bank Recon.', 'Unpresented Entries', 'Exit'].map(btn => (
             <button 
               key={btn}
               onClick={btn === 'Exit' ? onClose : undefined}
               className="flex-1 px-2 py-2 bg-slate-200 hover:bg-white text-[10px] font-black uppercase tracking-tighter text-slate-800 border border-slate-400 transition-all shadow-sm"
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
