/**
 * Shared domain enums / statuses — replace magic strings gradually.
 */
module.exports = {
  VOUCHER_TYPES: ['Payment', 'Receipt', 'Journal', 'SalesAuto', 'PurchaseAuto', 'JobWorkAuto', 'WastageAuto', 'ReturnAuto', 'NoteAuto'],
  SALE_STATUS: ['active', 'cancelled', 'paid', 'partial'],
  PURCHASE_STATUS: ['active', 'cancelled', 'paid', 'partial'],
  JOB_STATUS: ['Issued', 'In-Process', 'Received', 'Cancelled'],
  LOT_SOURCE: ['purchase', 'opening', 'jobwork', 'job_receive', 'return'],
  STOCK_MOVEMENT_TYPES: ['PURCHASE', 'ISSUE', 'RECEIVE', 'SALE', 'ADJUSTMENT', 'OPENING', 'RETURN'],
  PARTY_TYPES: ['Customer', 'Supplier', 'Both', 'Broker', 'Job Worker'],
  ITEM_CATEGORIES: ['Grey', 'Finished', 'Yarn', 'Others'],
  COMPANY_ROLES: ['owner', 'admin', 'manager', 'accountant', 'salesman', 'sales', 'viewer'],
};
