import React, { useEffect } from 'react';
import useToastStore from '../../store/useToastStore';

const TONE_CLASS = {
  success: 'bg-emerald-700 text-white border-emerald-800',
  error: 'bg-rose-700 text-white border-rose-800',
  warning: 'bg-amber-600 text-white border-amber-700',
  info: 'bg-slate-800 text-white border-slate-900',
};

/**
 * Global toast host — mount once under AppProviders.
 * Keeps existing ERP chrome; does not redesign layout.
 */
export default function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && toasts.length) {
        dismiss(toasts[toasts.length - 1].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toasts, dismiss]);

  if (!toasts.length) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[99999] flex flex-col gap-2 max-w-sm w-[min(100vw-2rem,24rem)] pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto border shadow-lg px-4 py-3 text-[12px] font-medium leading-snug rounded-md flex items-start gap-3 ${TONE_CLASS[t.tone] || TONE_CLASS.info}`}
          role="status"
        >
          <span className="flex-1">{t.message}</span>
          {t.undo && (
            <button
              type="button"
              className="shrink-0 underline opacity-90 hover:opacity-100 text-[11px] font-bold uppercase tracking-wide"
              onClick={() => {
                t.undo();
                dismiss(t.id);
              }}
            >
              Undo
            </button>
          )}
          <button
            type="button"
            className="shrink-0 opacity-80 hover:opacity-100 text-[14px] leading-none"
            aria-label="Dismiss"
            onClick={() => dismiss(t.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
