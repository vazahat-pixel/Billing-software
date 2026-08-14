import { fetchApi } from './index';

/**
 * Inventory API endpoints for fetching stock and lot details
 */
export const inventoryApi = {
  // Get all inventory lots with optional filters
  getInventory: async (companyId, filters = {}) => {
    const params = new URLSearchParams({ companyId, ...filters });
    return fetchApi(`/inventory?${params}`);
  },

  // Get lots for a specific item
  getLotsByItem: async (itemId, companyId) => {
    return fetchApi(`/inventory/lots?itemId=${itemId}&companyId=${companyId}`);
  },

  // Get detailed information about a specific lot
  getLotDetails: async (lotId, companyId) => {
    return fetchApi(`/inventory/lot/${lotId}?companyId=${companyId}`);
  },

  // Get total stock for an item across all lots
  getItemStock: async (itemId, companyId) => {
    return fetchApi(`/inventory/stock/${itemId}?companyId=${companyId}`);
  },

  // Get stock summary aggregated by item
  getStockSummary: async (companyId) => {
    return fetchApi(`/inventory/stock-summary?companyId=${companyId}`);
  },

  // Get inventory with warehouse grouping
  getInventoryByWarehouse: async (companyId, warehouseId = null) => {
    const params = new URLSearchParams({ companyId });
    if (warehouseId) params.append('warehouseId', warehouseId);
    return fetchApi(`/inventory?${params}`);
  },

  // Get stock location summary (where is material currently)
  getStockLocationSummary: async (companyId) => {
    return fetchApi(`/inventory/stock-locations?companyId=${companyId}`);
  },

  // Create opening stock
  createOpeningStock: async (data) => {
    return fetchApi('/inventory/opening-stock', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

export default inventoryApi;
