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
      case 'AVAILABLE': return <span className="px-3 py-1 bg-black text-white text-[9px] font-black uppercase tracking-widest border-2 border-black">AVAILABLE</span>;
      case 'LOW': return <span className="px-3 py-1 border-2 border-black text-black text-[9px] font-black uppercase tracking-widest">LOW STOCK</span>;
      case 'USED': return <span className="px-3 py-1 bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-widest border-2 border-slate-100">USED</span>;
      default: return <span className="px-3 py-1 border-2 border-slate-200 text-slate-400 text-[9px] font-black uppercase tracking-widest">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Header */}
      <div className="bg-white p-10 border-2 border-black flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl">
        <div>
           <h1 className="text-3xl font-black text-black uppercase tracking-tighter">Inventory Control</h1>
           <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Real-time atomic lot tracking system.</p>
        </div>
        <div className="flex gap-4">
           <button className="px-10 py-3 bg-black text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all">
             Export Registry
           </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-8 border-2 border-black relative overflow-hidden">
            <div className="flex justify-between items-start mb-6">
               <div className="p-4 bg-black text-white"><Package size={28} /></div>
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em]">Metrics / Vol.</span>
            </div>
            <h3 className="text-4xl font-black text-black tracking-tighter">{stats.totalMtrs.toLocaleString()} <span className="text-sm">MTRS</span></h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">Across {stats.items} Catalog Items</p>
            <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 -mr-12 -mt-12 rotate-45 z-[-1]"></div>
         </div>
         <div className="bg-white p-8 border-2 border-black">
            <div className="flex justify-between items-start mb-6">
               <div className="p-4 bg-slate-100 text-black border-2 border-black"><Clock size={28} /></div>
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em]">Audit / Status</span>
            </div>
            <h3 className="text-4xl font-black text-black tracking-tighter">{stats.lowStock} <span className="text-sm">LOTS</span></h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">Critical Threshold Alerts</p>
         </div>
         <div className="bg-black p-8 text-white">
            <div className="flex justify-between items-start mb-6">
               <div className="p-4 bg-white text-black"><TrendingUp size={28} /></div>
               <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em]">Trend Analysis</span>
            </div>
            <h3 className="text-2xl font-black uppercase tracking-tighter">Fast Moving Schema</h3>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-4">Cotton Silk D-101</p>
         </div>
      </div>

      {/* Main Lot Table */}
      <div className="bg-white border-2 border-black overflow-hidden flex flex-col shadow-2xl">
         <div className="p-4 border-b-2 border-black bg-white flex items-center justify-between">
            <div className="flex items-center gap-4">
               <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-black" size={14} />
                  <input 
                    placeholder="Audit Search (Lot, Design, Color)..." 
                    className="pl-12 pr-6 py-2.5 bg-white border-2 border-black text-[10px] font-black uppercase tracking-widest outline-none w-96 transition-all focus:w-[500px]"
                  />
               </div>
               <button className="p-2.5 bg-white border-2 border-black text-black hover:bg-slate-50 transition-all"><Filter size={18} /></button>
            </div>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-black text-[9px] font-black text-white uppercase tracking-[0.3em] sticky top-0 z-10">
                     <th className="px-8 py-5">Lot Registry & Item</th>
                     <th className="px-8 py-5">Design / Architecture</th>
                     <th className="px-8 py-5 text-right">Inbound Cap (MTRS)</th>
                     <th className="px-8 py-5 text-right">Remaining Bal.</th>
                     <th className="px-8 py-5">Usage Efficiency</th>
                     <th className="px-8 py-5">Status</th>
                     <th className="px-8 py-5 text-right">Audit</th>
                  </tr>
               </thead>
               <tbody className="divide-y-2 divide-slate-50">
                  {inventoryLots.map((lot) => (
                    <tr key={lot.lotId} className="hover:bg-slate-50 transition-all">
                       <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 bg-black text-white flex items-center justify-center">
                                <Hash size={16} />
                             </div>
                             <div>
                                <p className="text-[11px] font-black text-black uppercase tracking-widest">{lot.lotId}</p>
                                <p className="text-[9px] text-slate-400 font-black uppercase mt-1 tracking-widest">{lot.itemName}</p>
                             </div>
                          </div>
                       </td>
                       <td className="px-8 py-5">
                          <p className="text-[10px] font-black text-black uppercase tracking-widest">{lot.design}</p>
                          <p className="text-[9px] text-slate-400 uppercase font-black mt-1 tracking-widest">{lot.color}</p>
                       </td>
                       <td className="px-8 py-5 text-right text-[10px] font-black text-slate-400 tracking-widest">
                          {lot.totalMtrs.toFixed(2)}
                       </td>
                       <td className="px-8 py-5 text-right text-[12px] font-black text-black tracking-widest">
                          {lot.remainingMtrs.toFixed(2)} <span className="text-[9px]">MTRS</span>
                       </td>
                       <td className="px-8 py-5">
                          <div className="w-32">
                             <div className="h-2 w-full bg-slate-100 border border-slate-200 overflow-hidden">
                                <div 
                                  className={`h-full transition-all ${lot.remainingMtrs < 20 ? 'bg-black' : 'bg-slate-300'}`} 
                                  style={{ width: `${(lot.remainingMtrs / lot.totalMtrs) * 100}%` }}
                                ></div>
                             </div>
                          </div>
                       </td>
                       <td className="px-8 py-5">
                          {getStatusBadge(lot.status)}
                       </td>
                       <td className="px-8 py-5 text-right">
                          <button 
                            onClick={() => setSelectedLotId(lot.lotId)}
                            className="p-3 bg-white border-2 border-black text-black hover:bg-black hover:text-white transition-all shadow-sm"
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
    <Modal isOpen={isOpen} onClose={onClose} title={`Trace History: ${lotId}`} className="max-w-4xl h-[80vh] bg-white border-none p-0">
       <div className="flex flex-col h-full p-10">
          <div className="bg-black p-8 text-white mb-8 shadow-2xl">
             <h4 className="text-[9px] font-black uppercase tracking-[0.4em] opacity-50 mb-2">Audit Trail</h4>
             <h1 className="text-2xl font-black uppercase tracking-tighter">Movement Ledger</h1>
          </div>

          <div className="flex-1 overflow-hidden border-2 border-black flex flex-col shadow-xl">
             <div className="overflow-y-auto flex-1 custom-scrollbar">
                <table className="w-full text-left border-collapse">
                   <thead>
                      <tr className="bg-black text-[9px] font-black text-white uppercase tracking-[0.3em] sticky top-0">
                         <th className="px-6 py-4">Timestamp</th>
                         <th className="px-6 py-4">Type</th>
                         <th className="px-6 py-4 text-right">Quantum</th>
                         <th className="px-6 py-4 text-right">Post-Balance</th>
                         <th className="px-6 py-4">Ref ID</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y-2 divide-slate-50">
                      {movements.map((mov) => (
                        <tr key={mov.id} className="hover:bg-slate-50 transition-all">
                           <td className="px-6 py-4 text-[10px] text-slate-400 font-black uppercase tracking-widest">{mov.date}</td>
                           <td className="px-6 py-4">
                              <span className={`px-3 py-1 border-2 text-[8px] font-black uppercase tracking-widest ${
                                mov.type === 'PURCHASE' ? 'bg-black text-white border-black' :
                                mov.type === 'SALE' ? 'border-black text-black' :
                                'border-slate-100 text-slate-300'
                              }`}>
                                {mov.type}
                              </span>
                           </td>
                           <td className={`px-6 py-4 text-right text-[11px] font-black tracking-widest ${mov.quantity >= 0 ? 'text-black' : 'text-slate-400'}`}>
                              {mov.quantity > 0 ? '+' : ''}{mov.quantity.toFixed(2)}
                           </td>
                           <td className="px-6 py-4 text-right text-[11px] font-black text-black tracking-widest">
                              {mov.balanceAfter.toFixed(2)}
                           </td>
                           <td className="px-6 py-4 text-[9px] text-black font-black uppercase tracking-[0.2em]">{mov.referenceId}</td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
       </div>
    </Modal>
  );
};

export default InventoryPage;
