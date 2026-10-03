import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
    Mail, 
    Lock, 
    Eye, 
    EyeOff, 
    Loader2, 
    ArrowRight, 
    WifiOff, 
    ShieldCheck, 
    Smartphone, 
    Shield, 
    ChevronDown, 
    ChevronRight, 
    LayoutGrid,
    CheckCircle2,
    Calculator,
    Package,
    BarChart3,
    Sparkles,
    Star
} from 'lucide-react';
import useStore from '../../store/useStore';
import { loginWithOfflineSupport } from '../../utils/loginService';
import { listOfflineProfiles } from '../../utils/offlineAuth';
import { isOffline } from '../../utils/offlineHelpers';
import { subscribeNetworkStatus } from '../../utils/networkStatus';
import { isDesktopShell } from '../../utils/desktopMode';

/** Seeded by backend/seed.js — for quick demo fill */
const DEMO_USERS = [
    {
        label: 'Owner (Surat Demo)',
        email: 'user@textileerp.com',
        password: 'User@123',
    },
    {
        label: 'QA Admin (Dev)',
        email: 'qa.dev.admin@textileerp.dev',
        password: 'Admin@123',
    },
];

const isDev = import.meta.env.DEV;

const AppzetoLogo = () => (
    <div className="flex items-center gap-2.5">
        <svg width="34" height="34" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 drop-shadow-sm">
            <path d="M7 32L17.5 11C18.3 9.4 20.7 9.4 21.5 11L32 32H25L20 22L14 32H7Z" fill="url(#appzeto-grad-1)"/>
            <path d="M19.5 8C20.3 6.6 22.3 6.6 23.1 8L34.5 28C35.4 29.6 34.2 31.6 32.4 31.6H25.5L18.5 18L19.5 8Z" fill="url(#appzeto-grad-2)"/>
            <defs>
                <linearGradient id="appzeto-grad-1" x1="7" y1="9" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#0066FF"/>
                    <stop offset="1" stopColor="#0052CC"/>
                </linearGradient>
                <linearGradient id="appzeto-grad-2" x1="18" y1="7" x2="35" y2="32" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#38BDF8"/>
                    <stop offset="1" stopColor="#0284C7"/>
                </linearGradient>
            </defs>
        </svg>
        <div className="flex flex-col leading-none">
            <span className="text-[20px] font-black tracking-tight text-slate-900 font-sans">Appzeto</span>
            <span className="text-[9.5px] font-semibold text-slate-400 tracking-wider">SaaS Software Company</span>
        </div>
    </div>
);

const LoginPage = () => {
    const [email, setEmail] = useState(() => localStorage.getItem('last_login_email') || (isDev ? DEMO_USERS[0].email : ''));
    const [password, setPassword] = useState(() => (isDev ? DEMO_USERS[0].password : ''));
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [offlineMode, setOfflineMode] = useState(() => (typeof navigator !== 'undefined' ? !navigator.onLine : false));
    const [savedProfiles, setSavedProfiles] = useState([]);
    
    const navigate = useNavigate();
    const setAuth = useStore(state => state.setAuth);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const local =
                    typeof window.textileDesktop?.isLocalSync === 'function'
                        ? window.textileDesktop.isLocalSync()
                        : window.textileDesktop?.isLocal;
                if (local === false) return;

                if (window.textileDesktop?.needsSetup) {
                    const needs = await window.textileDesktop.needsSetup();
                    if (!cancelled && needs) navigate('/activate', { replace: true });
                }
            } catch {
                /* ignore */
            }
        })();
        return () => { cancelled = true; };
    }, [navigate]);

    useEffect(() => {
        const unsub = subscribeNetworkStatus(({ isOffline: offline, browserOnline }) => {
            setOfflineMode(!browserOnline ? true : offline);
        });
        listOfflineProfiles().then(setSavedProfiles).catch(() => {});
        return unsub;
    }, []);

    const fillDemo = (user) => {
        setEmail(user.email);
        setPassword(user.password);
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (rememberMe) {
                localStorage.setItem('last_login_email', email);
            } else {
                localStorage.removeItem('last_login_email');
            }

            const { token, user } = await loginWithOfflineSupport({ email, password });
            await setAuth({ token, user });
            navigate('/');
        } catch (err) {
            setError(err.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeviceLogin = () => {
        if (savedProfiles.length > 0) {
            setEmail(savedProfiles[0].email);
            if (savedProfiles[0].password) {
                setPassword(savedProfiles[0].password);
            }
        } else if (isDev) {
            fillDemo(DEMO_USERS[0]);
        }
    };

    return (
        <div className="min-h-screen w-full bg-[#EBF3FD] relative flex items-center justify-center p-3 sm:p-5 lg:p-8 font-sans select-none antialiased overflow-x-hidden">
            {/* Subtle Ambient Background Blooms */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-200/40 rounded-full blur-[100px]" />
                <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-sky-200/40 rounded-full blur-[100px]" />
            </div>

            {/* Main Rounded Stage Container */}
            <div className="w-full max-w-[1140px] bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl shadow-blue-900/10 border border-slate-100 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px] items-stretch relative z-10">
                
                {/* Left Column: Form Card (col-span-12 lg:col-span-6 xl:col-span-5) */}
                <div className="lg:col-span-6 xl:col-span-5 p-6 sm:p-8 lg:p-10 flex flex-col justify-between bg-white relative z-10 border-r border-slate-100/80">
                    
                    {/* Top Row: Appzeto Branding + Language Picker */}
                    <div className="flex items-center justify-between gap-3 mb-5">
                        <AppzetoLogo />
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-700 shadow-xs">
                            <span className="text-[13px]">🇮🇳</span>
                            <span>English</span>
                            <ChevronDown size={13} className="text-slate-400" />
                        </div>
                    </div>

                    {/* Header: Welcome Back */}
                    <div className="mb-5">
                        <h1 className="text-[26px] sm:text-[28px] font-black text-slate-900 tracking-tight leading-tight">
                            Welcome <span className="text-[#0066FF]">Back</span>
                        </h1>
                        <p className="text-[12px] sm:text-[13px] text-slate-500 mt-1 font-medium">
                            Login to your account to continue
                        </p>
                    </div>

                    {/* Offline Warning Banner */}
                    {offlineMode && (
                        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5">
                            <WifiOff size={16} className="text-amber-700 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-[11px] font-bold text-amber-900 uppercase tracking-wide">Offline Mode Active</p>
                                <p className="text-[10px] text-amber-700 mt-0.5">
                                    Sign in using the same credentials saved from your last online session.
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

                    {/* Login Form: Only Email & Password (Clean and direct, no company input) */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Email Address / Username Field */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                                Email Address / Username
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                                <input 
                                    type="text" 
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-white border border-slate-200 text-slate-900 pl-10 pr-4 py-3 rounded-xl text-[13px] font-medium placeholder:text-slate-400 focus:outline-none focus:border-[#0066FF] focus:ring-4 focus:ring-blue-500/10 transition-all shadow-xs"
                                    placeholder="user@textileerp.com"
                                    autoComplete="username"
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                                <input 
                                    type={showPassword ? 'text' : 'password'} 
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-white border border-slate-200 text-slate-900 pl-10 pr-10 py-3 rounded-xl text-[13px] font-medium placeholder:text-slate-400 focus:outline-none focus:border-[#0066FF] focus:ring-4 focus:ring-blue-500/10 transition-all shadow-xs"
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors"
                                    tabIndex={-1}
                                    title={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Remember Me & Forgot Password Row */}
                        <div className="flex items-center justify-between pt-0.5">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input 
                                    type="checkbox" 
                                    checked={rememberMe} 
                                    onChange={(e) => setRememberMe(e.target.checked)} 
                                    className="w-4 h-4 rounded text-[#0066FF] border-slate-300 focus:ring-[#0066FF] cursor-pointer"
                                />
                                <span className="text-[11.5px] font-medium text-slate-600">
                                    Remember me on this device
                                </span>
                            </label>

                            {!offlineMode && (
                                <Link 
                                    to="/forgot-password" 
                                    className="text-[11.5px] font-bold text-[#0066FF] hover:text-blue-700 transition-colors"
                                >
                                    Forgot password?
                                </Link>
                            )}
                        </div>

                        {/* Primary Sign In Button */}
                        <button 
                            disabled={loading}
                            type="submit"
                            className="w-full bg-gradient-to-r from-[#0066FF] to-[#0052CC] hover:from-[#0052CC] hover:to-[#0040A8] active:scale-[0.99] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-600/25 text-[13px] flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-70 mt-2"
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" size={18} />
                            ) : (
                                <>
                                    <span>Sign In</span>
                                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* OR Divider */}
                    <div className="flex items-center gap-3 my-2.5">
                        <div className="flex-1 h-px bg-slate-100" />
                        <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest">OR</span>
                        <div className="flex-1 h-px bg-slate-100" />
                    </div>

                    {/* Login with This Device Button */}
                    <button 
                        type="button" 
                        onClick={handleDeviceLogin}
                        className="w-full bg-slate-50 hover:bg-blue-50/60 border border-slate-200/80 rounded-xl p-3 flex items-center justify-between text-left transition-all cursor-pointer group shadow-xs"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-blue-100/60 text-[#0066FF] flex items-center justify-center shrink-0">
                                <LayoutGrid size={16} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[12px] font-bold text-slate-800 leading-tight">Login with This Device</p>
                                <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">One account. One device. Secure access.</p>
                            </div>
                        </div>
                        <ChevronRight size={15} className="text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                    </button>

                    {/* Quick Dev Demo Access Pills */}
                    {isDev && (
                        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100 text-[10px]">
                            <span className="font-bold text-slate-400">⚡ Demo:</span>
                            {DEMO_USERS.map((u) => (
                                <button
                                    key={u.email}
                                    type="button"
                                    onClick={() => fillDemo(u)}
                                    className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-600 font-semibold transition-colors cursor-pointer"
                                >
                                    {u.label.split(' ')[0]}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Trust Badges Row */}
                    <div className="grid grid-cols-3 gap-2 pt-3 mt-2 border-t border-slate-100 text-center">
                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-700">
                                <ShieldCheck size={12} className="text-blue-600 shrink-0" />
                                <span>Secure Login</span>
                            </div>
                            <span className="text-[8.5px] text-slate-400 font-medium mt-0.5">256-bit Encryption</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-700">
                                <Smartphone size={12} className="text-blue-600 shrink-0" />
                                <span>Device Binding</span>
                            </div>
                            <span className="text-[8.5px] text-slate-400 font-medium mt-0.5">1 Device / User</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-700">
                                <Shield size={12} className="text-blue-600 shrink-0" />
                                <span>Data Protection</span>
                            </div>
                            <span className="text-[8.5px] text-slate-400 font-medium mt-0.5">Enterprise Security</span>
                        </div>
                    </div>

                    {/* Bottom Navigation Links */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-2 border-t border-slate-100 text-[11px] text-slate-500">
                        <Link to="/portal" className="text-slate-500 hover:text-[#0066FF] font-semibold transition-colors">
                            ← Panel Selection
                        </Link>
                        <div className="flex items-center gap-3">
                            <Link to="/landing" className="hover:text-[#0066FF] font-semibold transition-colors">
                                Software Info
                            </Link>
                            <Link to="/signup" className="text-[#0066FF] font-bold hover:underline">
                                Create Account →
                            </Link>
                        </div>
                    </div>

                </div>

                {/* Right Column: Dynamic Crisp 3D Hero Showcase (col-span-12 lg:col-span-6 xl:col-span-7) */}
                <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 relative bg-gradient-to-br from-[#F5FAFE] via-[#EDF5FE] to-[#E3EFFF] p-8 xl:p-10 flex-col justify-between overflow-hidden select-none">
                    
                    {/* Ambient Light Blooms */}
                    <div className="absolute top-0 right-0 w-80 h-80 bg-blue-400/15 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-80 h-80 bg-sky-300/20 rounded-full blur-3xl pointer-events-none" />

                    {/* Top Content: Real Vector Typography (100% Crisp, Never Blurry!) */}
                    <div className="relative z-10">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100/70 border border-blue-200/80 text-[#0066FF] text-[11px] font-bold uppercase tracking-wider mb-2.5">
                            <Sparkles size={12} />
                            <span>Enterprise Textile Suite</span>
                        </div>

                        <h2 className="text-2xl xl:text-[30px] font-black tracking-tight text-slate-900 leading-tight">
                            All-in-One <span className="text-[#0066FF]">Textile ERP Solution</span>
                        </h2>
                        
                        <p className="text-[12px] xl:text-[13px] text-slate-600 font-medium mt-1.5 max-w-[500px] leading-relaxed">
                            Manage your business operations, accounting, inventory, GST, reports and more — in one powerful platform.
                        </p>

                        {/* 4 Feature Badges in Crisp HTML & Vector Icons */}
                        <div className="grid grid-cols-4 gap-2.5 mt-5">
                            {/* Accounting */}
                            <div className="bg-white/80 backdrop-blur-xs rounded-xl p-2.5 border border-slate-200/70 shadow-xs flex flex-col items-center text-center">
                                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1.5 border border-emerald-100">
                                    <Calculator size={16} />
                                </div>
                                <span className="text-[11px] font-bold text-slate-800 leading-tight">Accounting</span>
                                <span className="text-[9px] text-slate-500 font-medium mt-0.5">Smart & Accurate</span>
                            </div>

                            {/* Inventory */}
                            <div className="bg-white/80 backdrop-blur-xs rounded-xl p-2.5 border border-slate-200/70 shadow-xs flex flex-col items-center text-center">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0066FF] flex items-center justify-center mb-1.5 border border-blue-100">
                                    <Package size={16} />
                                </div>
                                <span className="text-[11px] font-bold text-slate-800 leading-tight">Inventory</span>
                                <span className="text-[9px] text-slate-500 font-medium mt-0.5">Real-time Stock</span>
                            </div>

                            {/* GST / Tax */}
                            <div className="bg-white/80 backdrop-blur-xs rounded-xl p-2.5 border border-slate-200/70 shadow-xs flex flex-col items-center text-center">
                                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-1.5 border border-amber-100">
                                    <ShieldCheck size={16} />
                                </div>
                                <span className="text-[11px] font-bold text-slate-800 leading-tight">GST / Tax</span>
                                <span className="text-[9px] text-slate-500 font-medium mt-0.5">Compliance Ready</span>
                            </div>

                            {/* Reports */}
                            <div className="bg-white/80 backdrop-blur-xs rounded-xl p-2.5 border border-slate-200/70 shadow-xs flex flex-col items-center text-center">
                                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-1.5 border border-purple-100">
                                    <BarChart3 size={16} />
                                </div>
                                <span className="text-[11px] font-bold text-slate-800 leading-tight">Reports</span>
                                <span className="text-[9px] text-slate-500 font-medium mt-0.5">Insightful Analytics</span>
                            </div>
                        </div>
                    </div>

                    {/* Center / Bottom: Ultra-High-Definition 3D Laptop Showcase with Glassmorphic Overlays */}
                    <div className="relative z-10 my-4 group">
                        <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-blue-900/12 border border-white/90 bg-white/40 backdrop-blur-xs">
                            <img 
                                src="/assets/user-login-laptop.jpg" 
                                alt="Appzeto Textile ERP Interface"
                                className="w-full h-auto max-h-[260px] xl:max-h-[290px] object-cover object-top transition-transform duration-700 group-hover:scale-[1.02]"
                            />
                            
                            {/* Glassmorphic Gradient Bottom Vignette */}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent pointer-events-none" />

                            {/* Top Right Live Pill */}
                            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/20 text-white text-[10.5px] font-semibold flex items-center gap-1.5 shadow-lg">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span>High-Speed Cloud</span>
                            </div>

                            {/* Bottom Left Trust Pill */}
                            <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-xl bg-white/90 backdrop-blur-md border border-slate-200/80 text-slate-800 text-[11px] font-bold flex items-center gap-2 shadow-md">
                                <CheckCircle2 size={14} className="text-[#0066FF]" />
                                <span>Fabric · Jobwork · Mill Ready</span>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Proof Strip */}
                    <div className="relative z-10 flex items-center justify-between px-3 py-2 rounded-xl bg-white/60 backdrop-blur-xs border border-slate-200/60 text-[11px] text-slate-600 font-medium">
                        <div className="flex items-center gap-1.5">
                            <div className="flex text-amber-400">
                                {[...Array(5)].map((_, i) => (
                                    <Star key={i} size={11} fill="currentColor" />
                                ))}
                            </div>
                            <span className="font-bold text-slate-800">4.9/5</span>
                            <span>from 1,000+ textile businesses</span>
                        </div>
                        <div className="flex items-center gap-1 text-[#0066FF] font-semibold">
                            <ShieldCheck size={13} />
                            <span>100% GST & E-Way Ready</span>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
};

export default LoginPage;
