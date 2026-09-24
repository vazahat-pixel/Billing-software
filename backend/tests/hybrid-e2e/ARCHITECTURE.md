# HYBRID E2E TEST ARCHITECTURE

## 1. Existing test infrastructure
- `tests/helpers/memoryDb.js` — throwaway MongoMemoryServer; refuses Atlas
- `tests/helpers/isolatedApp.js` — single in-process Express + memory DB
- `tests/hybridSync.sales.test.js` — unit/integration for leases/outbox/idempotency (`test:hybrid-sync`)

## 2. Reusable helpers
- `assertNotProduction`, MongoMemoryServer pattern
- Real services: `salesService`, `syncPushService`, `numberLeaseService`, `syncOutboxService`, `syncAgentWorker`

## 3. New helpers (this suite)
- Dual isolated MongoMemoryServer (central + local)
- Dual Express child processes (central API + local hybrid API)
- HTTP client, fixture seeder, snapshot/reconcile, certification report writer

## 4. Environment
- `NODE_ENV=test`, disposable DB names `*_hybrid_e2e_test`
- Never touches production URI / Atlas

## 5. Central API isolation
- Child process: `node server.js` with `HYBRID_SYNC_ENABLED=true`, unique port, central Mongo URI

## 6. Local API isolation
- Child process: `DESKTOP_LOCAL=true`, `DESKTOP_HYBRID=true`, local Mongo URI, `CENTRAL_API_BASE_URL` → central

## 7. Network failure simulation
- Stop central child (or point `CENTRAL_API_BASE_URL` at a closed port)
- Local API + local Mongo keep running
- Does not disable OS network

## 8. Process restart simulation
- Kill local API child → restart against same local MongoMemoryServer URI
- Optional deeper “PC restart” = stop+start local API (main CI path)

## 9. Database isolation
- Two memory mongods; dropped on teardown unless `KEEP_TEST_DATA=true`

## 10. Reconciliation
- Compare business fields (operationId, invoiceNo, qty, GST, stock deltas, accounting presence)
- Not byte-equal Mongo documents

## 11. Scenarios
See `run.js` checklist (online baseline, offline create, restart, sync, idempotency, timeout/retry, lease, isolation, entitlement, multi-offline)

## 12. Artifacts
- `backend/tests/hybrid-e2e/artifacts/HYBRID-E2E-<ts>-report.txt` (+ fail dumps)

## 13. Commands
```bash
cd backend && npm run test:hybrid-e2e
cd backend && npm run test:hybrid-e2e:keep-data
cd backend && npm run test:hybrid-sync   # unchanged
```
