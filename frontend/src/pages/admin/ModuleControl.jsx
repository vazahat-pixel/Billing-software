import React, { useEffect, useState } from 'react';
import {
    Layers, ShoppingCart, Receipt, Wrench, Calculator, FileText,
    BarChart2, Package, Settings, Check, ChevronDown, ChevronUp,
    Save, RefreshCw, AlertTriangle, Eye, EyeOff, ToggleLeft, ToggleRight,
    Building2, Search, Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useAdminStore from '../../store/useAdminStore';
import api from '../../utils/api';

// ── Complete Module + SubMenu + Field definitions matching the user Dashboard ──
const ALL_MODULES = [
    {
        key: 'sales', label: 'Sales', icon: Receipt, color: '#10b981',
        desc: 'Sales billing, orders, returns',
        subMenuItems: ['Sales Billing', 'Sales Order', 'Sales Return', 'Debit/Credit Note', 'Visit Log', 'Outstanding'],
        fields: {
            'Bale/Pcs': 'bale', 'Weight (KG)': 'weight', 'Challan No': 'challan',
            'Broker': 'broker', 'LR No': 'lrNo', 'Transport': 'transport',
            'GST Rate': 'gstRate', 'Discount %': 'discount1', 'Extra Discount': 'discount2'
        }
    },
    {
        key: 'purchase', label: 'Purchase', icon: ShoppingCart, color: '#3b82f6',
        desc: 'Purchase bills, orders, returns',
        subMenuItems: ['Purchase Bill', 'Purchase Order', 'Purchase Return', 'Job Purchase'],
        fields: {
            'Broker': 'broker', 'LR No': 'lrNo', 'Discount 2%': 'discount2',
            'Extra Charges': 'extraCharges', 'Transport': 'transport', 'Vehicle No': 'vehicleNo',
            'GST Rate': 'gstRate', 'Weight': 'weight'
        }
    },
    {
        key: 'jobWork', label: 'Job Work', icon: Wrench, color: '#8b5cf6',
        desc: 'Mill issue, receive, job issue/receive',
        subMenuItems: ['Mill Issue', 'Mill Receive', 'Job Issue', 'Job Receive', 'Update Job'],
        fields: {
            'Process Type': 'processType', 'Rate Per Meter': 'ratePerMeter',
            'Wastage %': 'wastage', 'Quality': 'quality', 'Design No': 'designNo'
        }
    },
    {
        key: 'accounting', label: 'Accounting', icon: Calculator, color: '#f59e0b',
        desc: 'Receipts, payments, vouchers, journals',
        subMenuItems: ['Bank Receipt', 'Bank Payment', 'Cash Book', 'Bank Book', 'Voucher Entry', 'Journal (GST)', 'TDS Entry', 'Opening Balance', 'Final Reports', 'FAS Reports'],
        fields: {
            'Narration': 'narration', 'Cheque No': 'chequeNo', 'Bank Name': 'bankName',
            'TDS %': 'tdsPercent', 'TCS %': 'tcsPercent', 'Cost Center': 'costCenter'
        }
    },
    {
        key: 'gst', label: 'GST', icon: FileText, color: '#ef4444',
        desc: 'GSTR-1, GSTR-2, 3B, compliance',
        subMenuItems: ['GSTR-1', 'GSTR-2B Matching', 'GST 3B Monthly', 'GST 3B Detail', 'GSTR-1 Error Check', 'GST Compliance', 'CA Desk', 'GST Updation'],
        fields: {
            'GSTIN': 'gstin', 'HSN Code': 'hsnCode', 'Tax Rate': 'taxRate',
            'ITC Eligible': 'itcEligible', 'E-Invoice': 'eInvoice'
        }
    },
    {
        key: 'inventory', label: 'Inventory', icon: Package, color: '#0ea5e9',
        desc: 'Stock, lots, item ledger',
        subMenuItems: ['Stock Ledger', 'Lot Details', 'Item Ledger', 'Cutting Entry', 'Beam Entry'],
        fields: {
            'Lot No': 'lotNo', 'Quality': 'quality', 'Design': 'design',
            'Process': 'process', 'Location': 'location'
        }
    },
    {
        key: 'reports', label: 'Reports', icon: BarChart2, color: '#6366f1',
        desc: 'Outstanding, statements, monthly',
        subMenuItems: ['Outstanding Report', 'Sales Outstanding', 'Broker Statement', 'Daily Transaction', 'Master List', 'Monthly Report', 'TDS Reports', 'TCS Reports', 'Process Reports', 'JobWork Reports'],
        fields: {}
    },
    {
        key: 'masters', label: 'Masters', icon: Settings, color: '#64748b',
        desc: 'Account, item, book, city masters',
        subMenuItems: ['Account Master', 'Item Master', 'Book Master', 'Account Group', 'Item Group', 'Station/City', 'Transport', 'Job Worker', 'Party Master', 'Item Rate Master', 'Opening Stock'],
        fields: {}
    },
    {
        key: 'utilities', label: 'Utilities', icon: Settings, color: '#94a3b8',
        desc: 'Backup, year closing, sync',
        subMenuItems: ['Backup', 'Restore', 'Year Closing', 'New A/c Year', 'Application Sync', 'Bulk WhatsApp', 'Email Option', 'Data Scanner'],
        fields: {}
    },
];

const Toggle = ({ checked, onChange }) => (
    <button type="button" onClick={onChange} className={`toggle-switch ${checked ? 'toggle-switch--on' : ''}`}>
        <motion.div className="toggle-knob" animate={{ x: checked ? 16 : 2 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }} />
    </button>
);

const ModuleCard = ({ module, companyConfig, onChange }) => {
    const [expanded, setExpanded] = useState(false);
    const Icon = module.icon;
    const enabled = companyConfig?.modules?.[module.key] ?? false;

    const toggleSubMenu = (item) => {
        const current = companyConfig?.subMenus?.[module.key] || {};
        onChange('subMenus', module.key, item, !(current[item] ?? true));
    };

    const toggleField = (fieldKey) => {
        const current = companyConfig?.fields?.[module.key] || {};
        onChange('fields', module.key, fieldKey, !(current[fieldKey] ?? false));
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`module-card ${enabled ? 'module-card--on' : 'module-card--off'}`}
        >
            {/* Header */}
            <div className="module-card__head" onClick={() => enabled && setExpanded(!expanded)}>
                <div className="module-card__icon-wrap" style={{ background: `${module.color}18`, border: `1px solid ${module.color}30` }}>
                    <Icon size={16} style={{ color: enabled ? module.color : '#334155' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="module-card__name">{module.label}</p>
                    <p className="module-card__desc">{module.desc}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {enabled && (module.subMenuItems.length > 0 || Object.keys(module.fields).length > 0) && (
                        <button onClick={e => { e.stopPropagation(); setExpanded(!expanded); }} className="expand-btn">
                            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                    )}
                    <Toggle checked={enabled} onChange={() => onChange('modules', null, module.key, !enabled)} />
                </div>
            </div>

            {/* Expanded Content */}
            <AnimatePresence>
                {expanded && enabled && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div className="module-card__body">
                            {/* Sub-menu items */}
                            {module.subMenuItems.length > 0 && (
                                <div>
                                    <p className="sub-section-label">Menu Items</p>
                                    <div className="sub-items-grid">
                                        {module.subMenuItems.map(item => {
                                            const subEnabled = companyConfig?.subMenus?.[module.key]?.[item] ?? true;
                                            return (
                                                <label key={item} className="sub-item-row">
                                                    <div
                                                        className={`sub-checkbox ${subEnabled ? 'sub-checkbox--on' : ''}`}
                                                        onClick={() => toggleSubMenu(item)}
                                                    >
                                                        {subEnabled && <Check size={9} style={{ color: 'white' }} />}
                                                    </div>
                                                    <span className={`sub-item-label ${subEnabled ? '' : 'sub-item-label--muted'}`}>{item}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Form Fields */}
                            {Object.keys(module.fields).length > 0 && (
                                <div style={{ marginTop: 12 }}>
                                    <p className="sub-section-label">Form Fields (Optional)</p>
                                    <div className="sub-items-grid">
                                        {Object.entries(module.fields).map(([label, key]) => {
                                            const fieldEnabled = companyConfig?.fields?.[module.key]?.[key] ?? false;
                                            return (
                                                <label key={key} className="sub-item-row">
                                                    <div
                                                        className={`sub-checkbox ${fieldEnabled ? 'sub-checkbox--on' : ''}`}
                                                        style={fieldEnabled ? { background: '#f59e0b', border: '1px solid #f59e0b' } : {}}
                                                        onClick={() => toggleField(key)}
                                                    >
                                                        {fieldEnabled && <Check size={9} style={{ color: 'white' }} />}
                                                    </div>
                                                    <span className={`sub-item-label ${fieldEnabled ? 'sub-item-label--warn' : 'sub-item-label--muted'}`}>{label}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

const ModuleControl = () => {
    const { companies, fetchCompanies, plans, fetchPlans } = useAdminStore();
    const [selectedCompany, setSelectedCompany] = useState('');
    const [config, setConfig] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => { fetchCompanies(); fetchPlans(); }, [fetchCompanies, fetchPlans]);

    useEffect(() => {
        if (selectedCompany) loadConfig(selectedCompany);
    }, [selectedCompany]);

    const loadConfig = async (companyId) => {
        try {
            const res = await api.get(`/admin/company/${companyId}/module-config`);
            setConfig(res.data);
        } catch {
            // Initialize default config
            const defaultModules = {};
            const defaultSubMenus = {};
            const defaultFields = {};
            ALL_MODULES.forEach(m => {
                defaultModules[m.key] = true;
                defaultSubMenus[m.key] = {};
                m.subMenuItems.forEach(s => { defaultSubMenus[m.key][s] = true; });
                defaultFields[m.key] = {};
                Object.values(m.fields).forEach(f => { defaultFields[m.key][f] = false; });
            });
            setConfig({ modules: defaultModules, subMenus: defaultSubMenus, fields: defaultFields });
        }
    };

    const handleChange = (type, moduleKey, itemKey, value) => {
        setConfig(prev => {
            if (type === 'modules') {
                return { ...prev, modules: { ...prev.modules, [itemKey]: value } };
            } else if (type === 'subMenus') {
                return {
                    ...prev,
                    subMenus: {
                        ...prev.subMenus,
                        [moduleKey]: { ...(prev.subMenus?.[moduleKey] || {}), [itemKey]: value }
                    }
                };
            } else if (type === 'fields') {
                return {
                    ...prev,
                    fields: {
                        ...prev.fields,
                        [moduleKey]: { ...(prev.fields?.[moduleKey] || {}), [itemKey]: value }
                    }
                };
            }
            return prev;
        });
    };

    const saveConfig = async () => {
        if (!selectedCompany) return;
        setSaving(true);
        try {
            await api.put(`/admin/company/${selectedCompany}/module-config`, config);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            alert('Failed to save: ' + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    const enableAll = () => {
        const newModules = {};
        ALL_MODULES.forEach(m => { newModules[m.key] = true; });
        setConfig(prev => ({ ...prev, modules: newModules }));
    };

    const disableAll = () => {
        const newModules = {};
        ALL_MODULES.forEach(m => { newModules[m.key] = false; });
        setConfig(prev => ({ ...prev, modules: newModules }));
    };

    const filteredModules = ALL_MODULES.filter(m =>
        m.label.toLowerCase().includes(search.toLowerCase()) ||
        m.desc.toLowerCase().includes(search.toLowerCase())
    );

    const enabledCount = config ? ALL_MODULES.filter(m => config.modules?.[m.key]).length : 0;

    return (
        <div className="space-y-4">
            {/* Header */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>Module Control</h2>
                    <p style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Dynamically control every module, menu item and form field per company</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {config && (
                        <>
                            <button onClick={disableAll} style={{ padding: '7px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 8, fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>
                                Disable All
                            </button>
                            <button onClick={enableAll} style={{ padding: '7px 12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', borderRadius: 8, fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>
                                Enable All
                            </button>
                            <motion.button
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={saveConfig}
                                disabled={saving}
                                className="admin-primary-btn"
                                style={{ background: saved ? 'linear-gradient(135deg,#10b981,#059669)' : undefined }}
                            >
                                {saving ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
                                {saved ? 'Saved — live in ~5s' : 'Save Config'}
                            </motion.button>
                        </>
                    )}
                </div>
            </motion.div>

            {/* Company Selector */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <label className="dark-input__label">Select Company to Configure</label>
                        <select className="dark-input" value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}>
                            <option value="">-- Choose a company --</option>
                            {companies.map(c => <option key={c._id} value={c._id}>{c.name} ({c.planId?.name || 'No Plan'})</option>)}
                        </select>
                    </div>
                    {selectedCompany && config && (
                        <div style={{ display: 'flex', gap: 12 }}>
                            {[
                                { label: 'Modules Active', value: `${enabledCount}/${ALL_MODULES.length}`, color: '#10b981' },
                                { label: 'Company Plan', value: companies.find(c => c._id === selectedCompany)?.planId?.name || 'N/A', color: '#a78bfa' },
                            ].map(s => (
                                <div key={s.label} style={{ textAlign: 'center', padding: '6px 14px', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 8 }}>
                                    <p style={{ fontSize: 16, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</p>
                                    <p style={{ fontSize: 9, color: '#334155', marginTop: 2, fontWeight: 700 }}>{s.label}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>

            {!selectedCompany && (
                <div className="glass-card" style={{ padding: 48, textAlign: 'center' }}>
                    <Layers size={40} style={{ color: '#1e293b', marginBottom: 12, marginLeft: 'auto', marginRight: 'auto', display: 'block' }} />
                    <p style={{ color: '#475569', fontWeight: 800, fontSize: 13 }}>Select a company to manage their module access</p>
                    <p style={{ color: '#1e293b', fontSize: 11, marginTop: 4 }}>Every module, sub-menu item and form field can be toggled per company</p>
                </div>
            )}

            {selectedCompany && config && (
                <>
                    {/* Search */}
                    <div className="admin-inline-search" style={{ flex: 1, maxWidth: 280 }}>
                        <Search size={13} style={{ color: '#475569' }} />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search modules..."
                        />
                    </div>

                    {/* Module Cards Grid */}
                    <div className="modules-grid">
                        {filteredModules.map(module => (
                            <ModuleCard
                                key={module.key}
                                module={module}
                                companyConfig={config}
                                onChange={handleChange}
                            />
                        ))}
                    </div>
                </>
            )}

        </div>
    );
};

export default ModuleControl;
