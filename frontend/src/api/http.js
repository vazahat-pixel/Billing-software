/**
 * Shared HTTP helpers for API modules.
 * Always extract `data` from standard envelope; preserve pagination meta.
 */
import client from './client';

export const http = client;

/** Full envelope: { success, message, data, meta, errors } */
export async function request(method, url, { params, data, config } = {}) {
  const res = await client.request({
    method,
    url,
    params,
    data,
    ...config,
  });
  const body = res.data || {};
  return {
    success: body.success !== false,
    message: body.message || '',
    data: body.data !== undefined ? body.data : body,
    meta: body.meta || body.pagination ? { ...(body.meta || {}), pagination: body.meta?.pagination || body.pagination } : {},
    errors: body.errors || [],
    raw: body,
    status: res.status,
  };
}

export const get = (url, params, config) => request('get', url, { params, config });
export const post = (url, data, config) => request('post', url, { data, config });
export const put = (url, data, config) => request('put', url, { data, config });
export const del = (url, config) => request('delete', url, { config });

/** Unwrap data only (most store actions) */
export const unwrap = async (promise) => {
  const env = await promise;
  return env.data;
};

/**
 * Normalize list payloads:
 * - array
 * - { sales|purchases|items|parties|data: [] }
 * - envelope already unwrapped
 */
export const asArray = (data, preferredKeys = []) => {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  for (const k of preferredKeys) {
    if (Array.isArray(data[k])) return data[k];
  }
  for (const k of ['data', 'items', 'rows', 'results', 'list']) {
    if (Array.isArray(data[k])) return data[k];
  }
  return [];
};

export const paginationFrom = (meta = {}, data = {}) => {
  const p = meta.pagination || data.pagination || {};
  const page = Number(p.page || data.page || 1);
  const limit = Number(p.limit || data.limit || 100);
  const total = Number(p.total ?? data.total ?? 0);
  return {
    page,
    limit,
    total,
    totalPages: p.totalPages || Math.max(1, Math.ceil(total / (limit || 1))),
  };
};
