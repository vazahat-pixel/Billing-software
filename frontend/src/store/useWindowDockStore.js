import { create } from 'zustand';

/**
 * Global taskbar for minimized ERP windows (sales, purchase, mill, bank…).
 * Multiple bills can stay minimized and restore independently.
 */
const useWindowDockStore = create((set, get) => ({
  items: [],

  register: (item) => {
    if (!item?.id) return;
    set((s) => {
      const rest = s.items.filter((i) => i.id !== item.id);
      return { items: [...rest, item] };
    });
  },

  unregister: (id) => {
    if (!id) return;
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },

  clear: () => set({ items: [] }),

  getIndex: (id) => get().items.findIndex((i) => i.id === id),
}));

export default useWindowDockStore;

/** Broadcast: other maximized windows should minimize so a new one can open. */
export function yieldOtherWindows(exceptId) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('erp-window-yield', { detail: { except: exceptId || null } })
  );
}
