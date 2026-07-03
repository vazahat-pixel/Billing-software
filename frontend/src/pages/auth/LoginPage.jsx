import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LayoutDashboard, Lock, Mail, Loader2, ArrowRight, WifiOff } from 'lucide-react';
import useStore from '../../store/useStore';
import { loginWithOfflineSupport } from '../../utils/loginService';
import { listOfflineProfiles } from '../../utils/offlineAuth';
import { isOffline } from '../../utils/offlineHelpers';
import { subscribeNetworkStatus } from '../../utils/networkStatus';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [offlineMode, setOfflineMode] = useState(isOffline());
    const [savedProfiles, setSavedProfiles] = useState([]);
    
    const navigate = useNavigate();
    const setAuth = useStore(state => state.setAuth);

    useEffect(() => {
        const unsub = subscribeNetworkStatus(({ isOffline: offline }) => {
            setOfflineMode(offline);
        });
        listOfflineProfiles().then(setSavedProfiles).catch(() => {});
        return unsub;
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const { token, user } = await loginWithOfflineSupport({ email, password });
            await setAuth({ token, user });
            navigate('/');
        } catch (err) {
            setError(err.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    const pickProfile = (profile) => {
        setEmail(profile.email);
    };

    return (
        <div className="min-h-screen bg-white flex items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-black/5 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-black/5 rounded-full blur-3xl"></div>
            </div>

            <div className="w-full max-w-md z-10">
                <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-2xl">
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center text-white shadow-lg shadow-black/20 mb-4">
                            <LayoutDashboard size={32} />
                        </div>
                        <h1 className="text-2xl font-bold text-black tracking-tight uppercase">Welcome Back</h1>
                        <p className="text-slate-400 mt-1 text-xs font-bold uppercase tracking-widest">SaaS ERP Management System</p>
                    </div>

                    {offlineMode && (
                        <div className="mb-5 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
                            <WifiOff size={16} className="text-amber-700 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-wider text-amber-800">Offline login</p>
                                <p className="text-[10px] text-amber-700 mt-1">
                                    Bookmark this page: <strong>{typeof window !== 'undefined' ? `${window.location.origin}/login` : '/login'}</strong>
                                </p>
                                <p className="text-[10px] text-amber-600 mt-1">
                                    Same email & password from your last online sign-in.
                                </p>
                            </div>
                        </div>
                    )}

                    {savedProfiles.length > 0 && (
                        <div className="mb-5">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Saved on this device</p>
                            <div className="flex flex-wrap gap-2">
                                {savedProfiles.slice(0, 4).map((profile) => (
                                    <button
                                        key={profile.email}
                                        type="button"
                                        onClick={() => pickProfile(profile)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                                            email === profile.email
                                                ? 'bg-black text-white border-black'
                                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-400'
                                        }`}
                                    >
                                        {profile.name || profile.email}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="p-4 bg-black text-white text-xs font-bold uppercase tracking-widest rounded-xl text-center">
                                {error}
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                <input 
                                    type="email" 
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-100 text-black pl-12 pr-4 py-3.5 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                                    placeholder="name@company.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                <input 
                                    type="password" 
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-100 text-black pl-12 pr-4 py-3.5 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {!offlineMode && (
                            <div className="flex justify-end">
                                <Link to="/forgot-password" className="text-xs font-bold text-slate-400 hover:text-black transition-colors uppercase tracking-widest">
                                    Forgot Password?
                                </Link>
                            </div>
                        )}

                        <button 
                            disabled={loading}
                            type="submit"
                            className="w-full bg-black hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg shadow-black/20 transition-all flex items-center justify-center gap-2 group uppercase tracking-widest text-xs"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : (
                                <>
                                    {offlineMode ? 'Sign In Offline' : 'Sign In'}
                                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-white/5 text-center">
                        {!offlineMode && (
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                                Don't have a business account? 
                                <Link to="/signup" className="text-black font-black hover:underline ml-1.5">Create Account</Link>
                            </p>
                        )}
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-3">
                            <Link to="/portal" className="text-slate-500 hover:text-black transition-colors">← Back to Panel Selection</Link>
                        </p>
                    </div>
                </div>
                
                <p className="text-center text-slate-600 text-xs mt-8">
                    © 2026 Textile ERP SaaS. All rights reserved.
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
