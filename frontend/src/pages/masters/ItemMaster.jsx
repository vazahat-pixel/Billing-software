import React, { useState } from 'react';
import useStore from '../../store/useStore';
import { ERPInput, ERPButton } from '../../components/forms/FormElements';
import ItemModal from './ItemModal';
import { Search, Plus, Edit2, Trash2, XCircle } from 'lucide-react';

const ItemMaster = () => {
  const { items, deleteItem } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const filteredItems = items.filter(i => 
    i.itemName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.designNo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden font-['Outfit']">
      
      {/* Header / Search */}
      <div className="bg-slate-900 p-4 flex justify-between items-center text-white">
         <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            📦 Design / Quality Master (Ref: #10)
         </h2>
         <div className="relative w-96">
            <ERPInput 
              placeholder="Search by Quality or Design No..." 
              className="bg-white/10 border-white/20 text-white placeholder:text-white/30 h-9 rounded-lg pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-3 top-2.5 text-white/30" size={16} />
         </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto bg-white">
         <table className="w-full text-[11px] border-collapse">
            <thead className="sticky top-0 bg-slate-100 text-slate-600 uppercase font-black tracking-tighter border-b border-slate-200">
               <tr>
                  <th className="px-4 py-3 text-left w-12">Sr</th>
                  <th className="px-4 py-3 text-left">Quality Name</th>
                  <th className="px-4 py-3 text-left">Design No</th>
                  <th className="px-4 py-3 text-left">Design Name</th>
                  <th className="px-4 py-3 text-left">Fabric</th>
                  <th className="px-4 py-3 text-right">HSN</th>
                  <th className="px-4 py-3 text-center">Unit</th>
                  <th className="px-4 py-3 text-right">Pur. Rate</th>
                  <th className="px-4 py-3 text-right">Sale Rate</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
               {filteredItems.map((item, idx) => (
                  <tr 
                    key={item.id} 
                    className="hover:bg-indigo-50/50 cursor-pointer transition-colors group"
                    onDoubleClick={() => { setSelectedItem(item); setIsModalOpen(true); }}
                  >
                     <td className="px-4 py-2 font-bold text-slate-400">{idx + 1}</td>
                     <td className="px-4 py-2 font-black text-slate-900 group-hover:text-indigo-600">{item.itemName}</td>
                     <td className="px-4 py-2 font-bold text-indigo-600">{item.designNo || '-'}</td>
                     <td className="px-4 py-2 text-slate-500">{item.designName || '-'}</td>
                     <td className="px-4 py-2 text-slate-400">{item.fabricQuality || '-'}</td>
                     <td className="px-4 py-2 text-right font-medium text-slate-500">{item.hsnCode}</td>
                     <td className="px-4 py-2 text-center">
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black uppercase text-slate-500">{item.unit}</span>
                     </td>
                     <td className="px-4 py-2 text-right font-bold text-slate-400">₹ {item.purchaseRate || '0.00'}</td>
                     <td className="px-4 py-2 text-right font-black text-emerald-600">₹ {item.saleRate || '0.00'}</td>
                  </tr>
               ))}
            </tbody>
         </table>
      </div>

      {/* Legacy Action Bar */}
      <div className="bg-slate-900 p-3 flex justify-between items-center border-t border-white/10">
         <div className="flex gap-2">
            <button 
              onClick={() => { setSelectedItem(null); setIsModalOpen(true); }}
              className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all shadow-lg shadow-emerald-900/20"
            >
               <Plus size={14} /> Add (F2)
            </button>
            <button 
              className="flex items-center gap-2 px-6 py-2 bg-[#3d2914] hover:bg-[#2a1c0e] text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
              onClick={() => { if(selectedItem) setIsModalOpen(true); }}
            >
               <Edit2 size={14} /> Edit (F3)
            </button>
            <button className="flex items-center gap-2 px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all">
               <Trash2 size={14} /> Delete (Del)
            </button>
         </div>
         <button className="flex items-center gap-2 px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all">
            <XCircle size={14} /> Exit (Esc)
         </button>
      </div>

      <ItemModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setSelectedItem(null); }}
        initialData={selectedItem}
      />
    </div>
  );
};

export default ItemMaster;
