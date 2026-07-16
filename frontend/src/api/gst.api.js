import { get, unwrap } from './http';
import { stage4Api } from './stage4.api';

export const gstApi = {
  gstr1: (params) => unwrap(get('/gst/gstr1', params)),
  gstr2: (params) => unwrap(get('/gst/gstr2', params)),
  caDashboard: (params) => unwrap(get('/gst/ca-dashboard', params)),
  gstr3b: (params) => unwrap(get('/gst/gstr3b', params)),
  hsnSummary: (params) => unwrap(get('/gst/hsn-summary', params)),
  dashboard: (params) => unwrap(get('/gst/dashboard', params)),
  config: () => unwrap(get('/gst/config')),
  /** Full Stage 4 compliance engine */
  stage4: stage4Api,
};

export { stage4Api };
export default gstApi;
