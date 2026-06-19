import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Lock, Mail, Loader2, ArrowRight, Eye, EyeOff, LayoutGrid } from 'lucide-react';
import api from '../../utils/api';
import useStore from '../../store/useStore';

const AdminLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const navigate = useNavigate();
    const setAuth = useStore(state => state.setAuth);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const response = await api.post('/auth/login', { email, password });
            const { token, user } = response.data;
            if (user.role !== 'super_admin') throw new Error('Access denied: Not a super admin');
            setAuth({ token, user });
            navigate('/admin/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="admin-login-shell">
            <div className="admin-login-card">
                <div className="flex flex-col items-center mb-6">
                    <div className="admin-login-logo">
                        <Shield size={22} />
                    </div>
                    <h1 className="admin-login-title">Admin Portal</h1>
                    <p className="admin-login-subtitle">
                        ERP Command Center · Super Admin Access
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="admin-login-error">{error}</div>
                    )}

                    <div>
                        <label className="admin-login-label">Admin Email</label>
                        <div className="admin-login-input-wrap">
                            <Mail size={15} style={{ color: 'var(--admin-text-subtle)' }} />
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="admin-login-input"
                                placeholder="admin@textileerp.com"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="admin-login-label">Password</label>
                        <div className="admin-login-input-wrap">
                            <Lock size={15} style={{ color: 'var(--admin-text-subtle)' }} />
                            <input
                                type={showPass ? 'text' : 'password'}
                                required
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="admin-login-input"
                                placeholder="••••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPass(!showPass)}
                                style={{ color: 'var(--admin-text-subtle)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            >
                                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                        </div>
                    </div>

                    <button disabled={loading} type="submit" className="admin-login-btn">
                        {loading ? (
                            <Loader2 className="animate-spin" size={16} />
                        ) : (
                            <>Sign In <ArrowRight size={15} /></>
                        )}
                    </button>
                </form>

                <div className="flex items-center gap-3 mt-6">
                    <div className="flex-1 h-px" style={{ background: 'var(--admin-border)' }} />
                    <span style={{ fontSize: 9, color: 'var(--admin-text-subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Authorized Only
                    </span>
                    <div className="flex-1 h-px" style={{ background: 'var(--admin-border)' }} />
                </div>

                <Link
                    to="/portal"
                    className="flex items-center justify-center gap-2 mt-5 portal-link"
                    style={{ fontSize: 11 }}
                >
                    <LayoutGrid size={13} />
                    Back to Panel Selection
                </Link>
            </div>
        </div>
    );
};

export default AdminLogin;
