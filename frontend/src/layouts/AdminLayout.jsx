import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Building2, CreditCard, Users, Settings, LogOut, ShieldCheck } from 'lucide-react';
import useStore from '../store/useStore';

const AdminLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const logout = useStore(state => state.logout);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
        { name: 'Companies', path: '/admin/companies', icon: Building2 },
        { name: 'Plans', path: '/admin/plans', icon: CreditCard },
        { name: 'Subscriptions', path: '/admin/subscriptions', icon: Users },
        { name: 'Licenses', path: '/admin/licenses', icon: ShieldCheck },
        { name: 'Usage', path: '/admin/usage', icon: Settings },
        { name: 'Audit Logs', path: '/admin/audit', icon: Settings },
    ];

    return (
        <div className="flex h-screen bg-white">
            {/* Sidebar - Solid Black */}
            <aside className="w-64 bg-black text-white flex flex-col">
                <div className="p-6 flex items-center gap-3">
                    <div className="p-2 bg-slate-800 rounded-lg">
                        <ShieldCheck size={24} className="text-white" />
                    </div>
                    <span className="text-xl font-bold tracking-tight uppercase">Admin</span>
                </div>

                <nav className="flex-1 px-4 py-4 space-y-1">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                                location.pathname === item.path
                                    ? 'bg-white text-black font-bold'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                            }`}
                        >
                            <item.icon size={20} />
                            <span className="font-medium">{item.name}</span>
                        </Link>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <button 
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full px-4 py-3 text-slate-400 hover:text-white transition-colors"
                    >
                        <LogOut size={20} />
                        <span className="font-medium">Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10">
                    <h1 className="text-lg font-semibold text-slate-800">
                        {navItems.find(n => n.path === location.pathname)?.name || 'Admin Panel'}
                    </h1>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-sm font-semibold text-slate-900">System Admin</p>
                            <p className="text-xs text-slate-500">Super Admin Access</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-black font-bold border border-slate-200">
                            SA
                        </div>
                    </div>
                </header>

                <div className="p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
