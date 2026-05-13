import React, { useEffect } from 'react';
import useAdminStore from '../../store/useAdminStore';
import { Users, Building2, CreditCard, TrendingUp } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, color, trend }) => (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-xl ${color}`}>
                <Icon className="text-white" size={24} />
            </div>
            {trend && (
                <span className="text-emerald-500 bg-emerald-50 px-2 py-1 rounded-lg text-xs font-bold">
                    +{trend}%
                </span>
            )}
        </div>
        <p className="text-slate-500 text-sm font-medium">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
    </div>
);

const AdminDashboard = () => {
    const { stats, fetchStats, loading } = useAdminStore();

    useEffect(() => {
        fetchStats();
    }, []);

    if (loading) return <div className="text-center py-10">Loading...</div>;

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="Total Users" 
                    value={stats?.totalUsers || 0} 
                    icon={Users} 
                    color="bg-blue-500"
                    trend={12}
                />
                <StatCard 
                    title="Total Companies" 
                    value={stats?.totalCompanies || 0} 
                    icon={Building2} 
                    color="bg-indigo-500"
                    trend={8}
                />
                <StatCard 
                    title="Active Subscriptions" 
                    value={stats?.activeCompanies || 0} 
                    icon={CreditCard} 
                    color="bg-purple-500"
                />
                <StatCard 
                    title="Monthly Revenue" 
                    value={`$${stats?.revenue?.toFixed(2) || '0.00'}`} 
                    icon={TrendingUp} 
                    color="bg-emerald-500"
                    trend={15}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Activity or Charts would go here */}
                <div className="bg-white p-8 rounded-2xl border border-slate-200 min-h-[300px] flex items-center justify-center text-slate-400">
                    Growth Analytics Chart Placeholder
                </div>
                <div className="bg-white p-8 rounded-2xl border border-slate-200 min-h-[300px] flex items-center justify-center text-slate-400">
                    Subscription Distribution Placeholder
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
