import { create } from 'zustand';

export const useAppStore = create((set) => ({
  isSidebarOpen: true,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  
  globalSearch: '',
  setGlobalSearch: (search) => set({ globalSearch: search }),
  
  notifications: [
    { id: 1, title: 'Low Stock Alert', desc: 'Cotton Blue 40s is below 50m', time: '2h ago', type: 'warning' },
    { id: 2, title: 'Purchase Order #501', desc: 'Received from Suresh Fabrics', time: '5h ago', type: 'success' },
  ],
  
  // Real ERP data state (Simulated)
  parties: [
    { id: 'P001', name: 'Suresh Fabrics', type: 'Supplier', mobile: '9876543210', email: 'suresh@fab.com', gstin: '24AAAAA0000A1Z5', address: 'Surat, Gujarat', balance: 45000 },
    { id: 'P002', name: 'Om Textiles', type: 'Both', mobile: '9123456789', email: 'om@textiles.com', gstin: '24BBBBB1111B1Z6', address: 'Ahmedabad, Gujarat', balance: -12500 },
  ],
  
  items: [
    { id: 'I001', name: 'Cotton 40s', category: 'Fabric', design: 'Plain', color: 'Blue', unit: 'MTR', gst: 5 },
    { id: 'I002', name: 'Silk Mix', category: 'Fabric', design: 'Floral', color: 'Red', unit: 'PCS', gst: 12 },
  ],
  
  lots: [
    { id: 'LOT-501', item: 'Cotton 40s', initialMtrs: 1200, currentMtrs: 450, status: 'In Process', stage: 'Printing' },
    { id: 'LOT-505', item: 'Silk Mix', initialMtrs: 800, currentMtrs: 800, status: 'Raw', stage: 'Raw' },
  ],
}));
