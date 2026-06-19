import React, { useEffect, useState } from 'react';
import { Activity, ShieldAlert, User, Clock, Filter, RefreshCw, ShoppingCart, Receipt, Wrench, Calculator, FileText, Settings, LogIn } from 'lucide-react';
import { motion } from 'framer-motion';
import useAdminStore from '../../store/useAdminStore';

const moduleColors = {
    auth: '#10b981', purchase: '#3b82f6', sales: '#a78bfa',
    inventory: '#f59e0b', jobWork: '#ec4899', admin: '#ef4444',
    accounting: '#14b8a6', gst: '#8b5cf6'
};

const moduleIcons = {
    auth: LogIn, purchase: ShoppingCart, sales: Receipt,
    inventory: Settings, jobWork: Wrench, admin: ShieldAlert,
    accounting: Calculator, gst: FileText
};

const severityMap = {
    login: { color: '#10b981', label: 'AUTH' },
    create: { color: '#3b82f6', label: 'CREATE' },
    update: { color: '#f59e0b', label: 'UPDATE' },
    delete: { color: '#ef4444', label: 'DELETE' },
    lock: { color: '#ef4444', label: 'LOCK' },
    unlock: { color: '#10b981', label: 'UNLOCK' },
    generate: { color: '#a78bfa', label: 'GEN' },
};

const Audit = () => {
    const { auditLogs, fetchAuditLogs, companies, fetchCompanies } = useAdminStore();
    const [selectedCompany, setSelectedCompany] = useState('');
    const [selectedModule, setSelectedModule] = useState('');

    useEffect(() => {
        fetchCompanies();
        fetchAuditLogs(selectedCompany, selectedModule);
    }, [fetchCompanies, fetchAuditLogs, selectedCompany, selectedModule]);

    const modules = ['auth', 'purchase', 'sales', 'inventory', 'jobWork', 'admin', 'accounting', 'gst'];

    const getSeverity = (action) => {
        const lowerAction = (action || '').toLowerCase();
        for (const [key, val] of Object.entries(severityMap)) {
            if (lowerAction.includes(key)) return val;
        }
        return { color: '#64748b', label: 'ACTION' };
    };

    return (
        <div className="space-y-5">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-black text-white">Security Audit Trail</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Complete log of all system events and user actions</p>
                </div>
                <button
                    onClick={() => fetchAuditLogs(selectedCompany, selectedModule)}
                    className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-violet-400 transition-colors px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-xl"
                >
                    <RefreshCw size={13} /> Refresh
                </button>
            </motion.div>

            {/* Filters */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-4 flex flex-col sm:flex-row gap-4">
                <div className="flex items-center gap-2 text-slate-600">
                    <Filter size={14} />
                </div>
                <div className="flex-1">
                    <select className="dark-input" value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}>
                        <option value="">All Companies</option>
                        {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="flex-1">
                    <select className="dark-input" value={selectedModule} onChange={e => setSelectedModule(e.target.value)}>
                        <option value="">All Modules</option>
                        {modules.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                    </select>
                </div>
            </motion.div>

            {/* Module Quick Filters */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="flex flex-wrap gap-2">
                {modules.map(m => {
                    const Icon = moduleIcons[m] || Activity;
                    const color = moduleColors[m] || '#64748b';
                    const isActive = selectedModule === m;
                    return (
                        <button
                            key={m}
                            onClick={() => setSelectedModule(isActive ? '' : m)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                            style={{
                                background: isActive ? `${color}22` : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${isActive ? color + '44' : 'rgba(255,255,255,0.06)'}`,
                                color: isActive ? color : '#475569'
                            }}
                        >
                            <Icon size={10} /> {m}
                        </button>
                    );
                })}
            </motion.div>

            {/* Logs */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card overflow-hidden">
                <div className="px-6 py-4 border-b border-white/[0.04] flex items-center gap-3">
                    <Activity size={16} className="text-violet-400" />
                    <span className="text-sm font-black text-white">Event Log</span>
                    <span className="ml-auto text-xs font-bold text-slate-600">{auditLogs.length} events</span>
                </div>
                <div className="divide-y divide-white/[0.03]">
                    {auditLogs.map((log, idx) => {
                        const Icon = moduleIcons[log.module] || Activity;
                        const modColor = moduleColors[log.module] || '#64748b';
                        const severity = getSeverity(log.action);
                        return (
                            <motion.div
                                key={log._id}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.03 }}
                                className="flex items-start gap-4 px-6 py-4 hover:bg-white/[0.015] transition-colors"
                            >
                                {/* Module Icon */}
                                <div
                                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                    style={{ background: `${modColor}18`, border: `1px solid ${modColor}30` }}
                                >
                                    <Icon size={15} style={{ color: modColor }} />
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-bold text-slate-200 truncate">{log.action}</span>
                                        <span
                                            className="text-[9px] font-black px-1.5 py-0.5 rounded-md"
                                            style={{ background: `${severity.color}18`, color: severity.color, border: `1px solid ${severity.color}30` }}
                                        >
                                            {severity.label}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-600 mt-0.5">{log.companyId?.name || 'System Level'}</p>
                                    <div className="flex items-center gap-4 mt-1.5 text-[10px] text-slate-700">
                                        <span className="flex items-center gap-1"><User size={9} />{log.userId?.name || 'System'}</span>
                                        <span className="flex items-center gap-1"><Clock size={9} />{new Date(log.createdAt).toLocaleString('en-IN')}</span>
                                        <span>IP: {log.ip || 'Local'}</span>
                                    </div>
                                </div>

                                {/* Module Tag */}
                                <span
                                    className="text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest flex-shrink-0"
                                    style={{ background: `${modColor}12`, color: modColor, border: `1px solid ${modColor}25` }}
                                >
                                    {log.module}
                                </span>
                            </motion.div>
                        );
                    })}
                    {auditLogs.length === 0 && (
                        <div className="p-16 text-center">
                            <ShieldAlert size={36} className="mx-auto mb-4 text-slate-700" />
                            <p className="text-sm font-black text-slate-500">No security events found</p>
                            <p className="text-xs text-slate-700 mt-1">Adjust your filters to see more results</p>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default Audit;
