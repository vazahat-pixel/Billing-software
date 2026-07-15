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
}));

export default useUiStore;
