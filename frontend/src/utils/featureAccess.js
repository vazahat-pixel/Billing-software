/** Plan + subscription feature gating for offline mode */

/**
 * Returns true if offline mode is allowed.
 * Default: ALLOW offline for all logged-in users.
 * Only block if plan or settings explicitly disables it.
 */
export const canUseOfflineMode = (plan, settings) => {
  // Explicit disable via plan
  if (plan?.offlineMode === false) return false;
  if (plan?.modules?.offline === false) return false;
  // Explicit disable via company settings
  if (settings?.offlineModeEnabled === false) return false;
  // Default: allow offline for all logged-in users
  return true;
};

export const getCompanySettings = (user) =>
  user?.activeConfig?.companySettings || user?.settings || {};
