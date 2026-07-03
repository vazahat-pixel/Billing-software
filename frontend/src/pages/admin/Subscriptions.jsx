import React, { useEffect, useState } from 'react';
import { CreditCard, Calendar, Clock, ArrowUpRight, Zap, X, TrendingUp, RefreshCw, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useAdminStore from '../../store/useAdminStore';

const statusColors = { active: '#10b981', suspended: '#ef4444', expired: '#f59e0b' };

const Subscriptions = () => {
    const { subscriptions, fetchSubscriptions, updateSubscription, plans, fetchPlans } = useAdminStore();
    const [editingSub, setEditingSub] = useState(null);
    const [subForm, setSubForm] = useState({ planId: '', billingCycle: 'monthly', endDate: '', status: 'active', offlineModeEnabled: false });

    useEffect(() => { fetchSubscriptions(); fetchPlans(); }, [fetchSubscriptions, fetchPlans]);

    const startEdit = (sub) => {
        setEditingSub(sub);
        setSubForm({
            planId: sub.planId?._id || '',
            billingCycle: sub.billingCycle || 'monthly',
            endDate: sub.endDate ? new Date(sub.endDate).toISOString().substring(0, 10) : '',
            status: sub.status || 'active',
            offlineModeEnabled: !!sub.offlineModeEnabled
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            await updateSubscription(editingSub.companyId?._id, subForm);
            setEditingSub(null);
        } catch (err) { alert(err.message || 'Failed to update'); }
    };

    const daysLeft = (endDate) => {
        const diff = Math.ceil((new Date(endDate) - new Date()) / 86400000);
        return diff;
    };

    return (
        <div className="space-y-5">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-black text-white">Subscriptions</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{subscriptions.length} active billing cycles</p>
                </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {subscriptions.map((sub, idx) => {
                    const days = daysLeft(sub.endDate);
                    const isExpiring = days <= 30;
                    return (
                        <motion.div
                            key={sub._id}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.06 }}
                            whileHover={{ y: -3 }}
                            className="sub-card"
                        >
                            <div className="sub-card__glow" style={{ opacity: isExpiring ? 0.15 : 0.08 }} />

                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <span className="sub-plan-tag">{sub.planId?.name || 'No'} Plan</span>
                                    <h3 className="text-base font-black text-white mt-1">{sub.companyId?.name || 'Unknown'}</h3>
                                </div>
                                <div className="sub-status-dot" style={{ background: statusColors[sub.status] || '#94a3b8', boxShadow: `0 0 8px ${statusColors[sub.status] || '#94a3b8'}` }} />
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="sub-info-box">
                                    <p className="sub-info-label">Billing</p>
                                    <p className="sub-info-val capitalize">{sub.billingCycle}</p>
                                </div>
                                <div className="sub-info-box">
                                    <p className="sub-info-label">Amount</p>
                                    <p className="sub-info-val text-violet-400">
                                        ₹{sub.billingCycle === 'monthly' ? sub.planId?.priceMonthly : sub.planId?.priceYearly}
                                    </p>
                                </div>
                            </div>

                            <div className="sub-dates">
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-600">Started</span>
                                    <span className="text-slate-400 font-bold">{new Date(sub.startDate).toLocaleDateString('en-IN')}</span>
                                </div>
                                <div className="flex justify-between text-xs mt-1.5">
                                    <span className="text-slate-600">Expires</span>
                                    <span className={`font-bold ${isExpiring ? 'text-amber-400' : 'text-slate-400'}`}>
                                        {new Date(sub.endDate).toLocaleDateString('en-IN')}
                                        {isExpiring && <span className="ml-1 text-[10px] text-amber-500">({days}d left)</span>}
                                    </span>
                                </div>
                            </div>

                            <button onClick={() => startEdit(sub)} className="sub-manage-btn">
                                <RefreshCw size={13} /> Manage Billing <ArrowUpRight size={13} />
                            </button>
                        </motion.div>
                    );
                })}

                {subscriptions.length === 0 && (
                    <div className="col-span-full glass-card p-16 flex flex-col items-center justify-center text-center">
                        <CreditCard size={40} className="text-slate-700 mb-4" />
                        <h3 className="text-sm font-black text-slate-400">No Active Subscriptions</h3>
                        <p className="text-xs text-slate-600 mt-1">Subscriptions appear here once companies are assigned a plan</p>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            <AnimatePresence>
                {editingSub && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/75 backdrop-blur-xl z-50 flex items-center justify-center p-4"
                        onClick={(e) => e.target === e.currentTarget && setEditingSub(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.92, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.92, y: 20 }}
                            className="dark-modal"
                        >
                            <div className="dark-modal__header">
                                <div>
                                    <h3 className="dark-modal__title">Manage Billing</h3>
                                    <p className="dark-modal__subtitle">{editingSub.companyId?.name}</p>
                                </div>
                                <button onClick={() => setEditingSub(null)} className="dark-modal__close"><X size={16} /></button>
                            </div>
                            <div className="dark-modal__body">
                                <form onSubmit={handleSave} className="space-y-4">
                                    <div>
                                        <label className="dark-input__label">Subscription Plan</label>
                                        <select className="dark-input" value={subForm.planId} onChange={e => setSubForm({ ...subForm, planId: e.target.value })}>
                                            {plans.map(p => <option key={p._id} value={p._id}>{p.name} Plan</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="dark-input__label">Billing Cycle</label>
                                            <select className="dark-input" value={subForm.billingCycle} onChange={e => setSubForm({ ...subForm, billingCycle: e.target.value })}>
                                                <option value="monthly">Monthly</option>
                                                <option value="yearly">Yearly</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="dark-input__label">Status</label>
                                            <select className="dark-input" value={subForm.status} onChange={e => setSubForm({ ...subForm, status: e.target.value })}>
                                                <option value="active">Active</option>
                                                <option value="suspended">Suspended</option>
                                                <option value="expired">Expired</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="dark-input__label">Expiration Date</label>
                                        <input type="date" className="dark-input" value={subForm.endDate} onChange={e => setSubForm({ ...subForm, endDate: e.target.value })} required />
                                    </div>
                                    <label className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl cursor-pointer">
                                        <span className="text-xs font-bold text-slate-300 flex items-center gap-2"><Wifi size={13} /> Offline Mode</span>
                                        <input type="checkbox" checked={subForm.offlineModeEnabled} onChange={e => setSubForm({ ...subForm, offlineModeEnabled: e.target.checked })} />
                                    </label>
                                    <button type="submit" className="dark-submit-btn w-full">
                                        <RefreshCw size={14} /> Apply Changes
                                    </button>
                                </form>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Subscriptions;
