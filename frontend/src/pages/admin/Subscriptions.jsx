import React, { useEffect } from 'react';
import { CreditCard, Calendar, Clock, ArrowUpRight, Zap } from 'lucide-react';
import useAdminStore from '../../store/useAdminStore';

const Subscriptions = () => {
    const { subscriptions, fetchSubscriptions, loading } = useAdminStore();

    useEffect(() => {
        fetchSubscriptions();
    }, [fetchSubscriptions]);

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {subscriptions.map((sub) => (
                    <div key={sub._id} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col group hover:shadow-xl hover:shadow-indigo-100 transition-all duration-500">
                        <div className="p-10 border-b border-slate-50 relative">
                            <div className="absolute top-8 right-8 p-3 bg-indigo-50 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-500">
                                <Zap size={24} />
                            </div>
                            <p className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-2">{sub.planId?.name} Plan</p>
                            <h3 className="text-2xl font-black text-slate-900 mb-1">{sub.companyId?.name}</h3>
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                                sub.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                            }`}>
                                <Clock size={10} /> {sub.status}
                            </div>
                        </div>

                        <div className="p-10 flex-1 space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-slate-400 uppercase">Billing Cycle</p>
                                    <p className="font-black text-slate-800 capitalize">{sub.billingCycle}</p>
                                </div>
                                <div className="text-right space-y-1">
                                    <p className="text-xs font-bold text-slate-400 uppercase">Price</p>
                                    <p className="font-black text-slate-900">₹{sub.billingCycle === 'monthly' ? sub.planId?.priceMonthly : sub.planId?.priceYearly}</p>
                                </div>
                            </div>

                            <div className="p-6 bg-slate-50 rounded-[1.5rem] space-y-4">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500 font-medium">Started On</span>
                                    <span className="font-bold text-slate-800">{new Date(sub.startDate).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500 font-medium">Next Renewal</span>
                                    <span className="font-bold text-slate-800">{new Date(sub.endDate).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>

                        <div className="px-10 pb-10">
                            <button className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-colors">
                                Manage Billing <ArrowUpRight size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            
            {subscriptions.length === 0 && (
                <div className="bg-white rounded-[3rem] p-20 text-center border-2 border-dashed border-slate-200">
                    <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-300">
                        <CreditCard size={40} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-2">No Active Subscriptions</h3>
                    <p className="text-slate-500 max-w-sm mx-auto">Active subscriptions will appear here once companies start choosing their plans.</p>
                </div>
            )}
        </div>
    );
};

export default Subscriptions;
