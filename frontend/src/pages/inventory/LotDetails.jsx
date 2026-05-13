import React, { useMemo } from 'react';
import useStore from '../../store/useStore';
import LotCard from '../../components/inventory/LotCard';
import MovementTable from '../../components/inventory/MovementTable';
import { ArrowLeft, BarChart3, Hash, Shield, Package, Save, Trash2, ArrowRight } from 'lucide-react';

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
    <div className="p-20 text-center bg-white border-2 border-dashed border-slate-200">
       <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">Lot Schema Not Found</h2>
       <button onClick={onBack} className="mt-8 text-[10px] font-black text-black uppercase tracking-widest border-2 border-black px-10 py-3 hover:bg-black hover:text-white transition-all">← Revert to Registry</button>
    </div>
  );

  return (
    <div className="pb-20 animate-fadeIn">
      {/* Architectural Header */}
      <div className="bg-white p-10 border-2 border-black flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl mb-10">
        <div className="flex items-center gap-8">
           <button 
             onClick={onBack}
             className="p-4 bg-white border-2 border-black text-black hover:bg-black hover:text-white transition-all shadow-sm"
           >
             <ArrowLeft size={24} />
           </button>
           <div>
              <h1 className="text-3xl font-black text-black uppercase tracking-tighter">Traceability Matrix</h1>
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">
                 <span>Inventory</span>
                 <ArrowRight size={10} />
                 <span className="text-black">Audit History: {lotId}</span>
              </div>
           </div>
        </div>
      </div>

      <LotCard lot={lot} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mt-10">
         <div className="lg:col-span-2">
            <div className="bg-white border-2 border-black shadow-2xl overflow-hidden">
               <div className="p-6 bg-black text-white flex items-center gap-4">
                  <BarChart3 size={20} />
                  <h3 className="text-[11px] font-black uppercase tracking-[0.4em]">Historical Movement Registry</h3>
               </div>
               <MovementTable movements={movements} />
            </div>
         </div>
         
         <div className="space-y-10">
            <div className="bg-white p-10 border-2 border-black shadow-2xl">
               <h4 className="text-[10px] font-black uppercase text-black tracking-[0.4em] mb-8 border-b-2 border-black pb-4 flex items-center gap-4">
                  <Hash size={18} /> Physical Parameters
               </h4>
               <div className="space-y-6">
                  <div className="flex justify-between items-center">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Tolerance Limit</span>
                     <span className="text-[12px] font-black text-black">2.5% SHRK.</span>
                  </div>
                  <div className="flex justify-between items-center">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Retention Cycle</span>
                     <span className="text-[12px] font-black text-black">180 DAYS</span>
                  </div>
                  <div className="pt-6 border-t-2 border-slate-50 flex justify-between items-center">
                     <span className="text-[10px] font-black text-black uppercase tracking-widest">Storage Protocol</span>
                     <span className="text-[9px] font-black text-white bg-black px-4 py-1 uppercase tracking-widest">ZONE-A / S12</span>
                  </div>
               </div>
            </div>

            <div className="bg-black p-10 text-white shadow-2xl">
                <div className="flex items-center gap-4 mb-8">
                   <Shield size={20} className="text-slate-500" />
                   <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.4em]">Control Matrix</p>
                </div>
                <div className="space-y-4">
                   <button className="w-full py-4 bg-white text-black text-[10px] font-black uppercase tracking-[0.3em] hover:bg-slate-200 transition-all flex items-center justify-center gap-3">
                      <Hash size={14} /> Protocol Barcode
                   </button>
                   <button className="w-full py-4 bg-transparent border-2 border-white/20 text-white text-[10px] font-black uppercase tracking-[0.3em] hover:border-white transition-all flex items-center justify-center gap-3">
                      <Layout size={14} /> Manual Audit
                   </button>
                   <button className="w-full py-4 bg-transparent border-2 border-white/10 text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] hover:border-rose-900 hover:text-rose-500 transition-all flex items-center justify-center gap-3">
                      <Trash2 size={14} /> Register Defect
                   </button>
                </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default LotDetails;
