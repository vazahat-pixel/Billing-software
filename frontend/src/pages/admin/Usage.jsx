import React, { useEffect, useState } from 'react';
import { BarChart3, Database, FileText, Users } from 'lucide-react';
import useAdminStore from '../../store/useAdminStore';

const Usage = () => {
    const { usage, fetchUsage, companies, fetchCompanies, loading } = useAdminStore();
    const [selectedCompany, setSelectedCompany] = useState('');
    const [period, setPeriod] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM

    useEffect(() => {
        fetchCompanies();
        fetchUsage(selectedCompany, period);
    }, [fetchCompanies, fetchUsage, selectedCompany, period]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-end bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Filter by Company</label>
                    <select 
                        className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                        value={selectedCompany}
                        onChange={(e) => setSelectedCompany(e.target.value)}
                    >
                        <option value="">All Companies</option>
                        {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="w-full md:w-48">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Month</label>
                    <input 
                        type="month" 
                        className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {usage.map((u) => (
                    <div key={u._id} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-black text-slate-900">{u.companyId?.name || 'Unknown'}</h3>
                            <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase">{u.period}</span>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                                <div className="flex items-center gap-3">
                                    <FileText size={20} className="text-blue-500" />
                                    <span className="text-sm font-bold text-slate-600">Invoices</span>
                                </div>
                                <span className="font-black text-slate-900">{u.invoicesCount}</span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                                <div className="flex items-center gap-3">
                                    <Users size={20} className="text-emerald-500" />
                                    <span className="text-sm font-bold text-slate-600">Active Users</span>
                                </div>
                                <span className="font-black text-slate-900">{u.usersCount}</span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                                <div className="flex items-center gap-3">
                                    <Database size={20} className="text-amber-500" />
                                    <span className="text-sm font-bold text-slate-600">Storage</span>
                                </div>
                                <span className="font-black text-slate-900">{u.storageUsedMb} MB</span>
                            </div>
                        </div>
                    </div>
                ))}
                {usage.length === 0 && (
                    <div className="col-span-full p-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                        <BarChart3 size={48} className="mb-4 opacity-20" />
                        <p className="font-bold">No usage data found for the selected filters</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Usage;
