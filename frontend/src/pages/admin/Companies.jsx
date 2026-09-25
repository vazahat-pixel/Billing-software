import React, { useEffect, useState } from 'react';
import { Building2, Lock, Unlock, ShieldCheck, Edit3, Plus, X, Search, Filter, Users, ArrowUpRight, Globe, Download, Trash2, UserRoundSearch, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useAdminStore from '../../store/useAdminStore';
import { adminApi } from '../../api';
import { AdminPageHeader, AdminButton, AdminBadge } from '../../components/admin/AdminUI';
import { notifyWarning, notifyError, notifySuccess } from '../../utils/notify';
import { erpConfirm } from '../../utils/confirm';

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
    const [filterState, setFilterState] = useState('');
    const [filterDistrict, setFilterDistrict] = useState('');
    const [filterCity, setFilterCity] = useState('');
    const [filterPlan, setFilterPlan] = useState('');

    const [createForm, setCreateForm] = useState({ name: '', ownerName: '', ownerEmail: '', ownerPassword: '', planId: '' });
    const [editForm, setEditForm] = useState({ name: '', planId: '', status: '', state: '', district: '', city: '' });
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
            const prevPlan = editingCompany?.planId?._id || editingCompany?.planId;
            await updateCompany(editingCompany._id, editForm);
            if (editForm.planId && String(editForm.planId) !== String(prevPlan)) {
                await adminApi.changeCompanyPlan(editingCompany._id, {
                    planId: editForm.planId,
                    reconcileModules: true,
                });
            }
            setEditingCompany(null);
            notifySuccess('Company updated');
            fetchCompanies();
        } catch (err) { notifyError(err, 'Failed to update'); }
    };

    const handleExport = async (company) => {
        try {
            const data = await adminApi.exportCompany(company._id);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${company.name || 'company'}-export.json`;
            a.click();
            URL.revokeObjectURL(url);
            notifySuccess('Export downloaded');
        } catch (err) {
            notifyError(err, 'Export failed');
        }
    };

    const handleProvisioningPack = async (company) => {
        try {
            const data = await adminApi.generateProvisioningPack(company._id);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${(company.name || 'company').replace(/\s+/g, '-')}-provisioning-pack.json`;
            a.click();
            URL.revokeObjectURL(url);
            notifySuccess('Provisioning pack downloaded — send securely to the desktop customer');
        } catch (err) {
            const msg =
                err?.response?.data?.message ||
                err?.message ||
                'Provisioning pack failed';
            notifyError(msg, 'Need active license + owner user on this company first');
        }
    };

    const handlePurge = async (company) => {
        const ok = await erpConfirm({
            title: 'Hard delete company',
            message: `Permanently delete "${company.name}" and all tenant data? This cannot be undone.`,
            confirmLabel: 'Continue',
            danger: true,
        });
        if (!ok) return;
        const confirmName = window.prompt(`Type company name exactly to confirm delete:\n${company.name}`);
        if (confirmName == null) return;
        try {
            await adminApi.deleteCompany(company._id, { confirmName });
            notifySuccess('Company deleted');
            fetchCompanies();
        } catch (err) {
            notifyError(err, 'Delete failed');
        }
    };

    const handleImpersonate = async (company) => {
        try {
            const data = await adminApi.impersonateCompany(company._id, { reason: 'support' });
            const token = data?.token;
            if (!token) throw new Error('No token returned');
            // localStorage shared across tabs — AuthBootstrap / AppProviders consume this
            localStorage.setItem(
                'pendingSupportSession',
                JSON.stringify({
                    token,
                    user: {
                        ...(data.user || {}),
                        id: data.user?.id || data.user?._id,
                        supportSession: true,
                        mustChangePassword: false,
                    },
                    companyId: company._id,
                    at: Date.now(),
                })
            );
            window.open(`${window.location.origin}/?supportToken=${encodeURIComponent(token)}`, '_blank');
            notifySuccess('Support session opened in new tab (30 min).');
            try {
                await navigator.clipboard.writeText(token);
            } catch { /* ignore */ }
        } catch (err) {
            notifyError(err, 'Impersonate failed');
        }
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
        const loc = company.location || company.meta || {};
        setEditForm({
            name: company.name,
            planId: company.planId?._id || '',
            status: company.status || 'active',
            state: loc.state || '',
            district: loc.district || '',
            city: loc.city || '',
        });
    };

    const locOf = (c) => c.location || c.meta || {};
    const uniqueSorted = (values) => [...new Set(values.map((v) => String(v || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const stateOptions = uniqueSorted(companies.map((c) => locOf(c).state));
    const districtOptions = uniqueSorted(
        companies
            .filter((c) => !filterState || locOf(c).state === filterState)
            .map((c) => locOf(c).district)
    );
    const cityOptions = uniqueSorted(
        companies
            .filter((c) => !filterState || locOf(c).state === filterState)
            .filter((c) => !filterDistrict || locOf(c).district === filterDistrict)
            .map((c) => locOf(c).city)
    );

    const filtered = companies.filter((c) => {
        const loc = locOf(c);
        const q = search.trim().toLowerCase();
        const hay = [
            c.name,
            c.ownerId?.name,
            c.ownerId?.email,
            c.planId?.name,
            loc.state,
            loc.district,
            loc.city,
            loc.gstin,
        ].join(' ').toLowerCase();
        if (q && !hay.includes(q)) return false;
        if (filterState && loc.state !== filterState) return false;
        if (filterDistrict && loc.district !== filterDistrict) return false;
        if (filterCity && loc.city !== filterCity) return false;
        if (filterPlan && String(c.planId?._id || c.planId) !== filterPlan) return false;
        return true;
    });

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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="admin-toolbar" style={{ flexWrap: 'wrap' }}>
                <div className="admin-toolbar__search" style={{ minWidth: 220, flex: '1 1 240px' }}>
                    <Search size={14} className="text-slate-500 flex-shrink-0" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search company, owner, city, GSTIN..."
                    />
                </div>
                <select className="dark-input" style={{ width: 140, height: 36 }} value={filterState} onChange={(e) => { setFilterState(e.target.value); setFilterDistrict(''); setFilterCity(''); }}>
                    <option value="">All states</option>
                    {stateOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className="dark-input" style={{ width: 140, height: 36 }} value={filterDistrict} onChange={(e) => { setFilterDistrict(e.target.value); setFilterCity(''); }}>
                    <option value="">All districts</option>
                    {districtOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className="dark-input" style={{ width: 140, height: 36 }} value={filterCity} onChange={(e) => setFilterCity(e.target.value)}>
                    <option value="">All cities</option>
                    {cityOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className="dark-input" style={{ width: 140, height: 36 }} value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)}>
                    <option value="">All plans</option>
                    {plans.map((p) => <option key={p._id} value={p._id}>{p.name}{p.features?.mobileView ? ' · Mobile' : ''}</option>)}
                </select>
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
                                {['Company', 'Owner', 'Place', 'Plan', 'Status', 'Actions'].map(h => (
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
                                        {(() => {
                                            const loc = locOf(company);
                                            const place = [loc.city, loc.district, loc.state].filter(Boolean).join(', ');
                                            return <p className="text-xs font-semibold text-slate-400">{place || '—'}</p>;
                                        })()}
                                    </td>
                                    <td>
                                        <span className="plan-badge">{company.planId?.name || 'No Plan'}</span>
                                        {company.planId?.features?.mobileView && (
                                            <p className="text-[10px] font-bold text-teal-700 mt-1">Mobile · view only</p>
                                        )}
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
                                            <button onClick={() => handleProvisioningPack(company)} className="icon-btn icon-btn--success" title="Download desktop provisioning pack">
                                                <Package size={14} />
                                            </button>
                                            <button onClick={() => handleExport(company)} className="icon-btn icon-btn--info" title="Export data">
                                                <Download size={14} />
                                            </button>
                                            <button onClick={() => handleImpersonate(company)} className="icon-btn" title="Impersonate owner (support)">
                                                <UserRoundSearch size={14} />
                                            </button>
                                            <button onClick={() => handlePurge(company)} className="icon-btn icon-btn--danger" title="Hard delete">
                                                <Trash2 size={14} />
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
                                    <td colSpan={6} className="px-5 py-16 text-center">
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
                    <div className="grid grid-cols-3 gap-3">
                        <DarkInput label="State" value={editForm.state} onChange={e => setEditForm({ ...editForm, state: e.target.value })} placeholder="Gujarat" />
                        <DarkInput label="District" value={editForm.district} onChange={e => setEditForm({ ...editForm, district: e.target.value })} placeholder="Surat" />
                        <DarkInput label="City" value={editForm.city} onChange={e => setEditForm({ ...editForm, city: e.target.value })} placeholder="Surat" />
                    </div>
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
                        Generate a product license for <strong className="text-violet-400">{licenseCompany?.name}</strong>.
                        This activates the company and renews their subscription to the expiry date below.
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
