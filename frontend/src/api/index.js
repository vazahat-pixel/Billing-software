/**
 * Canonical API barrel — pages/stores import from here, never axios.
 */
export { default as client, onApiLoadingChange } from './client';
export * from './http';

export { authApi } from './auth.api';
export { partiesApi } from './party.api';
export { itemsApi } from './item.api';
export { purchasesApi } from './purchase.api';
export { salesApi } from './sales.api';
export { purchaseEngineApi } from './purchaseEngine.api';
export { inventoryApi } from './inventory.api';
export { inventoryEngineApi } from './inventoryEngine.api';
export { productionEngineApi } from './productionEngine.api';
export { salesEngineApi } from './salesEngine.api';
export { businessAutomationApi } from './businessAutomation.api';
export { stage2OpsApi } from './stage2Ops.api';
export { jobworkApi, jobsApi } from './jobwork.api';
export { accountingApi, ledgerApi } from './accounting.api';
export { gstApi } from './gst.api';
export { reportApi, reportsApi } from './report.api';
export { dashboardApi } from './dashboard.api';
export { adminApi, subscriptionApi } from './admin.api';
export {
  booksApi,
  configApi,
  usersApi,
  visitsApi,
  ordersApi,
  returnsApi,
  notesApi,
  subMastersApi,
  warehousesApi,
  masterDataApi,
} from './masters.api';

// Backward-compatible alias used by Sprint 1.1
export { default as services } from './services/index.js';
