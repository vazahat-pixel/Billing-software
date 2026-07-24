import React, { useState, useMemo, useEffect } from 'react';
import useStore from '../../store/useStore';
import { Package, Search, Filter, History, Plus, MoreVertical, TrendingUp } from 'lucide-react';
import { CardGridLoader, SkeletonTable } from '../../components/ui/loaders';

const InventoryPage = () => {
   const { inventoryLots, fetchInventory, loading } = useStore();
   const [searchQuery, setSearchQuery] = useState('');
   const [activeTab, setActiveTab] = useState('ALL');

   useEffect(() => {
      fetchInventory();
   }, [fetchInventory]);

   const initialLoad = loading && inventoryLots.length === 0;

   const stats = useMemo(() => {
      const totalWeight = inventoryLots.reduce((acc, l) => acc + (l.remainingMtrs || 0), 0);
      const lowStock = inventoryLots.filter(l => l.status === 'Partially Used').length;
      const items = [...new Set(inventoryLots.map(l => l.itemId?.name || l.itemName || ''))].length;
      return { totalWeight, lowStock, items };
   }, [inventoryLots]);

   const getStatusBadge = (status) => {
      switch (status) {
         case 'Available':
            return <span className="px-3 py-1 bg-green-50 text-green-600 text-[10px] font-bold uppercase rounded-md border border-green-100">AVAILABLE</span>;
         case 'Partially Used':
            return <span className="px-3 py-1 bg-amber-50 text-amber-600 text-[10px] font-bold uppercase rounded-md border border-amber-100">PARTIALLY USED</span>;
         case 'Closed':
            return <span className="px-3 py-1 bg-red-50 text-red-600 text-[10px] font-bold uppercase rounded-md border border-red-100">CLOSED</span>;
         default:
            return <span className="px-3 py-1 bg-slate-50 text-slate-400 text-[10px] font-bold uppercase rounded-md border border-slate-100">{status}</span>;
      }
   };

   const filteredLots = useMemo(() => {
      return inventoryLots.filter(lot => {
         const name = (lot.itemId?.name || lot.itemName || '').toLowerCase();
         const lotId = (lot.lotId || '').toLowerCase();
         const matchSearch = name.includes(searchQuery.toLowerCase()) || lotId.includes(searchQuery.toLowerCase());
         if (!matchSearch) return false;
         if (activeTab === 'LOW') return lot.status === 'Partially Used';
         if (activeTab === 'OUT') return lot.status === 'Closed';
         return true;
      });
   }, [inventoryLots, activeTab, searchQuery]);

   const tabs = ['ALL', 'LOW', 'OUT'];

   return (
      <div className="p-8 space-y-8 bg-[#FDFCF9] min-h-screen">
         {/* Header Section */}
         <div className="flex items-center justify-between">
            <div>
               <h1 className="text-4xl font-black text-black tracking-tight italic">Inventory Control<span className="text-slate-300">.</span></h1>
               <p className="text-slate-400 text-[11px] font-bold uppercase tracking-[0.2em] mt-2">Stock Management • Real-Time Tracking</p>
            </div>
            <div className="flex gap-4">
               <button onClick={() => fetchInventory()} className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-lg text-[11px] font-bold uppercase tracking-widest text-black hover:bg-slate-50 transition-all shadow-sm">
                  Refresh Stock
               </button>
            </div>
         </div>

         {initialLoad ? (
            <>
               <CardGridLoader count={3} />
               <SkeletonTable rows={10} cols={6} />
            </>
         ) : (
         <>
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
               <h3 className="text-3xl font-black text-black mt-1">{stats.totalWeight.toFixed(1)} MTRS</h3>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
               <div className="flex justify-between items-start mb-10">
                  <div className="p-4 bg-slate-50 rounded-2xl">
                     <TrendingUp size={24} />
                  </div>
                  <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest">Active</span>
               </div>
               <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Unique Items</p>
               <h3 className="text-3xl font-black text-black mt-1">{stats.items}</h3>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
               <div className="flex justify-between items-start mb-10">
                  <div className="p-4 bg-slate-50 rounded-2xl">
                     <TrendingUp className="rotate-90" size={24} />
                  </div>
                  <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Partially Used</span>
               </div>
               <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Lots</p>
               <h3 className="text-3xl font-black text-black mt-1">{stats.lowStock}</h3>
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
                        className={`px-6 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${activeTab === tab ? 'bg-black text-white shadow-md' : 'text-slate-400 hover:text-black'
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
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-12 pr-6 py-2.5 bg-slate-50 border-none rounded-xl text-[10px] font-bold uppercase tracking-widest outline-none w-80 transition-all focus:bg-white focus:ring-1 focus:ring-black"
                     />
                  </div>
               </div>
            </div>

            <div className="overflow-x-auto">
               <table className="w-full text-left">
                  <thead>
                     <tr className="border-b border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <th className="px-8 py-5">Lot ID</th>
                        <th className="px-8 py-5">Product Name</th>
                        <th className="px-8 py-5">Category</th>
                        <th className="px-8 py-5 text-right">Remaining Pcs</th>
                        <th className="px-8 py-5 text-right">Remaining Mtrs</th>
                        <th className="px-8 py-5 text-center">Status</th>
                        <th className="px-8 py-5 text-right">Pur. Rate</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                     {filteredLots.map((lot) => (
                        <tr key={lot._id} className="hover:bg-slate-50/50 transition-all group">
                           <td className="px-8 py-6">
                              <p className="text-[11px] font-black text-black uppercase tracking-widest">{lot.lotId}</p>
                           </td>
                           <td className="px-8 py-6">
                              <p className="text-[11px] font-black text-black uppercase tracking-widest">{lot.itemId?.name || lot.itemName || 'N/A'}</p>
                           </td>
                           <td className="px-8 py-6">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{lot.itemId?.category || lot.category || 'N/A'}</p>
                           </td>
                           <td className="px-8 py-6 text-right">
                              <p className="text-[11px] font-black text-black uppercase tracking-widest">{lot.remainingPcs || 0} Pcs</p>
                           </td>
                           <td className="px-8 py-6 text-right">
                              <p className="text-[11px] font-black text-black uppercase tracking-widest">{lot.remainingMtrs.toFixed(2)} Mtrs</p>
                           </td>
                           <td className="px-8 py-6 text-center">
                              {getStatusBadge(lot.status)}
                           </td>
                           <td className="px-8 py-6 text-right">
                              <p className="text-[11px] font-black text-black uppercase tracking-widest">₹ {lot.itemId?.purchaseRate || 0}</p>
                           </td>
                        </tr>
                     ))}
                     {filteredLots.length === 0 && (
                        <tr>
                           <td colSpan="7" className="px-8 py-10 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              No inventory lots found
                           </td>
                        </tr>
                     )}
                  </tbody>
               </table>
            </div>
         </div>
         </>
         )}
      </div>
   );
};

export default InventoryPage;
