import { create } from 'zustand';
import { parseApiError } from '../utils/errors';

/**
 * Global toast queue — enterprise notifications (success/error/warning/info/loading).
 */
let toastSeq = 0;

const useToastStore = create((set, get) => ({
  toasts: [],

  push: (tone, message, options = {}) => {
    const id = options.id || ++toastSeq;
    const toast = {
      id,
      tone: tone || 'info',
      message: String(message || ''),
      duration: options.duration ?? (tone === 'error' ? 6000 : tone === 'loading' ? 0 : 3500),
      undo: options.undo || null,
      action: options.action || null,
      progress: options.progress ?? null,
      icon: options.icon ?? null,
      persistent: options.persistent ?? tone === 'loading',
    };
    set((s) => {
      const filtered = options.replaceId
        ? s.toasts.filter((t) => t.id !== options.replaceId)
        : s.toasts;
      return { toasts: [...filtered, toast].slice(-8) };
    });
    if (toast.duration > 0) {
      setTimeout(() => get().dismiss(id), toast.duration);
    }
    return id;
  },

  update: (id, patch) =>
    set((s) => ({
      toasts: s.toasts.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

/** Accept string OR Error/API object — always show user-friendly text for errors */
const resolveErrorMessage = (msg, fallback) => {
  if (msg == null || msg === '') return fallback || 'Something went wrong. Please try again.';
  if (typeof msg === 'object') return parseApiError(msg, fallback);
  return parseApiError({ message: String(msg) }, fallback || String(msg));
};

export const toast = {
  success: (msg, opts) => useToastStore.getState().push('success', msg, opts),
  error: (msg, opts) =>
    useToastStore.getState().push('error', resolveErrorMessage(msg, opts?.fallback), opts),
  warning: (msg, opts) => useToastStore.getState().push('warning', msg, opts),
  info: (msg, opts) => useToastStore.getState().push('info', msg, opts),
  loading: (msg, opts) => useToastStore.getState().push('loading', msg, { ...opts, duration: 0 }),
  progress: (msg, progress, opts) =>
    useToastStore.getState().push('info', msg, { ...opts, progress, duration: 0 }),
  dismiss: (id) => useToastStore.getState().dismiss(id),
  update: (id, patch) => useToastStore.getState().update(id, patch),
  unavailable: (featureName) =>
    useToastStore.getState().push(
      'warning',
      `${featureName || 'This feature'} is not available yet. Coming in a later sprint.`
    ),
};

export default useToastStore;
