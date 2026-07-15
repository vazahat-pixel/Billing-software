import { get, post, unwrap, asArray } from './http';

/** Stage 2 ops — Documents · Workflow · Validation · Certification (2.7–2.10) */
export const stage2OpsApi = {
  pipeline: () => unwrap(get('/stage2/pipeline')),

  // Documents
  docPipeline: () => unwrap(get('/stage2/documents/pipeline')),
  seedDocuments: () => unwrap(post('/stage2/documents/seed')),
  listTemplates: () => unwrap(get('/stage2/documents/templates')).then((d) => asArray(d)),
  docPayload: (body) => unwrap(post('/stage2/documents/payload', body)),
  lotLabel: (id) => unwrap(get(`/stage2/documents/labels/${id}`)),
  sendDocument: (body) => unwrap(post('/stage2/documents/send', body)),

  // Workflow
  wfPipeline: () => unwrap(get('/stage2/workflow/pipeline')),
  seedWorkflow: () => unwrap(post('/stage2/workflow/seed')),
  listDefinitions: () => unwrap(get('/stage2/workflow/definitions')).then((d) => asArray(d)),
  listInstances: (params) => unwrap(get('/stage2/workflow/instances', params)).then((d) => asArray(d)),
  startWorkflow: (body) => unwrap(post('/stage2/workflow/start', body)),
  decideWorkflow: (id, body) => unwrap(post(`/stage2/workflow/${id}/decide`, body)),
  commentWorkflow: (id, text) => unwrap(post(`/stage2/workflow/${id}/comments`, { text })),
  escalate: () => unwrap(post('/stage2/workflow/escalate')),
  creditCheck: (body) => unwrap(post('/stage2/workflow/credit-check', body)),

  // Validation
  validate: (body) => unwrap(post('/stage2/validate', body)),

  // Certification
  runCertification: () => unwrap(post('/stage2/certification/run')),
  latestCertification: () => unwrap(get('/stage2/certification/latest')),
  listCertifications: () => unwrap(get('/stage2/certification')).then((d) => asArray(d)),
};

export default stage2OpsApi;
