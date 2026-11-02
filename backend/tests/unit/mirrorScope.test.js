'use strict';

/**
 * What a desktop mirrors is a security and correctness decision, so it is pinned here.
 *
 *  - Every company-scoped collection must be classified: mirrored both ways, mirrored down only,
 *    or deliberately left out. A new model fails this test until someone decides which.
 *  - Billing, plan and module-gate collections must never be accepted from a desktop.
 *  - The web lock blocks entries but never reports, settings, sign-in or sync.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const scope = require('../../services/replication/scope');
const { isLockedWrite } = require('../../middlewares/desktopOnlyLock');

/** Company-scoped collections that are deliberately NOT mirrored: logs, sessions, queues, sync bookkeeping. */
const NOT_MIRRORED = new Set([
  'auditlogs', 'automationrunlogs', 'backuprecords', 'certificationruns', 'communicationlogs',
  'configchangelogs', 'domain_events', 'idempotencyrecords', 'jobqueues', 'loginhistories',
  'migrationruns', 'notifications', 'number_range_leases', 'onboardingprogresses', 'paymentorders',
  'platformlogs', 'processed_operations', 'sync_device_state', 'sync_outbox', 'sync_state',
  'userproductivities', 'usersessions',
  // Plan usage metering is the cloud's billing record; a desktop must never be able to write it.
  'usages',
]);

function companyScopedCollections() {
  const dir = path.join(__dirname, '..', '..', 'models');
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.js')) {
      try { require(path.join(dir, f)); } catch { /* model with optional deps */ }
    }
  }
  return Object.values(mongoose.models)
    .filter((m) => m.schema.path('companyId'))
    .map((m) => m.collection.collectionName);
}

describe('mirrored collections', () => {
  it('every company-scoped collection is classified', () => {
    const unclassified = companyScopedCollections()
      .filter((c) => !scope.isMirrored(c) && !NOT_MIRRORED.has(c))
      .sort();
    assert.deepEqual(unclassified, [], `decide whether these are mirrored (services/replication/scope.js): ${unclassified.join(', ')}`);
  });

  it('no collection is in two lists', () => {
    for (const c of scope.BOTH) assert.equal(scope.isDown(c), false, `${c} is both "both" and "down"`);
    for (const c of NOT_MIRRORED) assert.equal(scope.isMirrored(c), false, `${c} is mirrored and excluded`);
  });

  it('billing, plans, module gates, users and the company row are never accepted from a desktop', () => {
    for (const c of ['subscriptions', 'licenses', 'plans', 'companymoduleconfigs', 'featureflags', 'users', 'companies', 'usages']) {
      assert.equal(scope.isBoth(c), false, `${c} must not be uploadable`);
    }
  });

  it('bill and voucher counters are mirrored, so numbering stays in step', () => {
    assert.equal(scope.isBoth('counters'), true);
  });
});

describe('scope filters', () => {
  const A = '64b000000000000000000001';
  const B = '64b000000000000000000002';

  it('scopes ordinary collections by companyId, matching ObjectId and legacy string ids', () => {
    const f = scope.scopeFilter('sales', [A]);
    const values = f.companyId.$in.map(String);
    assert.ok(values.includes(A));
    assert.equal(f.companyId.$in.length, 2, 'both the ObjectId and the string form');
  });

  it('scopes counters by the company id inside their _id', () => {
    const f = scope.scopeFilter('counters', [A, B]);
    const re = new RegExp(f._id.$regex);
    assert.ok(re.test(`BILLNO-sales-${A}`));
    assert.ok(re.test(`JV-26-27-${B}`));
    assert.ok(!re.test('BILLNO-sales-64b000000000000000000009'));
  });

  it('refuses an empty or malformed company list', () => {
    assert.throws(() => scope.scopeFilter('sales', []));
    assert.throws(() => scope.scopeFilter('sales', ['not-an-id']));
  });

  it('docInScope accepts this group\'s documents only', () => {
    assert.equal(scope.docInScope('sales', { _id: 1, companyId: A }, [A]), true);
    assert.equal(scope.docInScope('sales', { _id: 1, companyId: B }, [A]), false);
    assert.equal(scope.docInScope('sales', { _id: 1 }, [A]), false, 'no companyId = refused');
    assert.equal(scope.docInScope('counters', { _id: `BILLNO-x-${A}` }, [A]), true);
    assert.equal(scope.docInScope('counters', { _id: `BILLNO-x-${B}` }, [A]), false);
  });
});

describe('Desktop-only entries lock', () => {
  const blocked = [
    ['POST', '/sales'], ['PUT', '/sales/abc'], ['DELETE', '/sales/abc'],
    ['POST', '/purchases'], ['DELETE', '/purchases/abc'],
    ['POST', '/accounting/receipts'], ['POST', '/accounting/payments'], ['POST', '/accounting/journal'],
    ['POST', '/notes'], ['POST', '/returns'], ['POST', '/jobs/issue'], ['POST', '/parties'],
    ['PUT', '/items/abc'], ['POST', '/stage3/journals/contra'],
  ];
  const allowed = [
    ['GET', '/sales'], ['GET', '/accounting/trial-balance'],
    ['POST', '/accounting/reports/trial-balance'], ['POST', '/accounting/reports/balance-sheet'],
    ['POST', '/stage3/outstanding/credit-check'],
    ['PUT', '/config/settings'], ['POST', '/auth/login'], ['POST', '/sync/mirror/apply'], ['PUT', '/sync/mirror/lock'],
    ['POST', '/users'],
  ];

  for (const [m, p] of blocked) it(`blocks ${m} ${p}`, () => assert.equal(isLockedWrite(m, p), true));
  for (const [m, p] of allowed) it(`allows ${m} ${p}`, () => assert.equal(isLockedWrite(m, p), false));
});
