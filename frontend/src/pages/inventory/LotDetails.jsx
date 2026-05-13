import React, { useMemo } from 'react';
import useStore from '../../store/useStore';
import LotCard from '../../components/inventory/LotCard';
import MovementTable from '../../components/inventory/MovementTable';
import { motion } from 'framer-motion';

const LotDetails = ({ lotId, onBack }) => {
  const { inventoryLots, stockMovements } = useStore();

  const lot = useMemo(() => 
    inventoryLots.find(l => l.lotId === lotId), 
  [inventoryLots, lotId]);

  const movements = useMemo(() => 
    stockMovements.filter(m => m.lotId === lotId)
      .sort((a, b) => new Date(b.date) - new Date(a.date)), 
  [stockMovements, lotId]);

  if (!lot) return (
    <div className="p-20 text-center">
       <h2 className="text-xl font-bold text-slate-400">Lot not found.</h2>
       <button onClick={onBack} className="mt-4 text-indigo-600 font-bold">← Go Back</button>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="pb-20"
    >
      <div className="flex items-center gap-4 mb-8">
         <button 
           onClick={onBack}
           className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all shadow-sm active:scale-95"
         >
           ←
         </button>
         <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">Lot Traceability Matrix</h1>
            <p className="text-xs text-slate-400 font-medium">Viewing historical movements for {lotId}</p>
         </div>
      </div>

      <LotCard lot={lot} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
         <div className="lg:col-span-2">
            <MovementTable movements={movements} />
         </div>
         
         <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
               <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Stock Breakdown</h4>
               <div className="space-y-4">
                  <div className="flex justify-between items-center">
                     <span className="text-sm font-medium text-slate-500 italic">Shrinkage Allowed</span>
                     <span className="text-sm font-bold text-slate-800">2.5%</span>
                  </div>
                  <div className="flex justify-between items-center">
                     <span className="text-sm font-medium text-slate-500 italic">Max Storage Period</span>
                     <span className="text-sm font-bold text-slate-800">180 Days</span>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                     <span className="text-xs font-black text-slate-900 uppercase">Warehouse Zone</span>
                     <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">ZONE-A / S12</span>
                  </div>
               </div>
            </div>

            <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-xl shadow-slate-100">
                <p className="text-[10px] font-black uppercase opacity-50 tracking-widest mb-4">Actions</p>
                <div className="space-y-3">
                   <button className="w-full py-3 bg-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors">Generate Barcode</button>
                   <button className="w-full py-3 bg-white/10 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/20 transition-colors">Manual Stock Check</button>
                   <button className="w-full py-3 bg-rose-600/20 text-rose-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-600/30 transition-colors">Mark as Defected</button>
                </div>
            </div>
         </div>
      </div>
    </motion.div>
  );
};

export default LotDetails;
