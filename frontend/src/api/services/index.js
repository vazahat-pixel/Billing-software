/**
 * @deprecated Import from `src/api` instead.
 * Thin re-export without circular barrel risks.
 */
export { authApi } from '../auth.api.js';
export { partiesApi } from '../party.api.js';
export { itemsApi } from '../item.api.js';
export { salesApi } from '../sales.api.js';
export { purchasesApi } from '../purchase.api.js';
export { inventoryApi } from '../inventory.api.js';
export { jobsApi } from '../jobwork.api.js';
export { accountingApi } from '../accounting.api.js';
export { gstApi } from '../gst.api.js';
export { reportsApi } from '../report.api.js';
export { booksApi, configApi } from '../masters.api.js';

import { authApi } from '../auth.api.js';
import { partiesApi } from '../party.api.js';
import { itemsApi } from '../item.api.js';
import { salesApi } from '../sales.api.js';
import { purchasesApi } from '../purchase.api.js';
import { inventoryApi } from '../inventory.api.js';
import { jobsApi } from '../jobwork.api.js';
import { accountingApi } from '../accounting.api.js';
import { gstApi } from '../gst.api.js';
import { reportsApi } from '../report.api.js';
import { booksApi, configApi } from '../masters.api.js';

export default {
  authApi,
  partiesApi,
  itemsApi,
  salesApi,
  purchasesApi,
  inventoryApi,
  jobsApi,
  accountingApi,
  gstApi,
  reportsApi,
  booksApi,
  configApi,
};
