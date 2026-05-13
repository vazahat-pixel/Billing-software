import React, { useEffect } from 'react';
import useAdminStore from '../../store/useAdminStore';
import { Search, Filter, MoreVertical, ToggleLeft, ToggleRight } from 'lucide-react';

const AdminCompanies = () => {
    const { companies, fetchCompanies, toggleCompany, loading } = useAdminStore();

    useEffect(() => {
        fetchCompanies();
    }, []);

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="relative flex-1 min-w-[300px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Search companies by name or owner..." 
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-medium">
                        <Filter size={18} />
                        Filter
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Company Details</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Owner</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Plan</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {companies.map((company) => (
                            <tr key={company._id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-bold">
                                            {company.companyName.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900">{company.companyName}</p>
                                            <p className="text-xs text-slate-500">ID: {company._id.substring(0, 8)}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <p className="text-sm font-medium text-slate-700">{company.ownerId?.name || 'N/A'}</p>
                                    <p className="text-xs text-slate-500">{company.ownerId?.email || '-'}</p>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                        company.subscriptionPlan === 'Premium' ? 'bg-amber-100 text-amber-700' :
                                        company.subscriptionPlan === 'Basic' ? 'bg-blue-100 text-blue-700' :
                                        'bg-slate-100 text-slate-600'
                                    }`}>
                                        {company.subscriptionPlan}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`flex items-center gap-1.5 text-xs font-bold ${
                                        company.isActive ? 'text-emerald-600' : 'text-rose-500'
                                    }`}>
                                        <span className={`h-1.5 w-1.5 rounded-full ${company.isActive ? 'bg-emerald-600' : 'bg-rose-500'}`}></span>
                                        {company.isActive ? 'Active' : 'Deactivated'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button 
                                            onClick={() => toggleCompany(company._id)}
                                            className={`p-2 rounded-lg transition-colors ${
                                                company.isActive ? 'text-emerald-500 hover:bg-emerald-50' : 'text-rose-500 hover:bg-rose-50'
                                            }`}
                                            title={company.isActive ? 'Deactivate' : 'Activate'}
                                        >
                                            {company.isActive ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                                        </button>
                                        <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                                            <MoreVertical size={20} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminCompanies;
