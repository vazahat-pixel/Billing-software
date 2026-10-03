import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
    Shield, 
    Lock, 
    Mail, 
    Loader2, 
    ArrowRight, 
    Eye, 
    EyeOff, 
    LayoutGrid, 
    WifiOff, 
    ChevronDown,
    Building2,
    Users,
    Sliders,
    KeyRound,
    ShieldCheck,
    CheckCircle2,
    Sparkles,
    Activity
} from 'lucide-react';
import useStore from '../../store/useStore';
import { loginWithOfflineSupport } from '../../utils/loginService';
import { listOfflineProfiles } from '../../utils/offlineAuth';
import { isOffline } from '../../utils/offlineHelpers';

const isDev = import.meta.env.DEV;
const DEMO_ADMIN = {
    email: 'admin@textileerp.com',
    password: 'Admin@123',
};

const AppzetoAdminLogo = () => (
    <div className="flex items-center gap-2.5">
        <svg width="34" height="34" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 drop-shadow-sm">
            <path d="M7 32L17.5 11C18.3 9.4 20.7 9.4 21.5 11L32 32H25L20 22L14 32H7Z" fill="url(#admin-appzeto-grad-1)"/>
            <path d="M19.5 8C20.3 6.6 22.3 6.6 23.1 8L34.5 28C35.4 29.6 34.2 31.6 32.4 31.6H25.5L18.5 18L19.5 8Z" fill="url(#admin-appzeto-grad-2)"/>
            <defs>
                <linearGradient id="admin-appzeto-grad-1" x1="7" y1="9" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#0066FF"/>
                    <stop offset="1" stopColor="#0052CC"/>
                </linearGradient>
                <linearGradient id="admin-appzeto-grad-2" x1="18" y1="7" x2="35" y2="32" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#38BDF8"/>
                    <stop offset="1" stopColor="#0284C7"/>
                </linearGradient>
            </defs>
        </svg>
        <div className="flex flex-col leading-none">
            <span className="text-[20px] font-black tracking-tight text-slate-900 font-sans">Appzeto</span>
            <span className="text-[9.5px] font-semibold text-slate-400 tracking-wider">SaaS Software Company</span>
        </div>
        <span className="ml-2 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-[#0066FF] text-[10px] font-bold uppercase tracking-wider">
            Super Admin
        </span>
    </div>
);

const AdminLogin = () => {
    const [email, setEmail] = useState(() => (isDev ? DEMO_ADMIN.email : ''));
    const [password, setPassword] = useState(() => (isDev ? DEMO_ADMIN.password : ''));
    const [totpCode, setTotpCode] = useState('');
    const [needs2fa, setNeeds2fa] = useState(false);
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
                if (admin && !isDev) setEmail(admin.email);
            })
            .catch(() => {});
        return () => {
            window.removeEventListener('online', refresh);
            window.removeEventListener('offline', refresh);
        };
    }, []);

    const fillDemo = () => {
        setEmail(DEMO_ADMIN.email);
        setPassword(DEMO_ADMIN.password);
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const { token, user } = await loginWithOfflineSupport({
                email,
                password,
                totpCode: totpCode || undefined,
                adminOnly: true
            });
            await setAuth({ token, user });
            navigate('/admin/dashboard');
        } catch (err) {
            if (err.requires2fa) {
                setNeeds2fa(true);
                setError('Enter the 6-digit code from your authenticator app');
            } else {
                setError(err.message || 'Login failed');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-[#EBF3FD] relative flex items-center justify-center p-3 sm:p-5 lg:p-8 font-sans select-none antialiased overflow-x-hidden">
            {/* Subtle Ambient Background Mesh Blooms */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-200/40 rounded-full blur-[100px]" />
                <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-sky-200/40 rounded-full blur-[100px]" />
            </div>

            {/* Main Rounded Stage Container in Clean Light Theme */}
            <div className="w-full max-w-[1140px] bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl shadow-blue-900/10 border border-slate-100 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px] items-stretch relative z-10">
                
                {/* Left Column: Admin Form (col-span-12 lg:col-span-6 xl:col-span-5) */}
                <div className="lg:col-span-6 xl:col-span-5 p-6 sm:p-8 lg:p-10 flex flex-col justify-between bg-white relative z-10 border-r border-slate-100/80">
                    
                    {/* Top Row: Appzeto Logo + Language */}
                    <div className="flex items-center justify-between gap-3 mb-5">
                        <AppzetoAdminLogo />
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-700 shadow-xs">
                            <span className="text-[13px]">🇮🇳</span>
                            <span>English</span>
                            <ChevronDown size={13} className="text-slate-400" />
                        </div>
                    </div>

                    {/* Header: Admin Portal */}
                    <div className="mb-5">
                        <h1 className="text-[26px] sm:text-[28px] font-black text-slate-900 tracking-tight leading-tight">
                            Admin <span className="text-[#0066FF]">Portal</span>
                        </h1>
                        <p className="text-[12px] sm:text-[13px] text-slate-500 mt-1 font-medium">
                            ERP Command Center · Super Admin Access
                        </p>
                    </div>

                    {/* Offline Notice Banner */}
                    {offlineMode && (
                        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5">
                            <WifiOff size={16} className="text-amber-700 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-[11px] font-bold text-amber-900 uppercase tracking-wide">Offline Mode Active</p>
                                <p className="text-[10px] text-amber-700 mt-0.5">
                                    Sign in using the same admin credentials saved from your last online session.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Error Banner */}
                    {error && (
                        <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[12px] font-semibold flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" />
                            <span className="flex-1">{error}</span>
                        </div>
                    )}

                    {/* Admin Login Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Admin Email */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                                Admin Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full bg-white border border-slate-200 text-slate-900 pl-10 pr-4 py-3 rounded-xl text-[13px] font-medium placeholder:text-slate-400 focus:outline-none focus:border-[#0066FF] focus:ring-4 focus:ring-blue-500/10 transition-all shadow-xs"
                                    placeholder="admin@textileerp.com"
                                    autoComplete="username"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full bg-white border border-slate-200 text-slate-900 pl-10 pr-10 py-3 rounded-xl text-[13px] font-medium placeholder:text-slate-400 focus:outline-none focus:border-[#0066FF] focus:ring-4 focus:ring-blue-500/10 transition-all shadow-xs"
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPass(!showPass)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors"
                                    tabIndex={-1}
                                    title={showPass ? 'Hide password' : 'Show password'}
                                >
                                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* 2FA Authenticator Code (Conditional or Active) */}
                        {(needs2fa || totpCode) && (
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                                    Authenticator Code (TOTP)
                                </label>
                                <div className="relative">
                                    <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        value={totpCode}
                                        onChange={(e) => setTotpCode(e.target.value)}
                                        className="w-full bg-white border border-slate-200 text-slate-900 pl-10 pr-4 py-3 rounded-xl text-[13px] font-medium placeholder:text-slate-400 focus:outline-none focus:border-[#0066FF] focus:ring-4 focus:ring-blue-500/10 transition-all shadow-xs"
                                        placeholder="6-digit code"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button 
                            disabled={loading}
                            type="submit"
                            className="w-full bg-gradient-to-r from-[#0066FF] to-[#0284C7] hover:from-[#0052CC] hover:to-[#0275B1] active:scale-[0.99] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-600/25 text-[13px] flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-70 mt-2"
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" size={18} />
                            ) : (
                                <>
                                    <span>{offlineMode ? 'Sign In Offline' : 'Sign In to Command Center'}</span>
                                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Authorized Only Divider */}
                    <div className="flex items-center gap-3 my-3">
                        <div className="flex-1 h-px bg-slate-100" />
                        <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest">AUTHORIZED PERSONNEL ONLY</span>
                        <div className="flex-1 h-px bg-slate-100" />
                    </div>

                    {/* Quick Dev Action & Back Links */}
                    <div className="flex items-center justify-between text-[11px] mb-2">
                        <Link
                            to="/portal"
                            className="flex items-center gap-1.5 text-slate-500 hover:text-[#0066FF] font-semibold transition-colors"
                        >
                            <LayoutGrid size={14} />
                            <span>← Back to Panel Selection</span>
                        </Link>

                        {isDev && (
                            <button
                                type="button"
                                onClick={fillDemo}
                                className="px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-[#0066FF] font-bold transition-colors cursor-pointer text-[10.5px] border border-blue-200"
                            >
                                ⚡ Fill Dev Admin
                            </button>
                        )}
                    </div>

                    {/* Security Seals */}
                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-center">
                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-700">
                                <ShieldCheck size={12} className="text-blue-600 shrink-0" />
                                <span>2FA Protection</span>
                            </div>
                            <span className="text-[8.5px] text-slate-400 font-medium mt-0.5">TOTP / Hardware</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-700">
                                <Activity size={12} className="text-blue-600 shrink-0" />
                                <span>Audit Logs</span>
                            </div>
                            <span className="text-[8.5px] text-slate-400 font-medium mt-0.5">Immutable Traces</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-700">
                                <Shield size={12} className="text-blue-600 shrink-0" />
                                <span>Granular RBAC</span>
                            </div>
                            <span className="text-[8.5px] text-slate-400 font-medium mt-0.5">Zero-Trust Guard</span>
                        </div>
                    </div>

                </div>

                {/* Right Column: Crisp Light-Themed Showcase with 3D Holographic Shield (col-span-12 lg:col-span-6 xl:col-span-7) */}
                <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 relative bg-gradient-to-br from-[#F5FAFE] via-[#EDF5FE] to-[#E3EFFF] p-8 xl:p-10 flex-col justify-between overflow-hidden select-none">
                    
                    {/* Ambient Light Blooms */}
                    <div className="absolute top-0 right-0 w-80 h-80 bg-blue-400/15 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-80 h-80 bg-sky-300/20 rounded-full blur-3xl pointer-events-none" />

                    {/* Top Content: Real Vector Feature Badges */}
                    <div className="relative z-10">
                        {/* 4 Feature Badges in Crisp HTML & Vector Icons */}
                        <div className="grid grid-cols-2 gap-2.5">
                            {/* Companies & Subscriptions */}
                            <div className="bg-white/80 backdrop-blur-xs rounded-xl p-3 border border-slate-200/70 shadow-xs flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-sky-50 text-[#0284C7] flex items-center justify-center shrink-0 border border-sky-100">
                                    <Building2 size={18} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11.5px] font-bold text-slate-800 leading-tight truncate">Companies & Subscriptions</p>
                                    <p className="text-[9.5px] text-slate-500 font-medium truncate mt-0.5">Multi-tenant management</p>
                                </div>
                            </div>

                            {/* Users, Audit & Usage */}
                            <div className="bg-white/80 backdrop-blur-xs rounded-xl p-3 border border-slate-200/70 shadow-xs flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                                    <Users size={18} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11.5px] font-bold text-slate-800 leading-tight truncate">Users, Audit & Usage</p>
                                    <p className="text-[9.5px] text-slate-500 font-medium truncate mt-0.5">Real-time activity logs</p>
                                </div>
                            </div>

                            {/* Module & Dynamic Config */}
                            <div className="bg-white/80 backdrop-blur-xs rounded-xl p-3 border border-slate-200/70 shadow-xs flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
                                    <Sliders size={18} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11.5px] font-bold text-slate-800 leading-tight truncate">Module & Dynamic Config</p>
                                    <p className="text-[9.5px] text-slate-500 font-medium truncate mt-0.5">Dynamic features & toggles</p>
                                </div>
                            </div>

                            {/* Licenses & Plans */}
                            <div className="bg-white/80 backdrop-blur-xs rounded-xl p-3 border border-slate-200/70 shadow-xs flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                                    <KeyRound size={18} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11.5px] font-bold text-slate-800 leading-tight truncate">Licenses & Plans</p>
                                    <p className="text-[9.5px] text-slate-500 font-medium truncate mt-0.5">Encrypted hardware binding</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Center: High-Res 3D Holographic Shield Showcase */}
                    <div className="relative z-10 my-4 group">
                        <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-blue-900/12 border border-white/90 bg-white/40 backdrop-blur-xs flex items-center justify-center max-h-[250px] xl:max-h-[280px]">
                            <img 
                                src="/assets/admin-shield-light.jpg" 
                                alt="CyberGuard Security Command Shield"
                                className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.02]"
                            />
                            
                            {/* Glassmorphic Gradient Vignette */}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent pointer-events-none" />

                            {/* Top Right Live Pill */}
                            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/20 text-white text-[10.5px] font-semibold flex items-center gap-1.5 shadow-lg">
                                <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                                <span>Zero-Trust Shield Active</span>
                            </div>

                            {/* Bottom Center Title Pill */}
                            <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-xl bg-white/90 backdrop-blur-md border border-slate-200/80 text-slate-800 text-[11px] font-bold flex items-center gap-2 shadow-md">
                                <ShieldCheck size={14} className="text-[#0066FF]" />
                                <span>Enterprise CyberGuard System</span>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Headline & Description */}
                    <div className="relative z-10 text-center">
                        <h2 className="text-xl xl:text-[24px] font-black text-slate-900 tracking-tight leading-tight">
                            Complete Control <span className="text-[#0066FF]">for Your Business</span>
                        </h2>
                        
                        <p className="text-[12px] xl:text-[12.5px] text-slate-600 font-medium mt-1 max-w-[460px] mx-auto leading-relaxed">
                            Manage companies, plans, licenses, users and system configuration in one unified high-security command panel.
                        </p>

                        <div className="mt-3 inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/70 backdrop-blur-xs border border-slate-200/70 text-[10.5px] font-semibold text-slate-600">
                            <span className="flex items-center gap-1 text-emerald-600 font-bold">
                                <CheckCircle2 size={12} /> SOC-2 Ready
                            </span>
                            <span>•</span>
                            <span>256-bit AES Encryption</span>
                            <span>•</span>
                            <span>99.99% Guaranteed SLA</span>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
};

export default AdminLogin;
