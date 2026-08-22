import { get, post, put, del, unwrap, asArray } from './http';

export const adminApi = {
  stats: () => unwrap(get('/admin/stats')),
  companies: () => unwrap(get('/admin/companies')).then((d) => asArray(d, ['companies'])),
  createCompany: (body) => unwrap(post('/admin/company', body)),
  updateCompany: (id, body) => unwrap(put(`/admin/company/${id}`, body)),
  lockCompany: (id) => unwrap(put(`/admin/company/${id}/lock`)),
  unlockCompany: (id) => unwrap(put(`/admin/company/${id}/unlock`)),
  plans: () => unwrap(get('/admin/plans')).then((d) => asArray(d, ['plans'])),
  createPlan: (body) => unwrap(post('/admin/plans', body)),
  updatePlan: (id, body) => unwrap(put(`/admin/plans/${id}`, body)),
  deletePlan: (id) => unwrap(del(`/admin/plans/${id}`)),
  subscriptions: () => unwrap(get('/admin/subscriptions')).then((d) => asArray(d, ['subscriptions'])),
  updateSubscription: (companyId, body) => unwrap(put(`/admin/subscription/${companyId}`, body)),
  generateLicense: (body) => unwrap(post('/admin/license/generate', body)),
  renewLicense: (companyId, body) => unwrap(put(`/admin/license/${companyId}/renew`, body)),
  usage: () => unwrap(get('/admin/usage')).then((d) => asArray(d, ['usage'])),

  // Commercial lifecycle — who is expiring, in grace, or locked out.
  lifecycle: (days) => unwrap(get('/admin/lifecycle', days ? { days } : undefined)),

  // Licence device slots. Releasing a slot is the recovery path when a
  // customer's computer dies, is reinstalled or replaced.
  devices: (companyId) => unwrap(get(`/admin/company/${companyId}/devices`)),
  releaseDevice: (companyId, deviceId) =>
    unwrap(del(`/admin/company/${companyId}/devices/${deviceId}`)),
  setMaxDevices: (companyId, maxDevices) =>
    unwrap(put(`/admin/company/${companyId}/devices/max`, { maxDevices })),
  audit: (params) => unwrap(get('/admin/audit', params)).then((d) => asArray(d, ['logs', 'audit'])),
  moduleConfig: (id) => unwrap(get(`/admin/company/${id}/module-config`)),
  saveModuleConfig: (id, body) => unwrap(put(`/admin/company/${id}/module-config`, body)),
  companyConfig: (id) => unwrap(get(`/admin/company/${id}/config`)),
  saveCompanyConfig: (id, body) => unwrap(put(`/admin/company/${id}/config`, body)),
  companyUsers: (id) => unwrap(get(`/admin/company/${id}/users`)).then((d) => asArray(d, ['users'])),
  addCompanyUser: (id, body) => unwrap(post(`/admin/company/${id}/user`, body)),
  updateUserRole: (userId, body) => unwrap(put(`/admin/user/${userId}/role`, body)),
  toggleUserActive: (userId) => unwrap(put(`/admin/user/${userId}/toggle-active`)),
  deleteCompanyUser: (userId) => unwrap(del(`/admin/user/${userId}`)),

  // Dynamic company config (bills / columns / flags / permissions / logs)
  billConfig: (id, billType) => unwrap(get(`/admin/company/${id}/config/bills/${billType}`)),
  saveBillConfig: (id, billType, body) => unwrap(put(`/admin/company/${id}/config/bills/${billType}`, body)),
  columnConfigs: (id) => unwrap(get(`/admin/company/${id}/config/columns`)).then((d) => asArray(d)),
  saveColumnConfig: (id, tableKey, body) => unwrap(put(`/admin/company/${id}/config/columns/${tableKey}`, body)),
  featureFlags: (id) => unwrap(get(`/admin/company/${id}/config/feature-flags`)).then((d) => asArray(d)),
  saveFeatureFlag: (id, flagKey, body) => unwrap(put(`/admin/company/${id}/config/feature-flags/${flagKey}`, body)),
  permissions: (id) => unwrap(get(`/admin/company/${id}/config/permissions`)),
  savePermissions: (id, body) => unwrap(put(`/admin/company/${id}/config/permissions`, body)),
  configLogs: (id, params) => unwrap(get(`/admin/company/${id}/config/logs`, params)).then((d) => asArray(d)),

  rawGet: (url) => unwrap(get(url)),
  rawPut: (url, body) => unwrap(put(url, body)),
  rawPost: (url, body) => unwrap(post(url, body)),
};

export const subscriptionApi = {
  // Admin-facing updates live under adminApi; tenant reads plan from /auth/me / config
  update: (companyId, body) => adminApi.updateSubscription(companyId, body),
};

export default adminApi;
