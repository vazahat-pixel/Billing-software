import React from 'react';
import useConfigStore from '../../store/useConfigStore';

/**
 * Permission gate — prefer section keys from permissions.js / PermissionMatrix.
 * Usage: <PermissionGate section="Transaction">...</PermissionGate>
 * Or: <PermissionGate canSave>...</PermissionGate>
 */
export default function PermissionGate({
  section,
  canSave = false,
  canManageUsers = false,
  fallback = null,
  children,
}) {
  const permissions = useConfigStore((s) => s.permissions);

  if (canSave && !permissions.canSave) return fallback;
  if (canManageUsers && !permissions.canManageUsers) return fallback;
  if (section && !permissions.canAccessSection?.(section)) return fallback;

  return <>{children}</>;
}
