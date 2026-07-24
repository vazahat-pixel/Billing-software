import { get, post, unwrap, asArray } from './http';

/** Stage 8 Commercial Release — /api/stage8/* */
export const stage8Api = {
  overview: () => unwrap(get('/stage8/overview')),
  flowCertify: () => unwrap(get('/stage8/flows/certify')),
  qaInventory: () => unwrap(get('/stage8/qa/inventory')),
  qaSmoke: () => unwrap(post('/stage8/qa/smoke')),
  uiuxChecklist: () => unwrap(get('/stage8/uiux/checklist')),

  licenseStatus: () => unwrap(get('/stage8/license/status')),
  licenseActivate: (body) => unwrap(post('/stage8/license/activate', body)),
  licenseActivateOffline: (body) => unwrap(post('/stage8/license/activate-offline', body)),
  licenseOfflineCode: (body) => unwrap(post('/stage8/license/offline-code', body)),
  licenseDeactivateDevice: (deviceId) => unwrap(post(`/stage8/license/devices/${deviceId}/deactivate`)),
  licenseRenew: (body) => unwrap(post('/stage8/license/renew', body)),
  licenseUpgrade: (body) => unwrap(post('/stage8/license/upgrade', body)),
  licenseIssue: (body) => unwrap(post('/stage8/license/issue', body || {})),
  licenseAudit: () => unwrap(get('/stage8/license/audit')),

  onboarding: () => unwrap(get('/stage8/onboarding')),
  onboardingWizard: () => unwrap(get('/stage8/onboarding/wizard')),
  onboardingStep: (body) => unwrap(post('/stage8/onboarding/step', body)),
  onboardingQuick: (body) => unwrap(post('/stage8/onboarding/quick-setup', body || {})),
  onboardingSkip: () => unwrap(post('/stage8/onboarding/skip')),

  releaseVersion: () => unwrap(get('/stage8/release/version')),
  releaseList: () => unwrap(get('/stage8/release')).then((d) => asArray(d)),
  releaseLatest: () => unwrap(get('/stage8/release/latest')),
  releaseEnsureV1: () => unwrap(post('/stage8/release/ensure-v1')),
  releaseApprove: (version, body) => unwrap(post(`/stage8/release/${version}/approve`, body || {})),
  releaseShip: (version) => unwrap(post(`/stage8/release/${version}/ship`)),
  docs: () => unwrap(get('/stage8/docs')),
  desktop: () => unwrap(get('/stage8/desktop')),

  certificationRun: (body) => unwrap(post('/stage8/certification/run', body || {})),
  certificationLatest: () => unwrap(get('/stage8/certification/latest')),
  certificationList: () => unwrap(get('/stage8/certification')).then((d) => asArray(d)),

  // 8.11 Enterprise Testing Platform
  testingCatalog: () => unwrap(get('/stage8/testing/catalog')),
  testingDashboard: () => unwrap(get('/stage8/testing/dashboard')),
  testingScaffold: () => unwrap(get('/stage8/testing/scaffold')),
  testingGates: () => unwrap(get('/stage8/testing/gates')),
  testingCertify: (body) => unwrap(post('/stage8/testing/certify', body || {})),
  testingLatest: () => unwrap(get('/stage8/testing/latest')),
  testingRuns: () => unwrap(get('/stage8/testing/runs')).then((d) => asArray(d)),
};

export default stage8Api;
