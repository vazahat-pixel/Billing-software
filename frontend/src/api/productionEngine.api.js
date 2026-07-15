import { get, post, unwrap, asArray } from './http';

/**
 * Sprint 2.4 Production & Job Work Engine
 */
export const productionEngineApi = {
  pipeline: () => unwrap(get('/production-engine/pipeline')),
  statusBoard: () => unwrap(get('/production-engine/board')),
  listJobs: (params) => unwrap(get('/production-engine/jobs', params)).then((d) => asArray(d)),
  listProcesses: () => unwrap(get('/production-engine/processes')).then((d) => asArray(d)),

  listChains: () => unwrap(get('/production-engine/chains')).then((d) => asArray(d)),
  createChain: (body) => unwrap(post('/production-engine/chains', body)),

  listMappings: (params) => unwrap(get('/production-engine/mappings', params)).then((d) => asArray(d)),
  resolveMapping: (params) => unwrap(get('/production-engine/mappings/resolve', params)),
  createMapping: (body) => unwrap(post('/production-engine/mappings', body)),

  issue: (body) => unwrap(post('/production-engine/issue', body)),
  receive: (body) => unwrap(post('/production-engine/receive', body)),
  advanceStep: (id, body) => unwrap(post(`/production-engine/jobs/${id}/advance`, body)),
  performQc: (id, body) => unwrap(post(`/production-engine/jobs/${id}/qc`, body)),
};

export default productionEngineApi;
