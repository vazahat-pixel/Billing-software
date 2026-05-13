import React from 'react';
import { motion } from 'framer-motion';

const LotCard = ({ lot }) => {
  if (!lot) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm"
    >
      <div className="flex justify-between items-start mb-8">
        <div>
          <span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest bg-indigo-50 px-3 py-1 rounded-full">
            Lot ID: {lot.lotId}
          </span>
          <h2 className="text-3xl font-black text-slate-800 mt-4 tracking-tight">{lot.itemName}</h2>
          <p className="text-slate-400 mt-1 font-medium">{lot.design} / {lot.color} / {lot.size}</p>
        </div>
        <div className="text-right">
           <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Purchase ID</span>
           <span className="text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">{lot.purchaseId}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
           <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Total MTRS</p>
           <h4 className="text-xl font-black text-slate-800">{lot.totalMtrs.toFixed(2)}</h4>
        </div>
        <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100">
           <p className="text-[10px] font-black uppercase text-emerald-600/70 mb-2">Remaining</p>
           <h4 className="text-xl font-black text-emerald-700">{lot.remainingMtrs.toFixed(2)}</h4>
        </div>
        <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100">
           <p className="text-[10px] font-black uppercase text-amber-600/70 mb-2">Used / Processed</p>
           <h4 className="text-xl font-black text-amber-700">{lot.usedMtrs.toFixed(2)}</h4>
        </div>
        <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100">
           <p className="text-[10px] font-black uppercase text-indigo-600/70 mb-2">Health</p>
           <div className="flex items-center gap-3">
              <h4 className="text-xl font-black text-indigo-700">{Math.round((lot.remainingMtrs / lot.totalMtrs) * 100)}%</h4>
              <div className="flex-1 h-2 bg-indigo-200 rounded-full overflow-hidden">
                 <div 
                   className="h-full bg-indigo-600 rounded-full" 
                   style={{ width: `${(lot.remainingMtrs / lot.totalMtrs) * 100}%` }}
                 />
              </div>
           </div>
        </div>
      </div>
    </motion.div>
  );
};

export default LotCard;
