import React, { useEffect, useState } from 'react';
import { Building2, Lock, Unlock, ShieldCheck, Edit3, Plus, X, Search, Filter, Users, ArrowUpRight, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useAdminStore from '../../store/useAdminStore';
import { AdminPageHeader, AdminButton, AdminBadge } from '../../components/admin/AdminUI';
import { notifyWarning, notifyError } from '../../utils/notify';

/* ── Dark Glass Modal ── */
const DarkModal = ({ isOpen, onClose, title, subtitle, children }) => (
    <AnimatePresence>
        {isOpen && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 backdrop-blur-xl z-50 flex items-center justify-center p-4"
                onClick={(e) => e.target === e.currentTarget && onClose()}
            >
                <motion.div
                    initial={{ scale: 0.92, y: 20, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.92, y: 20, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="dark-modal"
                >
                    <div className="dark-modal__header">
                        <div>
                            <h3 className="dark-modal__title">{title}</h3>
                            {subtitle && <p className="dark-modal__subtitle">{subtitle}</p>}
                        </div>
                        <button onClick={onClose} className="dark-modal__close">
                            <X size={16} />
                        </button>
                    </div>
                    <div className="dark-modal__body">{children}</div>
                </motion.div>
            </motion.div>
        )}
    </AnimatePresence>
);

/* ── Dark Input ── */
const DarkInput = ({ label, ...props }) => (
    <div>
        {label && <label className="dark-input__label">{label}</label>}
        <input className="dark-input" {...props} />
    </div>
);

/* ── Dark Select ── */
const DarkSelect = ({ label, children, ...props }) => (
    <div>
        {label && <label className="dark-input__label">{label}</label>}
        <select className="dark-input" {...props}>{children}</select>
    </div>
);

const Companies = () => {
    const { companies, fetchCompanies, lockCompany, unlockCompany, generateLicense, createCompany, updateCompany, plans, fetchPlans, loading } = useAdminStore();

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingCompany, setEditingCompany] = useState(null);
    const [licenseCompany, setLicenseCompany] = useState(null);
    const [search, setSearch] = useState('');

    const [createForm, setCreateForm] = useState({ name: '', ownerName: '', ownerEmail: '', ownerPassword: '', planId: '' });
    const [editForm, setEditForm] = useState({ name: '', planId: '', status: '' });
    const [expiryDate, setExpiryDate] = useState('');

    useEffect(() => {
        fetchCompanies();
        fetchPlans();
    }, [fetchCompanies, fetchPlans]);

    useEffect(() => {
        if (plans.length > 0 && !createForm.planId) {
            setCreateForm(prev => ({ ...prev, planId: plans[0]._id }));
        }
    }, [plans]);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!createForm.name || !createForm.ownerName || !createForm.ownerEmail || !createForm.ownerPassword || !createForm.planId) {
            return notifyWarning('Please fill in all fields.');
        }
        try {
            await createCompany(createForm);
            setIsCreateOpen(false);
            setCreateForm({ name: '', ownerName: '', ownerEmail: '', ownerPassword: '', planId: plans[0]?._id || '' });
        } catch (err) { notifyError(err, 'Failed to create company'); }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            await updateCompany(editingCompany._id, editForm);
            setEditingCompany(null);
        } catch (err) { notifyError(err, 'Failed to update'); }
    };

    const handleLicenseGenerate = async (e) => {
        e.preventDefault();
        if (!expiryDate) return notifyWarning('Please select an expiry date');
        try {
            await generateLicense({ companyId: licenseCompany._id, expiresAt: expiryDate });
            setExpiryDate('');
            setLicenseCompany(null);
        } catch (err) { notifyError(err, 'Failed to generate license'); }
    };

    const startEdit = (company) => {
        setEditingCompany(company);
        setEditForm({ name: company.name, planId: company.planId?._id || '', status: company.status || 'active' });
    };

    const filtered = companies.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.ownerId?.email?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-5">
            <AdminPageHeader
                title="Managed Companies"
                subtitle={`${companies.length} registered clients on the platform`}
                actions={
                    <AdminButton icon={Plus} onClick={() => setIsCreateOpen(true)}>
                        Add Company
                    </AdminButton>
                }
            />

            {/* Search & Filters */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="admin-toolbar">
                <div className="admin-toolbar__search">
                    <Search size={14} className="text-slate-500 flex-shrink-0" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search companies, owners..."
                    />
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 px-2">
                    <Filter size={13} />
                    <span className="font-bold">{filtered.length} results</span>
                </div>
            </motion.div>

            {/* Table */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="admin-table-wrap">
                <div className="overflow-x-auto">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                {['Company', 'Owner', 'Plan', 'Status', 'Actions'].map(h => (
                                    <th key={h}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((company, idx) => (
                                <motion.tr
                                    key={company._id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.04 }}
                                >
                                    <td>
                                        <div className="flex items-center gap-3">
                                            <div className="company-avatar">
                                                <span>{company.name.charAt(0).toUpperCase()}</span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-200">{company.name}</p>
                                                <p className="text-[10px] text-slate-600 font-mono truncate max-w-[120px]">ID: {company._id?.slice(-8)}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <p className="text-sm font-semibold text-slate-300">{company.ownerId?.name || 'N/A'}</p>
                                        <p className="text-[10px] text-slate-600">{company.ownerId?.email || ''}</p>
                                    </td>
                                    <td>
                                        <span className="plan-badge">{company.planId?.name || 'No Plan'}</span>
                                    </td>
                                    <td>
                                        <AdminBadge variant={company.status === 'active' ? 'success' : company.status === 'suspended' ? 'danger' : 'warning'} dot>
                                            {company.status || 'unknown'}
                                        </AdminBadge>
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-1">
                                            {company.status === 'active' ? (
                                                <button onClick={() => lockCompany(company._id)} className="icon-btn icon-btn--danger" title="Suspend">
                                                    <Lock size={14} />
                                                </button>
                                            ) : (
                                                <button onClick={() => unlockCompany(company._id)} className="icon-btn icon-btn--success" title="Activate">
                                                    <Unlock size={14} />
                                                </button>
                                            )}
                                            <button onClick={() => setLicenseCompany(company)} className="icon-btn icon-btn--info" title="Issue License">
                                                <ShieldCheck size={14} />
                                            </button>
                                            <button onClick={() => startEdit(company)} className="icon-btn icon-btn--warn" title="Edit">
                                                <Edit3 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </motion.tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-5 py-16 text-center">
                                        <Globe size={32} className="mx-auto mb-3 text-slate-700" />
                                        <p className="text-slate-600 font-bold text-sm">No companies found</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>

            {/* CREATE COMPANY MODAL */}
            <DarkModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Register New Company" subtitle="Onboard a new client to the ERP platform">
                <form onSubmit={handleCreate} className="space-y-4">
                    <DarkInput label="Company Name" type="text" value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} placeholder="Acme Textiles Ltd." required />
                    <div className="grid grid-cols-2 gap-3">
                        <DarkInput label="Owner Name" type="text" value={createForm.ownerName} onChange={e => setCreateForm({ ...createForm, ownerName: e.target.value })} placeholder="Ravi Kumar" required />
                        <DarkSelect label="Subscription Plan" value={createForm.planId} onChange={e => setCreateForm({ ...createForm, planId: e.target.value })}>
                            {plans.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                        </DarkSelect>
                    </div>
                    <DarkInput label="Owner Email" type="email" value={createForm.ownerEmail} onChange={e => setCreateForm({ ...createForm, ownerEmail: e.target.value })} placeholder="owner@company.com" required />
                    <DarkInput label="Owner Password" type="password" value={createForm.ownerPassword} onChange={e => setCreateForm({ ...createForm, ownerPassword: e.target.value })} placeholder="••••••••" required />
                    <button type="submit" className="dark-submit-btn w-full">
                        <Building2 size={15} /> Register & Seed Company
                    </button>
                </form>
            </DarkModal>

            {/* EDIT MODAL */}
            <DarkModal isOpen={!!editingCompany} onClose={() => setEditingCompany(null)} title="Edit Company" subtitle={editingCompany?.name}>
                <form onSubmit={handleUpdate} className="space-y-4">
                    <DarkInput label="Company Name" type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
                    <DarkSelect label="Subscription Plan" value={editForm.planId} onChange={e => setEditForm({ ...editForm, planId: e.target.value })}>
                        {plans.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                    </DarkSelect>
                    <DarkSelect label="Status" value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                    </DarkSelect>
                    <button type="submit" className="dark-submit-btn w-full">
                        <Edit3 size={15} /> Save Changes
                    </button>
                </form>
            </DarkModal>

            {/* LICENSE MODAL */}
            <DarkModal isOpen={!!licenseCompany} onClose={() => setLicenseCompany(null)} title="Issue License Key" subtitle={licenseCompany?.name}>
                <form onSubmit={handleLicenseGenerate} className="space-y-4">
                    <p className="text-xs text-slate-400 bg-white/[0.03] p-3 rounded-xl border border-white/[0.05]">
                        Generate a product license key for <strong className="text-violet-400">{licenseCompany?.name}</strong>. This will activate or renew their subscription.
                    </p>
                    <DarkInput label="Expiry Date" type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} required />
                    <button type="submit" className="dark-submit-btn w-full">
                        <ShieldCheck size={15} /> Generate & Apply Key
                    </button>
                </form>
            </DarkModal>
        </div>
    );
};

export default Companies;
