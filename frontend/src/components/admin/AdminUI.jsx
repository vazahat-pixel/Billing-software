import React from 'react';
import { motion } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';

/* ── Decorative SVG ── */
export const AdminMeshBg = () => (
    <>
        <div className="admin-mesh-bg" />
        <div className="admin-grid-overlay" />
    </>
);

export const AdminEmptyIllustration = ({ className = '' }) => (
    <svg className={`admin-empty__icon ${className}`} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="60" cy="60" r="50" stroke="url(#emptyGrad)" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.4" />
        <rect x="35" y="40" width="50" height="40" rx="8" fill="url(#emptyGrad)" opacity="0.15" />
        <path d="M45 55h30M45 63h20" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
        <circle cx="60" cy="60" r="8" fill="url(#emptyGrad)" opacity="0.2" />
        <defs>
            <linearGradient id="emptyGrad" x1="0" y1="0" x2="120" y2="120">
                <stop stopColor="#2563eb" />
                <stop offset="1" stopColor="#1d4ed8" />
            </linearGradient>
        </defs>
    </svg>
);

/* ── Page Header ── */
export const AdminPageHeader = ({ title, subtitle, actions, badge }) => (
    <div className="admin-page-header">
        <div>
            {badge && <div className="mb-2">{badge}</div>}
            <h1 className="admin-page-header__title">{title}</h1>
            {subtitle && <p className="admin-page-header__sub">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
);

/* ── Stat Card ── */
export const AdminStatCard = ({ label, value, icon: Icon, color, trend, barPercent = 70 }) => (
    <div className="admin-stat-card">
        <div className="admin-stat-card__header">
            <div className="admin-stat-card__icon" style={{ background: color }}>
                <Icon size={15} />
            </div>
            {trend && (
                <span className="admin-stat-badge">
                    <svg width="7" height="7" viewBox="0 0 8 8" fill="currentColor"><path d="M4 1l3 5H1z" /></svg>
                    {trend}
                </span>
            )}
        </div>
        <p className="admin-stat-label">{label}</p>
        <p className="admin-stat-value">{value}</p>
        <div className="admin-stat-bar">
            <div
                className="admin-stat-bar__fill"
                style={{ background: color, width: `${barPercent}%` }}
            />
        </div>
    </div>
);

/* ── Glass Card ── */
export const AdminGlassCard = ({ children, className = '', hover = false, ...props }) => (
    <div className={`glass-card ${hover ? 'glass-card-hover' : ''} ${className}`} {...props}>
        {children}
    </div>
);

/* ── Buttons ── */
export const AdminButton = ({ variant = 'primary', children, loading, icon: Icon, className = '', ...props }) => {
    const cls = variant === 'primary'
        ? 'admin-primary-btn'
        : `admin-btn admin-btn--${variant}`;
    return (
        <button className={`${cls} ${className}`} disabled={loading || props.disabled} {...props}>
            {loading ? <Loader2 className="animate-spin" size={14} /> : Icon && <Icon size={14} />}
            {children}
        </button>
    );
};

/* ── Badge ── */
export const AdminBadge = ({ variant = 'info', children, dot }) => (
    <span className={`admin-badge admin-badge--${variant}`}>
        {dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />}
        {children}
    </span>
);

/* ── Live indicator ── */
export const AdminLiveBadge = () => (
    <span className="admin-badge admin-badge--success" style={{ fontSize: 8, padding: '3px 8px' }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399', animation: 'adminPulse 2s infinite' }} />
        Live
    </span>
);

/* ── Toggle ── */
export const AdminToggle = ({ checked, onChange }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`toggle-switch ${checked ? 'toggle-switch--on' : ''}`}
        onClick={() => onChange(!checked)}
    >
        <motion.div
            className="toggle-knob"
            animate={{ x: checked ? 16 : 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
    </button>
);

/* ── Modal ── */
export const AdminModal = ({ open, onClose, title, subtitle, children, maxWidth = 520 }) => {
    if (!open) return null;
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="dark-modal"
                style={{ maxWidth }}
                onClick={e => e.stopPropagation()}
            >
                <div className="dark-modal__header">
                    <div>
                        <h2 className="dark-modal__title">{title}</h2>
                        {subtitle && <p className="dark-modal__subtitle">{subtitle}</p>}
                    </div>
                    <button type="button" className="dark-modal__close" onClick={onClose}>
                        <X size={14} />
                    </button>
                </div>
                <div className="dark-modal__body">{children}</div>
            </motion.div>
        </motion.div>
    );
};

/* ── Empty State ── */
export const AdminEmptyState = ({ title = 'No data yet', subtitle, action }) => (
    <div className="admin-empty">
        <AdminEmptyIllustration />
        <p className="admin-empty__title">{title}</p>
        {subtitle && <p className="admin-empty__sub">{subtitle}</p>}
        {action && <div className="mt-4">{action}</div>}
    </div>
);

/* ── Form Field ── */
export const AdminField = ({ label, children, className = '' }) => (
    <div className={className}>
        {label && <label className="dark-input__label">{label}</label>}
        {children}
    </div>
);

export const AdminInput = ({ className = '', ...props }) => (
    <input className={`dark-input ${className}`} {...props} />
);

export const AdminSelect = ({ className = '', children, ...props }) => (
    <select className={`dark-input ${className}`} {...props}>{children}</select>
);

/* ── Data Table ── */
export const AdminTable = ({ columns, rows, emptyMessage = 'No records found' }) => {
    if (!rows?.length) {
        return (
            <AdminGlassCard className="p-0">
                <AdminEmptyState title={emptyMessage} subtitle="Data will appear here once available." />
            </AdminGlassCard>
        );
    }
    return (
        <div className="admin-table-wrap">
            <table className="admin-table">
                <thead>
                    <tr>{columns.map(col => <th key={col.key || col}>{col.label || col}</th>)}</tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={row.id || i}>
                            {columns.map(col => (
                                <td key={col.key || col}>
                                    {col.render ? col.render(row) : row[col.key || col]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
