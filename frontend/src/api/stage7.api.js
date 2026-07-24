import { get, post, put, del, unwrap, asArray } from './http';

/** Stage 7 Infrastructure — /api/stage7/* */
export const stage7Api = {
  getConfig: () => unwrap(get('/stage7/security/config')),
  updateConfig: (body) => unwrap(put('/stage7/security/config', body)),
  seedFlags: () => unwrap(post('/stage7/security/seed-flags')),
  validatePassword: (password) => unwrap(post('/stage7/security/validate-password', { password })),
  securityPosture: () => unwrap(get('/stage7/security/posture')),

  sessions: () => unwrap(get('/stage7/sessions')).then((d) => asArray(d)),
  revokeSession: (sessionId) => unwrap(del(`/stage7/sessions/${sessionId}`)),
  revokeAllSessions: () => unwrap(post('/stage7/sessions/revoke-all')),
  forceLogout: (userId) => unwrap(post(`/stage7/sessions/force-logout/${userId}`)),
  loginHistory: (params) => unwrap(get('/stage7/sessions/history', params)).then((d) => asArray(d)),
  trustDevice: (body) => unwrap(post('/stage7/sessions/trust', body)),

  dbHealth: () => unwrap(get('/stage7/db/health')),
  dbIndexes: () => unwrap(get('/stage7/db/indexes')),
  dbAnalyze: (body) => unwrap(post('/stage7/db/analyze', body)),
  dbMigrations: () => unwrap(get('/stage7/db/migrations')),

  cacheStats: () => unwrap(get('/stage7/cache/stats')),
  cacheClear: () => unwrap(post('/stage7/cache/clear')),
  queueStats: () => unwrap(get('/stage7/queue/stats')),
  queueJobs: (params) => unwrap(get('/stage7/queue/jobs', params)).then((d) => asArray(d)),
  queueEnqueue: (body) => unwrap(post('/stage7/queue/jobs', body)),
  queueRetry: (id) => unwrap(post(`/stage7/queue/jobs/${id}/retry`)),

  monitorSnapshot: () => unwrap(get('/stage7/monitor/snapshot')),
  monitorHealth: () => unwrap(get('/stage7/monitor/health')),

  logs: (params) => unwrap(get('/stage7/logs', params)).then((d) => asArray(d)),
  logCategories: () => unwrap(get('/stage7/logs/categories')).then((d) => asArray(d)),
  auditLogs: (params) => unwrap(get('/stage7/logs/audit', params)).then((d) => asArray(d)),

  backups: (params) => unwrap(get('/stage7/backups', params)).then((d) => asArray(d)),
  backupCreate: (body) => unwrap(post('/stage7/backups', body || {})),
  backupPolicy: () => unwrap(get('/stage7/backups/policy')),
  backupSchedule: () => unwrap(post('/stage7/backups/schedule')),
  backupPreview: (id) => unwrap(get(`/stage7/backups/${id}/preview`)),
  backupVerify: (id) => unwrap(post(`/stage7/backups/${id}/verify`)),

  certificationRun: (body) => unwrap(post('/stage7/certification/run', body || {})),
  certificationLatest: () => unwrap(get('/stage7/certification/latest')),
  certificationList: () => unwrap(get('/stage7/certification')).then((d) => asArray(d)),
};

export default stage7Api;
