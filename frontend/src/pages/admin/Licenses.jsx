import React, { useEffect } from 'react';
import { ShieldCheck, Copy, Clock, CheckCircle2, XCircle } from 'lucide-react';
import useAdminStore from '../../store/useAdminStore';

const Licenses = () => {
    const { companies, fetchCompanies, loading } = useAdminStore();

    useEffect(() => {
        fetchCompanies();
    }, [fetchCompanies]);

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert('License key copied!');
    };

    return (
        <div className="space-y-6">
            <div className="bg-indigo-900 rounded-3xl p-10 text-white flex items-center justify-between overflow-hidden relative">
                <div className="relative z-10">
                    <h2 className="text-3xl font-black mb-2">License Keys</h2>
                    <p className="text-indigo-200">Monitor and manage unique company license keys and validation status.</p>
                </div>
                <ShieldCheck size={160} className="text-indigo-800 absolute -right-10 -bottom-10 rotate-12" />
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-8 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Company</th>
                                <th className="px-8 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">License Key</th>
                                <th className="px-8 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                                <th className="px-8 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {companies.filter(c => c.licenseKey).map((company) => (
                                <tr key={company._id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-8 py-6 font-bold text-slate-900">{company.name}</td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-3">
                                            <code className="bg-slate-100 px-3 py-1 rounded-lg text-indigo-600 font-mono font-bold tracking-wider">
                                                {company.licenseKey}
                                            </code>
                                            <button 
                                                onClick={() => copyToClipboard(company.licenseKey)}
                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                            >
                                                <Copy size={16} />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                                            <CheckCircle2 size={16} /> Validated
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <button className="text-sm font-bold text-indigo-600 hover:underline">View History</button>
                                    </td>
                                </tr>
                            ))}
                            {companies.filter(c => !c.licenseKey).map((company) => (
                                <tr key={company._id} className="opacity-60 bg-slate-50/50">
                                    <td className="px-8 py-6 font-bold text-slate-900">{company.name}</td>
                                    <td className="px-8 py-6 text-slate-400 italic">No key issued</td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-2 text-slate-400 font-bold text-sm">
                                            <XCircle size={16} /> Unlicensed
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <button className="text-sm font-bold text-indigo-600 hover:underline">Issue Now</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Licenses;
