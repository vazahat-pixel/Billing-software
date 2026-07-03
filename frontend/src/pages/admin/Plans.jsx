import React, { useEffect, useState } from 'react';
import { CreditCard, Check, Shield, Package, Database, Users as UsersIcon, Trash2, Plus, Zap, X, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, FileText, ShoppingCart, Wrench, Calculator, BarChart2, Receipt, Settings, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useAdminStore from '../../store/useAdminStore';

/* ── Module Icon Map ── */
const moduleIcons = {
    purchase: ShoppingCart,
    inventory: Package,
    jobWork: Wrench,
    sales: Receipt,
    accounting: Calculator,
    gst: FileText,
    reports: BarChart2,
    masters: Settings,
    utilities: Settings,
};

const moduleColors = {
    purchase: 'from-blue-500 to-cyan-500',
    inventory: 'from-amber-500 to-orange-500',
    jobWork: 'from-purple-500 to-violet-600',
    sales: 'from-emerald-500 to-teal-500',
    accounting: 'from-rose-500 to-pink-500',
    gst: 'from-indigo-500 to-blue-600',
    reports: 'from-slate-500 to-gray-600',
    masters: 'from-zinc-500 to-slate-600',
    utilities: 'from-slate-400 to-zinc-500',
};

/* ── Toggle Switch ── */
const Toggle = ({ checked, onChange }) => (
    <button
        type="button"
        onClick={onChange}
        className={`toggle-switch ${checked ? 'toggle-switch--on' : ''}`}
    >
        <motion.div
            className="toggle-knob"
            animate={{ x: checked ? 16 : 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        />
    </button>
);

/* ── Plan Card ── */
const PlanCard = ({ plan, onEdit, onDelete }) => {
    const activeModules = Object.entries(plan.features?.modules || {}).filter(([_, v]) => v).map(([k]) => k);
    const hasOffline = plan.features?.offlineMode || plan.features?.modules?.offline;

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            className="plan-card"
        >
            {/* Top Gradient Strip */}
            <div className="plan-card__strip" />

            {/* Header */}
            <div className="plan-card__head">
                <div>
                    <h3 className="plan-card__name">{plan.name}</h3>
                    <div className="flex items-baseline gap-1 mt-1">
                        <span className="plan-card__price">₹{plan.priceMonthly}</span>
                        <span className="plan-card__price-unit">/mo</span>
                    </div>
                </div>
                <div className="plan-card__badge">
                    <Zap size={10} />{plan.isActive ? 'Active' : 'Draft'}
                </div>
            </div>

            {/* Active Modules */}
            <div className="plan-card__modules">
                {hasOffline && (
                    <span className="module-pill"><Wifi size={10} /> offline</span>
                )}
                {activeModules.length > 0 ? activeModules.map(mod => {
                    const Icon = moduleIcons[mod] || Package;
                    return (
                        <span key={mod} className="module-pill">
                            <Icon size={10} /> {mod}
                        </span>
                    );
                }) : (
                    <span className="text-xs text-slate-600 italic">No modules enabled</span>
                )}
            </div>

            {/* Limits */}
            <div className="plan-card__limits">
                <div className="limit-item">
                    <UsersIcon size={12} className="text-slate-600" />
                    <span>{plan.limits?.users || 1} Users</span>
                </div>
                <div className="limit-item">
                    <FileText size={12} className="text-slate-600" />
                    <span>{plan.limits?.invoicesPerMonth || 100} Invoices/mo</span>
                </div>
                <div className="limit-item">
                    <Database size={12} className="text-slate-600" />
                    <span>{plan.limits?.storageMb || 500} MB Storage</span>
                </div>
            </div>

            {/* Actions */}
            <div className="plan-card__actions">
                <button onClick={() => onEdit(plan)} className="plan-edit-btn">
                    Edit Plan
                </button>
                <button onClick={() => onDelete(plan._id, plan.name)} className="plan-delete-btn">
                    <Trash2 size={14} />
                </button>
            </div>
        </motion.div>
    );
};

/* ── Plan Builder Modal ── */
const PlanBuilderModal = ({ plan, onClose, onSave }) => {
    const [form, setForm] = useState(plan);
    const [expandedModule, setExpandedModule] = useState(null);

    const toggleFeature = (key) => {
        setForm(prev => ({
            ...prev,
            features: {
                ...prev.features,
                [key]: !prev.features[key],
                modules: {
                    ...prev.features.modules,
                    ...(key === 'offlineMode' ? { offline: !prev.features.offlineMode } : {})
                }
            }
        }));
    };

    const toggleModule = (module) => {
        setForm(prev => ({
            ...prev,
            features: {
                ...prev.features,
                modules: { ...prev.features.modules, [module]: !prev.features.modules[module] }
            }
        }));
    };

    const toggleField = (module, field) => {
        setForm(prev => ({
            ...prev,
            features: {
                ...prev.features,
                fields: {
                    ...prev.features.fields,
                    [module]: { ...prev.features.fields[module], [field]: !prev.features.fields[module][field] }
                }
            }
        }));
    };

    const setLimit = (key, val) => setForm(prev => ({ ...prev, limits: { ...prev.limits, [key]: val } }));

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-2xl z-50 flex items-center justify-center p-4"
        >
            <motion.div
                initial={{ scale: 0.92, y: 24 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.92, y: 24 }}
                className="plan-builder"
            >
                {/* Header */}
                <div className="plan-builder__header">
                    <div>
                        <h3 className="text-base font-black text-white">Plan Builder</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Configure modules, field access & usage limits</p>
                    </div>
                    <button onClick={onClose} className="dark-modal__close">
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="flex flex-col" style={{ maxHeight: 'calc(90vh - 80px)' }}>
                    <div className="plan-builder__body">
                        {/* Left: Basics & Limits */}
                        <div className="space-y-5">
                            <div>
                                <label className="dark-input__label">Plan Name</label>
                                <select className="dark-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}>
                                    {['Basic', 'Standard', 'Pro', 'Enterprise', 'Custom'].map(n => (
                                        <option key={n} value={n}>{n}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="dark-input__label">Monthly Price (₹)</label>
                                    <input type="number" className="dark-input" value={form.priceMonthly} onChange={e => setForm({ ...form, priceMonthly: e.target.value })} />
                                </div>
                                <div>
                                    <label className="dark-input__label">Yearly Price (₹)</label>
                                    <input type="number" className="dark-input" value={form.priceYearly} onChange={e => setForm({ ...form, priceYearly: e.target.value })} />
                                </div>
                            </div>

                            <div>
                                <p className="dark-input__label mb-3">Usage Limits</p>
                                <div className="space-y-3">
                                    {[
                                        { key: 'users', icon: UsersIcon, label: 'Max Users' },
                                        { key: 'invoicesPerMonth', icon: FileText, label: 'Invoices / Month' },
                                        { key: 'storageMb', icon: Database, label: 'Storage (MB)' },
                                    ].map(({ key, icon: Icon, label }) => (
                                        <div key={key} className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
                                            <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
                                                <Icon size={13} className="text-violet-400" />
                                            </div>
                                            <span className="text-xs font-bold text-slate-400 flex-1">{label}</span>
                                            <input
                                                type="number"
                                                className="w-20 bg-transparent border border-white/[0.08] rounded-lg px-2 py-1 text-xs font-black text-white text-right outline-none focus:border-violet-500"
                                                value={form.limits[key]}
                                                onChange={e => setLimit(key, e.target.value)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl">
                                <div>
                                    <p className="text-xs font-bold text-slate-300">Plan Status</p>
                                    <p className="text-[10px] text-slate-600">Enable / disable this plan</p>
                                </div>
                                <Toggle checked={form.isActive} onChange={() => setForm({ ...form, isActive: !form.isActive })} />
                            </div>

                            <div className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl">
                                <div className="flex items-center gap-2">
                                    <Wifi size={13} className="text-emerald-400" />
                                    <div>
                                        <p className="text-xs font-bold text-slate-300">Offline Mode</p>
                                        <p className="text-[9px] text-slate-600">Work without internet</p>
                                    </div>
                                </div>
                                <Toggle checked={!!form.features?.offlineMode} onChange={() => toggleFeature('offlineMode')} />
                            </div>
                        </div>

                        {/* Right: Module Gating */}
                        <div>
                            <p className="dark-input__label mb-3">Module & Feature Access</p>
                            <div className="space-y-2">
                                {Object.entries(form.features?.modules || {}).map(([module, active]) => {
                                    const Icon = moduleIcons[module] || Package;
                                    const color = moduleColors[module] || 'from-slate-500 to-gray-600';
                                    const hasFields = form.features?.fields?.[module] && Object.keys(form.features.fields[module]).length > 0;
                                    const isExpanded = expandedModule === module;

                                    return (
                                        <div key={module} className={`module-row ${active ? 'module-row--on' : ''}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`module-row__icon bg-gradient-to-br ${color} ${!active ? 'opacity-40' : ''}`}>
                                                    <Icon size={13} />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs font-bold text-slate-300 capitalize">{module}</p>
                                                    <p className="text-[9px] text-slate-600">{active ? 'Enabled' : 'Disabled'}</p>
                                                </div>
                                                {hasFields && active && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedModule(isExpanded ? null : module)}
                                                        className="text-slate-600 hover:text-violet-400 transition-colors"
                                                    >
                                                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                    </button>
                                                )}
                                                <Toggle checked={active} onChange={() => toggleModule(module)} />
                                            </div>

                                            <AnimatePresence>
                                                {active && hasFields && isExpanded && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="overflow-hidden mt-3 pt-3 border-t border-white/[0.05]"
                                                    >
                                                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2">Field Access</p>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {Object.entries(form.features.fields[module]).map(([field, fieldActive]) => (
                                                                <label key={field} className="flex items-center gap-2 cursor-pointer group">
                                                                    <div
                                                                        onClick={() => toggleField(module, field)}
                                                                        className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-all ${fieldActive ? 'bg-violet-500 border-violet-500' : 'border-slate-600'}`}
                                                                    >
                                                                        {fieldActive && <Check size={10} className="text-white" />}
                                                                    </div>
                                                                    <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-300 capitalize">{field}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="plan-builder__footer">
                        <button type="button" onClick={onClose} className="plan-cancel-btn">
                            Discard
                        </button>
                        <button type="submit" className="dark-submit-btn flex-1">
                            <Shield size={15} /> Save Plan Configuration
                        </button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
};

/* ── Main Page ── */
const Plans = () => {
    const { plans, fetchPlans, savePlan, deletePlan } = useAdminStore();
    const [editingPlan, setEditingPlan] = useState(null);

    useEffect(() => { fetchPlans(); }, [fetchPlans]);

    const initialPlan = {
        name: 'Basic',
        priceMonthly: 0,
        priceYearly: 0,
        features: {
            offlineMode: false,
            modules: { purchase: false, inventory: false, jobWork: false, sales: false, accounting: false, gst: false, reports: false, masters: false, utilities: false, offline: false },
            fields: {
                purchase: { broker: false, lrNo: false, discount2: false },
                sales: { bale: false, weight: false, challan: false }
            }
        },
        limits: { users: 1, invoicesPerMonth: 100, storageMb: 500 },
        isActive: true
    };

    const handleSave = async (planData) => {
        await savePlan(planData);
        setEditingPlan(null);
    };

    const handleDelete = async (id, name) => {
        if (window.confirm(`Delete plan "${name}"?`)) {
            try { await deletePlan(id); } catch (err) { alert(err.message); }
        }
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-black text-white">Subscription Plans</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Define module access & pricing for each plan</p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setEditingPlan(initialPlan)}
                    className="admin-primary-btn"
                >
                    <Plus size={15} /> New Plan
                </motion.button>
            </motion.div>

            {/* Plan Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {plans.map((plan, idx) => (
                    <PlanCard
                        key={plan._id}
                        plan={plan}
                        onEdit={setEditingPlan}
                        onDelete={handleDelete}
                    />
                ))}
                {plans.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="col-span-full glass-card p-16 flex flex-col items-center justify-center text-center"
                    >
                        <CreditCard size={40} className="text-slate-700 mb-4" />
                        <h3 className="text-sm font-black text-slate-400">No Plans Created Yet</h3>
                        <p className="text-xs text-slate-600 mt-1">Create your first subscription plan to get started</p>
                    </motion.div>
                )}
            </div>

            {/* Plan Builder Modal */}
            <AnimatePresence>
                {editingPlan && (
                    <PlanBuilderModal
                        plan={editingPlan}
                        onClose={() => setEditingPlan(null)}
                        onSave={handleSave}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default Plans;
