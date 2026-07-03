import {
  getOfflineAuth,
  putOfflineAuth,
  listOfflineAuths,
  setActiveCompanyId
} from './offlineDB';
import { normalizeUser } from './normalizers';

const HASH_SALT = 'billing-offline-auth-v1';

const hashPassword = async (email, password) => {
  const payload = `${email.toLowerCase()}::${password}::${HASH_SALT}`;
  const data = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

export const saveOfflineCredential = async (email, password, { token, user }) => {
  const emailNorm = email.trim().toLowerCase();
  const normalizedUser = normalizeUser(user);
  const passwordHash = await hashPassword(emailNorm, password);

  await putOfflineAuth({
    id: emailNorm,
    email: emailNorm,
    passwordHash,
    token,
    user: normalizedUser,
    role: normalizedUser.role,
    companyId: normalizedUser.companyId,
    updatedAt: new Date().toISOString()
  });
};

export const updateOfflineSession = async (email, { token, user }) => {
  if (!email) return;
  const emailNorm = email.trim().toLowerCase();
  const existing = await getOfflineAuth(emailNorm);
  if (!existing) return;

  const normalizedUser = normalizeUser(user);
  await putOfflineAuth({
    ...existing,
    token,
    user: normalizedUser,
    role: normalizedUser.role,
    companyId: normalizedUser.companyId,
    updatedAt: new Date().toISOString()
  });
};

export const tryOfflineLogin = async (email, password, { adminOnly = false } = {}) => {
  const emailNorm = email.trim().toLowerCase();
  const record = await getOfflineAuth(emailNorm);

  if (!record) {
    throw new Error(
      'No offline login saved for this account. Sign in once while online, then you can use offline login.'
    );
  }

  const passwordHash = await hashPassword(emailNorm, password);
  if (passwordHash !== record.passwordHash) {
    throw new Error('Invalid email or password.');
  }

  if (adminOnly && record.role !== 'super_admin') {
    throw new Error('Access denied: Not a super admin');
  }

  if (record.user?.companyId) {
    setActiveCompanyId(record.user.companyId);
  }

  return {
    token: record.token,
    user: normalizeUser(record.user),
    role: record.role
  };
};

export const listOfflineProfiles = async () => {
  const records = await listOfflineAuths();
  return records
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map((r) => ({
      email: r.email,
      name: r.user?.name || r.email,
      role: r.role,
      companyName: r.user?.companyName || r.user?.settings?.legalName || '',
      updatedAt: r.updatedAt
    }));
};

export const removeOfflineProfile = async (email) => {
  const { removeOfflineAuth } = await import('./offlineDB');
  await removeOfflineAuth(email.trim().toLowerCase());
};
