import { useEffect } from 'react';

/**
 * JSM habit: a bill window opens with the cursor on its New button, so Enter starts a new entry and
 * Left / Right walk the button row (New, Edit, Save, Find, Print, Exit ...). The same happens again
 * whenever the window comes back to View mode (after a Save, or after browsing to another bill).
 *
 * Bill windows mark themselves with `data-erp-bill` and `data-erp-mode={mode}`. Nothing here touches
 * what a button does; it only moves keyboard focus, and never after the operator has typed or clicked.
 */
const BILL_SEL = '[data-erp-bill]';

const isShown = (el) => el && (el.offsetParent !== null || (el.getClientRects && el.getClientRects().length > 0));

function findNewButton(win) {
  const scope = win.closest('[data-erp-modal-z]') || win.parentElement || win;
  const buttons = [...scope.querySelectorAll('button')].filter((b) => !b.disabled && isShown(b));
  return buttons.find((b) => b.dataset.action === 'new')
    || buttons.find((b) => /^new$/i.test((b.textContent || '').trim()))
    || buttons.find((b) => /alt\+n/i.test(b.title || '') && /new/i.test(b.textContent || ''));
}

function isTopWindow(win) {
  if (document.querySelector('[data-book-selection-modal], [data-erp-confirm-dialog]')) return false;
  const host = win.closest('[data-erp-modal-z]');
  if (!host) return true;
  const shown = [...document.querySelectorAll('[data-erp-modal-z]')]
    .filter((m) => m.getClientRects().length > 0)
    .sort((a, b) => Number(a.getAttribute('data-erp-modal-z')) - Number(b.getAttribute('data-erp-modal-z')));
  return shown[shown.length - 1] === host;
}

export function useBillNewButtonFocus(enabled = true) {
  useEffect(() => {
    if (!enabled || typeof MutationObserver === 'undefined') return undefined;
    const seen = new WeakMap(); // window element -> last mode seen
    let lastUserAction = 0;
    const markUser = () => { lastUserAction = Date.now(); };

    const focusNewSoon = (win, mode) => {
      const started = Date.now();
      // a few tries: forms load their data and focus a field of their own shortly after opening
      [180, 500, 1000, 1800, 3000].forEach((ms) => setTimeout(() => {
        if (!win.isConnected || lastUserAction > started) return;
        if (win.getAttribute('data-erp-mode') !== mode) return;
        if (!isTopWindow(win)) return;
        const btn = findNewButton(win);
        if (btn && document.activeElement !== btn) btn.focus();
      }, ms));
    };

    let raf = 0;
    const scan = () => {
      raf = 0;
      document.querySelectorAll(BILL_SEL).forEach((win) => {
        const mode = win.getAttribute('data-erp-mode') || '';
        const prev = seen.get(win);
        if (prev === mode) return;
        seen.set(win, mode);
        // just opened (any mode), or back to View: cursor on New
        if (prev === undefined || /^view$/i.test(mode)) focusNewSoon(win, mode);
      });
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(scan); };

    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-erp-mode'] });
    document.addEventListener('keydown', markUser, true);
    document.addEventListener('mousedown', markUser, true);
    schedule();
    return () => {
      mo.disconnect();
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('keydown', markUser, true);
      document.removeEventListener('mousedown', markUser, true);
    };
  }, [enabled]);
}

export default useBillNewButtonFocus;
