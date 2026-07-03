/** Plan + subscription feature gating for offline mode */

export const canUseOfflineMode = (plan, settings) => {
  const planAllows = !!(plan?.offlineMode || plan?.modules?.offline);
  if (!planAllows) return false;
  return settings?.offlineModeEnabled === true;
};

export const getCompanySettings = (user) =>
  user?.activeConfig?.companySettings || user?.settings || {};
