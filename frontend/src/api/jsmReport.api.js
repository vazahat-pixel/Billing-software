import { get, post, unwrap } from './http';

export const jsmReportApi = {
  run: (reportId, params) => unwrap(get(`/reports/jsm/${reportId}`, { q: JSON.stringify(params) })),
  runPost: (reportId, params) => unwrap(post(`/reports/jsm/${reportId}`, params)),
  options: (reportId) => unwrap(get(`/reports/jsm/${reportId}/options`)),
};
