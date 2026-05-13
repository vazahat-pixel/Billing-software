import React, { useState, useMemo, useEffect } from 'react';
import useStore from '../../store/useStore';
import { Package, Search, Filter, History, Plus, MoreVertical, TrendingUp, ChevronDown } from 'lucide-react';
import Modal from '../../components/ui/Modal';

const InventoryPage = () => {
  const { inventoryLots, fetchInventory } = useStore();
  const [selectedLotId, setSelectedLotId] = useState(null);
  const [activeTab, setActiveTab] = useState('ALL');

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const stats = useMemo(() => {
    const totalWeight = inventoryLots.reduce((acc, l) => acc + (l.remainingMtrs || 0), 0);
    const lowStock = inventoryLots.filter(l => l.status === 'LOW').length;
    const items = [...new Set(inventoryLots.map(l => l.itemName))].length;
    return { totalWeight, lowStock, items };
  }, [inventoryLots]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'AVAILABLE': 
      case 'IN STOCK':
        return <span className="px-3 py-1 bg-green-50 text-green-600 text-[10px] font-bold uppercase rounded-md border border-green-100">IN STOCK</span>;
      case 'LOW': 
      case 'LOW STOCK':
        return <span className="px-3 py-1 bg-amber-50 text-amber-600 text-[10px] font-bold uppercase rounded-md border border-amber-100">LOW STOCK</span>;
      case 'OUT OF STOCK':
        return <span className="px-3 py-1 bg-red-600 text-white text-[10px] font-bold uppercase rounded-md shadow-sm">OUT OF STOCK</span>;
      default: 
        return <span className="px-3 py-1 bg-slate-50 text-slate-400 text-[10px] font-bold uppercase rounded-md border border-slate-100">{status}</span>;
    }
  };

  const tabs = ['ALL', 'LOW', 'OUT', 'INCOMING'];

  return (
    <div className="p-8 space-y-8 bg-[#FDFCF9] min-h-screen">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
           <h1 className="text-4xl font-black text-black tracking-tight italic">Inventory Control<span className="text-slate-300">.</span></h1>
           <p className="text-slate-400 text-[11px] font-bold uppercase tracking-[0.2em] mt-2">Stock Management • Real-Time Tracking</p>
        </div>
        <div className="flex gap-4">
           <button className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-lg text-[11px] font-bold uppercase tracking-widest text-black hover:bg-slate-50 transition-all shadow-sm">
             <History size={14} /> History
           </button>
           <button className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-lg text-[11px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg">
             <Plus size={14} /> Add New Item
           </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="flex justify-between items-start mb-10">
               <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-black group-hover:text-white transition-all duration-300">
                  <Package size={24} />
               </div>
               <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">In Stock</span>
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Total Stock</p>
            <h3 className="text-3xl font-black text-black mt-1">965 KG</h3>
         </div>

         <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="flex justify-between items-start mb-10">
               <div className="p-4 bg-slate-50 rounded-2xl">
                  <TrendingUp size={24} />
               </div>
               <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest">Active</span>
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Items</p>
            <h3 className="text-3xl font-black text-black mt-1">2</h3>
         </div>

         <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="flex justify-between items-start mb-10">
               <div className="p-4 bg-slate-50 rounded-2xl">
                  <TrendingUp className="rotate-90" size={24} />
               </div>
               <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Awaiting</span>
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Incoming</p>
            <h3 className="text-3xl font-black text-black mt-1">0</h3>
         </div>
      </div>

      {/* Inventory Registry Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
         <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-white">
            <div className="flex p-1 bg-slate-50 rounded-xl">
               {tabs.map(tab => (
                 <button
                   key={tab}
                   onClick={() => setActiveTab(tab)}
                   className={`px-6 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${
                     activeTab === tab ? 'bg-black text-white shadow-md' : 'text-slate-400 hover:text-black'
                   }`}
                 >
                   {tab}
                 </button>
               ))}
            </div>
            <div className="flex items-center gap-4">
               <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input 
                    placeholder="SEARCH INVENTORY..." 
                    className="pl-12 pr-6 py-2.5 bg-slate-50 border-none rounded-xl text-[10px] font-bold uppercase tracking-widest outline-none w-80 transition-all focus:bg-white focus:ring-1 focus:ring-black"
                  />
               </div>
               <button className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-black transition-all">
                 <Filter size={18} />
               </button>
            </div>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="border-b border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                     <th className="px-8 py-5">Product Name</th>
                     <th className="px-8 py-5">Category</th>
                     <th className="px-8 py-5 text-right">Current Qty</th>
                     <th className="px-8 py-5 text-center">Status</th>
                     <th className="px-8 py-5 text-right">Price/Unit</th>
                     <th className="px-8 py-5 text-right">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {inventoryLots.map((lot) => (
                    <tr key={lot.lotId} className="hover:bg-slate-50/50 transition-all group">
                       <td className="px-8 py-6">
                          <p className="text-[11px] font-black text-black uppercase tracking-widest">{lot.itemName || 'ROHU FISH'}</p>
                       </td>
                       <td className="px-8 py-6">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{lot.category || 'FRESHWATER'}</p>
                       </td>
                       <td className="px-8 py-6 text-right">
                          <p className="text-[11px] font-black text-black uppercase tracking-widest">{(lot.remainingMtrs || 450).toFixed(0)} KG</p>
                       </td>
                       <td className="px-8 py-6 text-center">
                          {getStatusBadge(lot.status || 'IN STOCK')}
                       </td>
                       <td className="px-8 py-6 text-right">
                          <p className="text-[11px] font-black text-black uppercase tracking-widest">₹ {(lot.rate || 285).toFixed(0)}</p>
                       </td>
                       <td className="px-8 py-6 text-right">
                          <button className="p-2 text-slate-300 hover:text-black transition-all">
                             <MoreVertical size={18} />
                          </button>
                       </td>
                    </tr>
                  ))}
                  {/* Sample Row from screenshot */}
                  <tr className="hover:bg-slate-50/50 transition-all group">
                     <td className="px-8 py-6"><p className="text-[11px] font-black text-black uppercase tracking-widest">SQUID</p></td>
                     <td className="px-8 py-6"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SEAFOOD</p></td>
                     <td className="px-8 py-6 text-right"><p className="text-[11px] font-black text-black uppercase tracking-widest">0 KG</p></td>
                     <td className="px-8 py-6 text-center">{getStatusBadge('OUT OF STOCK')}</td>
                     <td className="px-8 py-6 text-right"><p className="text-[11px] font-black text-black uppercase tracking-widest">₹ 380</p></td>
                     <td className="px-8 py-6 text-right"><button className="p-2 text-slate-300 hover:text-black transition-all"><MoreVertical size={18} /></button></td>
                  </tr>
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};

export default InventoryPage;
