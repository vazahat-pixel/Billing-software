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
        { name: 'Total Companies', value: stats?.totalCompanies || 0, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
        { name: 'Active Subscriptions', value: stats?.activeSubs || 0, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { name: 'Expiring Soon', value: stats?.expiringSoon || 0, icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
        { name: 'Est. MRR', value: `₹${stats?.mrr || 0}`, icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    ];

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {cards.map((card) => (
                    <div key={card.name} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-3 rounded-xl ${card.bg}`}>
                                <card.icon size={24} className={card.color} />
                            </div>
                            <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-full flex items-center gap-1">
                                <ArrowUpRight size={12} /> +12%
                            </span>
                        </div>
                        <h3 className="text-slate-500 text-sm font-medium">{card.name}</h3>
                        <p className="text-2xl font-bold text-slate-900 mt-1">{card.value}</p>
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
