import { useEffect } from 'react';
import { handleFormEnterKeyDown, findFormContainer } from '../utils/formEnterNavigation';

/**
 * Global ERP keyboard: Enter→next field, Ctrl+Enter / Alt+S → Save.
 */
export function useFormEnterNavigation(enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        handleFormEnterKeyDown(e);
        return;
      }

      if (e.key === 'Enter' && e.shiftKey && e.target?.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        const container = findFormContainer(e.target);
        if (!container) return;
        const saveBtn =
          container.querySelector('[data-enter-save]') ||
          container.querySelector('.classic-erp-form-footer button.btn-blue:not([disabled])');
        if (saveBtn) {
          e.preventDefault();
          saveBtn.click();
        }
        return;
      }

      if (e.altKey && e.key.toLowerCase() === 's') {
        const container = findFormContainer(e.target);
        const saveBtn = container?.querySelector('.classic-erp-form-footer button.btn-blue:not([disabled])');
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
