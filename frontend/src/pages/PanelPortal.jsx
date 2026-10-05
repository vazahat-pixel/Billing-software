import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LayoutDashboard, Shield, ArrowRight, CheckCircle2, ChevronDown } from 'lucide-react';
import useStore from '../store/useStore';
import { isOffline } from '../utils/offlineHelpers';

const DealingIndiaPortalLogo = () => (
    <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0066FF] to-[#4F46E5] flex items-center justify-center text-white shadow-md shadow-blue-500/25 shrink-0 font-black text-base tracking-wider select-none">
            DI
        </div>
        <div className="flex flex-col leading-none">
            <div className="flex items-center gap-1.5">
                <span className="text-[20px] font-black tracking-tight text-slate-900 font-sans">Dealing India</span>
                <span className="text-[9px] uppercase tracking-wider bg-blue-50 text-[#0066FF] border border-blue-200 px-1 py-0.5 rounded font-bold">
                    ERP
                </span>
            </div>
            <span className="text-[9.5px] font-semibold text-slate-400 tracking-wider mt-0.5">Textile Billing & ERP</span>
        </div>
    </div>
);

const PanelPortal = () => {
    const navigate = useNavigate();
    const { token, role, user } = useStore();

    const openErp = () => {
        const state = useStore.getState();
        const tok = state.token || localStorage.getItem('token');
        if (tok) {
            if (!state.role || (state.role !== 'user' && state.role !== 'super_admin')) {
                const r = state.user?.role === 'super_admin' ? 'super_admin' : 'user';
                localStorage.setItem('role', r);
                useStore.setState({ role: r });
            }
            navigate('/');
        } else {
            navigate('/login');
        }
    };

    const openAdmin = () => {
        const state = useStore.getState();
        const tok = state.token || localStorage.getItem('token');
        const r = state.role || state.user?.role || localStorage.getItem('role');
        if (tok && r === 'super_admin') navigate('/admin/dashboard');
        else navigate('/admin/login');
    };

    const isLoggedIn = Boolean(token);
    const isSuperAdmin = role === 'super_admin';

    useEffect(() => {
        if (!isLoggedIn && isOffline()) {
            navigate('/login', { replace: true });
        }
    }, [isLoggedIn, navigate]);

    return (
        <div className="min-h-screen w-full bg-[#EBF3FD] flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans select-none antialiased">
            <div className="w-full max-w-[1080px] bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl shadow-blue-900/10 border border-slate-100 p-6 sm:p-10 lg:p-12 flex flex-col justify-between min-h-[580px]">
                
                {/* Top Bar: Logo & Language */}
                <div className="flex items-center justify-between gap-4 mb-8">
                    <DealingIndiaPortalLogo />
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-700 shadow-xs">
                        <span className="text-[13px]">🇮🇳</span>
                        <span>English</span>
                        <ChevronDown size={13} className="text-slate-400" />
                    </div>
                </div>

                {/* Header Title & Intro */}
                <div className="text-center max-w-xl mx-auto mb-10">
                    <h1 className="text-[26px] sm:text-[30px] font-black text-slate-900 tracking-tight leading-tight">
                        Textile <span className="text-[#0066FF]">ERP SaaS</span>
                    </h1>
                    <p className="text-[13px] font-bold text-slate-600 mt-1 uppercase tracking-wide">
                        Choose your workspace
                    </p>
                    <p className="text-[12px] sm:text-[13px] text-slate-500 mt-2 font-medium">
                        Two dedicated panels — one for daily business operations, one for platform administration.
                    </p>
                </div>

                {/* 2 Workspace Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto w-full mb-8">
                    
                    {/* Card 1: ERP User Panel */}
                    <div className="bg-white rounded-2xl border-2 border-blue-500/20 hover:border-blue-500/50 p-6 shadow-lg shadow-blue-500/5 flex flex-col justify-between transition-all group hover:-translate-y-1 relative">
                        <div className="absolute top-5 right-5">
                            <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-wider">
                                Panel 1
                            </span>
                        </div>
                        <div>
                            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-4 shadow-md shadow-blue-600/30">
                                <LayoutDashboard size={22} />
                            </div>
                            <h2 className="text-[19px] font-extrabold text-slate-900">ERP User Panel</h2>
                            <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mt-0.5 mb-3">
                                Business & Operations
                            </p>
                            <p className="text-[12px] text-slate-500 leading-relaxed mb-4">
                                Billing, inventory, job work, GST, reports and day-to-day textile trading workflows.
                            </p>
                            <ul className="space-y-2 mb-6">
                                <li className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                                    <CheckCircle2 size={15} className="text-blue-600 shrink-0" />
                                    <span>Sales, Purchase & Job Work</span>
                                </li>
                                <li className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                                    <CheckCircle2 size={15} className="text-blue-600 shrink-0" />
                                    <span>Masters, Stock & Accounting</span>
                                </li>
                                <li className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                                    <CheckCircle2 size={15} className="text-blue-600 shrink-0" />
                                    <span>GST / CA Desk & Reports</span>
                                </li>
                            </ul>
                        </div>
                        <button
                            type="button"
                            onClick={openErp}
                            className="w-full bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold py-3 rounded-xl shadow-md shadow-blue-600/20 text-[12.5px] flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                            <span>Open Panel</span>
                            <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>

                    {/* Card 2: Admin Control Panel */}
                    <div className="bg-white rounded-2xl border-2 border-slate-200 hover:border-slate-800 p-6 shadow-lg shadow-slate-900/5 flex flex-col justify-between transition-all group hover:-translate-y-1 relative">
                        <div className="absolute top-5 right-5">
                            <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider">
                                Panel 2
                            </span>
                        </div>
                        <div>
                            <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center mb-4 shadow-md shadow-slate-900/30">
                                <Shield size={22} />
                            </div>
                            <h2 className="text-[19px] font-extrabold text-slate-900">Admin Control Panel</h2>
                            <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mt-0.5 mb-3">
                                Platform Management
                            </p>
                            <p className="text-[12px] text-slate-500 leading-relaxed mb-4">
                                Manage companies, plans, licenses, module control and live configuration for all tenants.
                            </p>
                            <ul className="space-y-2 mb-6">
                                <li className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                                    <CheckCircle2 size={15} className="text-slate-900 shrink-0" />
                                    <span>Companies & Subscriptions</span>
                                </li>
                                <li className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                                    <CheckCircle2 size={15} className="text-slate-900 shrink-0" />
                                    <span>Module & Dynamic Config</span>
                                </li>
                                <li className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                                    <CheckCircle2 size={15} className="text-slate-900 shrink-0" />
                                    <span>Users, Audit & Usage</span>
                                </li>
                            </ul>
                        </div>
                        <button
                            type="button"
                            onClick={openAdmin}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl shadow-md text-[12.5px] flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                            <span>Open Panel</span>
                            <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>

                </div>

                {/* Footer Link */}
                <div className="text-center text-[12px] text-slate-500">
                    <span>New business? </span>
                    <Link to="/signup" className="text-[#0066FF] font-bold hover:underline">
                        Create company account →
                    </Link>
                </div>

            </div>
        </div>
    );
};

export default PanelPortal;
