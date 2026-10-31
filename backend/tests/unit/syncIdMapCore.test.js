'use strict';

/**
 * A hybrid desktop's local ids are real ObjectIds, and the cloud mints its own id when it applies a
 * pushed create. So everything replayed afterwards has to be rewritten, and an operation that still
 * points at something the cloud has not seen must wait instead of being sent and failing.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../../services/syncIdMapCore');

const LOCAL_PARTY = 'aaaaaaaaaaaaaaaaaaaaaaa1';
const CLOUD_PARTY = 'bbbbbbbbbbbbbbbbbbbbbbb1';
const LOCAL_SALE = 'aaaaaaaaaaaaaaaaaaaaaaa2';
const CLOUD_SALE = 'bbbbbbbbbbbbbbbbbbbbbbb2';
const CLOUD_ONLY = 'ccccccccccccccccccccccc9';

const MAP = new Map([[LOCAL_PARTY, CLOUD_PARTY], [LOCAL_SALE, CLOUD_SALE]]);

describe('id detection', () => {
  it('accepts 24-char hex only', () => {
    assert.equal(core.isObjectId(LOCAL_PARTY), true);
    assert.equal(core.isObjectId('not-an-id'), false);
    assert.equal(core.isObjectId('aaaa'), false);
    assert.equal(core.isObjectId(12345), false);
    assert.equal(core.isObjectId(null), false);
  });

  it('finds ids at any depth', () => {
    const found = core.collectIds({
      partyId: LOCAL_PARTY,
      rows: [{ ref: { saleId: LOCAL_SALE } }],
      note: 'plain text',
      amount: 500,
    });
    assert.deepEqual([...found].sort(), [LOCAL_PARTY, LOCAL_SALE].sort());
  });
});

describe('remapping', () => {
  it('rewrites mapped ids and leaves unmapped ones alone', () => {
    const out = core.remapIds({
      partyId: LOCAL_PARTY,
      bills: [{ saleId: LOCAL_SALE, amount: 100 }],
      ledgerId: CLOUD_ONLY,
      narration: 'on account',
    }, MAP);

    assert.equal(out.partyId, CLOUD_PARTY);
    assert.equal(out.bills[0].saleId, CLOUD_SALE);
    assert.equal(out.bills[0].amount, 100, 'non-id values untouched');
    assert.equal(out.ledgerId, CLOUD_ONLY, 'an id the cloud already knows is not rewritten');
    assert.equal(out.narration, 'on account');
  });

  it('rewrites ids inside the request path', () => {
    assert.equal(core.remapPath(`/sales/${LOCAL_SALE}`, MAP), `/sales/${CLOUD_SALE}`);
    assert.equal(core.remapPath(`/sales/${LOCAL_SALE}/status`, MAP), `/sales/${CLOUD_SALE}/status`);
    assert.equal(core.remapPath('/accounting/receipts', MAP), '/accounting/receipts');
  });

  it('is a no-op with an empty map', () => {
    const body = { partyId: LOCAL_PARTY };
    assert.deepEqual(core.remapIds(body, new Map()), body);
    assert.equal(core.remapPath('/x/y', new Map()), '/x/y');
  });
});

describe('cleanBody', () => {
  it('drops device-only fields and never lets the body set the tenant', () => {
    const out = core.cleanBody({
      amount: 10, __v: 3, operationId: 'op-1', pendingSync: true,
      companyId: 'ffffffffffffffffffffffff',
    });
    assert.deepEqual(out, { amount: 10 });
  });

  it('passes non-objects through', () => {
    assert.equal(core.cleanBody(undefined), undefined);
    assert.equal(core.cleanBody('x'), 'x');
  });
});

describe('holding back operations that reference unsynced documents', () => {
  const unsynced = new Set([LOCAL_PARTY]);

  it('waits when a referenced document has not reached the cloud', () => {
    const refs = core.blockingRefs({ path: '/accounting/receipts', body: { partyId: LOCAL_PARTY } }, new Map(), unsynced);
    assert.deepEqual(refs, [LOCAL_PARTY]);
  });

  it('does not wait once that document is mapped', () => {
    const refs = core.blockingRefs({ path: '/accounting/receipts', body: { partyId: LOCAL_PARTY } }, MAP, unsynced);
    assert.deepEqual(refs, []);
  });

  it('does not wait on ids the cloud already knows', () => {
    const refs = core.blockingRefs({ path: '/accounting/receipts', body: { ledgerId: CLOUD_ONLY } }, new Map(), unsynced);
    assert.deepEqual(refs, []);
  });

  it('also inspects ids in the path', () => {
    const refs = core.blockingRefs({ path: `/sales/${LOCAL_PARTY}`, body: {} }, new Map(), unsynced);
    assert.deepEqual(refs, [LOCAL_PARTY]);
  });
});

describe('buildReplayRequest', () => {
  it('builds a ready request with ids rewritten', () => {
    const r = core.buildReplayRequest(
      { payload: { method: 'post', path: '/accounting/receipts', body: { partyId: LOCAL_PARTY, amount: 500 } } },
      MAP, new Set()
    );
    assert.equal(r.ready, true);
    assert.equal(r.method, 'POST', 'method is upper-cased');
    assert.equal(r.path, '/accounting/receipts');
    assert.deepEqual(r.body, { partyId: CLOUD_PARTY, amount: 500 });
  });

  it('reports what it is waiting for instead of sending a doomed request', () => {
    const r = core.buildReplayRequest(
      { payload: { method: 'POST', path: '/accounting/receipts', body: { partyId: LOCAL_PARTY } } },
      new Map(), new Set([LOCAL_PARTY])
    );
    assert.equal(r.ready, false);
    assert.deepEqual(r.waitingOn, [LOCAL_PARTY]);
    assert.equal(r.body, undefined);
  });

  it('sends no body for a DELETE but still rewrites its path', () => {
    const r = core.buildReplayRequest(
      { payload: { method: 'DELETE', path: `/sales/${LOCAL_SALE}` } },
      MAP, new Set()
    );
    assert.equal(r.ready, true);
    assert.equal(r.path, `/sales/${CLOUD_SALE}`);
    assert.equal(r.body, undefined);
  });

  it('defaults to POST when the row does not say', () => {
    const r = core.buildReplayRequest({ payload: { path: '/notes', body: {} } }, new Map(), new Set());
    assert.equal(r.method, 'POST');
  });
});
