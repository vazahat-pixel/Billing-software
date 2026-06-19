import React, { useEffect, useRef } from 'react';
import { Building2, Users, AlertCircle, TrendingUp, ArrowUpRight, Zap, Globe, Shield, Activity, BarChart2, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import useAdminStore from '../../store/useAdminStore';

/* ── Stat Card ── */
const StatCard = ({ name, value, icon: Icon, gradient, delay, suffix = '' }) => (
    <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.5, ease: 'easeOut' }}
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
        className="admin-stat-card"
    >
        <div className="admin-stat-card__glow" style={{ background: gradient }} />
        <div className="admin-stat-card__header">
            <div className="admin-stat-card__icon" style={{ background: gradient }}>
                <Icon size={18} />
            </div>
            <span className="admin-stat-badge">
                <ArrowUpRight size={10} /> Active
            </span>
        </div>
        <p className="admin-stat-label">{name}</p>
        <p className="admin-stat-value">{value}{suffix}</p>
        <div className="admin-stat-bar">
            <motion.div
                className="admin-stat-bar__fill"
                style={{ background: gradient }}
                initial={{ width: 0 }}
                animate={{ width: '70%' }}
                transition={{ delay: delay + 0.3, duration: 1, ease: 'easeOut' }}
            />
        </div>
    </motion.div>
);

/* ── Animated Donut Chart ── */
const DonutChart = ({ data }) => {
    const total = data.reduce((s, d) => s + d.count, 0) || 1;
    const colors = ['#0d9488', '#14b8a6', '#10b981', '#f59e0b', '#ef4444'];
    let cumulative = 0;
    const r = 40, cx = 50, cy = 50, stroke = 10;
    const circum = 2 * Math.PI * r;

    return (
        <div className="flex items-center gap-8">
            <svg width="100" height="100" viewBox="0 0 100 100">
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
                {data.map((item, i) => {
                    const pct = item.count / total;
                    const dashLen = circum * pct;
                    const dashGap = circum - dashLen;
                    const offset = circum * (1 - cumulative);
                    cumulative += pct;
                    return (
                        <motion.circle
                            key={item.name}
                            cx={cx} cy={cy} r={r}
                            fill="none"
                            stroke={colors[i % colors.length]}
                            strokeWidth={stroke}
                            strokeDasharray={`${dashLen} ${dashGap}`}
                            strokeDashoffset={offset}
                            strokeLinecap="round"
                            transform={`rotate(-90 ${cx} ${cy})`}
                            initial={{ strokeDasharray: `0 ${circum}` }}
                            animate={{ strokeDasharray: `${dashLen} ${dashGap}` }}
                            transition={{ delay: 0.5 + i * 0.2, duration: 1, ease: 'easeOut' }}
                        />
                    );
                })}
                <text x={cx} y={cy + 4} textAnchor="middle" fill="white" fontSize="12" fontWeight="900">
                    {total}
                </text>
            </svg>
            <div className="space-y-2 flex-1">
                {data.map((item, i) => (
                    <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: colors[i % colors.length] }} />
                            <span className="text-[11px] text-slate-400 font-medium">{item.name}</span>
                        </div>
                        <span className="text-[11px] font-black" style={{ color: colors[i % colors.length] }}>
                            {Math.round((item.count / total) * 100)}%
                        </span>
                    </div>
                ))}
                {data.length === 0 && (
                    <p className="text-xs text-slate-600 italic">No data</p>
                )}
            </div>
        </div>
    );
};

/* ── Animated Line Chart ── */
const MiniLineChart = ({ data = [], color = '#0d9488' }) => {
    const points = data.length > 0 ? data.map(d => d.revenue) : [0, 0, 0, 0, 0, 0];
    const maxVal = Math.max(...points, 100);
    const w = 360, h = 80;
    const xs = points.map((_, i) => (i / (points.length - 1)) * w);
    const ys = points.map(p => h - 10 - ((p / maxVal) * (h - 20)));
    const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${ys[i]}`).join(' ');
    const area = path + ` L ${w} ${h} L 0 ${h} Z`;
    const gradId = `lgrad-${color.replace('#', '')}`;

    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 80 }} preserveAspectRatio="none">
            <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <motion.path
                d={area}
                fill={`url(#${gradId})`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
            />
            <motion.path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, ease: 'easeInOut', delay: 0.3 }}
            />
            {xs.map((x, i) => (
                <motion.circle
                    key={i}
                    cx={x} cy={ys[i]} r="3"
                    fill={color}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                />
            ))}
        </svg>
    );
};

/* ── Recent Activity ── */
const ActivityItem = ({ action, time, module, color }) => (
    <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-3 py-3 border-b border-white/[0.03] last:border-0"
    >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white shrink-0" style={{ background: color }}>
            {module?.charAt(0)?.toUpperCase() || 'A'}
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-300 truncate">{action}</p>
            <p className="text-[10px] text-slate-600">{module}</p>
        </div>
        <span className="text-[10px] text-slate-600 whitespace-nowrap">{time}</span>
    </motion.div>
);

const Dashboard = () => {
    const { stats, fetchStats, loading } = useAdminStore();

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const cards = [
        { name: 'Total Companies', value: stats?.totalCompanies || 0, icon: Building2, gradient: 'linear-gradient(135deg, #0d9488, #0f766e)', delay: 0 },
        { name: 'Active Subscriptions', value: stats?.activeSubs || 0, icon: Users, gradient: 'linear-gradient(135deg, #10b981, #059669)', delay: 0.1 },
        { name: 'Expiring Soon', value: stats?.expiringSoon || 0, icon: AlertCircle, gradient: 'linear-gradient(135deg, #f59e0b, #d97706)', delay: 0.2 },
        { name: 'Monthly Revenue', value: `₹${((stats?.mrr || 0) / 1000).toFixed(1)}K`, icon: TrendingUp, gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', delay: 0.3 },
    ];

    const distribution = stats?.planDistribution || [];

    const getLogColor = (module) => {
        const colors = {
            companies: '#0d9488',
            plans: '#3b82f6',
            subscriptions: '#10b981',
            licenses: '#f59e0b',
            audit: '#ef4444',
            usage: '#6366f1'
        };
        return colors[module] || '#0d9488';
    };

    const formatTime = (dateStr) => {
        try {
            const diffMs = Date.now() - new Date(dateStr).getTime();
            const diffMin = Math.round(diffMs / 60000);
            if (diffMin < 1) return 'Just now';
            if (diffMin < 60) return `${diffMin}m ago`;
            const diffHr = Math.round(diffMin / 60);
            if (diffHr < 24) return `${diffHr}h ago`;
            return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        } catch {
            return 'N/A';
        }
    };

    const recentActivity = stats?.recentLogs?.length > 0
        ? stats.recentLogs.map(log => ({
            action: `${log.action} ${log.companyId ? `(${log.companyId.name})` : ''}`,
            module: log.module,
            time: formatTime(log.createdAt),
            color: getLogColor(log.module)
        }))
        : [
            { action: 'New company registered', module: 'companies', time: '2m ago', color: '#0d9488' },
            { action: 'License key generated', module: 'licenses', time: '14m ago', color: '#3b82f6' },
            { action: 'Plan upgraded to Pro', module: 'subscriptions', time: '1h ago', color: '#10b981' },
            { action: 'User access revoked', module: 'audit', time: '3h ago', color: '#ef4444' },
            { action: 'API limit reached', module: 'usage', time: '5h ago', color: '#f59e0b' },
        ];

    if (loading && !stats) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-10 h-10 rounded-full border-2 border-transparent border-t-teal-500"
                    />
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Loading Analytics...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Welcome Banner */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="admin-welcome-banner"
            >
                <div className="admin-welcome-banner__glow" />
                <div className="flex items-center gap-4">
                    <div className="admin-welcome-icon">
                        <Star size={20} />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-white">Welcome back, Super Admin</h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} — All systems operational
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3 ml-auto">
                    <div className="text-right">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Platform Health</p>
                        <p className="text-sm font-black text-emerald-400">99.8% Uptime</p>
                    </div>
                    <Shield size={32} className="text-emerald-500 opacity-40" />
                </div>
            </motion.div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {cards.map((card) => (
                    <StatCard key={card.name} {...card} />
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                {/* Revenue Chart – wide */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="lg:col-span-3 glass-card p-6"
                >
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-sm font-black text-white">Revenue Growth</h3>
                            <p className="text-[10px] text-slate-500 mt-0.5">Monthly Recurring Revenue trend</p>
                        </div>
                        <span className="admin-trend-badge">
                            <TrendingUp size={10} /> +28% MoM
                        </span>
                    </div>
                    <MiniLineChart data={stats?.revenueTrend} color="#0d9488" />
                    <div className="flex justify-between mt-3 text-[9px] font-bold text-slate-600 uppercase tracking-wider">
                        {(stats?.revenueTrend || []).map(item => <span key={item.month}>{item.month}</span>)}
                    </div>
                </motion.div>

                {/* Plan Distribution – narrow */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="lg:col-span-2 glass-card p-6"
                >
                    <div className="mb-5">
                        <h3 className="text-sm font-black text-white">Plan Distribution</h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">Active subscription breakdown</p>
                    </div>
                    <DonutChart data={distribution} />
                </motion.div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                {/* Recent Activity */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="lg:col-span-3 glass-card p-6"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-black text-white">Recent Activity</h3>
                            <p className="text-[10px] text-slate-500 mt-0.5">Latest system events</p>
                        </div>
                        <Activity size={16} className="text-teal-600" />
                    </div>
                    {recentActivity.map((a, i) => (
                        <ActivityItem key={i} {...a} />
                    ))}
                </motion.div>

                {/* Quick Actions */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="lg:col-span-2 glass-card p-6 flex flex-col gap-3"
                >
                    <div className="mb-2">
                        <h3 className="text-sm font-black text-white">Quick Actions</h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">Common admin shortcuts</p>
                    </div>
                    {[
                        { label: 'Add New Company', icon: Building2, color: '#0d9488', href: '/admin/companies' },
                        { label: 'Create New Plan', icon: Zap, color: '#3b82f6', href: '/admin/plans' },
                        { label: 'Issue License Key', icon: Shield, color: '#10b981', href: '/admin/licenses' },
                        { label: 'View Audit Trail', icon: Activity, color: '#f59e0b', href: '/admin/audit' },
                        { label: 'Usage Analytics', icon: BarChart2, color: '#ef4444', href: '/admin/usage' },
                    ].map((action, i) => (
                        <motion.a
                            key={action.label}
                            href={action.href}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.7 + i * 0.07 }}
                            className="admin-quick-action"
                        >
                            <div className="admin-quick-action__icon" style={{ background: action.color }}>
                                <action.icon size={15} />
                            </div>
                            <span className="admin-quick-action__label">{action.label}</span>
                            <ArrowUpRight size={13} className="ml-auto text-slate-600 group-hover:text-teal-600 transition-colors" />
                        </motion.a>
                    ))}
                </motion.div>
            </div>
        </div>
    );
};

export default Dashboard;
