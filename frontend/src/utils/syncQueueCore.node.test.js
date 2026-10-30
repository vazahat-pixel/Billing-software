// Run: node --test src/utils/syncQueueCore.node.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  remapLocalIds, pendingLocalRefs, cleanPayloadForSend, resolveRequest,
  idempotencyKeyOf, classifyError, renumberNotice,
} from './syncQueueCore.js';

const L_PARTY = 'local-1-party';
const L_ITEM = 'local-2-item';
const L_SALE = 'local-3-sale';

test('a sale waiting on a party and item created offline', () => {
  const sale = {
    _id: L_SALE, id: L_SALE, customerId: { _id: L_PARTY, name: 'RAJA' },
    items: [{ itemId: L_ITEM, qty: 5 }, { itemId: '64b0000000000000000000aa', qty: 1 }],
  };
  assert.deepEqual(pendingLocalRefs(sale, L_SALE).sort(), [L_PARTY, L_ITEM].sort());
  const map = new Map([[L_PARTY, '64b0000000000000000000p1'], [L_ITEM, '64b0000000000000000000i1']]);
  const fixed = remapLocalIds(sale, map);
  assert.equal(fixed.customerId._id, '64b0000000000000000000p1');
  assert.equal(fixed.items[0].itemId, '64b0000000000000000000i1');
  assert.equal(fixed.items[1].itemId, '64b0000000000000000000aa');
  assert.deepEqual(pendingLocalRefs(fixed, L_SALE), []);
});

test('own id is not a dependency, nested _id is', () => {
  assert.deepEqual(pendingLocalRefs({ _id: L_SALE, id: L_SALE, localId: L_SALE }, L_SALE), []);
  assert.deepEqual(pendingLocalRefs({ _id: 'local-x', brokerId: { _id: L_PARTY } }, 'local-x'), [L_PARTY]);
});

test('device-only fields and local record ids are never sent', () => {
  const out = cleanPayloadForSend({ _id: L_SALE, id: L_SALE, localId: L_SALE, offlinePending: true, _cachedAt: 1, invoiceNo: '6' });
  assert.deepEqual(out, { invoiceNo: '6' });
  assert.equal(cleanPayloadForSend({ _id: '64b0000000000000000000aa' })._id, '64b0000000000000000000aa');
});

test('routing: new entries use their stored endpoint', () => {
  const r = resolveRequest({ entityType: 'payments', action: 'create', endpoint: '/stage3/journals/contra', payload: { _id: 'local-c', amount: 10 } });
  assert.deepEqual(r, { method: 'post', url: '/stage3/journals/contra', data: { amount: 10 } });
});

test('routing: legacy queued contra / journal / receive / notes go to the right place', () => {
  assert.equal(resolveRequest({ entityType: 'payments', payload: { voucherType: 'Contra' } }).url, '/stage3/journals/contra');
  assert.equal(resolveRequest({ entityType: 'payments', payload: { voucherType: 'Journal' } }).url, '/accounting/journal');
  assert.equal(resolveRequest({ entityType: 'payments', payload: { amount: 5 } }).url, '/accounting/payments');
  assert.equal(resolveRequest({ entityType: 'notes', payload: {} }).url, '/notes');
  const rec = resolveRequest({
    entityType: 'jobs', action: 'create',
    payload: { _id: '64b0000000000000000000j1', id: '64b0000000000000000000j1', action: 'updateReceive', status: 'Received', offlinePending: true, receivedQty: 90 },
  });
  assert.equal(rec.method, 'post');
  assert.equal(rec.url, '/jobs/receive');
  assert.deepEqual(rec.data, { jobId: '64b0000000000000000000j1', receivedQty: 90 });
  assert.equal(resolveRequest({ entityType: 'jobs', payload: { lotId: 'x' } }).url, '/jobs/issue');
});

test('routing: update / delete / status', () => {
  assert.deepEqual(resolveRequest({ entityType: 'sales', action: 'delete', serverId: 'S1' }), { method: 'delete', url: '/sales/S1' });
  assert.equal(resolveRequest({ entityType: 'sales', action: 'update', serverId: 'S1', payload: { status: 'cancelled' } }).url, '/sales/S1/status');
  assert.equal(resolveRequest({ entityType: 'sales', action: 'update', serverId: 'S1', payload: { netAmount: 5, offlinePending: true } }).data.offlinePending, undefined);
});

test('same idempotency key on every attempt', () => {
  assert.equal(idempotencyKeyOf({ id: 'q1', payload: { operationId: 'op-9' } }), 'op-9');
  assert.equal(idempotencyKeyOf({ id: 'q1', opKey: 'k', payload: {} }), 'k');
  assert.equal(idempotencyKeyOf({ id: 'q1', payload: {} }), 'q1');
});

test('error classes', () => {
  assert.equal(classifyError(new Error('Network Error')), 'offline');
  assert.equal(classifyError({ response: { status: 503 } }), 'retry');
  assert.equal(classifyError({ response: { status: 409, data: { code: 'IDEMPOTENCY_IN_PROGRESS' } } }), 'retry');
  assert.equal(classifyError({ response: { status: 400, data: { message: 'Insufficient stock' } } }), 'rejected');
  assert.equal(classifyError({ response: { status: 409, data: { message: 'duplicate' } } }), 'rejected');
  assert.equal(classifyError({ response: { status: 401, data: { message: 'Token is not valid' } } }), 'auth');
});

test('renumber notice only when the server changed the bill number', () => {
  assert.deepEqual(
    renumberNotice({ entityType: 'purchases', payload: { invoiceNo: '6' } }, { invoiceNo: '7' }),
    { entityType: 'purchases', from: '6', to: '7' }
  );
  assert.equal(renumberNotice({ entityType: 'purchases', payload: { invoiceNo: '6' } }, { invoiceNo: '6' }), null);
  assert.equal(renumberNotice({ entityType: 'parties', payload: {} }, { name: 'x' }), null);
  assert.deepEqual(
    renumberNotice({ entityType: 'jobs', payload: { challanNo: '12' } }, { jobCardNo: '13', challanNo: '13' }),
    { entityType: 'jobs', from: '12', to: '13' }
  );
});
