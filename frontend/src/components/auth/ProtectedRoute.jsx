import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useStore from '../../store/useStore';
import { isOffline } from '../../utils/offlineHelpers';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
    const storeToken = useStore((s) => s.token);
    const role = useStore((s) => s.role);
    const token = storeToken || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    const location = useLocation();

    if (!token) {
        if (location.pathname.startsWith('/admin')) {
            return <Navigate to="/admin/login" state={{ from: location }} replace />;
        }
        if (isOffline()) {
            return <Navigate to="/login" state={{ from: location }} replace />;
        }
        return <Navigate to="/portal" state={{ from: location }} replace />;
    }

    if (allowedRoles.length > 0) {
        const hasPermission = allowedRoles.includes(role);

        if (!hasPermission && role !== 'super_admin') {
            console.warn(`[ProtectedRoute] Access denied for role: ${role} on path: ${location.pathname}`);
            return <Navigate to="/" replace />;
        }
    }

    return children;
};

export default ProtectedRoute;
