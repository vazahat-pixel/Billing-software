import { get, post, put, unwrap, asArray } from './http';

export const jobworkApi = {
  list: () => unwrap(get('/jobs')).then((d) => asArray(d, ['jobs'])),
  issue: (body) => unwrap(post('/jobs/issue', body)),
  receive: (body) => unwrap(post('/jobs/receive', body)),
  process: (body) => unwrap(put('/jobs/process', body)),
};

/** @deprecated alias */
export const jobsApi = jobworkApi;

export default jobworkApi;
