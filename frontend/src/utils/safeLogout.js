import { processSyncQueue, getPendingCount, isSyncRunning } from './syncQueue';
import { isOffline } from './networkStatus';
import { erpConfirm } from './confirm';
import useStore from '../store/useStore';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Logout that first uploads this computer's offline entries, so they are on the cloud before the
 * user opens the account on another PC or laptop. Anything that cannot upload (no internet, login
 * expired, refused) is counted and the user may stay logged in instead. Entries are never deleted
 * by logout — they upload the next time this computer logs in with internet.
 * @returns {Promise<boolean>} true when the user was logged out
 */
export async function logoutWithSync() {
  if (!isOffline()) {
    // A background upload may be running; give it a moment, then run once more ourselves.
    for (let i = 0; i < 20 && isSyncRunning(); i += 1) await wait(250);
    try {
      await processSyncQueue(null, null, null, { includeRejected: true });
    } catch {
      /* counted below */
    }
  }
  let left = 0;
  try {
    left = await getPendingCount();
  } catch {
    left = 0;
  }
  if (left > 0) {
    const ok = await erpConfirm({
      title: 'Entries not uploaded yet',
      message:
        `${left} ${left === 1 ? 'entry' : 'entries'} on this computer ${left === 1 ? 'is' : 'are'} not on the cloud yet` +
        `${isOffline() ? ' (no internet)' : ''}.\n\n` +
        'If you log out now they stay safe on THIS computer and upload the next time you log in here ' +
        'with internet — they will NOT show on another PC until then.\n\n' +
        'Internet ON karke dobara Logout dabayein, taaki entries doosre PC par bhi dikhein.',
      confirmLabel: 'Logout anyway',
      cancelLabel: 'Stay logged in',
      danger: true,
    });
    if (!ok) return false;
  }
  await useStore.getState().logout();
  return true;
}
