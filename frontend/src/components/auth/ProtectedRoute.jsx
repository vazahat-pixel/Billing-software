import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useStore from '../../store/useStore';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
    const { token, role } = useStore();
    const location = useLocation();

    // 1. If not logged in, redirect to appropriate login
    if (!token) {
        const redirectPath = location.pathname.startsWith('/admin') ? '/admin/login' : '/portal';
        return <Navigate to={redirectPath} state={{ from: location }} replace />;
    }

    // 2. If roles are specified, check permissions
    if (allowedRoles.length > 0) {
        const hasPermission = allowedRoles.includes(role);
        
        // If they don't have direct permission, check if they are a super_admin
        // (Super Admin is granted access to all protected routes)
        if (!hasPermission && role !== 'super_admin') {
            console.warn(`[ProtectedRoute] Access denied for role: ${role} on path: ${location.pathname}`);
            return <Navigate to="/" replace />;
        }
    }

    return children;
};

export default ProtectedRoute;
