import { get, unwrap } from './http';

export const gstApi = {
  gstr1: (params) => unwrap(get('/gst/gstr1', params)),
  gstr2: (params) => unwrap(get('/gst/gstr2', params)),
  caDashboard: (params) => unwrap(get('/gst/ca-dashboard', params)),
};

export default gstApi;
