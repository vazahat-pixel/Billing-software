import React from 'react';

const MovementTable = ({ movements }) => {
  const getMovementTypeStyle = (type) => {
    switch (type) {
      case 'PURCHASE': return 'text-emerald-600 bg-emerald-50';
      case 'SALE': return 'text-rose-600 bg-rose-50';
      case 'ISSUE': return 'text-amber-600 bg-amber-50';
      case 'RECEIVE': return 'text-indigo-600 bg-indigo-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mt-8">
      <div className="p-6 border-b border-slate-100 bg-slate-50/30">
         <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            📊 Transaction History & Movements
            <span className="text-[10px] text-slate-400 font-medium normal-case">/ Real-time logs</span>
         </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Date</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Type</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Quantity</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Balance After</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Reference ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {movements.map((mov, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 text-xs font-bold text-slate-500">{new Date(mov.date).toLocaleDateString()}</td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tight ${getMovementTypeStyle(mov.type)}`}>
                    {mov.type}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`font-black text-sm ${mov.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {mov.quantity > 0 ? `+${mov.quantity.toFixed(2)}` : `${mov.quantity.toFixed(2)}`}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="font-bold text-slate-900">{mov.balanceAfter.toFixed(2)} MTRS</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-[11px] font-medium text-slate-400 underline decoration-slate-200 cursor-help">{mov.referenceId}</span>
                </td>
              </tr>
            ))}
            {movements.length === 0 && (
              <tr>
                <td colSpan="5" className="text-center py-12 text-slate-400 italic">No movements recorded for this lot yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MovementTable;
