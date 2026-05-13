import React, { useEffect, useState } from 'react';
import { CreditCard, Check, Shield, Package, Database, Users as UsersIcon } from 'lucide-react';
import useAdminStore from '../../store/useAdminStore';

const Plans = () => {
    const { plans, fetchPlans, savePlan, loading } = useAdminStore();
    const [editingPlan, setEditingPlan] = useState(null);

    useEffect(() => {
        fetchPlans();
    }, [fetchPlans]);

    const initialPlan = {
        name: 'Basic',
        priceMonthly: 0,
        priceYearly: 0,
        features: {
            modules: { purchase: false, inventory: false, jobWork: false, sales: false, accounting: false, gst: false, reports: false },
            fields: {
                purchase: { broker: false, lrNo: false, discount2: false },
                sales: { bale: false, weight: false, challan: false }
            }
        },
        limits: { users: 1, invoicesPerMonth: 100, storageMb: 500 },
        isActive: true
    };

    const handleSave = async (e) => {
        e.preventDefault();
        await savePlan(editingPlan);
        setEditingPlan(null);
    };

    const toggleModule = (module) => {
        setEditingPlan({
            ...editingPlan,
            features: {
                ...editingPlan.features,
                modules: {
                    ...editingPlan.features.modules,
                    [module]: !editingPlan.features.modules[module]
                }
            }
        });
    };

    const toggleField = (module, field) => {
        setEditingPlan({
            ...editingPlan,
            features: {
                ...editingPlan.features,
                fields: {
                    ...editingPlan.features.fields,
                    [module]: {
                        ...editingPlan.features.fields[module],
                        [field]: !editingPlan.features.fields[module][field]
                    }
                }
            }
        });
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-800">Subscription Plans</h2>
                <button 
                    onClick={() => setEditingPlan(initialPlan)}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2"
                >
                    <Package size={20} /> Create New Plan
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {plans.map((plan) => (
                    <div key={plan._id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="text-xl font-bold text-slate-900 mb-1">{plan.name}</h3>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-black text-indigo-600">₹{plan.priceMonthly}</span>
                                <span className="text-slate-500 text-sm font-medium">/month</span>
                            </div>
                        </div>
                        
                        <div className="p-8 flex-1 space-y-4">
                            <div className="space-y-2">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Modules</p>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(plan.features.modules).filter(([_, val]) => val).map(([key]) => (
                                        <span key={key} className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold flex items-center gap-1">
                                            <Check size={12} /> {key}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4 space-y-3">
                                <div className="flex items-center gap-3 text-slate-600">
                                    <UsersIcon size={18} className="text-slate-400" />
                                    <span className="text-sm font-medium">{plan.limits.users} User Licenses</span>
                                </div>
                                <div className="flex items-center gap-3 text-slate-600">
                                    <Package size={18} className="text-slate-400" />
                                    <span className="text-sm font-medium">{plan.limits.invoicesPerMonth} Invoices / Month</span>
                                </div>
                                <div className="flex items-center gap-3 text-slate-600">
                                    <Database size={18} className="text-slate-400" />
                                    <span className="text-sm font-medium">{plan.limits.storageMb}MB Storage</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 bg-slate-50/50 border-t border-slate-100">
                            <button 
                                onClick={() => setEditingPlan(plan)}
                                className="w-full py-3 rounded-xl border-2 border-indigo-600 text-indigo-600 font-bold hover:bg-indigo-600 hover:text-white transition-all"
                            >
                                Edit Plan Details
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {editingPlan && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6 overflow-y-auto">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-4xl shadow-2xl overflow-hidden">
                        <form onSubmit={handleSave} className="flex flex-col h-[85vh]">
                            <div className="p-10 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900">Plan Builder</h3>
                                    <p className="text-slate-500">Configure modules, fields, and usage limits</p>
                                </div>
                                <button type="button" onClick={() => setEditingPlan(null)} className="p-2 hover:bg-slate-100 rounded-full">
                                    <Shield size={24} className="text-slate-400" />
                                </button>
                            </div>

                            <div className="p-10 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div className="space-y-8">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Plan Name</label>
                                            <select 
                                                className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-600 outline-none font-bold"
                                                value={editingPlan.name}
                                                onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                                            >
                                                <option value="Basic">Basic</option>
                                                <option value="Standard">Standard</option>
                                                <option value="Pro">Pro</option>
                                                <option value="Custom">Custom</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Monthly Price</label>
                                            <input 
                                                type="number" 
                                                className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-600 outline-none"
                                                value={editingPlan.priceMonthly}
                                                onChange={(e) => setEditingPlan({ ...editingPlan, priceMonthly: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Yearly Price</label>
                                            <input 
                                                type="number" 
                                                className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-600 outline-none"
                                                value={editingPlan.priceYearly}
                                                onChange={(e) => setEditingPlan({ ...editingPlan, priceYearly: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <p className="text-sm font-black text-slate-900 uppercase">Usage Limits</p>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <label className="text-xs text-slate-500 block mb-1">Users</label>
                                                <input type="number" className="w-full p-3 border rounded-xl" value={editingPlan.limits.users} onChange={(e) => setEditingPlan({ ...editingPlan, limits: { ...editingPlan.limits, users: e.target.value } })} />
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 block mb-1">Invoices</label>
                                                <input type="number" className="w-full p-3 border rounded-xl" value={editingPlan.limits.invoicesPerMonth} onChange={(e) => setEditingPlan({ ...editingPlan, limits: { ...editingPlan.limits, invoicesPerMonth: e.target.value } })} />
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 block mb-1">Storage (MB)</label>
                                                <input type="number" className="w-full p-3 border rounded-xl" value={editingPlan.limits.storageMb} onChange={(e) => setEditingPlan({ ...editingPlan, limits: { ...editingPlan.limits, storageMb: e.target.value } })} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <p className="text-sm font-black text-slate-900 uppercase">Modules & Feature Gating</p>
                                    <div className="space-y-4">
                                        {Object.entries(editingPlan.features.modules).map(([module, active]) => (
                                            <div key={module} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                                                <div className="flex items-center justify-between mb-4">
                                                    <span className="font-bold text-slate-800 capitalize">{module}</span>
                                                    <button 
                                                        type="button"
                                                        onClick={() => toggleModule(module)}
                                                        className={`w-12 h-6 rounded-full transition-all relative ${active ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                                    >
                                                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${active ? 'right-1' : 'left-1'}`} />
                                                    </button>
                                                </div>
                                                
                                                {active && editingPlan.features.fields[module] && (
                                                    <div className="grid grid-cols-1 gap-2 pt-4 border-t border-slate-200">
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Field Access Control</p>
                                                        {Object.entries(editingPlan.features.fields[module]).map(([field, fieldActive]) => (
                                                            <label key={field} className="flex items-center gap-3 text-sm text-slate-600 cursor-pointer hover:text-indigo-600">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={fieldActive} 
                                                                    onChange={() => toggleField(module, field)}
                                                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600"
                                                                />
                                                                <span className="capitalize">{field}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="p-10 bg-slate-50 border-t border-slate-100 flex gap-4">
                                <button type="button" onClick={() => setEditingPlan(null)} className="flex-1 py-4 text-slate-600 font-bold hover:bg-slate-100 rounded-2xl transition-all">Discard Changes</button>
                                <button type="submit" className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all">Save Plan Configuration</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Plans;
