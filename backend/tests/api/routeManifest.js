/**
 * Critical API routes for QA coverage testing.
 */
module.exports = [
  { group: 'health', method: 'GET', path: '/health', auth: false },
  { group: 'auth', method: 'POST', path: '/api/auth/login', auth: false, body: true },
  { group: 'dashboard', method: 'GET', path: '/api/dashboard/summary', auth: true },
  { group: 'purchases', method: 'GET', path: '/api/purchases', auth: true, query: '?page=1&limit=5' },
  { group: 'sales', method: 'GET', path: '/api/sales', auth: true, query: '?page=1&limit=5' },
  { group: 'parties', method: 'GET', path: '/api/parties', auth: true, query: '?page=1&limit=5' },
  { group: 'items', method: 'GET', path: '/api/items', auth: true, query: '?page=1&limit=5' },
  { group: 'inventory', method: 'GET', path: '/api/inventory/lots', auth: true, query: '?page=1&limit=5' },
  { group: 'jobs', method: 'GET', path: '/api/jobs', auth: true },
  { group: 'accounting', method: 'GET', path: '/api/accounting/ledgers', auth: true },
  { group: 'gst', method: 'GET', path: '/api/gst/config', auth: true },
  { group: 'reports', method: 'GET', path: '/api/reports/bundle', auth: true },
  { group: 'warehouses', method: 'GET', path: '/api/warehouses', auth: true },
  { group: 'masters', method: 'GET', path: '/api/masters/export', auth: true },
  { group: 'users', method: 'GET', path: '/api/users', auth: true },
  { group: 'integrity', method: 'GET', path: '/api/integrity/reconcile', auth: true },
  { group: 'purchase-engine', method: 'GET', path: '/api/purchase-engine/pipeline', auth: true },
  { group: 'sales-engine', method: 'GET', path: '/api/sales-engine/pipeline', auth: true },
  { group: 'inventory-engine', method: 'GET', path: '/api/inventory-engine/pipeline', auth: true },
  { group: 'production-engine', method: 'GET', path: '/api/production-engine/pipeline', auth: true },
];
