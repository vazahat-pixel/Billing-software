#!/usr/bin/env node
/**
 * Stage 8.11 — CI quality gate aggregator.
 * Reads exit codes / flags from prior steps via env and blocks deploy if any critical suite failed.
 *
 * Env flags (set to "1" on failure):
 *   GATE_UNIT_FAILED, GATE_INTEGRATION_FAILED, GATE_SECURITY_FAILED,
 *   GATE_ISOLATION_FAILED, GATE_CERTIFICATION_FAILED, GATE_API_FAILED,
 *   GATE_PLATFORM_SCORE, GATE_PLATFORM_PASSED
 */
const qualityGates = require('../../services/certifiers/qualityGates');

const summary = {
  unitFailed: process.env.GATE_UNIT_FAILED === '1',
  integrationFailed: process.env.GATE_INTEGRATION_FAILED === '1',
  securityFailed: process.env.GATE_SECURITY_FAILED === '1',
  isolationFailed: process.env.GATE_ISOLATION_FAILED === '1',
  certificationFailed: process.env.GATE_CERTIFICATION_FAILED === '1',
  apiFailed: process.env.GATE_API_FAILED === '1',
  platformScore: process.env.GATE_PLATFORM_SCORE
    ? Number(process.env.GATE_PLATFORM_SCORE)
    : undefined,
  platformPassed: process.env.GATE_PLATFORM_PASSED === '0' ? false : process.env.GATE_PLATFORM_PASSED === '1' ? true : undefined,
};

const result = qualityGates.evaluateCi(summary);

console.log('=== Stage 8.11 Quality Gates ===');
console.log(JSON.stringify(result, null, 2));

if (!result.deployAllowed) {
  console.error('DEPLOY BLOCKED — certification gates failed.');
  process.exit(1);
}

console.log('DEPLOY ALLOWED — all critical certification gates passed.');
process.exit(0);
