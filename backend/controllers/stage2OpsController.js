const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const documentEngineService = require('../services/documentEngineService');
const workflowEngineService = require('../services/workflowEngineService');
const { validateBusiness } = require('../services/validateBusinessService');
const certificationService = require('../services/certificationService');

const uid = (req) => req.user?._id || req.user?.id || null;

// ─── Documents (2.7) ─────────────────────────────────────────
exports.docPipeline = asyncHandler(async (req, res) => {
  return ok(res, await documentEngineService.pipeline(req.companyId));
});
exports.docSeed = asyncHandler(async (req, res) => {
  return ok(res, await documentEngineService.seedTemplates(req.companyId), 'Templates seeded');
});
exports.docListTemplates = asyncHandler(async (req, res) => {
  return ok(res, await documentEngineService.listTemplates(req.companyId));
});
exports.docPayload = asyncHandler(async (req, res) => {
  return ok(
    res,
    await documentEngineService.buildPayload(req.companyId, {
      docType: req.body.docType || req.query.docType,
      referenceId: req.body.referenceId || req.query.referenceId,
    })
  );
});
exports.docLabel = asyncHandler(async (req, res) => {
  return ok(res, await documentEngineService.buildLotLabel(req.companyId, req.params.id));
});
exports.docSend = asyncHandler(async (req, res) => {
  return ok(res, await documentEngineService.sendDocument(req.companyId, req.body), 'Queued');
});

// ─── Workflow (2.8) ──────────────────────────────────────────
exports.wfPipeline = asyncHandler(async (req, res) => {
  return ok(res, await workflowEngineService.pipeline(req.companyId));
});
exports.wfSeed = asyncHandler(async (req, res) => {
  return ok(res, await workflowEngineService.seedDefinitions(req.companyId), 'Workflows seeded');
});
exports.wfListDefs = asyncHandler(async (req, res) => {
  return ok(res, await workflowEngineService.listDefinitions(req.companyId));
});
exports.wfList = asyncHandler(async (req, res) => {
  return ok(res, await workflowEngineService.listInstances(req.companyId, { status: req.query.status }));
});
exports.wfStart = asyncHandler(async (req, res) => {
  return created(res, await workflowEngineService.startWorkflow(req.companyId, req.body, uid(req)));
});
exports.wfDecide = asyncHandler(async (req, res) => {
  return ok(
    res,
    await workflowEngineService.decide(req.companyId, req.params.id, req.body, uid(req)),
    req.body.approve === false ? 'Rejected' : 'Approved'
  );
});
exports.wfComment = asyncHandler(async (req, res) => {
  return ok(res, await workflowEngineService.addComment(req.companyId, req.params.id, req.body.text, uid(req)));
});
exports.wfEscalate = asyncHandler(async (req, res) => {
  return ok(res, await workflowEngineService.escalateOverdue(req.companyId), 'Escalation scan done');
});
exports.wfCreditCheck = asyncHandler(async (req, res) => {
  return ok(
    res,
    await workflowEngineService.checkCreditLimit(
      req.companyId,
      req.body.customerId,
      req.body.amount,
      uid(req)
    )
  );
});

// ─── Validation (2.9) ────────────────────────────────────────
exports.validate = asyncHandler(async (req, res) => {
  const result = await validateBusiness({
    module: req.body.module,
    action: req.body.action || 'create',
    companyId: req.companyId,
    payload: req.body.payload || req.body,
    options: req.body.options || {},
  });
  return ok(res, result, result.ok ? 'Valid' : 'Validation failed');
});

// ─── Certification (2.10) ────────────────────────────────────
exports.certRun = asyncHandler(async (req, res) => {
  return created(res, await certificationService.run(req.companyId, { triggeredBy: uid(req) }));
});
exports.certLatest = asyncHandler(async (req, res) => {
  return ok(res, await certificationService.latest(req.companyId));
});
exports.certList = asyncHandler(async (req, res) => {
  return ok(res, await certificationService.list(req.companyId));
});

/** Combined Stage 2 ops pipeline */
exports.stage2Pipeline = asyncHandler(async (req, res) => {
  const [docs, wf, cert] = await Promise.all([
    documentEngineService.pipeline(req.companyId),
    workflowEngineService.pipeline(req.companyId),
    certificationService.latest(req.companyId),
  ]);
  return ok(res, {
    documents: docs,
    workflow: wf,
    certification: cert
      ? { score: cert.score, passed: cert.passed, status: cert.status, gate: cert.gate }
      : null,
  });
});
