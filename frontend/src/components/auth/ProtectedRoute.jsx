import React, { useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useStore from '../../store/useStore';
import { isOffline } from '../../utils/offlineHelpers';

/**
 * Platform role for routing: only `user` | `super_admin`.
 * Never confuse with companyRole (owner/admin/manager/…).
 */
function resolvePlatformRole(storeRole, storeUser) {
  const fromStore = storeRole || storeUser?.role;
  if (fromStore === 'super_admin' || fromStore === 'user') return fromStore;

  try {
    const saved = JSON.parse(localStorage.getItem('user') || 'null');
    if (saved?.role === 'super_admin' || saved?.role === 'user') return saved.role;
  } catch {
    /* ignore */
  }

  const ls = localStorage.getItem('role');
  if (ls === 'super_admin' || ls === 'user') return ls;

  // Logged-in session without a platform role → ERP user (never block panel)
  return null;
}

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const storeToken = useStore((s) => s.token);
  const storeRole = useStore((s) => s.role);
  const storeUser = useStore((s) => s.user);
  const sessionReady = useStore((s) => s.sessionReady);
  const token = storeToken || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
  const location = useLocation();

  const role = useMemo(
    () => resolvePlatformRole(storeRole, storeUser),
    [storeRole, storeUser]
  );

  if (!token) {
    if (location.pathname.startsWith('/admin')) {
      return <Navigate to="/admin/login" state={{ from: location }} replace />;
    }
    if (isOffline()) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
    return <Navigate to="/portal" state={{ from: location }} replace />;
  }

  // Session hydrate runs in AppProviders / AuthBootstrap (outside this gate)
  if (allowedRoles.length > 0 && !sessionReady) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Loading session...</p>
      </div>
    );
  }

  if (allowedRoles.length > 0) {
    // Token present → default ERP access as `user` (fixes role:undefined deny loop)
    const effectiveRole = role || 'user';
    const isAdminRoute = location.pathname.startsWith('/admin');
    const hasPermission =
      allowedRoles.includes(effectiveRole) || effectiveRole === 'super_admin';

    if (!hasPermission) {
      console.warn(
        `[ProtectedRoute] Access denied for role: ${effectiveRole} on path: ${location.pathname}`
      );
      if (isAdminRoute) {
        return <Navigate to="/admin/login" replace />;
      }
      return <Navigate to="/portal" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
