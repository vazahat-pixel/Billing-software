import { create } from 'zustand';

/**
 * UI chrome state only — never business entities.
 */
const useUiStore = create((set) => ({
  commandPaletteOpen: false,
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),

  globalSearchQuery: '',
  setGlobalSearchQuery: (q) => set({ globalSearchQuery: String(q || '') }),

  notificationCenterOpen: false,
  openNotificationCenter: () => set({ notificationCenterOpen: true }),
  closeNotificationCenter: () => set({ notificationCenterOpen: false }),
  toggleNotificationCenter: () =>
    set((s) => ({ notificationCenterOpen: !s.notificationCenterOpen })),
  notificationUnread: 0,
  setNotificationUnread: (n) => set({ notificationUnread: Number(n) || 0 }),
}));

export default useUiStore;
