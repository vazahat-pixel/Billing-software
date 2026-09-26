import { useEffect, useRef } from 'react';

const isTypingTarget = (el) => {
  if (!el) return false;
  const tag = String(el.tagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return !!el.closest?.('[data-erp-combobox], [data-command-palette], [data-book-selection-modal], [data-find-modal]');
};

/**
 * Same book keys on every ERP form:
 * F3 = Find, + / - = next / previous, Enter in View = New.
 */
export default function useErpBookKeys({
  isOpen,
  mode,
  readOnly,
  showFind = false,
  onFind,
  onNew,
  onPrev,
  onNext,
}) {
  const refs = useRef({ onFind, onNew, onPrev, onNext });
  refs.current = { onFind, onNew, onPrev, onNext };

  useEffect(() => {
    if (!isOpen || showFind) return undefined;
    const onKey = (e) => {
      if (e.key === 'F3' || (e.altKey && String(e.key || '').toLowerCase() === 'f')) {
        e.preventDefault();
        e.stopPropagation();
        refs.current.onFind?.();
        return;
      }
      const prevKey = e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract' || e.code === 'Minus';
      const nextKey = e.key === '+' || e.key === '=' || e.code === 'NumpadAdd' || e.code === 'Equal';
      if ((prevKey || nextKey) && !e.ctrlKey && !e.altKey && mode === 'View' && !readOnly) {
        if (isTypingTarget(e.target) && (e.target?.type === 'number' || e.target?.type === 'text')) {
          if (String(e.target.value || '').length && document.activeElement === e.target) {
            /* still walk bills in View — fields are locked */
          }
        }
        e.preventDefault();
        e.stopPropagation();
        if (prevKey) refs.current.onPrev?.();
        else refs.current.onNext?.();
        return;
      }
      if (mode !== 'View' || readOnly) return;
      if (e.key === 'Enter' && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
        if (e.target?.closest?.('[data-book-selection-modal], [data-command-palette], [data-find-modal]')) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        refs.current.onNew?.();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen, showFind, mode, readOnly]);
}
