import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, PieChart, LineChart, FileText, Download, TrendingUp, TrendingDown, Package, Users, ArrowRight } from 'lucide-react';

const ReportsPage = () => {
  const navigate = useNavigate();
  const reportGroups = [
    {
      title: 'Revenue / Yield',
      icon: TrendingUp,
      reports: [
        { name: 'Daily Yield Analytics', type: 'Analytical' },
        { name: 'Aging / Sales Outstanding', type: 'Accounting', path: '/reports/sales-outstanding' },
        { name: 'Entity Sales Ledger', type: 'Accounting' },
        { name: 'Pipeline Fulfillment', type: 'Operations' }
      ]
    },
    {
      title: 'Atomic Inventory',
      icon: Package,
      reports: [
        { name: 'Lot Master Schema', type: 'Inventory' },
        { name: 'Atomic Stock Movement', type: 'Audit' },
        { name: 'Static Stock Analysis', type: 'Alerts' },
        { name: 'Global Asset Registry', type: 'Inventory' }
      ]
    },
    {
      title: 'Fiscal Framework',
      icon: FileText,
      reports: [
        { name: 'Counterparty Dossier', type: 'Accounting' },
        { name: 'Trial Balance Audit', type: 'Regulatory' },
        { name: 'Profit & Loss (P&L)', type: 'Fiscal' },
        { name: 'Consolidated Balance Sheet', type: 'Fiscal' }
      ]
    }
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Architectural Header */}
      <div className="bg-white p-10 border-2 border-black flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl">
        <div className="flex items-center gap-6">
           <div className="p-4 bg-black text-white">
              <BarChart3 size={28} />
           </div>
           <div>
              <h1 className="text-3xl font-black text-black uppercase tracking-tighter">Analytical Intelligence</h1>
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">
                 <span>Reporting</span>
                 <ArrowRight size={10} />
                 <span className="text-black">Audit Registry Framework</span>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {reportGroups.map((group, idx) => (
          <div key={idx} className="bg-white border-2 border-black overflow-hidden flex flex-col shadow-2xl">
             <div className="p-8 bg-black text-white flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <div className="p-2 bg-white text-black"><group.icon size={20} /></div>
                   <h3 className="font-black text-[11px] uppercase tracking-[0.4em]">{group.title}</h3>
                </div>
                <button className="p-1.5 hover:bg-white/10 transition-all text-white/50"><BarChart3 size={16} /></button>
             </div>
             
             <div className="flex-1 p-2">
                <div className="divide-y-2 divide-slate-50">
                   {group.reports.map((report, rIdx) => (
                     <div 
                        key={rIdx} 
                        onClick={() => report.path && navigate(report.path)}
                        className={`p-6 hover:bg-slate-50 transition-all group ${report.path ? 'cursor-pointer' : 'cursor-default'} flex items-center justify-between`}
                     >
                        <div>
                           <p className="text-[11px] font-black text-black uppercase tracking-widest group-hover:text-black transition-colors">{report.name}</p>
                           <p className="text-[9px] text-slate-400 font-black uppercase mt-1 tracking-[0.2em]">{report.type}</p>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button className="p-2 bg-white border-2 border-black text-black shadow-sm"><Download size={14} /></button>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
             
             <div className="p-6 bg-white border-t-2 border-black">
                <button className="w-full py-4 bg-slate-50 border-2 border-slate-100 text-black text-[9px] font-black uppercase hover:bg-black hover:text-white transition-all tracking-[0.4em]">
                   Protocol Batch Export
                </button>
             </div>
          </div>
        ))}
      </div>

      {/* High-Contrast Visual Intelligence Footer */}
      <div className="bg-black p-12 text-white relative overflow-hidden shadow-2xl">
         <div className="absolute top-0 right-0 p-12 opacity-10"><PieChart size={240} strokeWidth={1} /></div>
         <div className="relative z-10 max-w-2xl">
            <h2 className="text-4xl font-black mb-4 uppercase tracking-tighter">Operational Visualization</h2>
            <p className="text-slate-500 text-[11px] font-black uppercase tracking-[0.3em] mb-10 leading-loose">Synchronize your fiscal datasets with the global analytical engine. Real-time visualization for strategic resource allocation and high-frequency audit protocols.</p>
            <div className="flex gap-4">
               <button className="px-10 py-4 bg-white text-black text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Launch Intelligence Engine</button>
               <button className="px-10 py-4 bg-transparent border-2 border-white/20 text-white text-[10px] font-black uppercase tracking-widest hover:border-white transition-all">Audit Protocols</button>
            </div>
         </div>
      </div>
    </div>
  );
};

export default ReportsPage;
