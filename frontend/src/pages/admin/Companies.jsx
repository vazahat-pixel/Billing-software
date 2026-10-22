import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Building2, Lock, Unlock, ShieldCheck, Edit3, Plus, X, Search, Filter, Users, ArrowUpRight, Globe, Download, Trash2, UserRoundSearch, Package, ChevronDown, ChevronRight, CornerDownRight, Layers } from 'lucide-react';
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

/** Filter dropdown with a search box, so long state/city/plan lists stay usable. */
const SearchableFilter = ({ value, onChange, allLabel, options, width = 160 }) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const boxRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const onDoc = (e) => {
            if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
        };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
        inputRef.current?.focus();
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const q = query.trim().toLowerCase();
    const visible = options.filter((o) => o.label.toLowerCase().includes(q));
    const current = options.find((o) => o.value === value);

    return (
        <div ref={boxRef} style={{ position: 'relative', width, flex: '0 0 auto' }}>
            <button
                type="button"
                className="dark-input"
                style={{ height: 36, width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}
                onClick={() => { setQuery(''); setOpen((v) => !v); }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {current?.label || allLabel}
                </span>
                <span style={{ color: '#94a3b8', fontSize: 10 }}>▼</span>
            </button>
            {open && (
                <div
                    style={{
                        position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 40,
                        width: Math.max(width, 220), background: '#fff', border: '1px solid #e2e8f0',
                        borderRadius: 8, boxShadow: '0 12px 32px rgba(15,23,42,0.12)', overflow: 'hidden',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderBottom: '1px solid #e2e8f0' }}>
                        <Search size={13} className="text-slate-400" />
                        <input
                            ref={inputRef}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={`Search ${allLabel.replace(/^All\s+/i, '').toLowerCase()}…`}
                            style={{ border: 'none', outline: 'none', width: '100%', fontSize: 12, fontWeight: 600, color: '#0f172a' }}
                        />
                    </div>
                    <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                        <button
                            type="button"
                            onClick={() => { onChange(''); setOpen(false); }}
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: 12, fontWeight: 700, background: !value ? '#f0fdfa' : 'transparent', color: '#0f766e' }}
                        >
                            {allLabel}
                        </button>
                        {visible.map((o) => (
                            <button
                                key={o.value}
                                type="button"
                                onClick={() => { onChange(o.value); setOpen(false); }}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: 12, fontWeight: 600, background: value === o.value ? '#f0fdfa' : 'transparent', color: '#0f172a' }}
                            >
                                {o.label}
                            </button>
                        ))}
                        {visible.length === 0 && (
                            <p style={{ padding: '10px 12px', fontSize: 12, color: '#94a3b8' }}>No match</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

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

    const [createForm, setCreateForm] = useState({ name: '', ownerName: '', ownerEmail: '', ownerPassword: '', planId: '', groupCode: '' });
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
            const created = await createCompany(createForm);
            setIsCreateOpen(false);
            setCreateForm({ name: '', ownerName: '', ownerEmail: '', ownerPassword: '', planId: plans[0]?._id || '', groupCode: '' });
            if (created?.groupCode) notifySuccess(`Company created. Group code: ${created.groupCode}`);
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

    // 1. Build map of all companies by ID
    const compMap = useMemo(() => new Map(companies.map(c => [String(c._id), c])), [companies]);

    // 2. Group into Root (Parent) companies and their Child sub-companies
    const { rootCompanies, childrenByParent } = useMemo(() => {
        const childrenMap = new Map();
        const roots = [];

        companies.forEach((c) => {
            const pId = c.masterCompanyId ? String(c.masterCompanyId) : null;
            if (pId && compMap.has(pId)) {
                if (!childrenMap.has(pId)) childrenMap.set(pId, []);
                childrenMap.get(pId).push(c);
            } else {
                roots.push(c);
            }
        });

        return { rootCompanies: roots, childrenByParent: childrenMap };
    }, [companies, compMap]);

    // 3. Search & Filter predicate
    const matchesFilter = useCallback((c) => {
        const loc = locOf(c);
        const q = search.trim().toLowerCase();
        const hay = [
            c.name,
            c.coCode,
            c.ownerId?.name,
            c.ownerId?.email,
            c.ownerId?.username,
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
    }, [search, filterState, filterDistrict, filterCity, filterPlan]);

    // 4. A Root matches if it matches directly OR any of its child companies match
    const filteredRoots = useMemo(() => {
        return rootCompanies.filter((root) => {
            const rootMatches = matchesFilter(root);
            const children = childrenByParent.get(String(root._id)) || [];
            const anyChildMatches = children.some((ch) => matchesFilter(ch));
            return rootMatches || anyChildMatches;
        });
    }, [rootCompanies, childrenByParent, matchesFilter]);

    // 5. Expand / Collapse State for Sub-Companies Dropdown
    const [expandedParents, setExpandedParents] = useState(new Set());

    // When searching or filtering, automatically expand parents that contain matching children
    useEffect(() => {
        if (search.trim() || filterState || filterDistrict || filterCity || filterPlan) {
            const toExpand = new Set();
            filteredRoots.forEach((root) => {
                const children = childrenByParent.get(String(root._id)) || [];
                if (children.some((ch) => matchesFilter(ch))) {
                    toExpand.add(String(root._id));
                }
            });
            setExpandedParents(toExpand);
        }
    }, [search, filterState, filterDistrict, filterCity, filterPlan, filteredRoots, childrenByParent, matchesFilter]);

    const toggleExpand = (id) => {
        const sId = String(id);
        setExpandedParents((prev) => {
            const next = new Set(prev);
            if (next.has(sId)) next.delete(sId);
            else next.add(sId);
            return next;
        });
    };

    const expandAll = () => {
        setExpandedParents(new Set(rootCompanies.map((r) => String(r._id))));
    };

    const collapseAll = () => {
        setExpandedParents(new Set());
    };

    const totalChildren = useMemo(() => {
        let count = 0;
        childrenByParent.forEach((list) => { count += list.length; });
        return count;
    }, [childrenByParent]);

    // Suspend Parent with Cascade Confirmation
    const handleRootLock = async (company, childCount = 0) => {
        if (childCount > 0) {
            const ok = await erpConfirm({
                title: 'Suspend Main Company & Child Firms',
                message: `Suspending "${company.name}" will automatically suspend all ${childCount} child firm(s). Their users will not be able to log in or operate. Continue?`,
                confirmLabel: 'Suspend All',
                danger: true,
            });
            if (!ok) return;
        } else {
            const ok = await erpConfirm({
                title: 'Suspend Company',
                message: `Suspend "${company.name}"? Users from this company will not be able to log in.`,
                confirmLabel: 'Suspend',
                danger: true,
            });
            if (!ok) return;
        }
        try {
            await lockCompany(company._id);
            notifySuccess(`"${company.name}" ${childCount > 0 ? `and ${childCount} child firm(s) ` : ''}suspended`);
        } catch (err) {
            notifyError(err, 'Failed to suspend');
        }
    };

    // Activate Parent with Cascade Confirmation
    const handleRootUnlock = async (company, childCount = 0) => {
        if (childCount > 0) {
            const ok = await erpConfirm({
                title: 'Activate Main Company & Child Firms',
                message: `Activating "${company.name}" will also reactivate all ${childCount} child firm(s). Continue?`,
                confirmLabel: 'Activate All',
            });
            if (!ok) return;
        }
        try {
            await unlockCompany(company._id);
            notifySuccess(`"${company.name}" ${childCount > 0 ? `and ${childCount} child firm(s) ` : ''}activated`);
        } catch (err) {
            notifyError(err, 'Failed to activate');
        }
    };

    const handleChildLock = async (child, parent) => {
        if (parent?.status === 'suspended') {
            return notifyWarning(`Parent company "${parent.name}" is already suspended. All child firms are locked.`);
        }
        try {
            await lockCompany(child._id);
            notifySuccess(`Child firm "${child.name}" suspended`);
        } catch (err) {
            notifyError(err, 'Failed to suspend child firm');
        }
    };

    const handleChildUnlock = async (child, parent) => {
        if (parent?.status === 'suspended') {
            return notifyWarning(`Parent company "${parent.name}" is suspended. Activate the parent company first.`);
        }
        try {
            await unlockCompany(child._id);
            notifySuccess(`Child firm "${child.name}" activated`);
        } catch (err) {
            notifyError(err, 'Failed to activate child firm');
        }
    };

    return (
        <div className="space-y-5">
            <AdminPageHeader
                title="Managed Companies"
                subtitle={`${rootCompanies.length} main clients ${totalChildren > 0 ? `· ${totalChildren} child firms` : ''} on the platform`}
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
                <SearchableFilter
                    value={filterState}
                    allLabel="All states"
                    options={stateOptions.map((s) => ({ value: s, label: s }))}
                    onChange={(v) => { setFilterState(v); setFilterDistrict(''); setFilterCity(''); }}
                />
                <SearchableFilter
                    value={filterDistrict}
                    allLabel="All districts"
                    options={districtOptions.map((s) => ({ value: s, label: s }))}
                    onChange={(v) => { setFilterDistrict(v); setFilterCity(''); }}
                />
                <SearchableFilter
                    value={filterCity}
                    allLabel="All cities"
                    options={cityOptions.map((s) => ({ value: s, label: s }))}
                    onChange={setFilterCity}
                />
                <SearchableFilter
                    value={filterPlan}
                    allLabel="All plans"
                    width={170}
                    options={plans.map((p) => ({ value: p._id, label: `${p.name}${p.features?.mobileView ? ' · Mobile' : ''}` }))}
                    onChange={setFilterPlan}
                />
                <div className="flex items-center gap-2 text-xs px-2 ml-auto">
                    <Filter size={13} className="text-slate-600" />
                    <span className="font-extrabold text-slate-800">
                        {filteredRoots.length} main {filteredRoots.length === 1 ? 'client' : 'clients'}
                    </span>
                    {totalChildren > 0 && (
                        <button
                            type="button"
                            onClick={expandedParents.size > 0 ? collapseAll : expandAll}
                            className="text-[11px] font-extrabold px-2.5 py-1 rounded border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer ml-1 shadow-xs"
                        >
                            {expandedParents.size > 0 ? 'Collapse All' : 'Expand All'}
                        </button>
                    )}
                </div>
            </motion.div>

            {/* Table */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="admin-table-wrap">
                <div className="overflow-x-auto">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                {['Company & Sub-Cos', 'Customer / Owner', 'Mobile & Contact', 'Demo & Plan Status', 'Location', 'Status', 'Actions'].map(h => (
                                    <th key={h} className="text-slate-700 font-extrabold text-[10px] tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRoots.map((company, idx) => {
                                const rootId = String(company._id);
                                const children = childrenByParent.get(rootId) || [];
                                const isExpanded = expandedParents.has(rootId);
                                const visibleChildren = (search.trim() || filterState || filterDistrict || filterCity || filterPlan)
                                    ? children.filter(ch => matchesFilter(ch))
                                    : children;

                                return (
                                    <React.Fragment key={company._id}>
                                        {/* Main Parent Company Row */}
                                        <motion.tr
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.03 }}
                                            className={`transition-colors border-b border-slate-200 ${
                                                isExpanded && children.length > 0 ? 'bg-slate-50/90' : 'bg-white hover:bg-slate-50/80'
                                            }`}
                                        >
                                            <td className="py-2.5 px-3">
                                                <div className="flex items-start gap-2.5">
                                                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                                                        <span>{company.name.charAt(0).toUpperCase()}</span>
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <p className="text-xs font-black text-slate-900 tracking-tight">{company.name}</p>
                                                            {company.isRoot !== false ? (
                                                                <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 uppercase">
                                                                    Root
                                                                </span>
                                                            ) : (
                                                                <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-slate-100 text-slate-800 border border-slate-300">
                                                                    Child ({company.coCode || 'Co'})
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] text-slate-600 font-bold font-mono mt-0.5">
                                                            ID: <span className="text-slate-800 font-extrabold">{company._id?.slice(-8)}</span>
                                                            {company.createdAt && ` · Reg: ${new Date(company.createdAt).toLocaleDateString('en-IN')}`}
                                                        </p>

                                                        {/* Sub-Companies Accordion / Dropdown Toggle */}
                                                        {children.length > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleExpand(rootId)}
                                                                className={`mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-extrabold rounded-md border transition-all cursor-pointer shadow-xs ${
                                                                    isExpanded
                                                                        ? 'bg-emerald-700 text-white border-emerald-800'
                                                                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300'
                                                                }`}
                                                                title={isExpanded ? 'Click to hide child firms' : 'Click to show child firms in dropdown'}
                                                            >
                                                                {isExpanded ? <ChevronDown size={12} className={isExpanded ? "text-white" : "text-emerald-800"} /> : <ChevronRight size={12} className="text-emerald-800" />}
                                                                <span>{children.length} Sub-compan{children.length === 1 ? 'y' : 'ies'}</span>
                                                                <span className="text-[9px] font-semibold opacity-90">({isExpanded ? 'Hide' : 'View'})</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <div className="space-y-0.5">
                                                    <p className="text-xs font-black text-slate-900">{company.ownerId?.name || 'N/A'}</p>
                                                    {company.ownerId?.username && (
                                                        <p className="text-[11px] font-bold font-mono text-teal-700">@{company.ownerId.username}</p>
                                                    )}
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="text-[11px] font-semibold text-slate-700">{company.ownerId?.email || ''}</span>
                                                        {company.ownerId?.emailVerified ? (
                                                            <span className="text-[9px] font-black text-emerald-800 bg-emerald-100 px-1 rounded border border-emerald-300" title="Email verified via OTP">
                                                                ✓ Verified
                                                            </span>
                                                        ) : (
                                                            <span className="text-[9px] font-black text-amber-800 bg-amber-100 px-1 rounded border border-amber-300" title="Email not verified">
                                                                Unverified
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <p className="text-xs font-mono font-black text-slate-900">{company.ownerId?.mobile || company.meta?.phone || '—'}</p>
                                                <p className="text-[10px] font-semibold text-slate-600">{company.meta?.email || ''}</p>
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300 uppercase">
                                                            {company.subscription?.planName || company.planId?.name || 'Basic'}
                                                        </span>
                                                        {company.demo?.lifecycleState && (
                                                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${
                                                                company.demo.lifecycleState === 'DEMO_ACTIVE'
                                                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                                                    : company.demo.lifecycleState === 'DEMO_EXPIRED'
                                                                    ? 'bg-rose-100 text-rose-900 border-rose-300'
                                                                    : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                                            }`}>
                                                                {company.demo.lifecycleState}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {company.demo?.remainingDays !== null && company.demo?.remainingDays !== undefined && (
                                                        <p className={`text-[10px] font-black font-mono ${
                                                            company.demo.remainingDays > 3
                                                                ? 'text-amber-800'
                                                                : company.demo.remainingDays > 0
                                                                ? 'text-orange-800'
                                                                : 'text-rose-800'
                                                        }`}>
                                                            {company.demo.remainingDays > 0
                                                                ? `⏳ ${company.demo.remainingDays} day(s) remaining`
                                                                : '⚠ Demo Expired'}
                                                        </p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-3">
                                                {(() => {
                                                    const loc = locOf(company);
                                                    const place = [loc.city, loc.district, loc.state].filter(Boolean).join(', ');
                                                    return <p className="text-xs font-bold text-slate-800">{place || '—'}</p>;
                                                })()}
                                            </td>
                                            <td className="py-2.5 px-3">
                                                {company.status === 'suspended' ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300">
                                                        <Lock size={10} className="stroke-[3]" /> SUSPENDED
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> ACTIVE
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <div className="flex items-center gap-1 flex-wrap">
                                                    {company.status === 'active' ? (
                                                        <button onClick={() => handleRootLock(company, children.length)} className="w-7 h-7 rounded flex items-center justify-center bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 shadow-2xs" title={children.length > 0 ? `Suspend main company and all ${children.length} child firm(s)` : 'Suspend'}>
                                                            <Lock size={13} className="stroke-[2.5]" />
                                                        </button>
                                                    ) : (
                                                        <button onClick={() => handleRootUnlock(company, children.length)} className="w-7 h-7 rounded flex items-center justify-center bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 shadow-2xs" title={children.length > 0 ? `Activate main company and all ${children.length} child firm(s)` : 'Activate'}>
                                                            <Unlock size={13} className="stroke-[2.5]" />
                                                        </button>
                                                    )}
                                                    <button onClick={() => setLicenseCompany(company)} className="w-7 h-7 rounded flex items-center justify-center bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 shadow-2xs" title="Issue License">
                                                        <ShieldCheck size={13} />
                                                    </button>
                                                    <button onClick={() => handleProvisioningPack(company)} className="w-7 h-7 rounded flex items-center justify-center bg-white border border-teal-300 text-teal-700 hover:bg-teal-50 shadow-2xs" title="Download desktop provisioning pack">
                                                        <Package size={13} />
                                                    </button>
                                                    <button onClick={() => handleExport(company)} className="w-7 h-7 rounded flex items-center justify-center bg-white border border-indigo-300 text-indigo-700 hover:bg-indigo-50 shadow-2xs" title="Export data">
                                                        <Download size={13} />
                                                    </button>
                                                    <button onClick={() => handleImpersonate(company)} className="w-7 h-7 rounded flex items-center justify-center bg-white border border-purple-300 text-purple-700 hover:bg-purple-50 shadow-2xs" title="Impersonate owner (support)">
                                                        <UserRoundSearch size={13} />
                                                    </button>
                                                    <button onClick={() => handlePurge(company)} className="w-7 h-7 rounded flex items-center justify-center bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 shadow-2xs" title="Hard delete">
                                                        <Trash2 size={13} />
                                                    </button>
                                                    <button onClick={() => startEdit(company)} className="w-7 h-7 rounded flex items-center justify-center bg-white border border-amber-300 text-amber-700 hover:bg-amber-50 shadow-2xs" title="Edit">
                                                        <Edit3 size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>

                                        {/* Child Company Nested Sub-Rows (Light, High-Contrast & Compact) */}
                                        {isExpanded && visibleChildren.map((child) => {
                                            const parentSuspended = company.status === 'suspended';
                                            const effectiveChildStatus = parentSuspended ? 'suspended' : (child.status || 'active');

                                            return (
                                                <tr
                                                    key={child._id}
                                                    className="bg-emerald-50/40 border-l-[4px] border-l-emerald-600 border-b border-emerald-100 hover:bg-emerald-50/70 transition-colors"
                                                >
                                                    <td className="py-2 pl-6 pr-3">
                                                        <div className="flex items-start gap-2">
                                                            <CornerDownRight size={14} className="text-emerald-700 shrink-0 mt-1 stroke-[3]" />
                                                            <div className="w-6 h-6 rounded bg-teal-100 border border-teal-400 text-teal-900 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                                                                <span>{child.name.charAt(0).toUpperCase()}</span>
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <p className="text-xs font-black text-slate-900 tracking-tight">{child.name}</p>
                                                                    <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-teal-100 text-teal-900 border border-teal-300">
                                                                        Child ({child.coCode || 'Co'})
                                                                    </span>
                                                                </div>
                                                                <p className="text-[10px] text-slate-600 font-bold font-mono">
                                                                    ID: <span className="text-slate-800 font-extrabold">{child._id?.slice(-8)}</span>
                                                                    {child.createdAt && ` · Reg: ${new Date(child.createdAt).toLocaleDateString('en-IN')}`}
                                                                </p>
                                                                <p className="text-[10px] font-extrabold text-emerald-800 font-mono mt-0.5">
                                                                    ↳ Sub-firm of {company.name}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <div className="space-y-0.5">
                                                            <p className="text-xs font-bold text-slate-900">
                                                                {child.ownerId?.name || company.ownerId?.name || 'Same as Root'}
                                                            </p>
                                                            {(child.ownerId?.username || company.ownerId?.username) && (
                                                                <p className="text-[10px] font-bold font-mono text-teal-700">
                                                                    @{child.ownerId?.username || company.ownerId?.username}
                                                                </p>
                                                            )}
                                                            <span className="text-[10px] font-semibold text-slate-600">
                                                                {child.ownerId?.email || company.ownerId?.email || ''}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <p className="text-xs font-mono font-black text-slate-900">
                                                            {child.ownerId?.mobile || child.meta?.phone || company.ownerId?.mobile || '—'}
                                                        </p>
                                                        <p className="text-[10px] font-semibold text-slate-600">{child.meta?.email || ''}</p>
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-slate-100 text-slate-800 border border-slate-300 uppercase">
                                                                    {child.subscription?.planName || child.planId?.name || company.subscription?.planName || 'Basic'}
                                                                </span>
                                                                {child.demo?.lifecycleState && (
                                                                    <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${
                                                                        child.demo.lifecycleState === 'DEMO_ACTIVE'
                                                                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                                                                            : child.demo.lifecycleState === 'DEMO_EXPIRED'
                                                                            ? 'bg-rose-100 text-rose-900 border-rose-300'
                                                                            : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                                                    }`}>
                                                                        {child.demo.lifecycleState}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {child.demo?.remainingDays !== null && child.demo?.remainingDays !== undefined && (
                                                                <p className="text-[10px] font-black font-mono text-amber-900">
                                                                    ⏳ {child.demo.remainingDays}d remaining
                                                                </p>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        {(() => {
                                                            const loc = locOf(child);
                                                            const place = [loc.city, loc.district, loc.state].filter(Boolean).join(', ');
                                                            return <p className="text-xs font-bold text-slate-800">{place || locOf(company).city || '—'}</p>;
                                                        })()}
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        {parentSuspended ? (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300 shadow-2xs" title="Parent company is suspended, so this child firm is suspended automatically">
                                                                <Lock size={10} className="stroke-[3]" /> SUSPENDED (via Parent)
                                                            </span>
                                                        ) : effectiveChildStatus === 'active' ? (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> ACTIVE
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300">
                                                                <Lock size={10} className="stroke-[3]" /> SUSPENDED
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <div className="flex items-center gap-1 flex-wrap">
                                                            {effectiveChildStatus === 'active' ? (
                                                                <button onClick={() => handleChildLock(child, company)} className="w-6 h-6 rounded flex items-center justify-center bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 shadow-2xs" title="Suspend child firm">
                                                                    <Lock size={12} className="stroke-[2.5]" />
                                                                </button>
                                                            ) : (
                                                                <button onClick={() => handleChildUnlock(child, company)} className="w-6 h-6 rounded flex items-center justify-center bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 shadow-2xs" title="Activate child firm">
                                                                    <Unlock size={12} className="stroke-[2.5]" />
                                                                </button>
                                                            )}
                                                            <button onClick={() => setLicenseCompany(child)} className="w-6 h-6 rounded flex items-center justify-center bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 shadow-2xs" title="Issue License">
                                                                <ShieldCheck size={12} />
                                                            </button>
                                                            <button onClick={() => handleProvisioningPack(child)} className="w-6 h-6 rounded flex items-center justify-center bg-white border border-teal-300 text-teal-700 hover:bg-teal-50 shadow-2xs" title="Download provisioning pack">
                                                                <Package size={12} />
                                                            </button>
                                                            <button onClick={() => handleExport(child)} className="w-6 h-6 rounded flex items-center justify-center bg-white border border-indigo-300 text-indigo-700 hover:bg-indigo-50 shadow-2xs" title="Export data">
                                                                <Download size={12} />
                                                            </button>
                                                            <button onClick={() => handleImpersonate(child)} className="w-6 h-6 rounded flex items-center justify-center bg-white border border-purple-300 text-purple-700 hover:bg-purple-50 shadow-2xs" title="Impersonate owner">
                                                                <UserRoundSearch size={12} />
                                                            </button>
                                                            <button onClick={() => handlePurge(child)} className="w-6 h-6 rounded flex items-center justify-center bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 shadow-2xs" title="Hard delete">
                                                                <Trash2 size={12} />
                                                            </button>
                                                            <button onClick={() => startEdit(child)} className="w-6 h-6 rounded flex items-center justify-center bg-white border border-amber-300 text-amber-700 hover:bg-amber-50 shadow-2xs" title="Edit">
                                                                <Edit3 size={12} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })}
                            {filteredRoots.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-5 py-16 text-center">
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
                    <DarkInput label="Group code" type="text" value={createForm.groupCode} onChange={e => setCreateForm({ ...createForm, groupCode: e.target.value.toUpperCase() })} placeholder="Blank = auto" />
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
