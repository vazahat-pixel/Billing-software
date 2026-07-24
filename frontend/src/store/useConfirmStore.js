import { create } from 'zustand';

let confirmSeq = 0;

const useConfirmStore = create((set, get) => ({
  dialog: null,

  open: (options) =>
    new Promise((resolve) => {
      const id = ++confirmSeq;
      set({
        dialog: {
          id,
          title: options.title || 'Confirm',
          message: options.message || '',
          confirmLabel: options.confirmLabel || 'Confirm',
          cancelLabel: options.cancelLabel || 'Cancel',
          danger: !!options.danger,
          loading: false,
          resolve,
        },
      });
    }),

  setLoading: (loading) =>
    set((s) => (s.dialog ? { dialog: { ...s.dialog, loading } } : {})),

  close: (result) => {
    const { dialog } = get();
    if (dialog?.resolve) dialog.resolve(result);
    set({ dialog: null });
  },
}));

export default useConfirmStore;
