import React, { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import useConfirmStore from '../../store/useConfirmStore';

/**
 * Enterprise confirmation modal — replaces window.confirm().
 * Keyboard: Escape = cancel, Enter = confirm (when not loading).
 */
export default function ConfirmDialogHost() {
  const dialog = useConfirmStore((s) => s.dialog);
  const close = useConfirmStore((s) => s.close);
  const confirmRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!dialog) return;
    const t = setTimeout(() => {
      (dialog.danger ? cancelRef : confirmRef).current?.focus();
    }, 40);
    return () => clearTimeout(t);
  }, [dialog]);

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !dialog.loading) {
        e.preventDefault();
        close(false);
      }
      if (e.key === 'Enter' && !dialog.loading) {
        e.preventDefault();
        close(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, close]);

  if (!dialog) return null;

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center p-4 erp-modal-overlay animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="erp-confirm-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !dialog.loading) close(false);
      }}
    >
      <div className="erp-modal-body w-full max-w-md p-0 overflow-hidden erp-motion-scale-in">
        <div
          className={`px-4 py-3 text-[13px] font-semibold border-b border-[var(--border-subtle)] ${
            dialog.danger
              ? 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]'
              : 'bg-[var(--bg-subtle)] text-[var(--text-primary)]'
          }`}
          id="erp-confirm-title"
        >
          {dialog.title}
        </div>
        <div className="px-4 py-4">
          <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">{dialog.message}</p>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
          <button
            ref={cancelRef}
            type="button"
            disabled={dialog.loading}
            className="erp-btn erp-btn-secondary h-8 px-4 text-[11px] disabled:opacity-50"
            onClick={() => close(false)}
          >
            {dialog.cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            disabled={dialog.loading}
            className={`erp-btn h-8 px-4 text-[11px] text-white disabled:opacity-60 flex items-center gap-2 ${
              dialog.danger ? 'bg-[var(--color-danger)] hover:opacity-90' : 'erp-btn-primary'
            }`}
            onClick={() => close(true)}
          >
            {dialog.loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
