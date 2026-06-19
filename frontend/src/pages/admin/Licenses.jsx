import React, { useEffect, useState } from 'react';
import { ShieldCheck, Copy, CheckCircle2, XCircle, X, Key, RefreshCw, Plus, Fingerprint } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useAdminStore from '../../store/useAdminStore';

const Licenses = () => {
    const { companies, fetchCompanies, generateLicense, renewLicense } = useAdminStore();
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [renewingCompany, setRenewingCompany] = useState(null);
    const [expiryDate, setExpiryDate] = useState('');
    const [copiedKey, setCopiedKey] = useState(null);

    useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

    const copyToClipboard = (text, id) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(id);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    const handleIssueKey = async (e) => {
        e.preventDefault();
        if (!expiryDate) return alert('Please select an expiry date');
        try {
            await generateLicense({ companyId: selectedCompany._id, expiresAt: expiryDate });
            setExpiryDate(''); setSelectedCompany(null);
        } catch (err) { alert(err.message || 'Failed to issue license'); }
    };

    const handleRenewKey = async (e) => {
        e.preventDefault();
        if (!expiryDate) return alert('Please select a date');
        try {
            await renewLicense(renewingCompany._id, { expiresAt: expiryDate });
            setExpiryDate(''); setRenewingCompany(null);
        } catch (err) { alert(err.message || 'Failed to renew'); }
    };

    const licensed = companies.filter(c => c.licenseKey);
    const unlicensed = companies.filter(c => !c.licenseKey);

    return (
        <div className="space-y-5">
            {/* Header Banner */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="license-hero">
                <div className="license-hero__glow" />
                <div className="relative z-10 flex items-center gap-4">
                    <div className="license-hero__icon">
                        <Fingerprint size={24} />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-white">License Keys</h2>
                        <p className="text-xs text-slate-400 mt-0.5">Monitor and issue product license keys for all companies</p>
                    </div>
                </div>
                <div className="relative z-10 flex items-center gap-6 ml-auto">
                    <div className="text-center">
                        <p className="text-2xl font-black text-emerald-400">{licensed.length}</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Licensed</p>
                    </div>
                    <div className="w-px h-10 bg-white/10" />
                    <div className="text-center">
                        <p className="text-2xl font-black text-amber-400">{unlicensed.length}</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Pending</p>
                    </div>
                </div>
            </motion.div>

            {/* Licensed Companies */}
            {licensed.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/[0.04] flex items-center gap-3">
                        <CheckCircle2 size={16} className="text-emerald-400" />
                        <span className="text-sm font-black text-white">Active Licenses</span>
                        <span className="ml-auto text-xs font-bold text-slate-600">{licensed.length} companies</span>
                    </div>
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/[0.03]">
                                {['Company', 'License Key', 'Status', 'Action'].map(h => (
                                    <th key={h} className="px-6 py-3 text-left text-[10px] font-black text-slate-600 uppercase tracking-widest">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {licensed.map((company, idx) => (
                                <motion.tr
                                    key={company._id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: idx * 0.04 }}
                                    className="border-b border-white/[0.03] hover:bg-white/[0.015] transition-colors"
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xs font-black text-emerald-400">
                                                {company.name.charAt(0)}
                                            </div>
                                            <span className="text-sm font-bold text-slate-200">{company.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <code className="license-key-code">{company.licenseKey}</code>
                                            <button
                                                onClick={() => copyToClipboard(company.licenseKey, company._id)}
                                                className="license-copy-btn"
                                                title="Copy"
                                            >
                                                {copiedKey === company._id ? <CheckCircle2 size={13} className="text-emerald-400" /> : <Copy size={13} />}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="license-active-badge">
                                            <span className="badge-dot" /> Validated
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button onClick={() => { setRenewingCompany(company); setExpiryDate(''); }} className="license-action-btn">
                                            <RefreshCw size={12} /> Renew
                                        </button>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </motion.div>
            )}

            {/* Unlicensed */}
            {unlicensed.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/[0.04] flex items-center gap-3">
                        <XCircle size={16} className="text-amber-400" />
                        <span className="text-sm font-black text-white">Unlicensed Companies</span>
                        <span className="ml-auto text-xs font-bold text-amber-600">{unlicensed.length} pending</span>
                    </div>
                    <div className="divide-y divide-white/[0.03]">
                        {unlicensed.map((company, idx) => (
                            <motion.div
                                key={company._id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: idx * 0.04 }}
                                className="px-6 py-4 flex items-center hover:bg-white/[0.015] transition-colors"
                            >
                                <div className="flex items-center gap-3 flex-1">
                                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xs font-black text-amber-400">
                                        {company.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-200">{company.name}</p>
                                        <p className="text-[10px] text-slate-600">No license key issued</p>
                                    </div>
                                </div>
                                <button onClick={() => { setSelectedCompany(company); setExpiryDate(''); }} className="license-issue-btn">
                                    <Plus size={12} /> Issue Key
                                </button>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Issue Modal */}
            <AnimatePresence>
                {selectedCompany && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/75 backdrop-blur-xl z-50 flex items-center justify-center p-4"
                        onClick={e => e.target === e.currentTarget && setSelectedCompany(null)}
                    >
                        <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }} className="dark-modal">
                            <div className="dark-modal__header">
                                <div>
                                    <h3 className="dark-modal__title">Issue License Key</h3>
                                    <p className="dark-modal__subtitle">{selectedCompany.name}</p>
                                </div>
                                <button onClick={() => setSelectedCompany(null)} className="dark-modal__close"><X size={16} /></button>
                            </div>
                            <div className="dark-modal__body">
                                <form onSubmit={handleIssueKey} className="space-y-4">
                                    <p className="text-xs text-slate-400 bg-white/[0.03] p-3 rounded-xl border border-white/[0.05]">
                                        Generate a license key for <strong className="text-violet-400">{selectedCompany.name}</strong>. This will activate their subscription.
                                    </p>
                                    <div>
                                        <label className="dark-input__label">Expiry Date</label>
                                        <input type="date" className="dark-input" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} required />
                                    </div>
                                    <button type="submit" className="dark-submit-btn w-full">
                                        <Key size={14} /> Generate & Apply Key
                                    </button>
                                </form>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Renew Modal */}
            <AnimatePresence>
                {renewingCompany && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/75 backdrop-blur-xl z-50 flex items-center justify-center p-4"
                        onClick={e => e.target === e.currentTarget && setRenewingCompany(null)}
                    >
                        <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }} className="dark-modal">
                            <div className="dark-modal__header">
                                <div>
                                    <h3 className="dark-modal__title">Renew License</h3>
                                    <p className="dark-modal__subtitle">{renewingCompany.name}</p>
                                </div>
                                <button onClick={() => setRenewingCompany(null)} className="dark-modal__close"><X size={16} /></button>
                            </div>
                            <div className="dark-modal__body">
                                <form onSubmit={handleRenewKey} className="space-y-4">
                                    <div>
                                        <label className="dark-input__label">New Expiry Date</label>
                                        <input type="date" className="dark-input" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} required />
                                    </div>
                                    <button type="submit" className="dark-submit-btn w-full">
                                        <RefreshCw size={14} /> Renew & Validate
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

export default Licenses;
