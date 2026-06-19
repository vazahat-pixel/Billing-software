import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Shield } from 'lucide-react';
import useStore from '../store/useStore';

/**
 * Switch between ERP User Panel (/) and Admin Panel (/admin/*).
 * Shown for super_admin in both shells; ERP-only users see ERP tab only on portal.
 */
const PanelSwitcher = ({ variant = 'dark' }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const role = useStore(state => state.role);

    if (role !== 'super_admin') return null;

    const isAdmin = location.pathname.startsWith('/admin');
    const cls = variant === 'light' ? 'panel-switcher panel-switcher--light' : 'panel-switcher';

    return (
        <div className={cls}>
            <button
                type="button"
                className={`panel-switcher__btn ${!isAdmin ? 'panel-switcher__btn--active' : ''}`}
                onClick={() => navigate('/')}
            >
                <LayoutDashboard size={13} />
                ERP Panel
            </button>
            <button
                type="button"
                className={`panel-switcher__btn ${isAdmin ? 'panel-switcher__btn--active' : ''}`}
                onClick={() => navigate('/admin/dashboard')}
            >
                <Shield size={13} />
                Admin Panel
            </button>
        </div>
    );
};

export default PanelSwitcher;
