import { get, post, put, del, unwrap, asArray, paginationFrom } from './http';

export const itemsApi = {
  list: async (params) => {
    const env = await get('/items', params);
    return { items: asArray(env.data, ['items']), pagination: paginationFrom(env.meta, env.data) };
  },
  listRaw: (params) => unwrap(get('/items', params)).then((d) => asArray(d, ['items'])),
  search: (q) => unwrap(get('/items/search', { q })).then((d) => asArray(d, ['items'])),
  get: (id) => unwrap(get(`/items/${id}`)),
  create: (body) => unwrap(post('/items', body)),
  update: (id, body) => unwrap(put(`/items/${id}`, body)),
  remove: (id) => unwrap(del(`/items/${id}`)),
};

export default itemsApi;
