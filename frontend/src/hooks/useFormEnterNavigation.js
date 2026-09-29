import { useEffect } from 'react';
import {
  handleFormEnterKeyDown,
  handleFormArrowKeyDown,
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
