import { get, post, put, del, unwrap, asArray, paginationFrom, http } from './http';

export const purchasesApi = {
  list: async (params) => {
    const env = await get('/purchases', params);
    const items = asArray(env.data, ['purchases']);
    return { items, pagination: paginationFrom(env.meta, env.data) };
  },
  listRaw: (params) =>
    unwrap(get('/purchases', params)).then((d) => asArray(d, ['purchases'])),
  get: (id) => unwrap(get(`/purchases/${id}`)),
  create: (body) => unwrap(post('/purchases', body)),
  /** Intended REST update — backend currently exposes status-only; gap tracked in Sprint 1.3 report. */
  update: (id, body) => unwrap(put(`/purchases/${id}`, body)),
  updateStatus: (id, status) => unwrap(put(`/purchases/${id}/status`, { status })),
  remove: (id) => unwrap(del(`/purchases/${id}`)),
  /**
   * Parse supplier bill (PDF/photo or pasted text) on server for accurate OCR + master matching.
   * @param {{ file?: File, text?: string }} opts
   */
  parseBill: async ({ file, text } = {}) => {
    const form = new FormData();
    if (file) form.append('bill', file);
    if (text) form.append('text', text);
    try {
      const res = await http.request({
        method: 'post',
        url: '/purchases/parse-bill',
        data: form,
        timeout: 180000,
        maxContentLength: 20 * 1024 * 1024,
        maxBodyLength: 20 * 1024 * 1024,
        transformRequest: [
          (data, headers) => {
            // Drop default JSON content-type so browser sets multipart boundary
            if (headers && typeof headers === 'object') {
              delete headers['Content-Type'];
              delete headers['content-type'];
            }
            return data;
          },
        ],
      });
      const body = res.data || {};
      if (body.success === false) {
        const err = new Error(body.message || 'Bill parse failed');
        err.draft = body.errors?.[0]?.draft || body.data;
        throw err;
      }
      return body.data !== undefined ? body.data : body;
    } catch (e) {
      const body = e?.response?.data;
      if (body?.message) {
        const err = new Error(body.message);
        err.draft = body.errors?.[0]?.draft || body.data;
        err.response = e.response;
        throw err;
      }
      throw e;
    }
  },
};

export default purchasesApi;
