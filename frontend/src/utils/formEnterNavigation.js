const FOCUSABLE_SELECTOR = [
  'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([disabled]):not([readonly]):not([tabindex="-1"])',
  'input[data-erp-combobox-input]:not([disabled]):not([readonly])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([readonly]):not([tabindex="-1"])',
  'button[data-enter-action="true"]:not([disabled]):not([tabindex="-1"])',
  'button[data-enter-nav="action"]:not([disabled]):not([tabindex="-1"])',
].join(',');

const CONTAINER_SELECTORS = [
  '[data-form-enter-nav]',
  '.classic-erp-window',
  'form',
  '.erp-form-container',
  '.erp-modal-body',
  '[role="dialog"]',
  '[data-erp-dialog]',
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
    const skipEl = el.closest('[data-enter-skip]');
    if (skipEl && skipEl.getAttribute('data-enter-skip') !== 'false') return false;
    return true;
  });
}

export function focusElement(el) {
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

export function focusPrevField(currentEl) {
  const container = findFormContainer(currentEl);
  if (!container) return false;

  const focusable = getFocusableElements(container);
  const idx = focusable.indexOf(currentEl);
  if (idx > 0) {
    const prev = focusable[idx - 1];
    if (prev) {
      focusElement(prev);
      return true;
    }
  }
  return false;
}

export function focusGridCell(currentEl, direction) {
  const td = currentEl.closest('td');
  const tr = currentEl.closest('tr');
  const tbody = tr?.closest('tbody') || tr?.parentElement;
  if (!td || !tr || !tbody) return false;

  const colIdx = Array.from(tr.children).indexOf(td);
  const rows = Array.from(tbody.querySelectorAll('tr'));
  const rowIdx = rows.indexOf(tr);

  if (direction === 'up' && rowIdx > 0) {
    const prevRow = rows[rowIdx - 1];
    const targetTd = prevRow.children[colIdx];
    const targetInput = targetTd?.querySelector(FOCUSABLE_SELECTOR);
    if (targetInput) {
      focusElement(targetInput);
      return true;
    }
  } else if (direction === 'down' && rowIdx < rows.length - 1) {
    const nextRow = rows[rowIdx + 1];
    const targetTd = nextRow.children[colIdx];
    const targetInput = targetTd?.querySelector(FOCUSABLE_SELECTOR);
    if (targetInput) {
      focusElement(targetInput);
      return true;
    }
  }
  return false;
}

export function shouldHandleFormNavigation(e) {
  if (e.ctrlKey || e.altKey || e.metaKey) return false;
  if (e.defaultPrevented) return false;

  const target = e.target;
  if (!(target instanceof HTMLElement)) return false;

  const tag = target.tagName;
  if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA' && tag !== 'BUTTON') return false;

  // Elements with custom Enter actions or opting out of navigation
  if (target.dataset.enterAction === 'true') return false;
  if (target.closest('[data-enter-action="true"]')) return false;
  if (target.dataset.enterNav === 'off' || target.dataset.enterNav === 'action') return false;
  if (target.closest('[data-enter-nav="off"]')) return false;
  if (target.closest('[data-command-palette]')) return false;
  if (target.closest('[data-book-selection-modal]')) return false;
  if (target.closest('[data-enter-skip]')) return false;

  // Buttons should execute their click/action on Enter unless explicitly set to navigate
  if (tag === 'BUTTON' && target.dataset.enterNext !== 'true') return false;

  return true;
}

export function handleFormEnterKeyDown(e) {
  if (e.key !== 'Enter') return;
  if (e.shiftKey) {
    // Shift+Enter -> Go backwards to previous field
    if (e.target?.tagName === 'TEXTAREA') return;
    if (shouldHandleFormNavigation(e)) {
      const moved = focusPrevField(e.target);
      if (moved) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    return;
  }

  if (!shouldHandleFormNavigation(e)) return;

  const moved = focusNextField(e.target);
  if (moved) {
    e.preventDefault();
    e.stopPropagation();
  }
}

export function handleFormArrowKeyDown(e) {
  if (!shouldHandleFormNavigation(e)) return;

  const target = e.target;
  const isInput = target.tagName === 'INPUT';
  const isSelect = target.tagName === 'SELECT';
  const isTextarea = target.tagName === 'TEXTAREA';

  // Do not hijack arrows inside textarea with multiline text unless at extreme edge
  if (isTextarea) return;

  // Arrow Up / Down in Table Grids (e.g. Sales / Purchase line items)
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    // If it's a combobox dropdown or select, let combobox/native select handle up/down
    if (target.hasAttribute('data-erp-combobox-input') || isSelect) return;

    const dir = e.key === 'ArrowUp' ? 'up' : 'down';
    const moved = focusGridCell(target, dir);
    if (moved) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
  }

  // Left Arrow: Move to previous field if at start of input
  if (e.key === 'ArrowLeft') {
    let atStart = false;
    if (isInput) {
      try {
        atStart = target.selectionStart === 0 && target.selectionEnd === 0;
      } catch {
        atStart = true;
      }
    } else {
      atStart = true;
    }

    if (atStart) {
      const moved = focusPrevField(target);
      if (moved) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    return;
  }

  // Right Arrow: Move to next field if at end of input
  if (e.key === 'ArrowRight') {
    let atEnd = false;
    if (isInput) {
      try {
        atEnd = target.selectionStart === target.value.length;
      } catch {
        atEnd = true;
      }
    } else {
      atEnd = true;
    }

    if (atEnd) {
      const moved = focusNextField(target);
      if (moved) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }
}
