import React, { useEffect, useState } from 'react';
import { Building2, MoreVertical, Lock, Unlock, ExternalLink, ShieldCheck } from 'lucide-react';
import useAdminStore from '../../store/useAdminStore';

const Companies = () => {
    const { companies, fetchCompanies, lockCompany, unlockCompany, generateLicense, loading } = useAdminStore();
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [expiryDate, setExpiryDate] = useState('');

    useEffect(() => {
        fetchCompanies();
    }, [fetchCompanies]);

    const handleLicenseGenerate = async (companyId) => {
        if (!expiryDate) return alert('Please select an expiry date');
        await generateLicense({ companyId, expiresAt: expiryDate });
        setExpiryDate('');
        setSelectedCompany(null);
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">Managed Companies</h2>
                <button className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
                    Add New Company
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Company</th>
                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Owner</th>
                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Plan</th>
                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Status</th>
                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {companies.map((company) => (
                            <tr key={company._id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
                                            {company.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-900">{company.name}</p>
                                            <p className="text-xs text-slate-500">ID: {company._id.substring(0, 8)}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <p className="text-sm text-slate-700">{company.ownerId?.name || 'N/A'}</p>
                                    <p className="text-xs text-slate-500">{company.ownerId?.email || ''}</p>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold">
                                        {company.planId?.name || 'No Plan'}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                        company.status === 'active' ? 'bg-emerald-50 text-emerald-700' :
                                        company.status === 'suspended' ? 'bg-rose-50 text-rose-700' :
                                        'bg-amber-50 text-amber-700'
                                    }`}>
                                        {company.status.toUpperCase()}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        {company.status === 'active' ? (
                                            <button 
                                                onClick={() => lockCompany(company._id)}
                                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                title="Lock Company"
                                            >
                                                <Lock size={18} />
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => unlockCompany(company._id)}
                                                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                                title="Unlock Company"
                                            >
                                                <Unlock size={18} />
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => setSelectedCompany(company)}
                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                            title="Issue License"
                                        >
                                            <ShieldCheck size={18} />
                                        </button>
                                        <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
                                            <MoreVertical size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {selectedCompany && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl">
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Issue License</h3>
                        <p className="text-slate-500 mb-6 text-sm">Issue a new license key for {selectedCompany.name}</p>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Expiry Date</label>
                                <input 
                                    type="date" 
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                                    value={expiryDate}
                                    onChange={(e) => setExpiryDate(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button 
                                onClick={() => setSelectedCompany(null)}
                                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => handleLicenseGenerate(selectedCompany._id)}
                                className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
                            >
                                Generate Key
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Companies;
