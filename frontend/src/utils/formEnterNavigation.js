const FOCUSABLE_SELECTOR = [
  'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([disabled]):not([readonly]):not([tabindex="-1"])',
  'input[data-enter-include]:not([disabled]):not([tabindex="-1"])',
  '[data-line-start]:not([disabled]):not([tabindex="-1"])',
  'input[data-erp-combobox-input]:not([disabled]):not([readonly]):not([tabindex="-1"])',
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
  const list = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => {
    if (!isVisible(el)) return false;
    if (el.tabIndex === -1 || el.getAttribute('tabindex') === '-1') return false;
    if (el.getAttribute('data-enter-skip') === 'true') return false;
    const offHost = el.closest('[data-enter-nav="off"]');
    if (offHost && offHost !== el) return false;
    const skipEl = el.closest('[data-enter-skip]');
    if (skipEl && skipEl.getAttribute('data-enter-skip') !== 'false') {
      const explicitSkip = el.getAttribute('data-enter-skip') === 'true' ||
        (skipEl && !skipEl.classList.contains('erp-combobox') && skipEl.getAttribute('data-enter-skip') === 'true');
      if (explicitSkip) return false;
      const keepCombobox = el.hasAttribute('data-erp-combobox-input');
      if (!keepCombobox) return false;
    }
    return true;
  });
  return list
    .map((el, domIndex) => {
      const raw = el.getAttribute('data-enter-order');
      const order = raw != null && raw !== '' && !Number.isNaN(Number(raw)) ? Number(raw) : 1000 + domIndex;
      return { el, order };
    })
    .sort((a, b) => a.order - b.order)
    .map((row) => row.el);
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

function nextFocusableAfter(container, currentEl) {
  const focusable = getFocusableElements(container);
  const idx = focusable.indexOf(currentEl);
  if (idx !== -1) return focusable[idx + 1] || null;
  // Open combobox marks itself data-enter-skip, so the current input is
  // missing from the list. Still step to the next field after it.
  for (const el of focusable) {
    if (currentEl.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) return el;
  }
  return null;
}

export function findEnterSaveButton(container) {
  if (!container) return null;
  const host = container.parentElement || container;
  return host.querySelector('[data-enter-save]:not([disabled])')
    || container.querySelector('.classic-erp-form-footer button.btn-blue:not([disabled])')
    || container.querySelector('.erp-bill-action-bar button.btn-blue:not([disabled])');
}

export function focusNextField(currentEl) {
  const container = findFormContainer(currentEl);
  if (!container) return false;

  const next = nextFocusableAfter(container, currentEl);
  if (next) {
    focusElement(next);
    return true;
  }

  const form = container.tagName === 'FORM' ? container : container.closest('form');
  if (form && !container.hasAttribute('data-form-enter-nav')) {
    return false;
  }

  const saveBtn = findEnterSaveButton(container);
  if (saveBtn && saveBtn !== currentEl) {
    if (saveBtn.hasAttribute('data-enter-save')) {
      saveBtn.click();
      return true;
    }
    saveBtn.focus();
    return true;
  }

  return false;
}

/** Shift+Tab jumps from the item grid to the bottom block (transport, totals, then Enter saves). */
export function focusFormFooter(currentEl) {
  if (!(currentEl instanceof HTMLElement)) return false;
  const container = findFormContainer(currentEl);
  if (!container) return false;
  const footer = container.querySelector('[data-enter-footer]');
  if (!footer || footer.contains(currentEl)) return false;
  const first = getFocusableElements(footer)[0];
  if (first) {
    focusElement(first);
    first.scrollIntoView?.({ block: 'nearest' });
    return true;
  }
  const saveBtn = footer.querySelector('[data-enter-save]:not([disabled])') || findEnterSaveButton(container);
  if (saveBtn) {
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

function lineGridOf(el) {
  return el?.closest?.('[data-line-grid]') || null;
}

function addLineButton(grid) {
  if (!grid) return null;
  return grid.querySelector('[data-add-line]')
    || grid.parentElement?.querySelector('[data-add-line]')
    || grid.closest('.classic-erp-window, [data-erp-dialog], [role="dialog"]')?.querySelector('[data-add-line]')
    || null;
}

function focusLineStart(row) {
  if (!row) return false;
  const start = row.querySelector('[data-line-start]') || getFocusableElements(row)[0];
  if (!start) return false;
  focusElement(start);
  return true;
}

/** Enter on the last cell of a line moves to the next line, or adds one. Sr No stays 1, 2, 3… */
export function advanceGridLine(currentEl) {
  const grid = lineGridOf(currentEl);
  const row = currentEl?.closest?.('tbody tr');
  if (!grid || !row || !grid.contains(row)) return false;

  const focusable = getFocusableElements(row);
  const idx = focusable.indexOf(currentEl);
  if (idx === -1 || idx < focusable.length - 1) return false;

  const rows = Array.from(grid.querySelectorAll('tbody tr'));
  const rowIdx = rows.indexOf(row);
  if (rowIdx >= 0 && rowIdx < rows.length - 1) {
    return focusLineStart(rows[rowIdx + 1]);
  }

  const addBtn = addLineButton(grid);
  if (!addBtn || addBtn.disabled) return false;
  addBtn.click();
  setTimeout(() => {
    const fresh = grid.querySelectorAll('tbody tr');
    focusLineStart(fresh[fresh.length - 1]);
  }, 50);
  return true;
}

function valueFullySelected(el) {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return true;
  if (el.readOnly || el.disabled) return true;
  try {
    return el.selectionStart === 0 && el.selectionEnd === String(el.value || '').length;
  } catch {
    return true;
  }
}

/** Delete removes the current grid row (empty cell, full selection, or Shift/Ctrl+Delete). */
export function handleGridDeleteKey(e) {
  if (e.key !== 'Delete' || e.altKey || e.metaKey) return false;
  const el = e.target;
  if (!(el instanceof HTMLElement)) return false;
  const row = el.closest('[data-line-grid] tbody tr');
  if (!row) return false;
  const del = row.querySelector('[data-delete-line]:not([disabled])');
  if (!del) return false;

  const force = e.shiftKey || e.ctrlKey;
  const isField = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
  const empty = !isField || !String(el.value || '').trim();
  if (!force && !empty && !valueFullySelected(el)) return false;

  e.preventDefault();
  e.stopPropagation();
  del.click();
  return true;
}

export function shouldHandleFormNavigation(e) {
  if (e.ctrlKey || e.altKey || e.metaKey) return false;
  if (e.defaultPrevented) return false;

  const target = e.target;
  if (!(target instanceof HTMLElement)) return false;

  const tag = target.tagName;
  const lineStart = target.hasAttribute('data-line-start');
  if (!lineStart && tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA' && tag !== 'BUTTON') return false;

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

  if (advanceGridLine(e.target)) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }

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
