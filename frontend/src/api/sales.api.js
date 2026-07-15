import { get, post, put, del, unwrap, asArray, paginationFrom } from './http';

export const salesApi = {
  list: async (params) => {
    const env = await get('/sales', params);
    const items = asArray(env.data, ['sales']);
    return { items, pagination: paginationFrom(env.meta, env.data) };
  },
  listRaw: (params) => unwrap(get('/sales', params)).then((d) => asArray(d, ['sales'])),
  get: (id) => unwrap(get(`/sales/${id}`)),
  create: (body) => unwrap(post('/sales', body)),
  update: (id, body) => unwrap(put(`/sales/${id}`, body)),
  updateStatus: (id, status) => unwrap(put(`/sales/${id}/status`, { status })),
  remove: (id) => unwrap(del(`/sales/${id}`)),
};

export default salesApi;
