import { get, post, unwrap } from './http';

/** TDS / TCS Engine — /api/tds/* */
export const tdsApi = {
  sections: () => unwrap(get('/tds/sections')),
  list: (params) => unwrap(get('/tds', params)),
  report: (params) => unwrap(get('/tds/report', params)),
  postTds: (body) => unwrap(post('/tds', body)),
  postTcs: (body) => unwrap(post('/tds/tcs', body)),
  issueCertificate: (id) => unwrap(post(`/tds/${id}/certificate`)),
};

export default tdsApi;
