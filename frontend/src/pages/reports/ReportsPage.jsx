import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, PieChart, LineChart, FileText, Download, TrendingUp, TrendingDown, Package, Users } from 'lucide-react';

const ReportsPage = () => {
  const navigate = useNavigate();
  const reportGroups = [
    {
      title: 'Sales & Revenue',
      icon: TrendingUp,
      color: 'emerald',
      reports: [
        { name: 'Daily Sales Summary', type: 'Analytical' },
        { name: 'Sales Outstanding (Aging)', type: 'Accounting', path: '/reports/sales-outstanding' },
        { name: 'Customer Sales Register', type: 'Accounting' },
        { name: 'Pending Order Tracking', type: 'Sales' }
      ]
    },
    {
      title: 'Inventory & Stock',
      icon: Package,
      color: 'indigo',
      reports: [
        { name: 'Lot-wise Stock Report', type: 'Inventory' },
        { name: 'Stock Movement History', type: 'Ledger' },
        { name: 'Slow Moving Designs', type: 'Alerts' },
        { name: 'Warehouse-wise Stock', type: 'Inventory' }
      ]
    },
    {
      title: 'Financial Statements',
      icon: FileText,
      color: 'rose',
      reports: [
        { name: 'Party Ledger Balances', type: 'Accounting' },
        { name: 'Trial Balance', type: 'Final' },
        { name: 'Profit & Loss (P&L)', type: 'Final' },
        { name: 'Balance Sheet', type: 'Final' }
      ]
    }
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Business Reports & Analytics</h1>
        <p className="text-slate-500 text-sm">Comprehensive multi-module reporting for data-driven decisions.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportGroups.map((group, idx) => (
          <div key={idx} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
             <div className={`p-6 bg-${group.color}-600 text-white flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-white/20 rounded-lg"><group.icon size={20} /></div>
                   <h3 className="font-black text-sm uppercase tracking-wider">{group.title}</h3>
                </div>
                <button className="p-1.5 hover:bg-white/10 rounded-md transition-all"><BarChart3 size={16} /></button>
             </div>
             
             <div className="flex-1 p-2">
                <div className="divide-y divide-slate-50">
                   {group.reports.map((report, rIdx) => (
                     <div 
                        key={rIdx} 
                        onClick={() => report.path && navigate(report.path)}
                        className={`p-4 hover:bg-slate-50 transition-all group ${report.path ? 'cursor-pointer' : 'cursor-default'} flex items-center justify-between rounded-xl`}
                     >
                        <div>
                           <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{report.name}</p>
                           <p className="text-[9px] text-slate-400 font-black uppercase mt-0.5 tracking-widest">{report.type}</p>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-md border border-slate-100 shadow-sm"><Download size={14} /></button>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
             
             <div className="p-4 bg-slate-50 border-t border-slate-100">
                <button className="w-full py-2.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase hover:bg-slate-100 transition-all rounded-lg tracking-widest">
                   Schedule Weekly Export
                </button>
             </div>
          </div>
        ))}
      </div>

      {/* Visual Analytics Placeholder */}
      <div className="bg-slate-900 rounded-2xl p-8 text-white relative overflow-hidden">
         <div className="absolute top-0 right-0 p-12 opacity-5"><PieChart size={200} /></div>
         <div className="relative z-10 max-w-lg">
            <h2 className="text-3xl font-black mb-2">Visual Intelligence</h2>
            <p className="text-slate-400 text-sm mb-6">Connect your reporting data to advanced BI tools or use our built-in visualization engine for real-time sales trends and inventory heatmaps.</p>
            <div className="flex gap-4">
               <button className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-bold transition-all shadow-xl shadow-indigo-600/20">Launch BI Tool</button>
               <button className="px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all">Configure Alerts</button>
            </div>
         </div>
      </div>
    </div>
  );
};

export default ReportsPage;
