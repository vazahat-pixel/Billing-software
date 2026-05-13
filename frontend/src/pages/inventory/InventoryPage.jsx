import React, { useState, useMemo, useEffect } from 'react';
import useStore from '../../store/useStore';
import { Package, Hash, Layers, Filter, Search, MoreVertical, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import Modal from '../../components/ui/Modal';

const InventoryPage = () => {
  const { inventoryLots, stockMovements, fetchInventory } = useStore();
  const [selectedLotId, setSelectedLotId] = useState(null);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const stats = useMemo(() => {
    const totalMtrs = inventoryLots.reduce((acc, l) => acc + (l.remainingMtrs || 0), 0);
    const lowStock = inventoryLots.filter(l => l.status === 'LOW').length;
    const items = [...new Set(inventoryLots.map(l => l.itemName))].length;
    return { totalMtrs, lowStock, items };
  }, [inventoryLots]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'AVAILABLE': return <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[10px] font-black">AVAILABLE</span>;
      case 'LOW': return <span className="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-full text-[10px] font-black animate-pulse">LOW STOCK</span>;
      case 'USED': return <span className="px-2 py-0.5 bg-slate-100 text-slate-400 border border-slate-200 rounded-full text-[10px] font-black">USED</span>;
      default: return <span className="px-2 py-0.5 bg-slate-50 text-slate-600 border border-slate-100 rounded-full text-[10px] font-black">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-2xl font-black text-slate-900 tracking-tight">Stock Inventory (Lot Engine)</h1>
           <p className="text-slate-500 text-sm">Real-time lot-wise meter tracking and stock movements.</p>
        </div>
        <div className="flex gap-3">
           <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
             Export Stock Sheet
           </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-start mb-4">
               <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600"><Package size={24} /></div>
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Meters</span>
            </div>
            <h3 className="text-3xl font-black text-slate-900">{stats.totalMtrs.toLocaleString()} MTRS</h3>
            <p className="text-xs text-slate-500 mt-1">Across {stats.items} Unique Items</p>
         </div>
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-start mb-4">
               <div className="p-3 bg-amber-50 rounded-xl text-amber-600"><Clock size={24} /></div>
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Low Stock Lots</span>
            </div>
            <h3 className="text-3xl font-black text-amber-600">{stats.lowStock} LOTS</h3>
            <p className="text-xs text-slate-500 mt-1">Below 20% threshold</p>
         </div>
         <div className="bg-indigo-900 p-6 rounded-2xl shadow-xl shadow-indigo-100 text-white">
            <div className="flex justify-between items-start mb-4">
               <div className="p-3 bg-white/10 rounded-xl text-white"><TrendingUp size={24} /></div>
               <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Avg Design Movement</span>
            </div>
            <h3 className="text-3xl font-black">Fast Moving</h3>
            <p className="text-xs text-indigo-200 mt-1">Cotton Silk D-101</p>
         </div>
      </div>

      {/* Main Lot Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
         <div className="p-5 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
            <div className="flex items-center gap-4">
               <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    placeholder="Search lot no, design, color..." 
                    className="pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 w-80"
                  />
               </div>
               <button className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-600"><Filter size={16} /></button>
            </div>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                     <th className="px-6 py-4">Lot ID & Item</th>
                     <th className="px-6 py-4">Design / Color</th>
                     <th className="px-6 py-4 text-right">Total (MTRS)</th>
                     <th className="px-6 py-4 text-right">Remaining</th>
                     <th className="px-6 py-4">Usage</th>
                     <th className="px-6 py-4">Status</th>
                     <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {inventoryLots.map((lot) => (
                    <tr key={lot.lotId} className="hover:bg-slate-50 transition-colors group">
                       <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
                                <Hash size={14} />
                             </div>
                             <div>
                                <p className="text-xs font-black text-slate-900">{lot.lotId}</p>
                                <p className="text-[10px] text-slate-500 font-bold">{lot.itemName}</p>
                             </div>
                          </div>
                       </td>
                       <td className="px-6 py-4">
                          <p className="text-xs font-bold text-indigo-600">{lot.design}</p>
                          <p className="text-[10px] text-slate-400 uppercase font-black">{lot.color}</p>
                       </td>
                       <td className="px-6 py-4 text-right text-xs font-bold text-slate-500">
                          {lot.totalMtrs.toFixed(2)}
                       </td>
                       <td className="px-6 py-4 text-right text-xs font-black text-slate-900">
                          {lot.remainingMtrs.toFixed(2)} MTRS
                       </td>
                       <td className="px-6 py-4">
                          <div className="w-24">
                             <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full transition-all ${lot.remainingMtrs < 20 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                                  style={{ width: `${(lot.remainingMtrs / lot.totalMtrs) * 100}%` }}
                                ></div>
                             </div>
                          </div>
                       </td>
                       <td className="px-6 py-4">
                          {getStatusBadge(lot.status)}
                       </td>
                       <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => setSelectedLotId(lot.lotId)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-md border border-transparent hover:border-slate-200 transition-all"
                          >
                             <Clock size={16} />
                          </button>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      <MovementModal 
        isOpen={!!selectedLotId} 
        onClose={() => setSelectedLotId(null)} 
        lotId={selectedLotId} 
        movements={stockMovements.filter(m => m.lotId === selectedLotId)}
      />
    </div>
  );
};

const MovementModal = ({ isOpen, onClose, lotId, movements }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Stock Movement History - ${lotId}`} className="max-w-2xl">
       <div className="overflow-hidden border border-slate-100 rounded-xl">
          <table className="w-full text-left">
             <thead>
                <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                   <th className="px-4 py-3">Date</th>
                   <th className="px-4 py-3">Type</th>
                   <th className="px-4 py-3 text-right">Quantity</th>
                   <th className="px-4 py-3 text-right">Balance After</th>
                   <th className="px-4 py-3">Reference</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-50">
                {movements.map((mov) => (
                  <tr key={mov.id}>
                     <td className="px-4 py-3 text-[10px] text-slate-500 font-bold">{mov.date}</td>
                     <td className="px-4 py-3">
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                          mov.type === 'PURCHASE' ? 'bg-emerald-50 text-emerald-600' :
                          mov.type === 'SALE' ? 'bg-rose-50 text-rose-600' :
                          'bg-indigo-50 text-indigo-600'
                        }`}>
                          {mov.type}
                        </span>
                     </td>
                     <td className={`px-4 py-3 text-right text-xs font-black ${mov.quantity >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {mov.quantity > 0 ? '+' : ''}{mov.quantity.toFixed(2)}
                     </td>
                     <td className="px-4 py-3 text-right text-xs font-black text-slate-900">
                        {mov.balanceAfter.toFixed(2)}
                     </td>
                     <td className="px-4 py-3 text-[10px] text-indigo-500 font-bold">{mov.referenceId}</td>
                  </tr>
                ))}
             </tbody>
          </table>
       </div>
    </Modal>
  );
};

export default InventoryPage;
