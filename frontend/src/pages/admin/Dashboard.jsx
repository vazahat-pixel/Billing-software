import React, { useEffect } from 'react';
import { Building2, Users, CreditCard, AlertCircle, TrendingUp, ArrowUpRight } from 'lucide-react';
import useAdminStore from '../../store/useAdminStore';

const Dashboard = () => {
    const { stats, fetchStats, loading } = useAdminStore();

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    if (loading && !stats) return <div>Loading...</div>;

    const cards = [
        { name: 'Total Companies', value: stats?.totalCompanies || 0, icon: Building2 },
        { name: 'Active Subscriptions', value: stats?.activeSubs || 0, icon: Users },
        { name: 'Expiring Soon', value: stats?.expiringSoon || 0, icon: AlertCircle },
        { name: 'Est. MRR', value: `₹${stats?.mrr || 0}`, icon: TrendingUp },
    ];

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {cards.map((card) => (
                    <div key={card.name} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:border-black transition-all group">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-3 rounded-xl bg-slate-50 group-hover:bg-black group-hover:text-white transition-all`}>
                                <card.icon size={24} />
                            </div>
                            <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-3 py-1 rounded-lg flex items-center gap-1 uppercase tracking-widest">
                                <ArrowUpRight size={10} /> +12%
                            </span>
                        </div>
                        <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-widest leading-none">{card.name}</h3>
                        <p className="text-3xl font-black text-black mt-2 tracking-tight">{card.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Placeholder for Charts */}
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm h-80 flex items-center justify-center text-slate-400">
                    Plan Distribution Chart (Coming Soon)
                </div>
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm h-80 flex items-center justify-center text-slate-400">
                    Revenue Trend Chart (Coming Soon)
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
