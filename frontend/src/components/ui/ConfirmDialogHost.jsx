import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import useConfirmStore from '../../store/useConfirmStore';

/**
 * Enterprise confirmation modal — replaces window.confirm().
 * Keyboard:
 * - ArrowLeft / ArrowRight / ArrowUp / ArrowDown: switch between No and Yes
 * - Tab / Shift+Tab: switch between No and Yes
 * - Enter / Space: confirm active button (Yes or No)
 * - Escape: cancel (No)
 * - Y / N: quick Yes / No shortcuts
 */
export default function ConfirmDialogHost() {
  const dialog = useConfirmStore((s) => s.dialog);
  const close = useConfirmStore((s) => s.close);
  const confirmRef = useRef(null);
  const cancelRef = useRef(null);
  const [activeBtn, setActiveBtn] = useState('confirm');

  // Sync initial selection & focus when dialog opens
  useEffect(() => {
    if (!dialog) return;
    const initial = dialog.defaultFocus === 'cancel' ? 'cancel' : 'confirm';
    setActiveBtn(initial);
    const t = setTimeout(() => {
      if (initial === 'confirm') {
        confirmRef.current?.focus();
      } else {
        cancelRef.current?.focus();
      }
    }, 40);
    return () => clearTimeout(t);
  }, [dialog]);

  // Global key navigation in capture phase so no underlying form / grid steals keys
  useEffect(() => {
    if (!dialog) return;

    const onKey = (e) => {
      if (dialog.loading) return;

      // Escape -> Cancel
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close(false);
        return;
      }

      // ArrowLeft -> Navigate to Cancel ("No")
      if (e.key === 'ArrowLeft' || e.key === 'Left') {
        e.preventDefault();
        e.stopPropagation();
        setActiveBtn('cancel');
        cancelRef.current?.focus();
        return;
      }

      // ArrowRight -> Navigate to Confirm ("Yes")
      if (e.key === 'ArrowRight' || e.key === 'Right') {
        e.preventDefault();
        e.stopPropagation();
        setActiveBtn('confirm');
        confirmRef.current?.focus();
        return;
      }

      // ArrowUp / ArrowDown -> Toggle between "No" and "Yes"
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setActiveBtn((prev) => {
          const next = prev === 'confirm' ? 'cancel' : 'confirm';
          if (next === 'confirm') {
            confirmRef.current?.focus();
          } else {
            cancelRef.current?.focus();
          }
          return next;
        });
        return;
      }

      // Tab / Shift+Tab -> Toggle between "No" and "Yes"
      if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        setActiveBtn((prev) => {
          const next = e.shiftKey
            ? (prev === 'confirm' ? 'cancel' : 'confirm')
            : (prev === 'cancel' ? 'confirm' : 'cancel');
          if (next === 'confirm') {
            confirmRef.current?.focus();
          } else {
            cancelRef.current?.focus();
          }
          return next;
        });
        return;
      }

      // Enter or Space -> Execute currently active button
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        if (activeBtn === 'cancel' || document.activeElement === cancelRef.current) {
          close(false);
        } else {
          close(true);
        }
        return;
      }

      // Shortcut Y -> Yes
      if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        e.stopPropagation();
        close(true);
        return;
      }

      // Shortcut N -> No
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        e.stopPropagation();
        close(false);
        return;
      }
    };

    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [dialog, activeBtn, close]);

  if (!dialog) return null;

  return (
    <div
      data-erp-confirm-dialog="true"
      className="fixed inset-0 z-[100000] flex items-center justify-center p-4 erp-modal-overlay animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="erp-confirm-title"
      tabIndex={-1}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !dialog.loading) close(false);
      }}
    >
      <div className="erp-modal-body w-full max-w-md p-0 overflow-hidden erp-motion-scale-in shadow-2xl rounded-lg border border-[var(--border-subtle)]">
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
        <div className="px-5 py-4 bg-white dark:bg-slate-900">
          <p className="text-[13px] leading-relaxed text-[var(--text-secondary)] font-medium">{dialog.message}</p>
        </div>
        <div className="flex justify-end items-center gap-3 px-4 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
          <button
            ref={cancelRef}
            type="button"
            disabled={dialog.loading}
            onMouseEnter={() => setActiveBtn('cancel')}
            onFocus={() => setActiveBtn('cancel')}
            className={`erp-btn h-8 px-5 text-[12px] font-semibold transition-all rounded disabled:opacity-50 select-none ${
              activeBtn === 'cancel'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-2 border-blue-600 ring-2 ring-blue-500/40 shadow-md scale-105'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-50'
            }`}
            onClick={() => close(false)}
          >
            {dialog.cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            disabled={dialog.loading}
            onMouseEnter={() => setActiveBtn('confirm')}
            onFocus={() => setActiveBtn('confirm')}
            className={`erp-btn h-8 px-5 text-[12px] font-semibold text-white transition-all rounded disabled:opacity-60 flex items-center gap-2 select-none ${
              dialog.danger
                ? activeBtn === 'confirm'
                  ? 'bg-red-600 border-2 border-red-700 ring-2 ring-red-400/50 shadow-md scale-105 hover:bg-red-700'
                  : 'bg-red-600/85 border border-red-700/50 hover:bg-red-600'
                : activeBtn === 'confirm'
                ? 'erp-btn-primary border-2 border-blue-700 ring-2 ring-blue-400/50 shadow-md scale-105'
                : 'erp-btn-primary opacity-80 hover:opacity-100'
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
