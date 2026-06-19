import React, { useEffect, useState } from 'react';
import {
    Settings2, Building2, Save, RefreshCw, Globe, Calendar, Phone,
    MapPin, Mail, FileText, Hash, Percent, DollarSign, Palette,
    User, Shield, Image, Edit3
} from 'lucide-react';
import { motion } from 'framer-motion';
import useAdminStore from '../../store/useAdminStore';
import api from '../../utils/api';

const FINANCIAL_YEARS = ['2023-24', '2024-25', '2025-26', '2026-27'];
const GST_SCHEMES = ['Regular (Monthly)', 'QRMP (Quarterly)', 'Composition', 'Exempt'];
const CURRENCIES = ['INR (₹)', 'USD ($)', 'EUR (€)', 'GBP (£)'];
const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];

const Section = ({ title, icon: Icon, color, children }) => (
    <div className="config-section">
        <div className="config-section__header">
            <div style={{ width: 28, height: 28, borderRadius: 7, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={13} style={{ color }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#334155' }}>{title}</span>
            <div style={{ flex: 1, height: 1, background: 'var(--admin-border)', marginLeft: 8 }} />
        </div>
        <div className="config-section__body">{children}</div>
    </div>
);

const ConfigField = ({ label, children }) => (
    <div>
        <label className="dark-input__label">{label}</label>
        {children}
    </div>
);

const CompanyConfig = () => {
    const { companies, fetchCompanies } = useAdminStore();
    const [selectedCompany, setSelectedCompany] = useState('');
    const [config, setConfig] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => { fetchCompanies(); }, [fetchCompanies]);
    useEffect(() => { if (selectedCompany) loadConfig(selectedCompany); }, [selectedCompany]);

    const defaultConfig = {
        // Company Info
        legalName: '', shortName: '', gstin: '', pan: '', tan: '',
        phone: '', email: '', website: '',
        address: '', city: '', state: '', pincode: '',
        // Financial Settings
        financialYear: '2024-25', gstScheme: 'Regular (Monthly)',
        currency: 'INR (₹)', dateFormat: 'DD/MM/YYYY',
        tdsEnabled: false, tcsEnabled: false, eway: false, eInvoice: false,
        // Business Settings
        businessType: 'Textile', invoicePrefix: 'INV', purchasePrefix: 'PUR',
        challanPrefix: 'CHL', receiptPrefix: 'RCP', paymentPrefix: 'PAY',
        autoVoucherNo: true, printWatermark: false, showLogo: true,
        // UI/Branding
        primaryColor: '#0d9488', logoUrl: '',
        // Limits Override
        maxUsers: '', maxInvoices: '', maxStorage: '',
        // Custom Fields
        customField1Label: '', customField2Label: '', customField3Label: '',
        // Notifications
        notifyExpiry: true, notifyLowStock: false, notifyOverdue: true,
    };

    const loadConfig = async (companyId) => {
        try {
            const res = await api.get(`/admin/company/${companyId}/config`);
            setConfig({ ...defaultConfig, ...res.data });
        } catch {
            setConfig({ ...defaultConfig });
        }
    };

    const handleChange = (key, val) => setConfig(prev => ({ ...prev, [key]: val }));

    const saveConfig = async () => {
        if (!selectedCompany) return;
        setSaving(true);
        try {
            await api.put(`/admin/company/${selectedCompany}/config`, config);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            alert('Failed to save: ' + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    const Toggle = ({ field }) => (
        <button type="button"
            onClick={() => handleChange(field, !config[field])}
            style={{ width: 32, height: 18, background: config[field] ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.07)', border: `1px solid ${config[field] ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.09)'}`, borderRadius: 18, position: 'relative', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0 }}
        >
            <motion.div animate={{ x: config[field] ? 16 : 2 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                style={{ width: 12, height: 12, background: 'white', borderRadius: '50%', position: 'absolute', boxShadow: '0 2px 4px rgba(0,0,0,0.4)' }} />
        </button>
    );

    const ToggleRow = ({ label, desc, field }) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 9 }}>
            <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', margin: 0 }}>{label}</p>
                <p style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>{desc}</p>
            </div>
            <Toggle field={field} />
        </div>
    );

    const company = companies.find(c => c._id === selectedCompany);

    return (
        <div className="space-y-4">
            {/* Header */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h2 className="admin-page-title-inline">Company Configuration</h2>
                    <p className="admin-page-sub-inline">Configure company settings, financial parameters, and UI preferences</p>
                </div>
                {config && (
                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={saveConfig} disabled={saving}
                        className="admin-primary-btn"
                        style={{ background: saved ? 'linear-gradient(135deg,#10b981,#059669)' : undefined }}
                    >
                        {saving ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
                        {saved ? '✓ Saved!' : 'Save All Changes'}
                    </motion.button>
                )}
            </motion.div>

            {/* Company Selector */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card" style={{ padding: 14 }}>
                <label className="dark-input__label">Select Company to Configure</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <select className="dark-input" style={{ flex: 1 }} value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}>
                        <option value="">-- Choose a company --</option>
                        {companies.map(c => <option key={c._id} value={c._id}>{c.name} ({c.ownerId?.email})</option>)}
                    </select>
                    {selectedCompany && company && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--admin-accent-soft)', border: '1px solid #5eead4', borderRadius: 9 }}>
                            <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg,#0d9488,#0f766e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: 'white' }}>{company.name.charAt(0)}</div>
                            <div>
                                <p style={{ fontSize: 11, fontWeight: 800, color: '#0f766e', margin: 0 }}>{company.name}</p>
                                <p style={{ fontSize: 9, color: '#475569', margin: 0 }}>{company.planId?.name || 'No Plan'}</p>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>

            {!selectedCompany && (
                <div className="glass-card" style={{ padding: 48, textAlign: 'center' }}>
                    <Settings2 size={40} style={{ color: '#1e293b', marginBottom: 12, marginLeft: 'auto', marginRight: 'auto', display: 'block' }} />
                    <p style={{ color: '#475569', fontWeight: 800, fontSize: 13 }}>Select a company to configure their settings</p>
                </div>
            )}

            {selectedCompany && config && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    {/* Company Info */}
                    <Section title="Company Information" icon={Building2} color="#3b82f6">
                        <div className="config-grid-2">
                            <ConfigField label="Legal Company Name">
                                <input className="dark-input" value={config.legalName} onChange={e => handleChange('legalName', e.target.value)} placeholder="Xyz Textiles Pvt Ltd" />
                            </ConfigField>
                            <ConfigField label="Short Name">
                                <input className="dark-input" value={config.shortName} onChange={e => handleChange('shortName', e.target.value)} placeholder="XYZ" />
                            </ConfigField>
                            <ConfigField label="GSTIN">
                                <input className="dark-input" value={config.gstin} onChange={e => handleChange('gstin', e.target.value)} placeholder="22AAAAA0000A1Z5" />
                            </ConfigField>
                            <ConfigField label="PAN">
                                <input className="dark-input" value={config.pan} onChange={e => handleChange('pan', e.target.value)} placeholder="AAAAA0000A" />
                            </ConfigField>
                            <ConfigField label="Phone">
                                <input className="dark-input" value={config.phone} onChange={e => handleChange('phone', e.target.value)} placeholder="+91 98765 43210" />
                            </ConfigField>
                            <ConfigField label="Email">
                                <input className="dark-input" type="email" value={config.email} onChange={e => handleChange('email', e.target.value)} placeholder="firm@company.com" />
                            </ConfigField>
                        </div>
                        <div style={{ marginTop: 10 }}>
                            <ConfigField label="Address">
                                <textarea className="dark-input" rows={2} value={config.address} onChange={e => handleChange('address', e.target.value)} placeholder="Street, Area..." style={{ resize: 'none' }} />
                            </ConfigField>
                        </div>
                        <div className="config-grid-3" style={{ marginTop: 10 }}>
                            <ConfigField label="City">
                                <input className="dark-input" value={config.city} onChange={e => handleChange('city', e.target.value)} placeholder="Surat" />
                            </ConfigField>
                            <ConfigField label="State">
                                <input className="dark-input" value={config.state} onChange={e => handleChange('state', e.target.value)} placeholder="Gujarat" />
                            </ConfigField>
                            <ConfigField label="Pincode">
                                <input className="dark-input" value={config.pincode} onChange={e => handleChange('pincode', e.target.value)} placeholder="395001" />
                            </ConfigField>
                        </div>
                    </Section>

                    {/* Financial Settings */}
                    <Section title="Financial Settings" icon={DollarSign} color="#f59e0b">
                        <div className="config-grid-2">
                            <ConfigField label="Financial Year">
                                <select className="dark-input" value={config.financialYear} onChange={e => handleChange('financialYear', e.target.value)}>
                                    {FINANCIAL_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </ConfigField>
                            <ConfigField label="GST Filing Scheme">
                                <select className="dark-input" value={config.gstScheme} onChange={e => handleChange('gstScheme', e.target.value)}>
                                    {GST_SCHEMES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </ConfigField>
                            <ConfigField label="Currency">
                                <select className="dark-input" value={config.currency} onChange={e => handleChange('currency', e.target.value)}>
                                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </ConfigField>
                            <ConfigField label="Date Format">
                                <select className="dark-input" value={config.dateFormat} onChange={e => handleChange('dateFormat', e.target.value)}>
                                    {DATE_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                            </ConfigField>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                            <ToggleRow label="TDS Deduction" desc="Enable TDS tracking in transactions" field="tdsEnabled" />
                            <ToggleRow label="TCS Collection" desc="Enable TCS tracking" field="tcsEnabled" />
                            <ToggleRow label="E-Way Bill" desc="Generate e-way bills for transport" field="eway" />
                            <ToggleRow label="E-Invoice" desc="Generate e-invoices via IRP portal" field="eInvoice" />
                        </div>
                    </Section>

                    {/* Voucher Series */}
                    <Section title="Voucher Series & Prefixes" icon={Hash} color="#10b981">
                        <div className="config-grid-2">
                            {[
                                { label: 'Invoice Prefix', field: 'invoicePrefix', placeholder: 'INV' },
                                { label: 'Purchase Prefix', field: 'purchasePrefix', placeholder: 'PUR' },
                                { label: 'Challan Prefix', field: 'challanPrefix', placeholder: 'CHL' },
                                { label: 'Receipt Prefix', field: 'receiptPrefix', placeholder: 'RCP' },
                                { label: 'Payment Prefix', field: 'paymentPrefix', placeholder: 'PAY' },
                                { label: 'Business Type', field: 'businessType', placeholder: 'Textile' },
                            ].map(({ label, field, placeholder }) => (
                                <ConfigField key={field} label={label}>
                                    <input className="dark-input" value={config[field]} onChange={e => handleChange(field, e.target.value)} placeholder={placeholder} />
                                </ConfigField>
                            ))}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                            <ToggleRow label="Auto Voucher Numbering" desc="Auto-increment voucher numbers" field="autoVoucherNo" />
                        </div>
                    </Section>

                    {/* Notifications & Alerts */}
                    <Section title="Notifications & Alerts" icon={Globe} color="#6366f1">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <ToggleRow label="Expiry Alerts" desc="Notify before subscription expires" field="notifyExpiry" />
                            <ToggleRow label="Low Stock Alert" desc="Notify when inventory is low" field="notifyLowStock" />
                            <ToggleRow label="Overdue Payments" desc="Notify on overdue receivables" field="notifyOverdue" />
                        </div>
                        <div style={{ marginTop: 10 }}>
                            <p style={{ fontSize: 9, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Custom Invoice Fields</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {[1, 2, 3].map(n => (
                                    <ConfigField key={n} label={`Custom Field ${n} Label`}>
                                        <input className="dark-input" value={config[`customField${n}Label`]} onChange={e => handleChange(`customField${n}Label`, e.target.value)} placeholder={`e.g. Purchase Order No.`} />
                                    </ConfigField>
                                ))}
                            </div>
                        </div>
                    </Section>

                    {/* Limit Overrides */}
                    <Section title="Plan Limit Overrides" icon={Shield} color="#ef4444">
                        <p style={{ fontSize: 10, color: '#475569', marginBottom: 10 }}>Override the default plan limits for this specific company. Leave blank to use plan defaults.</p>
                        <div className="config-grid-3">
                            <ConfigField label="Max Users">
                                <input className="dark-input" type="number" value={config.maxUsers} onChange={e => handleChange('maxUsers', e.target.value)} placeholder="From plan" />
                            </ConfigField>
                            <ConfigField label="Max Invoices/mo">
                                <input className="dark-input" type="number" value={config.maxInvoices} onChange={e => handleChange('maxInvoices', e.target.value)} placeholder="From plan" />
                            </ConfigField>
                            <ConfigField label="Max Storage (MB)">
                                <input className="dark-input" type="number" value={config.maxStorage} onChange={e => handleChange('maxStorage', e.target.value)} placeholder="From plan" />
                            </ConfigField>
                        </div>
                    </Section>

                    {/* Branding */}
                    <Section title="UI & Branding" icon={Palette} color="#8b5cf6">
                        <ConfigField label="Brand Primary Color">
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <input type="color" value={config.primaryColor} onChange={e => handleChange('primaryColor', e.target.value)} style={{ width: 40, height: 36, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 4, background: 'rgba(255,255,255,0.03)', cursor: 'pointer' }} />
                                <input className="dark-input" value={config.primaryColor} onChange={e => handleChange('primaryColor', e.target.value)} placeholder="#7c3aed" style={{ fontFamily: 'monospace' }} />
                            </div>
                        </ConfigField>
                        <div style={{ marginTop: 10 }}>
                            <ConfigField label="Logo URL">
                                <input className="dark-input" value={config.logoUrl} onChange={e => handleChange('logoUrl', e.target.value)} placeholder="https://..." />
                            </ConfigField>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                            <ToggleRow label="Show Logo on Invoices" desc="Print company logo on documents" field="showLogo" />
                            <ToggleRow label="Print Watermark" desc="Add watermark to printed documents" field="printWatermark" />
                        </div>
                    </Section>
                </div>
            )}

        </div>
    );
};

export default CompanyConfig;
