import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LayoutDashboard, Lock, Mail, Loader2, Building, User, Check } from 'lucide-react';
import { authApi } from '../../api';
import { billingApi } from '../../api/billing.api';
import useStore from '../../store/useStore';
import { saveOfflineCredential } from '../../utils/offlineAuth';

const SignupPage = () => {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        companyName: '',
        email: '',
        password: '',
        planId: '',
    });
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const navigate = useNavigate();
    const setAuth = useStore(state => state.setAuth);

    useEffect(() => {
        billingApi.publicPlans()
            .then((res) => {
                const list = res?.data?.plans || res?.plans || [];
                setPlans(list);
                if (list[0]?._id) {
                    setFormData((p) => ({ ...p, planId: list[0]._id }));
                }
            })
            .catch(() => setPlans([]));
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const data = await authApi.register({
                name: `${formData.firstName} ${formData.lastName}`.trim(),
                email: formData.email,
                password: formData.password,
                companyName: formData.companyName,
                planId: formData.planId || undefined,
            });
            const token = data?.token || data?.data?.token;
            const user = data?.user || data?.data?.user;

            await saveOfflineCredential(formData.email, formData.password, { token, user });
            await setAuth({ token, user });
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
            </div>

            <div className="w-full max-w-2xl z-10">
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[2rem] shadow-2xl">
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 mb-4">
                            <LayoutDashboard size={32} />
                        </div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Start free trial</h1>
                        <p className="text-slate-400 mt-1 text-sm">Pick a plan — existing customer books are never affected</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-xl text-center">
                                {error}
                            </div>
                        )}

                        {plans.length > 0 && (
                            <div className="grid sm:grid-cols-3 gap-2 mb-2">
                                {plans.map((p) => (
                                    <button
                                        key={p._id}
                                        type="button"
                                        onClick={() => setFormData((prev) => ({ ...prev, planId: p._id }))}
                                        className={`text-left p-3 rounded-xl border transition ${
                                            formData.planId === p._id
                                                ? 'border-indigo-500 bg-indigo-500/20'
                                                : 'border-white/10 bg-slate-800/40 hover:border-white/20'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-1">
                                            <span className="font-bold text-white text-sm">{p.name}</span>
                                            {formData.planId === p._id && <Check size={14} className="text-indigo-300" />}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-1">₹{p.priceMonthly}/mo</div>
                                        {p.trialDays > 0 && (
                                            <div className="text-[10px] text-emerald-400 mt-1">{p.trialDays}-day trial</div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">First Name</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                    <input
                                        type="text"
                                        name="firstName"
                                        required
                                        value={formData.firstName}
                                        onChange={handleChange}
                                        className="w-full bg-slate-800/50 border border-slate-700 text-white pl-12 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="John"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Last Name</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                    <input
                                        type="text"
                                        name="lastName"
                                        required
                                        value={formData.lastName}
                                        onChange={handleChange}
                                        className="w-full bg-slate-800/50 border border-slate-700 text-white pl-12 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="Doe"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Company Name</label>
                            <div className="relative">
                                <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                <input
                                    type="text"
                                    name="companyName"
                                    required
                                    value={formData.companyName}
                                    onChange={handleChange}
                                    className="w-full bg-slate-800/50 border border-slate-700 text-white pl-12 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="Your firm"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full bg-slate-800/50 border border-slate-700 text-white pl-12 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="you@company.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                <input
                                    type="password"
                                    name="password"
                                    required
                                    minLength={8}
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="w-full bg-slate-800/50 border border-slate-700 text-white pl-12 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="animate-spin" size={18} /> : null}
                            Create account
                        </button>

                        <p className="text-center text-sm text-slate-500">
                            Already have an account? <Link to="/login" className="text-indigo-400 hover:underline">Sign in</Link>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default SignupPage;
