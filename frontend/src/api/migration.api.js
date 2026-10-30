import client from './client';
import { get, post, put, unwrap } from './http';

/** Old-software migration — /api/migration/* */
export const migrationApi = {
  createRun: (source = 'JSM') => unwrap(post('/migration/runs', { source })),
  uploadChunk: (id, index, bytes) => unwrap(put(`/migration/runs/${id}/chunk?index=${index}`, bytes, { headers: { 'Content-Type': 'application/octet-stream' }, timeout: 120000 })),
  complete: (id, bytes) => unwrap(post(`/migration/runs/${id}/complete`, { bytes })),
  getRun: (id) => unwrap(get(`/migration/runs/${id}`)),
  preview: (id, years) => unwrap(post(`/migration/runs/${id}/preview`, { years }, { timeout: 120000 })),
  apply: (id, years) => unwrap(post(`/migration/runs/${id}/apply`, { years })),
  reconcile: (id) => unwrap(post(`/migration/runs/${id}/reconcile`, {}, { timeout: 120000 })),
  undo: (id) => unwrap(post(`/migration/runs/${id}/undo`, {}, { timeout: 180000 })),
  reportCsv: async (id) => (await client.get(`/migration/runs/${id}/report.csv`, { responseType: 'blob' })).data,
};

export default migrationApi;
