import React, { useEffect, useState } from 'react';
import { BarChart3, Database, FileText, Users, TrendingUp, Layers } from 'lucide-react';
import { motion } from 'framer-motion';
import useAdminStore from '../../store/useAdminStore';

const Usage = () => {
    const { usage, fetchUsage, companies, fetchCompanies } = useAdminStore();
    const [selectedCompany, setSelectedCompany] = useState('');
    const [period, setPeriod] = useState(new Date().toISOString().substring(0, 7));

    useEffect(() => {
        fetchCompanies();
        fetchUsage(selectedCompany, period);
    }, [fetchCompanies, fetchUsage, selectedCompany, period]);

    const metrics = [
        { key: 'invoicesCount', label: 'Invoices', icon: FileText, color: '#3b82f6', max: 500 },
        { key: 'usersCount', label: 'Active Users', icon: Users, color: '#10b981', max: 50 },
        { key: 'storageUsedMb', label: 'Storage (MB)', icon: Database, color: '#f59e0b', max: 1000, unit: 'MB' },
    ];

    return (
        <div className="space-y-5">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-black text-white">Usage Analytics</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Monitor resource consumption per company</p>
                </div>
            </motion.div>

            {/* Filters */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                    <label className="dark-input__label">Filter by Company</label>
                    <select className="dark-input" value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}>
                        <option value="">All Companies</option>
                        {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="w-full sm:w-48">
                    <label className="dark-input__label">Period</label>
                    <input type="month" className="dark-input" value={period} onChange={e => setPeriod(e.target.value)} />
                </div>
            </motion.div>

            {/* Usage Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {usage.map((u, idx) => (
                    <motion.div
                        key={u._id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.06 }}
                        whileHover={{ y: -3 }}
                        className="usage-card"
                    >
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h3 className="text-sm font-black text-white">{u.companyId?.name || 'Unknown'}</h3>
                                <span className="text-[10px] font-bold text-slate-600">{u.period}</span>
                            </div>
                            <div className="usage-period-badge">
                                <TrendingUp size={10} />
                                <span>{u.period?.split('-')[1]}</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {metrics.map(({ key, label, icon: Icon, color, max, unit }) => {
                                const val = u[key] || 0;
                                const pct = Math.min((val / max) * 100, 100);
                                return (
                                    <div key={key}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <Icon size={13} style={{ color }} />
                                                <span className="text-xs font-bold text-slate-400">{label}</span>
                                            </div>
                                            <span className="text-xs font-black text-slate-300">
                                                {val}{unit || ''}
                                                <span className="text-slate-600 font-normal">/{max}{unit || ''}</span>
                                            </span>
                                        </div>
                                        <div className="usage-bar">
                                            <motion.div
                                                className="usage-bar__fill"
                                                style={{ background: color }}
                                                initial={{ width: 0 }}
                                                animate={{ width: `${pct}%` }}
                                                transition={{ delay: idx * 0.06 + 0.3, duration: 0.8, ease: 'easeOut' }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                ))}

                {usage.length === 0 && (
                    <div className="col-span-full glass-card p-16 flex flex-col items-center text-center">
                        <BarChart3 size={40} className="text-slate-700 mb-4" />
                        <h3 className="text-sm font-black text-slate-500">No Usage Data</h3>
                        <p className="text-xs text-slate-600 mt-1">No usage records for the selected filters</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Usage;
