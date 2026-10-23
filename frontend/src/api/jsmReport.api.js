import { get, unwrap } from './http';

export const jsmReportApi = {
  run: (reportId, params) => unwrap(get(`/reports/jsm/${reportId}`, { q: JSON.stringify(params) })),
  options: (reportId) => unwrap(get(`/reports/jsm/${reportId}/options`)),
};
