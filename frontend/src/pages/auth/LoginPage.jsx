import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LayoutDashboard, Lock, Mail, Loader2, ArrowRight } from 'lucide-react';
import api from '../../utils/api';
import useStore from '../../store/useStore';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
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
            
            // 1. Save to global state
            setAuth({ token, user });

            // 2. Redirect to ERP panel (super_admin can switch to admin from header)
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background Decorative Elements */}
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

                        <div className="flex justify-end">
                            <Link to="/forgot-password" summerized="true" className="text-xs font-bold text-slate-400 hover:text-black transition-colors uppercase tracking-widest">
                                Forgot Password?
                            </Link>
                        </div>

                        <button 
                            disabled={loading}
                            type="submit"
                            className="w-full bg-black hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg shadow-black/20 transition-all flex items-center justify-center gap-2 group uppercase tracking-widest text-xs"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : (
                                <>
                                    Sign In 
                                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-white/5 text-center">
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                            Don't have a business account? 
                            <Link to="/signup" className="text-black font-black hover:underline ml-1.5">Create Account</Link>
                        </p>
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
