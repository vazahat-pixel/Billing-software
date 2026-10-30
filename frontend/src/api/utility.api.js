import { get, unwrap } from './http';

/** System Utilities — /api/utilities/* */
export const utilityApi = {
  missingSeries: () => unwrap(get('/utilities/missing-series')),
  duplicateEntries: () => unwrap(get('/utilities/duplicate-entries', undefined, { timeout: 120000 })),
};

export default utilityApi;
