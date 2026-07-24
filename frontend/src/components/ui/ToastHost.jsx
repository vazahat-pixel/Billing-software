import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, Loader2, X } from 'lucide-react';
import useToastStore from '../../store/useToastStore';
import { ProgressBar } from './loaders';

const TONE_STYLE = {
  success: {
    bar: 'bg-[var(--color-success)]',
    bg: 'bg-[var(--color-success-bg)] border-[var(--color-success)]/25 text-[var(--text-primary)]',
    icon: CheckCircle2,
    iconClass: 'text-[var(--color-success)]',
  },
  error: {
    bar: 'bg-[var(--color-danger)]',
    bg: 'bg-[var(--color-danger-bg)] border-[var(--color-danger)]/25 text-[var(--text-primary)]',
    icon: AlertCircle,
    iconClass: 'text-[var(--color-danger)]',
  },
  warning: {
    bar: 'bg-[var(--color-warning)]',
    bg: 'bg-[var(--color-warning-bg)] border-[var(--color-warning)]/25 text-[var(--text-primary)]',
    icon: AlertTriangle,
    iconClass: 'text-[var(--color-warning)]',
  },
  info: {
    bar: 'bg-[var(--color-info)]',
    bg: 'bg-[var(--color-info-bg)] border-[var(--color-info)]/25 text-[var(--text-primary)]',
    icon: Info,
    iconClass: 'text-[var(--color-info)]',
  },
  loading: {
    bar: 'bg-[var(--color-primary)]',
    bg: 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-primary)]',
    icon: Loader2,
    iconClass: 'text-[var(--color-primary)] animate-spin',
  },
};

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
      {toasts.map((t) => {
        const style = TONE_STYLE[t.tone] || TONE_STYLE.info;
        const Icon = style.icon;
        return (
          <div
            key={t.id}
            className={`pointer-events-auto border shadow-[var(--shadow-lg)] rounded-lg overflow-hidden erp-toast-enter ${style.bg}`}
            role="status"
          >
            <div className={`h-0.5 w-full ${style.bar}`} />
            <div className="px-3 py-2.5 flex items-start gap-2.5">
              <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${style.iconClass}`} aria-hidden />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium leading-snug">{t.message}</p>
                {t.progress != null && (
                  <div className="mt-2">
                    <ProgressBar value={t.progress} />
                  </div>
                )}
                {(t.undo || t.action) && (
                  <div className="flex gap-3 mt-2">
                    {t.undo && (
                      <button
                        type="button"
                        className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-primary)] hover:underline"
                        onClick={() => {
                          t.undo();
                          dismiss(t.id);
                        }}
                      >
                        Undo
                      </button>
                    )}
                    {t.action && (
                      <button
                        type="button"
                        className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-primary)] hover:underline"
                        onClick={() => {
                          t.action.onClick?.();
                          if (t.action.dismiss !== false) dismiss(t.id);
                        }}
                      >
                        {t.action.label || 'Action'}
                      </button>
                    )}
                  </div>
                )}
              </div>
              {!t.persistent && (
                <button
                  type="button"
                  className="shrink-0 p-0.5 rounded opacity-60 hover:opacity-100 text-[var(--text-muted)] erp-focus-ring"
                  aria-label="Dismiss"
                  onClick={() => dismiss(t.id)}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
