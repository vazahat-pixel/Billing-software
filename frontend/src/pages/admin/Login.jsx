import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Lock, Mail, Loader2, ArrowRight, Eye, EyeOff, LayoutGrid, WifiOff } from 'lucide-react';
import useStore from '../../store/useStore';
import { loginWithOfflineSupport } from '../../utils/loginService';
import { listOfflineProfiles } from '../../utils/offlineAuth';
import { isOffline } from '../../utils/offlineHelpers';

const AdminLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [offlineMode, setOfflineMode] = useState(isOffline());

    const navigate = useNavigate();
    const setAuth = useStore(state => state.setAuth);

    useEffect(() => {
        const refresh = () => setOfflineMode(isOffline());
        window.addEventListener('online', refresh);
        window.addEventListener('offline', refresh);
        refresh();
        listOfflineProfiles()
            .then((profiles) => {
                const admin = profiles.find((p) => p.role === 'super_admin');
                if (admin) setEmail(admin.email);
            })
            .catch(() => {});
        return () => {
            window.removeEventListener('online', refresh);
            window.removeEventListener('offline', refresh);
        };
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const { token, user } = await loginWithOfflineSupport({
                email,
                password,
                adminOnly: true
            });
            await setAuth({ token, user });
            navigate('/admin/dashboard');
        } catch (err) {
            setError(err.message || 'Login failed');
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

                {offlineMode && (
                    <div className="mb-4 p-3 rounded-lg flex items-center gap-2" style={{ background: 'var(--admin-warning-bg, #fff7ed)', border: '1px solid #fed7aa' }}>
                        <WifiOff size={14} className="text-amber-700 shrink-0" />
                        <p className="text-[10px] font-semibold text-amber-800">Offline admin login — same password as last online sign-in</p>
                    </div>
                )}

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
                            <>{offlineMode ? 'Sign In Offline' : 'Sign In'} <ArrowRight size={15} /></>
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
