const FOCUSABLE_SELECTOR = [
  'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([disabled]):not([readonly]):not([tabindex="-1"])',
  'input[data-erp-combobox-input]:not([disabled]):not([readonly])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([readonly]):not([tabindex="-1"])',
].join(',');

const CONTAINER_SELECTORS = [
  '[data-form-enter-nav]',
  '.classic-erp-window',
  'form',
  '.erp-form-container',
  '.erp-modal-body',
  '[role="dialog"]',
];

function isVisible(el) {
  if (!el?.isConnected) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (el.getClientRects().length === 0) return false;
  return true;
}

export function findFormContainer(el) {
  if (!el?.closest) return null;
  for (const sel of CONTAINER_SELECTORS) {
    const found = el.closest(sel);
    if (found) return found;
  }
  return null;
}

export function getFocusableElements(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => {
    if (!isVisible(el)) return false;
    if (el.closest('[data-enter-nav="off"]')) return false;
    if (el.closest('[data-enter-skip]')) return false;
    return true;
  });
}

function focusElement(el) {
  if (!el) return;
  el.focus();
  if (typeof el.select === 'function' && !['date', 'datetime-local', 'month', 'week', 'time'].includes(el.type)) {
    try {
      el.select();
    } catch {
      /* ignore */
    }
  }
}

export function focusNextField(currentEl) {
  const container = findFormContainer(currentEl);
  if (!container) return false;

  const focusable = getFocusableElements(container);
  const idx = focusable.indexOf(currentEl);
  if (idx === -1) return false;

  const next = focusable[idx + 1];
  if (next) {
    focusElement(next);
    return true;
  }

  const form = container.tagName === 'FORM' ? container : container.closest('form');
  if (form) {
    return false;
  }

  const saveBtn = container.querySelector('[data-enter-save]')
    || container.querySelector('.classic-erp-form-footer button.btn-blue:not([disabled])')
    || container.querySelector('.erp-modal-footer button.erp-btn-primary:not([disabled])');
  if (saveBtn && saveBtn !== currentEl) {
    saveBtn.focus();
    return true;
  }

  return false;
}

export function shouldHandleFormEnter(e) {
  if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return false;
  if (e.defaultPrevented) return false;

  const target = e.target;
  if (!(target instanceof HTMLElement)) return false;

  const tag = target.tagName;
  if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') return false;

  if (target.dataset.enterNav === 'off') return false;
  if (target.closest('[data-enter-nav="off"]')) return false;
  if (target.closest('[data-command-palette]')) return false;
  if (target.closest('[data-book-selection-modal]')) return false;
  if (target.closest('[data-enter-skip]')) return false;

  return true;
}

export function handleFormEnterKeyDown(e) {
  if (!shouldHandleFormEnter(e)) return;

  const moved = focusNextField(e.target);
  if (moved) {
    e.preventDefault();
    e.stopPropagation();
  }
}
