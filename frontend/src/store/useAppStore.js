/**
 * @deprecated Dead mock store — intentionally emptied in Sprint 1.1.
 * Use useStore (ERP data) + useConfigStore (session config) + useUiStore (chrome).
 * This file remains only so accidental imports don't crash the build.
 */
import { create } from 'zustand';

export const useAppStore = create(() => ({
  _deprecated: true,
  isSidebarOpen: false,
  toggleSidebar: () => {},
  globalSearch: '',
  setGlobalSearch: () => {},
  notifications: [],
  parties: [],
  items: [],
  lots: [],
}));

export default useAppStore;
