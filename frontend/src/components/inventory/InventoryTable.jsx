import React from 'react';
import { motion } from 'framer-motion';

const InventoryTable = ({ data, onViewDetails }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'LOW': return 'bg-amber-100 text-amber-700 border-amber-200 animate-pulse';
      case 'USED': return 'bg-slate-100 text-slate-500 border-slate-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Lot ID</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Item Name</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Design / Color</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Total MTRS</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Remaining</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Status</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((lot) => (
              <motion.tr 
                key={lot.lotId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                whileHover={{ backgroundColor: '#f8fafc' }}
                className="group transition-colors cursor-pointer"
                onClick={() => onViewDetails(lot.lotId)}
              >
                <td className="px-6 py-4">
                  <span className="font-bold text-indigo-600 block">{lot.lotId}</span>
                  <span className="text-[9px] text-slate-400 font-medium">Created: {new Date(lot.createdAt).toLocaleDateString()}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="font-semibold text-slate-700">{lot.itemName}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-600 uppercase">{lot.design}</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-[11px] font-medium text-slate-500">{lot.color}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-slate-400 font-medium">{lot.totalMtrs.toFixed(2)}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className={`font-black text-sm ${lot.status === 'LOW' ? 'text-amber-600' : 'text-slate-900'}`}>
                    {lot.remainingMtrs.toFixed(2)}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-black border ${getStatusColor(lot.status)}`}>
                    {lot.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                   <button 
                     className="text-indigo-600 hover:text-indigo-800 text-[11px] font-bold uppercase tracking-tight group-hover:underline"
                   >
                     View Details →
                   </button>
                </td>
              </motion.tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan="7" className="text-center py-20 text-slate-400 font-medium italic">
                  No lots found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InventoryTable;
