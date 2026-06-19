import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, Building2, CreditCard, ShieldCheck,
    BarChart3, Activity, LogOut, ChevronRight, Bell, Search,
    Shield, TrendingUp, Settings2, UserCog, Layers, Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../store/useStore';
import { AdminLiveBadge } from '../components/admin/AdminUI';
import PanelSwitcher from '../components/PanelSwitcher';

const AdminLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const logout = useStore(state => state.logout);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [notifications] = useState(3);
    const now = new Date();

    const handleLogout = () => { logout(); navigate('/portal'); };

    const navGroups = [
        {
            group: 'Core',
            items: [
                { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard, desc: 'KPIs & Analytics' },
                { name: 'Companies', path: '/admin/companies', icon: Building2, desc: 'Client Management' },
            ]
        },
        {
            group: 'Subscriptions',
            items: [
                { name: 'Plans', path: '/admin/plans', icon: CreditCard, desc: 'Plan Builder' },
                { name: 'Subscriptions', path: '/admin/subscriptions', icon: TrendingUp, desc: 'Billing Cycles' },
                { name: 'Licenses', path: '/admin/licenses', icon: ShieldCheck, desc: 'Key Management' },
            ]
        },
        {
            group: 'Dynamic Control',
            items: [
                { name: 'Module Control', path: '/admin/modules', icon: Layers, desc: 'Feature Gating' },
                { name: 'Dynamic Config', path: '/admin/dynamic', icon: Database, desc: 'Bills, Columns, Flags' },
                { name: 'User Management', path: '/admin/users', icon: UserCog, desc: 'Per-Company Users' },
                { name: 'Company Config', path: '/admin/config', icon: Settings2, desc: 'Firm Settings' },
            ]
        },
        {
            group: 'Monitoring',
            items: [
                { name: 'Usage', path: '/admin/usage', icon: BarChart3, desc: 'Analytics' },
                { name: 'Audit Logs', path: '/admin/audit', icon: Activity, desc: 'Security Trail' },
            ]
        }
    ];

    const allNavItems = navGroups.flatMap(g => g.items);
    const currentNav = allNavItems.find(n => n.path === location.pathname);

    return (
        <div className="admin-shell">
            <motion.aside
                animate={{ width: sidebarOpen ? 204 : 56 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="admin-sidebar"
            >
                <div className="admin-logo-area">
                    <div className="admin-logo-icon">
                        <Shield size={15} />
                    </div>
                    <AnimatePresence>
                        {sidebarOpen && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}
                            >
                                <span className="admin-logo-title">ERP Admin</span>
                                <AdminLiveBadge />
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="admin-collapse-btn" style={{ marginLeft: 'auto' }}>
                        <ChevronRight size={12} style={{ transform: sidebarOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>
                </div>

                <nav className="admin-nav">
                    {navGroups.map(group => (
                        <div key={group.group}>
                            {sidebarOpen && (
                                <p className="admin-nav-group-label">{group.group}</p>
                            )}
                            {group.items.map(item => {
                                const isActive = location.pathname === item.path;
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        title={!sidebarOpen ? item.name : undefined}
                                        className={`admin-nav-item ${isActive ? 'admin-nav-item--active' : ''}`}
                                    >
                                        <div className="admin-nav-icon">
                                            <item.icon size={13} />
                                        </div>
                                        {sidebarOpen && (
                                            <div className="admin-nav-text">
                                                <span className={`admin-nav-name ${isActive ? 'admin-nav-name--active' : ''}`}>{item.name}</span>
                                                <span className="admin-nav-desc">{item.desc}</span>
                                            </div>
                                        )}
                                        {isActive && <div className="admin-nav-active-bar" />}
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                {sidebarOpen && (
                    <div className="admin-status-card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399' }} />
                            <span style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>System</span>
                        </div>
                        {[['API', '98ms'], ['DB', '12%'], ['Up', '99.8%']].map(([k, v]) => (
                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 2 }}>
                                <span style={{ color: '#64748b' }}>{k}</span>
                                <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{v}</span>
                            </div>
                        ))}
                    </div>
                )}

                <div className="admin-sidebar-footer">
                    <button onClick={handleLogout} className="admin-logout-btn" title={!sidebarOpen ? 'Sign Out' : undefined}>
                        <div className="admin-logout-icon"><LogOut size={12} /></div>
                        {sidebarOpen && <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>Sign Out</span>}
                    </button>
                </div>
            </motion.aside>

            <div className="admin-main">
                <header className="admin-topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {currentNav && (
                            <>
                                <div className="admin-page-icon">
                                    <currentNav.icon size={14} />
                                </div>
                                <div>
                                    <p className="admin-page-title">{currentNav.name}</p>
                                    <p className="admin-page-desc">{currentNav.desc}</p>
                                </div>
                            </>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <PanelSwitcher variant="light" />
                        <div className="admin-search">
                            <Search size={12} style={{ color: 'var(--admin-text-subtle)', flexShrink: 0 }} />
                            <input placeholder="Search..." className="admin-search-input" />
                        </div>
                        <button type="button" className="admin-notif-btn">
                            <Bell size={13} />
                            {notifications > 0 && <span className="admin-notif-badge">{notifications}</span>}
                        </button>
                        <div className="admin-user-chip">
                            <div className="admin-avatar"><Shield size={11} /></div>
                            <div className="hidden-mobile">
                                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--admin-text)', lineHeight: 1 }}>Super Admin</p>
                                <p style={{ fontSize: 9, color: 'var(--admin-text-muted)', lineHeight: 1, marginTop: 2 }}>Full Access</p>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="admin-breadcrumb">
                    <span>Admin</span>
                    <ChevronRight size={10} />
                    <span style={{ color: 'var(--admin-accent)', fontWeight: 600 }}>{currentNav?.name || 'Panel'}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--admin-text-subtle)' }}>
                        {now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                </div>

                <main className="admin-content">
                    <motion.div
                        key={location.pathname}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                    >
                        <Outlet />
                    </motion.div>
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
