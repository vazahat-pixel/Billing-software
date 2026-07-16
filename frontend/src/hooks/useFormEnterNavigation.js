import { useEffect } from 'react';
import { handleFormEnterKeyDown } from '../utils/formEnterNavigation';

/**
 * Global Enter → next field navigation for ERP forms.
 * Scoped to inputs inside form containers (Modal, classic-erp-window, form, etc.).
 */
export function useFormEnterNavigation(enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = (e) => {
      handleFormEnterKeyDown(e);
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [enabled]);
}

export default useFormEnterNavigation;
