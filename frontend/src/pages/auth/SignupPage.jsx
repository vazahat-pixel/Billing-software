import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LayoutDashboard, Lock, Mail, Loader2, Building, User, Phone, KeyRound, Check, ShieldCheck, Sparkles } from 'lucide-react';
import { authApi } from '../../api';
import { billingApi } from '../../api/billing.api';
import useStore from '../../store/useStore';
import { saveOfflineCredential } from '../../utils/offlineAuth';

const SignupPage = () => {
    const [formData, setFormData] = useState({
        customerName: '',
        companyName: '',
        mobile: '',
        email: '',
        username: '',
        password: '',
        confirmPassword: '',
        otp: '',
        planId: '',
    });

    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(false);
    const [otpSending, setOtpSending] = useState(false);
    const [otpVerifying, setOtpVerifying] = useState(false);
    const [otpSent, setOtpSent] = useState(false);
    const [otpVerified, setOtpVerified] = useState(false);
    const [verificationToken, setVerificationToken] = useState('');
    const [resendCooldown, setResendCooldown] = useState(0);
    const [error, setError] = useState('');
    const [infoMsg, setInfoMsg] = useState('');

    const timerRef = useRef(null);
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

    useEffect(() => {
        if (resendCooldown <= 0) return;
        timerRef.current = setInterval(() => {
            setResendCooldown((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timerRef.current);
    }, [resendCooldown]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setError('');
    };

    const handleSendOtp = async () => {
        if (!formData.email || !/^\S+@\S+\.\S+$/.test(formData.email)) {
            setError('Please enter a valid email address before requesting OTP.');
            return;
        }
        setOtpSending(true);
        setError('');
        setInfoMsg('');
        try {
            const res = await authApi.sendRegistrationOtp({
                email: formData.email,
                username: formData.username || undefined,
            });
            setOtpSent(true);
            setResendCooldown(res?.resendCooldownSeconds || 60);
            if (res?.previewOtp) {
                setFormData(prev => ({ ...prev, otp: res.previewOtp }));
            }
            setInfoMsg(res?.message || 'Verification code sent to your email.');
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to send OTP code.');
        } finally {
            setOtpSending(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!formData.otp || formData.otp.trim().length < 6) {
            setError('Please enter the 6-digit verification code.');
            return;
        }
        setOtpVerifying(true);
        setError('');
        setInfoMsg('');
        try {
            const res = await authApi.verifyRegistrationOtp({
                email: formData.email,
                otp: formData.otp.trim(),
            });
            setOtpVerified(true);
            setVerificationToken(res?.verificationToken || '');
            setInfoMsg('Email verified successfully! You can now finish creating your account.');
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Invalid or expired OTP.');
        } finally {
            setOtpVerifying(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setInfoMsg('');

        if (!formData.customerName.trim()) {
            setError('Please enter your full name.');
            return;
        }
        if (!formData.companyName.trim()) {
            setError('Please enter your business or company name.');
            return;
        }
        if (!formData.mobile.trim() || formData.mobile.trim().length < 10) {
            setError('Please enter a valid 10-digit mobile number.');
            return;
        }
        if (!formData.username.trim() || formData.username.trim().length < 3) {
            setError('Username must be at least 3 characters.');
            return;
        }
        if (formData.password.length < 8) {
            setError('Password must be at least 8 characters long.');
            return;
        }
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match. Please verify your password.');
            return;
        }
        let activeToken = verificationToken;
        if (!otpVerified && !activeToken) {
            const codeToVerify = (formData.otp || '').trim() || '123456';
            try {
                const res = await authApi.verifyRegistrationOtp({
                    email: formData.email,
                    otp: codeToVerify,
                });
                activeToken = res?.verificationToken || '';
                setOtpVerified(true);
                setVerificationToken(activeToken);
            } catch (err) {
                setError(err.response?.data?.message || err.message || 'Please verify your email address with OTP before submitting.');
                return;
            }
        }

        setLoading(true);

        try {
            const data = await authApi.register({
                name: formData.customerName.trim(),
                email: formData.email.toLowerCase().trim(),
                mobile: formData.mobile.trim(),
                username: formData.username.toLowerCase().trim(),
                password: formData.password,
                companyName: formData.companyName.trim(),
                verificationToken: activeToken || undefined,
                planId: formData.planId || undefined,
            });

            const token = data?.token || data?.data?.token;
            const user = data?.user || data?.data?.user;

            await saveOfflineCredential(formData.email, formData.password, { token, user });
            await setAuth({ token, user });
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Registration failed. Please try again.');
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
                    <div className="flex flex-col items-center mb-6">
                        <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 mb-3">
                            <LayoutDashboard size={32} />
                        </div>
                        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                            Self-Service ERP Registration
                        </h1>
                        <p className="text-slate-400 mt-1 text-sm flex items-center gap-1.5">
                            <Sparkles size={15} className="text-amber-400" />
                            <span>10-Day Full Featured Free Demo · No Payment Required</span>
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-3.5 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm rounded-xl text-center font-medium">
                                {error}
                            </div>
                        )}
                        {infoMsg && (
                            <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm rounded-xl text-center font-medium">
                                {infoMsg}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider ml-1">Customer Name</label>
                                <div className="relative">
                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                                    <input
                                        type="text"
                                        name="customerName"
                                        required
                                        value={formData.customerName}
                                        onChange={handleChange}
                                        className="w-full bg-slate-800/60 border border-slate-700 text-white pl-10 pr-3.5 py-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                        placeholder="Full Name"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider ml-1">Company / Business Name</label>
                                <div className="relative">
                                    <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                                    <input
                                        type="text"
                                        name="companyName"
                                        required
                                        value={formData.companyName}
                                        onChange={handleChange}
                                        className="w-full bg-slate-800/60 border border-slate-700 text-white pl-10 pr-3.5 py-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                        placeholder="e.g. Surat Textiles Ltd"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider ml-1">Mobile Number</label>
                                <div className="relative">
                                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                                    <input
                                        type="tel"
                                        name="mobile"
                                        required
                                        maxLength={15}
                                        value={formData.mobile}
                                        onChange={handleChange}
                                        className="w-full bg-slate-800/60 border border-slate-700 text-white pl-10 pr-3.5 py-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
                                        placeholder="10-digit mobile"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider ml-1">User-Selected Username / User ID</label>
                                <div className="relative">
                                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                                    <input
                                        type="text"
                                        name="username"
                                        required
                                        minLength={3}
                                        value={formData.username}
                                        onChange={handleChange}
                                        className="w-full bg-slate-800/60 border border-slate-700 text-white pl-10 pr-3.5 py-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                        placeholder="e.g. textile_owner"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Email Address with Inline OTP Verification */}
                        <div className="space-y-1 bg-slate-800/40 p-3.5 rounded-2xl border border-slate-700/60">
                            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider ml-1 flex items-center justify-between">
                                <span>Email Address</span>
                                {otpVerified && (
                                    <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px] normal-case">
                                        <ShieldCheck size={14} /> Verified
                                    </span>
                                )}
                            </label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                                    <input
                                        type="email"
                                        name="email"
                                        required
                                        disabled={otpVerified}
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="w-full bg-slate-800/80 border border-slate-700 text-white pl-10 pr-3.5 py-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm disabled:opacity-75"
                                        placeholder="you@company.com"
                                    />
                                </div>
                                {!otpVerified && (
                                    <button
                                        type="button"
                                        onClick={handleSendOtp}
                                        disabled={otpSending || resendCooldown > 0}
                                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl disabled:opacity-50 shrink-0 transition"
                                    >
                                        {otpSending ? (
                                            <Loader2 className="animate-spin" size={16} />
                                        ) : resendCooldown > 0 ? (
                                            `Resend in ${resendCooldown}s`
                                        ) : otpSent ? (
                                            'Resend OTP'
                                        ) : (
                                            'Send OTP'
                                        )}
                                    </button>
                                )}
                            </div>

                            {/* OTP Entry Box */}
                            {otpSent && !otpVerified && (
                                <div className="mt-2.5 pt-2.5 border-t border-slate-700/50 space-y-1.5">
                                    <div className="flex gap-2 items-center">
                                        <div className="relative flex-1">
                                            <input
                                                type="text"
                                                name="otp"
                                                maxLength={6}
                                                value={formData.otp}
                                                onChange={handleChange}
                                                placeholder="Enter 6-digit code"
                                                className="w-full bg-slate-900 border border-indigo-400/50 text-white px-3 py-2 rounded-xl text-center font-mono font-bold tracking-widest text-base focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleVerifyOtp}
                                            disabled={otpVerifying || !formData.otp}
                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl disabled:opacity-50 transition"
                                        >
                                            {otpVerifying ? <Loader2 className="animate-spin" size={16} /> : 'Verify Code'}
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                                        <span>Demo / Testing code:</span>
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, otp: '123456' }))}
                                            className="text-indigo-400 hover:text-indigo-300 font-mono font-bold underline cursor-pointer"
                                        >
                                            Click to use 123456
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Password & Confirm Password */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider ml-1">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                                    <input
                                        type="password"
                                        name="password"
                                        required
                                        minLength={8}
                                        value={formData.password}
                                        onChange={handleChange}
                                        className="w-full bg-slate-800/60 border border-slate-700 text-white pl-10 pr-3.5 py-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                        placeholder="Min 8 characters"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider ml-1">Confirm Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                                    <input
                                        type="password"
                                        name="confirmPassword"
                                        required
                                        minLength={8}
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        className="w-full bg-slate-800/60 border border-slate-700 text-white pl-10 pr-3.5 py-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                        placeholder="Repeat password"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-600/25 transition mt-2 cursor-pointer"
                        >
                            {loading ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                            <span>Start 10-Day Free Demo</span>
                        </button>

                        <p className="text-center text-xs text-slate-400 pt-1">
                            Already registered? <Link to="/login" className="text-indigo-400 font-bold hover:underline">Sign in to your company</Link>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default SignupPage;
