import { get, post, put, del, unwrap, asArray, paginationFrom } from './http';

export const partiesApi = {
  list: async (params) => {
    const env = await get('/parties', params);
    return { items: asArray(env.data, ['parties']), pagination: paginationFrom(env.meta, env.data) };
  },
  listRaw: (params) => unwrap(get('/parties', params)).then((d) => asArray(d, ['parties'])),
  search: (q) => unwrap(get('/parties/search', { q })).then((d) => asArray(d, ['parties'])),
  get: (id) => unwrap(get(`/parties/${id}`)),
  create: (body) => unwrap(post('/parties', body)),
  update: (id, body) => unwrap(put(`/parties/${id}`, body)),
  remove: (id) => unwrap(del(`/parties/${id}`)),
};

export default partiesApi;
