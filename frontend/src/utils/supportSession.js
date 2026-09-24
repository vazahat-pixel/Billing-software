/**
 * Consume admin "Open as support" session from URL / localStorage pending payload.
 * Returns true if a support session was applied (caller should skip normal restore).
 */
export async function consumeSupportSession(setAuth) {
  if (typeof window === 'undefined') return false;

  let pending = null;
  try {
    pending = JSON.parse(localStorage.getItem('pendingSupportSession') || 'null');
  } catch {
    pending = null;
  }

  const params = new URLSearchParams(window.location.search);
  const supportToken = params.get('supportToken');
  const token = supportToken || pending?.token;
  if (!token) return false;

  localStorage.removeItem('pendingSupportSession');
  try {
    if (supportToken && window.history?.replaceState) {
      const clean = `${window.location.pathname || '/'}${window.location.hash || ''}`;
      window.history.replaceState({}, '', clean);
    }
  } catch { /* ignore */ }

  try {
    if (pending?.user && (!supportToken || pending.token === token)) {
      await setAuth({
        token,
        user: {
          ...pending.user,
          supportSession: true,
          mustChangePassword: false,
        },
      });
      return true;
    }

    localStorage.setItem('token', token);
    const { authApi } = await import('../api/auth.api');
    const me = await authApi.me();
    const user = me?.user || me;
    await setAuth({
      token,
      user: {
        ...(user || {}),
        supportSession: true,
        mustChangePassword: false,
      },
    });
    return true;
  } catch (err) {
    console.error('[supportSession] failed:', err?.message || err);
    localStorage.removeItem('token');
    return false;
  }
}

export function hasPendingSupportSession() {
  if (typeof window === 'undefined') return false;
  try {
    if (new URLSearchParams(window.location.search).get('supportToken')) return true;
    return !!localStorage.getItem('pendingSupportSession');
  } catch {
    return false;
  }
}
