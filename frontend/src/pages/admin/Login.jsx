import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, Mail, Loader2, ArrowRight } from 'lucide-react';
import api from '../../utils/api';
import useStore from '../../store/useStore';

const AdminLogin = () => {
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
            
            if (user.role !== 'super_admin') {
                throw new Error('Access denied: You are not a super admin');
            }

            setAuth({ token, user });
            navigate('/admin/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent opacity-50"></div>
            
            <div className="w-full max-w-md z-10">
                <div className="bg-slate-900/50 backdrop-blur-2xl border border-slate-800 p-10 rounded-[2.5rem] shadow-2xl">
                    <div className="flex flex-col items-center mb-10">
                        <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-indigo-500/20 mb-6">
                            <ShieldCheck size={40} />
                        </div>
                        <h1 className="text-3xl font-black text-white tracking-tight">Admin Portal</h1>
                        <p className="text-slate-500 mt-2 font-medium">Secured SaaS Management</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-2xl text-center font-bold italic">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Admin Email</label>
                            <div className="relative">
                                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                                <input 
                                    type="email" 
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 text-white pl-14 pr-6 py-4 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-slate-700 font-medium"
                                    placeholder="admin@textileerp.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Security Password</label>
                            <div className="relative">
                                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                                <input 
                                    type="password" 
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 text-white pl-14 pr-6 py-4 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-slate-700"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <button 
                            disabled={loading}
                            type="submit"
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-5 rounded-2xl shadow-2xl shadow-indigo-500/20 transition-all flex items-center justify-center gap-3 group"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : (
                                <>
                                    Verify & Access 
                                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>
                </div>
                
                <p className="text-center text-slate-700 text-xs mt-10 font-bold uppercase tracking-widest">
                    Authorized Personnel Only
                </p>
            </div>
        </div>
    );
};

export default AdminLogin;
