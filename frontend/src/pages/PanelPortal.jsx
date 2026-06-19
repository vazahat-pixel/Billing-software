import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LayoutDashboard, Shield, ArrowRight, Layers } from 'lucide-react';
import useStore from '../store/useStore';

const PanelCard = ({ title, subtitle, description, features, icon: Icon, accent, onClick, delay, badge }) => (
    <button
        type="button"
        onClick={onClick}
        className="portal-panel-card"
        style={{ '--panel-gradient': accent }}
    >
        <div className="portal-panel-card__strip" />
        <div className="portal-panel-card__icon" style={{ background: accent }}>
            <Icon size={20} />
        </div>
        {badge && <span className="portal-panel-card__badge">{badge}</span>}
        <h2 className="portal-panel-card__title">{title}</h2>
        <p className="portal-panel-card__subtitle">{subtitle}</p>
        <p className="portal-panel-card__desc">{description}</p>
        <ul className="portal-panel-card__features">
            {features.map(f => (
                <li key={f}>
                    <span className="portal-panel-card__dot" />
                    {f}
                </li>
            ))}
        </ul>
        <span className="portal-panel-card__cta">
            Open Panel <ArrowRight size={14} />
        </span>
    </button>
);

const PanelPortal = () => {
    const navigate = useNavigate();
    const { token, role, user } = useStore();

    const openErp = () => {
        if (token) navigate('/');
        else navigate('/login');
    };

    const openAdmin = () => {
        if (token && role === 'super_admin') navigate('/admin/dashboard');
        else navigate('/admin/login');
    };

    const isLoggedIn = Boolean(token);
    const isSuperAdmin = role === 'super_admin';

    return (
        <div className="portal-shell">
            <div className="portal-content">
                <header className="portal-header">
                    <div className="portal-brand">
                        <div className="portal-brand__icon">
                            <Layers size={18} />
                        </div>
                        <div>
                            <h1 className="portal-brand__title">Textile ERP SaaS</h1>
                            <p className="portal-brand__sub">Choose your workspace</p>
                        </div>
                    </div>
                    {isLoggedIn && (
                        <div className="portal-user-chip">
                            <span className="portal-user-chip__dot" />
                            Signed in as <strong>{user?.name || user?.email}</strong>
                        </div>
                    )}
                </header>

                <p className="portal-intro">
                    Two dedicated panels — one for daily business operations, one for platform administration.
                </p>

                <div className="portal-grid">
                    <PanelCard
                        title="ERP User Panel"
                        subtitle="Business & Operations"
                        badge="Panel 1"
                        description="Billing, inventory, job work, GST, reports and day-to-day textile trading workflows."
                        icon={LayoutDashboard}
                        accent="#2563eb"
                        features={[
                            'Sales, Purchase & Job Work',
                            'Masters, Stock & Accounting',
                            'GST / CA Desk & Reports',
                        ]}
                        onClick={openErp}
                    />
                    <PanelCard
                        title="Admin Control Panel"
                        subtitle="Platform Management"
                        badge="Panel 2"
                        description="Manage companies, plans, licenses, module control and live configuration for all tenants."
                        icon={Shield}
                        accent="#1e293b"
                        features={[
                            'Companies & Subscriptions',
                            'Module & Dynamic Config',
                            'Users, Audit & Usage',
                        ]}
                        onClick={openAdmin}
                    />
                </div>

                {!isLoggedIn && (
                    <div className="portal-footer">
                        <p>New business? <Link to="/signup" className="portal-link">Create company account</Link></p>
                    </div>
                )}

                {isLoggedIn && !isSuperAdmin && (
                    <p className="portal-note">
                        Admin panel requires super admin credentials.
                    </p>
                )}
            </div>
        </div>
    );
};

export default PanelPortal;
