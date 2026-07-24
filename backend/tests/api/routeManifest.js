/**
 * Expanded critical + transactional API route manifest for Stage 8.11 certification.
 * Target: 100% transactional endpoint group coverage.
 */
module.exports = [
  // Health & auth
  { group: 'health', method: 'GET', path: '/health', auth: false },
  { group: 'auth', method: 'POST', path: '/api/auth/login', auth: false, body: true },
  { group: 'auth', method: 'POST', path: '/api/auth/register', auth: false, body: true },
  { group: 'auth', method: 'GET', path: '/api/auth/me', auth: true },

  // Dashboard & masters
  { group: 'dashboard', method: 'GET', path: '/api/dashboard/summary', auth: true },
  { group: 'parties', method: 'GET', path: '/api/parties', auth: true, query: '?page=1&limit=5' },
  { group: 'parties', method: 'POST', path: '/api/parties', auth: true, body: true, transactional: true },
  { group: 'items', method: 'GET', path: '/api/items', auth: true, query: '?page=1&limit=5' },
  { group: 'items', method: 'POST', path: '/api/items', auth: true, body: true, transactional: true },
  { group: 'masters', method: 'GET', path: '/api/masters/export', auth: true },
  { group: 'warehouses', method: 'GET', path: '/api/warehouses', auth: true },
  { group: 'books', method: 'GET', path: '/api/books', auth: true },
  { group: 'users', method: 'GET', path: '/api/users', auth: true },

  // Sales
  { group: 'sales', method: 'GET', path: '/api/sales', auth: true, query: '?page=1&limit=5' },
  { group: 'sales', method: 'POST', path: '/api/sales', auth: true, body: true, transactional: true },
  { group: 'sales', method: 'GET', path: '/api/sales-engine/pipeline', auth: true },

  // Purchase
  { group: 'purchases', method: 'GET', path: '/api/purchases', auth: true, query: '?page=1&limit=5' },
  { group: 'purchases', method: 'POST', path: '/api/purchases', auth: true, body: true, transactional: true },
  { group: 'purchases', method: 'GET', path: '/api/purchase-engine/pipeline', auth: true },

  // Inventory
  { group: 'inventory', method: 'GET', path: '/api/inventory/lots', auth: true, query: '?page=1&limit=5' },
  { group: 'inventory', method: 'GET', path: '/api/inventory-engine/pipeline', auth: true },
  { group: 'inventory', method: 'GET', path: '/api/inventory/stock-summary', auth: true },

  // Job / production
  { group: 'jobs', method: 'GET', path: '/api/jobs', auth: true },
  { group: 'jobs', method: 'GET', path: '/api/production-engine/pipeline', auth: true },

  // Returns & notes
  { group: 'returns', method: 'GET', path: '/api/returns', auth: true },
  { group: 'notes', method: 'GET', path: '/api/notes', auth: true },
  { group: 'orders', method: 'GET', path: '/api/orders', auth: true },

  // Accounting
  { group: 'accounting', method: 'GET', path: '/api/accounting/ledgers', auth: true },
  { group: 'accounting', method: 'GET', path: '/api/accounting/entries', auth: true },
  { group: 'accounting', method: 'GET', path: '/api/accounting/trial-balance', auth: true },
  { group: 'accounting', method: 'GET', path: '/api/accounting/profit-loss', auth: true },
  { group: 'accounting', method: 'GET', path: '/api/accounting/balance-sheet', auth: true },
  { group: 'payments', method: 'GET', path: '/api/accounting/payments', auth: true },

  // GST
  { group: 'gst', method: 'GET', path: '/api/gst/config', auth: true },
  { group: 'gst', method: 'GET', path: '/api/gst/gstr1', auth: true },
  { group: 'gst', method: 'GET', path: '/api/gst/gstr3b', auth: true },
  { group: 'gst', method: 'GET', path: '/api/gst/hsn-summary', auth: true },

  // Reports & integrity
  { group: 'reports', method: 'GET', path: '/api/reports/bundle', auth: true },
  { group: 'reports', method: 'GET', path: '/api/reports/sales', auth: true },
  { group: 'reports', method: 'GET', path: '/api/reports/purchase', auth: true },
  { group: 'reports', method: 'GET', path: '/api/reports/stock', auth: true },
  { group: 'integrity', method: 'GET', path: '/api/integrity/reconcile', auth: true },

  // Stage 8 commercial / testing platform
  { group: 'stage8', method: 'GET', path: '/api/stage8/overview', auth: true },
  { group: 'stage8', method: 'GET', path: '/api/stage8/flows/certify', auth: true },
  { group: 'stage8', method: 'GET', path: '/api/stage8/testing/catalog', auth: true },
  { group: 'stage8', method: 'GET', path: '/api/stage8/testing/dashboard', auth: true },
  { group: 'stage8', method: 'POST', path: '/api/stage8/testing/certify', auth: true, body: true, transactional: true },
];
