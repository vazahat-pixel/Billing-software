import { get, post, unwrap, asArray } from './http';

/** Cutting Entry / Beam Entry — /api/production/* */
export const cuttingBeamApi = {
  listCutting: (params) => unwrap(get('/production/cutting', params)).then((d) => asArray(d)),
  createCutting: (body) => unwrap(post('/production/cutting', body)),
  listBeam: (params) => unwrap(get('/production/beam', params)).then((d) => asArray(d)),
  createBeam: (body) => unwrap(post('/production/beam', body)),
};

export default cuttingBeamApi;
