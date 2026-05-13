import React from 'react';
import { Check, X, Shield, Star, Rocket, Plus } from 'lucide-react';

const PlanCard = ({ name, price, icon: Icon, features, color, active }) => (
    <div className={`bg-white rounded-3xl border-2 p-8 transition-all ${
        active ? 'border-indigo-600 ring-4 ring-indigo-50 shadow-xl scale-[1.02]' : 'border-slate-200 hover:border-slate-300'
    }`}>
        <div className={`h-14 w-14 rounded-2xl ${color} flex items-center justify-center mb-6`}>
            <Icon className="text-white" size={28} />
        </div>
        <h3 className="text-xl font-bold text-slate-900">{name}</h3>
        <div className="mt-4 flex items-baseline gap-1">
            <span className="text-3xl font-black text-slate-900">${price}</span>
            <span className="text-slate-500 font-medium">/mo</span>
        </div>

        <div className="mt-8 space-y-4">
            {Object.entries(features).map(([feature, enabled]) => (
                <div key={feature} className="flex items-center gap-3">
                    {enabled ? (
                        <div className="h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center">
                            <Check className="text-emerald-600" size={12} strokeWidth={3} />
                        </div>
                    ) : (
                        <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center">
                            <X className="text-slate-400" size={12} strokeWidth={3} />
                        </div>
                    )}
                    <span className={`text-sm font-medium ${enabled ? 'text-slate-700' : 'text-slate-400'}`}>
                        {feature.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </span>
                </div>
            ))}
        </div>

        <button className={`w-full mt-8 py-3 rounded-xl font-bold transition-all ${
            active ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}>
            Configure Details
        </button>
    </div>
);

const AdminPlans = () => {
    const plans = [
        {
            name: 'Basic',
            price: 29,
            icon: Shield,
            color: 'bg-blue-500',
            features: {
                purchaseModule: true,
                inventory: true,
                jobWork: false,
                gstReporting: false,
                advancedReports: false
            }
        },
        {
            name: 'Standard',
            price: 59,
            icon: Star,
            color: 'bg-indigo-500',
            active: true,
            features: {
                purchaseModule: true,
                inventory: true,
                jobWork: true,
                gstReporting: true,
                advancedReports: false
            }
        },
        {
            name: 'Pro Business',
            price: 129,
            icon: Rocket,
            color: 'bg-purple-600',
            features: {
                purchaseModule: true,
                inventory: true,
                jobWork: true,
                gstReporting: true,
                advancedReports: true
            }
        }
    ];

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Subscription Engine</h2>
                    <p className="text-slate-500 mt-1">Define pricing tiers and feature entitlements</p>
                </div>
                <button className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20">
                    <Plus size={20} />
                    New Plan
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {plans.map((plan) => (
                    <PlanCard key={plan.name} {...plan} />
                ))}
            </div>

            {/* Global Feature Toggle Control */}
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-6">Module Global Controls</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                    {['Purchase', 'Inventory', 'Job Work', 'GST', 'Reports'].map(module => (
                        <div key={module} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center gap-3">
                            <span className="text-sm font-bold text-slate-700">{module}</span>
                            <div className="h-10 w-20 bg-indigo-100 rounded-full flex items-center px-1">
                                <div className="h-8 w-8 bg-indigo-600 rounded-full shadow-md translate-x-10"></div>
                            </div>
                            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Enabled</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AdminPlans;
