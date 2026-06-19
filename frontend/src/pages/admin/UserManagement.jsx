import React, { useEffect, useState } from 'react';
import {
    UserCog, Plus, Trash2, Edit3, X, Shield, User, Mail,
    Key, Building2, Search, RefreshCw, CheckCircle2, Crown,
    EyeOff, Eye, Lock, Unlock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useAdminStore from '../../store/useAdminStore';
import api from '../../utils/api';

const ROLES = [
    { value: 'owner', label: 'Owner', color: '#f59e0b', desc: 'Full access, can add users' },
    { value: 'manager', label: 'Manager', color: '#8b5cf6', desc: 'Can access all modules' },
    { value: 'accountant', label: 'Accountant', color: '#3b82f6', desc: 'Accounting & reports only' },
    { value: 'salesman', label: 'Salesman', color: '#10b981', desc: 'Sales module only' },
    { value: 'viewer', label: 'Viewer', color: '#64748b', desc: 'Read-only access' },
];

const Toggle = ({ checked, onChange }) => (
    <button type="button" onClick={onChange} className={`toggle-switch ${checked ? 'toggle-switch--on' : ''}`}>
        <motion.div className="toggle-knob" animate={{ x: checked ? 16 : 2 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }} />
    </button>
);

const DarkModal = ({ isOpen, onClose, title, subtitle, maxWidth = 480, children }) => (
    <AnimatePresence>
        {isOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                onClick={e => e.target === e.currentTarget && onClose()}
            >
                <motion.div initial={{ scale: 0.93, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.93, y: 18 }}
                    style={{ background: '#090d1c', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, width: '100%', maxWidth, boxShadow: '0 30px 70px rgba(0,0,0,0.7)', overflow: 'hidden' }}
                >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '18px 18px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <div>
                            <h3 style={{ fontSize: 14, fontWeight: 900, color: 'white', margin: 0 }}>{title}</h3>
                            {subtitle && <p style={{ fontSize: 10, color: '#475569', marginTop: 3 }}>{subtitle}</p>}
                        </div>
                        <button onClick={onClose} className="dark-modal__close"><X size={14} /></button>
                    </div>
                    <div style={{ padding: 18 }}>{children}</div>
                </motion.div>
            </motion.div>
        )}
    </AnimatePresence>
);

const UserManagement = () => {
    const { companies, fetchCompanies } = useAdminStore();
    const [selectedCompany, setSelectedCompany] = useState('');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [search, setSearch] = useState('');
    const [showPass, setShowPass] = useState(false);

    const [addForm, setAddForm] = useState({ name: '', email: '', password: '', companyRole: 'accountant', isActive: true });

    useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

    useEffect(() => {
        if (selectedCompany) loadUsers();
    }, [selectedCompany]);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/admin/company/${selectedCompany}/users`);
            setUsers(res.data || []);
        } catch {
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/admin/company/${selectedCompany}/user`, { ...addForm, companyId: selectedCompany });
            setIsAddOpen(false);
            setAddForm({ name: '', email: '', password: '', companyRole: 'accountant', isActive: true });
            loadUsers();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to add user');
        }
    };

    const handleUpdateRole = async (userId, newRole) => {
        try {
            await api.put(`/admin/user/${userId}/role`, { companyRole: newRole });
            loadUsers();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to update role');
        }
    };

    const handleToggleActive = async (userId, currentStatus) => {
        try {
            await api.put(`/admin/user/${userId}/toggle-active`);
            loadUsers();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to update status');
        }
    };

    const handleDeleteUser = async (userId, name) => {
        if (!window.confirm(`Remove user "${name}" from this company?`)) return;
        try {
            await api.delete(`/admin/user/${userId}`);
            loadUsers();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete');
        }
    };

    const filtered = users.filter(u =>
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())
    );

    const roleInfo = (role) => ROLES.find(r => r.value === role) || ROLES[4];
    const company = companies.find(c => c._id === selectedCompany);

    return (
        <div className="space-y-4">
            {/* Header */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h2 className="admin-page-title-inline">User Management</h2>
                    <p className="admin-page-sub-inline">Manage users, roles, and access permissions per company</p>
                </div>
                {selectedCompany && (
                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setIsAddOpen(true)} className="admin-primary-btn">
                        <Plus size={13} /> Add User
                    </motion.button>
                )}
            </motion.div>

            {/* Company + Stats */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <label className="dark-input__label">Select Company</label>
                        <select className="dark-input" value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}>
                            <option value="">-- Choose company --</option>
                            {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                        </select>
                    </div>
                    {selectedCompany && (
                        <div style={{ display: 'flex', gap: 10 }}>
                            {[
                                { label: 'Total Users', value: users.length, color: '#a78bfa' },
                                { label: 'Active', value: users.filter(u => u.isActive !== false).length, color: '#10b981' },
                                { label: 'Plan', value: company?.planId?.name || 'N/A', color: '#3b82f6' },
                            ].map(s => (
                                <div key={s.label} className="admin-stat-chip">
                                    <p className="admin-stat-chip__value" style={{ color: s.color }}>{s.value}</p>
                                    <p className="admin-stat-chip__label">{s.label}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>

            {!selectedCompany && (
                <div className="glass-card" style={{ padding: 48, textAlign: 'center' }}>
                    <UserCog size={40} style={{ color: '#1e293b', marginBottom: 12, marginLeft: 'auto', marginRight: 'auto', display: 'block' }} />
                    <p style={{ color: '#475569', fontWeight: 800, fontSize: 13 }}>Select a company to manage their users</p>
                </div>
            )}

            {selectedCompany && (
                <>
                    {/* Roles Legend */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {ROLES.map(r => (
                            <div key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: `${r.color}10`, border: `1px solid ${r.color}25`, borderRadius: 7 }}>
                                <div style={{ width: 7, height: 7, borderRadius: '50%', background: r.color }} />
                                <span style={{ fontSize: 9, fontWeight: 800, color: r.color, textTransform: 'uppercase' }}>{r.label}</span>
                                <span style={{ fontSize: 9, color: '#334155' }}>— {r.desc}</span>
                            </div>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="admin-inline-search">
                        <Search size={13} style={{ color: '#475569' }} />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users by name or email..." />
                    </div>

                    {/* Users Table */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card" style={{ overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--admin-border)' }}>
                                    {['User', 'Email', 'Role', 'Status', 'Actions'].map(h => (
                                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 9, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#334155' }}>Loading...</td></tr>
                                ) : filtered.map((user, idx) => {
                                    const role = roleInfo(user.companyRole || user.role);
                                    const isActive = user.isActive !== false;
                                    return (
                                        <motion.tr key={user._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.04 }}
                                            style={{ borderBottom: '1px solid var(--admin-border)', transition: 'background 0.15s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--admin-surface-hover)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${role.color}18`, border: `1px solid ${role.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: role.color }}>
                                                        {user.name?.charAt(0)?.toUpperCase() || 'U'}
                                                    </div>
                                                    <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{user.name}</span>
                                                    {user.role === 'super_admin' && <Crown size={12} style={{ color: '#f59e0b' }} />}
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <span style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>{user.email}</span>
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <select
                                                    value={user.companyRole || user.role || 'viewer'}
                                                    onChange={e => handleUpdateRole(user._id, e.target.value)}
                                                    style={{ background: `${role.color}12`, border: `1px solid ${role.color}25`, color: role.color, borderRadius: 7, padding: '4px 8px', fontSize: 10, fontWeight: 800, cursor: 'pointer', outline: 'none', fontFamily: 'Inter' }}
                                                >
                                                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                                </select>
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? '#10b981' : '#ef4444' }} />
                                                    <span style={{ fontSize: 10, fontWeight: 800, color: isActive ? '#10b981' : '#ef4444' }}>{isActive ? 'Active' : 'Inactive'}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    <button onClick={() => handleToggleActive(user._id, isActive)} title={isActive ? 'Deactivate' : 'Activate'}
                                                        style={{ width: 28, height: 28, borderRadius: 7, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isActive ? '#ef4444' : '#10b981', transition: 'all 0.2s' }}>
                                                        {isActive ? <Lock size={13} /> : <Unlock size={13} />}
                                                    </button>
                                                    <button onClick={() => handleDeleteUser(user._id, user.name)} title="Remove"
                                                        style={{ width: 28, height: 28, borderRadius: 7, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', transition: 'all 0.2s' }}>
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                                {!loading && filtered.length === 0 && (
                                    <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center' }}>
                                        <User size={30} style={{ color: '#1e293b', marginBottom: 10, marginLeft: 'auto', marginRight: 'auto', display: 'block' }} />
                                        <p style={{ color: '#334155', fontWeight: 700, fontSize: 12 }}>No users found</p>
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </motion.div>
                </>
            )}

            {/* Add User Modal */}
            <DarkModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add New User" subtitle={company?.name}>
                <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                        <label className="dark-input__label">Full Name</label>
                        <input className="dark-input" type="text" placeholder="Ravi Kumar" value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} required />
                    </div>
                    <div>
                        <label className="dark-input__label">Email</label>
                        <input className="dark-input" type="email" placeholder="user@company.com" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} required />
                    </div>
                    <div style={{ position: 'relative' }}>
                        <label className="dark-input__label">Password</label>
                        <div style={{ position: 'relative' }}>
                            <input className="dark-input" type={showPass ? 'text' : 'password'} placeholder="••••••••" value={addForm.password} onChange={e => setAddForm({ ...addForm, password: e.target.value })} required style={{ paddingRight: 40 }} />
                            <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}>
                                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="dark-input__label">Role</label>
                        <select className="dark-input" value={addForm.companyRole} onChange={e => setAddForm({ ...addForm, companyRole: e.target.value })}>
                            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>)}
                        </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 9 }}>
                        <div>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>Active Status</p>
                            <p style={{ fontSize: 9, color: '#334155' }}>User can log in immediately</p>
                        </div>
                        <Toggle checked={addForm.isActive} onChange={() => setAddForm({ ...addForm, isActive: !addForm.isActive })} />
                    </div>
                    <button type="submit" className="dark-submit-btn" style={{ width: '100%' }}>
                        <Plus size={14} /> Create User Account
                    </button>
                </form>
            </DarkModal>

        </div>
    );
};

export default UserManagement;
