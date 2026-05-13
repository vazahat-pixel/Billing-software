import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart, 
  Package,
  FileText,
  Calendar,
  Download,
  Plus,
  Hammer,
  Zap
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { motion } from 'framer-motion';

const data = [
  { name: 'Jan', sales: 4000, purchase: 2400 },
  { name: 'Feb', sales: 3000, purchase: 1398 },
  { name: 'Mar', sales: 5000, purchase: 9800 },
  { name: 'Apr', sales: 2780, purchase: 3908 },
  { name: 'May', sales: 4890, purchase: 4800 },
  { name: 'Jun', sales: 2390, purchase: 3800 },
  { name: 'Jul', sales: 6490, purchase: 4300 },
];

const fabricData = [
  { name: 'Cotton', value: 400, color: '#059669' },
  { name: 'Silk', value: 300, color: '#2563eb' },
  { name: 'Linen', value: 200, color: '#d97706' },
  { name: 'Wool', value: 100, color: '#dc2626' },
];

const StatCard = ({ title, value, trend, trendValue, icon: Icon, color }) => (
  <div className="bg-white p-4 rounded-lg border border-slate-200/60 shadow-sm flex flex-col gap-0.5">
    <div className="flex items-center justify-between">
      <div className={`p-2 rounded bg-${color}-50 text-${color}-600`}>
        <Icon size={16} />
      </div>
      <div className={`flex items-center gap-1 text-[11px] font-bold ${trend === 'up' ? 'text-emerald-600' : 'text-rose-600'}`}>
         {trend === 'up' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
         {trendValue}
      </div>
    </div>
    <div className="mt-3">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{title}</p>
      <h3 className="text-xl font-bold text-slate-900 mt-0.5 tracking-tight">{value}</h3>
    </div>
  </div>
);

const Dashboard = () => {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Business Overview</h1>
          <p className="text-slate-500 text-sm mt-1">Real-time performance metrics for your textile enterprise.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={Download}>Export Data</Button>
          <Button size="sm" icon={Plus}>Quick Entry</Button>
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Revenue" value="₹4.25L" trend="up" trendValue="+12.5%" icon={DollarSign} color="emerald" />
        <StatCard title="Active Jobs" value="156" trend="up" trendValue="+5" icon={Hammer} color="blue" />
        <StatCard title="Inventory Value" value="₹84.2L" trend="down" trendValue="-2.1%" icon={Package} color="amber" />
        <StatCard title="Receivables" value="₹2.15L" trend="up" trendValue="+₹45k" icon={TrendingUp} color="rose" />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card title="Sales & Purchase Performance" className="xl:col-span-2">
          <div className="h-[320px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} dx={-8} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="sales" stroke="#059669" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                <Area type="monotone" dataKey="purchase" stroke="#64748b" strokeWidth={2} fillOpacity={0.05} fill="#64748b" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Operational Alerts" icon={Zap}>
             <div className="space-y-3">
                {[
                  { title: 'Lot #502 Delayed', desc: 'Dyeing stage exceeded 48h', time: '12m ago', color: 'rose' },
                  { title: 'Payment Due', desc: 'Om Textiles: ₹12,500', time: '1h ago', color: 'amber' },
                  { title: 'Indent Approved', desc: '500m Cotton 40s', time: '4h ago', color: 'emerald' },
                ].map((alert, i) => (
                  <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex gap-3 group hover:bg-white hover:border-emerald-500/20 transition-all cursor-pointer">
                     <div className={`w-1 h-auto rounded-full bg-${alert.color}-500`}></div>
                     <div className="flex-1">
                        <div className="flex justify-between items-start">
                           <p className="text-[12px] font-bold text-slate-800 leading-none">{alert.title}</p>
                           <span className="text-[9px] font-bold text-slate-400 uppercase">{alert.time}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">{alert.desc}</p>
                     </div>
                  </div>
                ))}
             </div>
             <button className="w-full mt-4 py-2 text-[11px] font-bold text-slate-400 hover:text-slate-900 transition-colors uppercase tracking-widest">
                Clear All Notifications
             </button>
          </Card>
        </div>
      </div>

      {/* Tables Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Latest Transactions" extra={<button className="text-[11px] font-bold text-emerald-600 hover:underline">Full Ledger</button>}>
          <div className="space-y-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between p-2.5 hover:bg-slate-50 rounded transition-colors group border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-slate-50 rounded-lg flex items-center justify-center text-slate-500 border border-slate-100 group-hover:bg-white group-hover:border-emerald-100 group-hover:text-emerald-600 transition-all">
                    <FileText size={16} />
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-slate-800">INV/26/00{i}</p>
                    <p className="text-[10px] text-slate-500 font-medium">Suresh Fabrics • ₹{(12500 * i).toLocaleString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">24 Apr 2026</p>
                  <Badge variant={i % 2 === 0 ? 'success' : 'info'} className="mt-1">
                     {i % 2 === 0 ? 'Paid' : 'Pending'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Production Status">
          <div className="space-y-4">
            {[
              { stage: 'Mill Issue', count: 12, value: '4,500m', progress: 85, color: 'blue' },
              { stage: 'Printing', count: 8, value: '2,800m', progress: 45, color: 'emerald' },
              { stage: 'Finished', count: 24, value: '8,200m', progress: 100, color: 'indigo' },
            ].map((p, i) => (
              <div key={i} className="space-y-2">
                 <div className="flex justify-between items-end">
                    <div>
                       <p className="text-[12px] font-bold text-slate-800">{p.stage}</p>
                       <p className="text-[10px] text-slate-500 font-medium">{p.count} Lots • {p.value}</p>
                    </div>
                    <span className="text-[11px] font-black text-slate-900">{p.progress}%</span>
                 </div>
                 <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${p.progress}%` }}
                      transition={{ duration: 1, delay: i * 0.1 }}
                      className={`h-full bg-${p.color}-500 rounded-full`}
                    />
                 </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
