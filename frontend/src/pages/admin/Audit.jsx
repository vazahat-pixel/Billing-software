import React, { useEffect, useState } from 'react';
import { Activity, ShieldAlert, User, Clock } from 'lucide-react';
import useAdminStore from '../../store/useAdminStore';

const Audit = () => {
    const { auditLogs, fetchAuditLogs, companies, fetchCompanies, loading } = useAdminStore();
    const [selectedCompany, setSelectedCompany] = useState('');
    const [selectedModule, setSelectedModule] = useState('');

    useEffect(() => {
        fetchCompanies();
        fetchAuditLogs(selectedCompany, selectedModule);
    }, [fetchCompanies, fetchAuditLogs, selectedCompany, selectedModule]);

    const modules = ['auth', 'purchase', 'sales', 'inventory', 'jobWork', 'admin'];

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-end bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Company</label>
                    <select 
                        className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-slate-700 outline-none"
                        value={selectedCompany}
                        onChange={(e) => setSelectedCompany(e.target.value)}
                    >
                        <option value="">All Companies</option>
                        {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Module</label>
                    <select 
                        className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-slate-700 outline-none"
                        value={selectedModule}
                        onChange={(e) => setSelectedModule(e.target.value)}
                    >
                        <option value="">All Modules</option>
                        {modules.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h2 className="text-xl font-black text-slate-900">Security Audit Trail</h2>
                    <ShieldAlert className="text-amber-500" size={24} />
                </div>

                <div className="p-0">
                    {auditLogs.map((log) => (
                        <div key={log._id} className="p-6 border-b border-slate-50 hover:bg-slate-50/50 transition-colors flex items-start gap-6">
                            <div className="p-3 bg-slate-100 rounded-xl text-slate-400">
                                <Activity size={20} />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                    <h4 className="font-bold text-slate-900">{log.action}</h4>
                                    <span className="text-[10px] font-black bg-slate-200 text-slate-600 px-2 py-0.5 rounded uppercase tracking-tighter">{log.module}</span>
                                </div>
                                <p className="text-sm text-slate-500 mb-3">
                                    Performed on {log.companyId?.name || 'System Level'}
                                </p>
                                <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
                                    <span className="flex items-center gap-1"><User size={12} /> {log.userId?.name || 'System'}</span>
                                    <span className="flex items-center gap-1"><Clock size={12} /> {new Date(log.createdAt).toLocaleString()}</span>
                                    <span>IP: {log.ip || 'Local'}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {auditLogs.length === 0 && (
                        <div className="p-20 text-center text-slate-400 font-bold italic">
                            No security events recorded for current filters
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Audit;
