import { create } from 'zustand';

/**
 * Global toast queue — single source for success/error/warning/info.
 * Replace browser alert() throughout the ERP UI.
 */
let toastSeq = 0;

const useToastStore = create((set, get) => ({
  toasts: [],

  push: (tone, message, options = {}) => {
    const id = ++toastSeq;
    const toast = {
      id,
      tone: tone || 'info',
      message: String(message || ''),
      duration: options.duration ?? (tone === 'error' ? 6000 : 3500),
      undo: options.undo || null,
    };
    set((s) => ({ toasts: [...s.toasts, toast].slice(-8) }));
    if (toast.duration > 0) {
      setTimeout(() => get().dismiss(id), toast.duration);
    }
    return id;
  },

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

export const toast = {
  success: (msg, opts) => useToastStore.getState().push('success', msg, opts),
  error: (msg, opts) => useToastStore.getState().push('error', msg, opts),
  warning: (msg, opts) => useToastStore.getState().push('warning', msg, opts),
  info: (msg, opts) => useToastStore.getState().push('info', msg, opts),
  /** Honest stub for features not yet backend-backed — never fake success */
  unavailable: (featureName) =>
    useToastStore.getState().push(
      'warning',
      `${featureName || 'This feature'} is not available yet. Coming in a later sprint.`
    ),
};

export default useToastStore;
