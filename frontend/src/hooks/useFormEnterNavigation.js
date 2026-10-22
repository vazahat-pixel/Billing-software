import { useEffect } from 'react';
import {
  handleFormEnterKeyDown,
  handleFormArrowKeyDown,
  handleGridDeleteKey,
  focusFormFooter,
  findFormContainer,
  findEnterSaveButton,
} from '../utils/formEnterNavigation';

/**
 * Global ERP keyboard:
 * - Enter → next field
 * - Shift+Enter → previous field
 * - Left/Right Arrow → navigate between fields at boundary
 * - Up/Down Arrow → navigate table cells
 * - Ctrl+Enter / Alt+S → Save
 */
export function useFormEnterNavigation(enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = (e) => {
      if (document.querySelector('[data-erp-confirm-dialog]')) return;
      if (e.key === 'Tab' && e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (focusFormFooter(e.target)) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }

      if (e.key === 'Delete' && handleGridDeleteKey(e)) return;

      // Enter / Shift+Enter navigation
      if (e.key === 'Enter' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        handleFormEnterKeyDown(e);
        return;
      }

      // Arrow navigation (Left/Right/Up/Down)
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
        handleFormArrowKeyDown(e);
        return;
      }

      // F3: Find / Search in current master modal or active screen
      if (e.key === 'F3') {
        const activeContainer =
          document.querySelector('.classic-erp-window:not([style*="display: none"]), [role="dialog"]:not([style*="display: none"]), [data-erp-dialog]') ||
          findFormContainer(e.target) ||
          document.body;
        const findTarget = activeContainer?.querySelector?.(
          '[data-master-find], input[placeholder*="Find" i], input[placeholder*="Search" i], button[data-action="find"], .classic-erp-btn[title*="Find" i]'
        );
        if (findTarget) {
          e.preventDefault();
          e.stopPropagation();
          if (findTarget.tagName === 'BUTTON') {
            findTarget.click();
          } else {
            findTarget.focus();
            try { findTarget.select(); } catch {}
          }
          return;
        }
      }

      // Alt+N / F2: New Record
      if ((e.altKey && e.key.toLowerCase() === 'n') || e.key === 'F2') {
        const active = document.querySelector('.classic-erp-window:not([style*="display: none"]), [role="dialog"]:not([style*="display: none"])') || document.body;
        const newBtn = active.querySelector('button[data-action="new"], button[title*="Alt+N" i]');
        if (newBtn && !newBtn.disabled) {
          e.preventDefault();
          newBtn.click();
          return;
        }
      }

      // Alt+E: Edit Record
      if (e.altKey && e.key.toLowerCase() === 'e') {
        const active = document.querySelector('.classic-erp-window:not([style*="display: none"]), [role="dialog"]:not([style*="display: none"])') || document.body;
        const editBtn = active.querySelector('button[data-action="edit"], button[title*="Alt+E" i]');
        if (editBtn && !editBtn.disabled) {
          e.preventDefault();
          editBtn.click();
          return;
        }
      }

      // Alt+C: Cancel Operation
      if (e.altKey && e.key.toLowerCase() === 'c') {
        const active = document.querySelector('.classic-erp-window:not([style*="display: none"]), [role="dialog"]:not([style*="display: none"])') || document.body;
        const cancelBtn = active.querySelector('button[data-action="cancel"], button[title*="Cancel" i]');
        if (cancelBtn && !cancelBtn.disabled) {
          e.preventDefault();
          cancelBtn.click();
          return;
        }
      }

      // Alt+D: Delete Record
      if (e.altKey && e.key.toLowerCase() === 'd') {
        const active = document.querySelector('.classic-erp-window:not([style*="display: none"]), [role="dialog"]:not([style*="display: none"])') || document.body;
        const delBtn = active.querySelector('button[data-action="delete"], button[title*="Delete" i]');
        if (delBtn && !delBtn.disabled) {
          e.preventDefault();
          delBtn.click();
          return;
        }
      }

      // Alt+X: Exit Modal
      if (e.altKey && e.key.toLowerCase() === 'x') {
        const active = document.querySelector('.classic-erp-window:not([style*="display: none"]), [role="dialog"]:not([style*="display: none"])') || document.body;
        const exitBtn = active.querySelector('button[data-action="exit"], .classic-erp-close-btn');
        if (exitBtn) {
          e.preventDefault();
          exitBtn.click();
          return;
        }
      }

      // Ctrl+Enter / Cmd+Enter: Save Form
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        const saveBtn = findEnterSaveButton(findFormContainer(e.target));
        if (saveBtn) {
          e.preventDefault();
          saveBtn.click();
        }
        return;
      }

      // Alt+S: Save Form
      if (e.altKey && e.key.toLowerCase() === 's') {
        const saveBtn = findEnterSaveButton(findFormContainer(e.target));
        if (saveBtn) {
          e.preventDefault();
          saveBtn.click();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [enabled]);
}

export default useFormEnterNavigation;
