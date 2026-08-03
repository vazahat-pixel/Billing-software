import { get, unwrap } from './http';

/** System Utilities — /api/utilities/* */
export const utilityApi = {
  missingSeries: () => unwrap(get('/utilities/missing-series')),
};

export default utilityApi;
