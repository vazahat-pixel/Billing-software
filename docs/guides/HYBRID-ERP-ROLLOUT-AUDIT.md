# HYBRID ERP ROLLOUT AUDIT
Version: 1.0 | Date: 2026-09-22 | Scope: Purchase, Job Issue/Receive, Banking, Ledger, GST, Reports

---

## 1. EXISTING ARCHITECTURE

### 1.1 Repository Layout

```
Billing-software/
  backend/              - Node.js/Express central API (production and test)
    server.js           - Express boot, hybrid sync agent start
    models/             - Mongoose schemas (96 models)
    services/           - Business logic (101 service files)
    routes/             - 45 route modules
    controllers/        - HTTP adapters
    utils/              - helpers (withTransaction, refIntegrity, salesTotals, purchaseTotals)
    tests/
      hybrid-e2e/       - Certified Sales E2E harness
        run.js          - 723-line test runner (Sales golden reference)
        lib/env.js      - Dual MongoMemoryServer + child Express lifecycle
        lib/fixtures.js - Deterministic seed (company, user, item, inventory, license)
        lib/http.js     - HTTP helper
        lib/report.js   - Certification report
        artifacts/      - Test output directory
  desktop/              - Electron desktop client
    main.js             - Electron main process
    syncAgent.js        - Desktop sync agent orchestrator
    localRuntime/       - Bundled local API runtime
```

### 1.2 Backend Environment Flags

| Flag | Values | Meaning |
|---|---|---|
| DESKTOP_LOCAL | true/false | This instance is a desktop-local API |
| DESKTOP_HYBRID | true/false | Hybrid sync active (requires DESKTOP_LOCAL=true) |
| HYBRID_SYNC_ENABLED | true/false | Central will accept /sync/push operations |
| CENTRAL_API_BASE_URL | URL | Where local agent posts sync operations |
| MODULE_GATE_ENFORCE | true/false | Enforce module entitlement |
| DEVICE_BINDING_ENFORCE | true/false | Enforce device binding policy |
| SYNC_AGENT_INTERVAL_MS | ms | Sync agent tick interval (default 20000) |
| SYNC_INVOICE_LEASE_SIZE | int | Number of invoice numbers per lease (default 50) |
| SYNC_INVOICE_LEASE_TTL_HOURS | int | Lease TTL in hours (default 168 = 1 week) |

---

## 2. EXISTING SERVICES

### 2.1 Core Business Services (Protected - DO NOT ALTER)

| Service File | Primary Purpose |
|---|---|
| salesService.js (21 KB) | Sales invoice creation - stock deduction + accounting + outbox |
| purchaseService.js (22 KB) | Purchase bill creation - stock increase + accounting |
| jobService.js (36 KB) | Job Issue / Job Receive / Job Work full lifecycle |
| accountingService.js (29 KB) | Journal posting for all modules |
| cashBankEngineService.js (9.7 KB) | Cash/Bank payment and receipt vouchers |
| inventoryEngineService.js (17 KB) | Inventory reporting and stock movements |
| gstService.js / gstReturnService.js | GST calculation and GSTR-1/2B |
| gstinReportService.js (48 KB) | GSTIN-level reporting |
| ledgerEngineService.js (16 KB) | Ledger statement generation |
| outstandingEngineService.js (14 KB) | Payable/Receivable tracking |
| reportService.js (40 KB) | All business reports |
| numberLeaseService.js (6 KB) | Offline invoice number lease management |
| syncOutboxService.js (3.2 KB) | Durable outbox enqueue/status |
| syncAgentWorker.js (6.8 KB) | Background push/pull sync agent |
| syncPushService.js (4.9 KB) | Central push handler (currently Sales only) |
| syncPullService.js (7 KB) | Pull/apply central changes to local |
| entitlementService.js (12 KB) | Module gate enforcement |
| deviceBindingService.js (11 KB) | Device binding policy |
| configService.js (21 KB) | Company/tenant config and seeding |
| voucherSeriesService.js (3.3 KB) | Voucher series and allocation |

### 2.2 Mill/Job Work Note

The repository uses jobService.js for what the prompt calls "Mill Issue" and "Mill Receive".
There is NO separate millService.js.

- Mill Issue  = jobService.issueToJob()
- Mill Receive = jobService.receiveFromJob()

Job Work and Mill are the same document type (Job model). The processType field
distinguishes mill operations (Weaving, Processing) from sub-contracted job work.

---

## 3. EXISTING MODELS

### 3.1 Sync Infrastructure Models

| Model | Collection | Purpose |
|---|---|---|
| SyncOutbox | sync_outbox | Durable outbox. Status: PENDING/SYNCING/SYNCED/FAILED/CONFLICT/RETRY |
| ProcessedOperation | processed_operations | Central idempotency store. Unique: (companyId, operationId) |
| SyncDeviceState | - | Per-device sync version, last push timestamp |
| SyncState | - | Key-value store. Agent context + number leases + sequences |
| NumberRangeLease | number_range_leases | Invoice number ranges leased to devices |

### 3.2 Business Document Models

| Model | Key Fields |
|---|---|
| Sales | companyId, customerId, invoiceNo, items[], taxableAmount, cgst, sgst, igst, gstAmount, netAmount, operationId, accountingEntryId |
| Purchase | companyId, supplierId, invoiceNo, items[], taxableAmount, cgst, sgst, igst, gstAmount, netAmount, reverseCharge, tdsAmount, accountingEntryId |
| Job | companyId, jobCardNo, lotId, workerId, processType, issueQty, issuePcs, receivedQty, receivedPcs, wastage, status, steps[], processCharges, processGstAmount |
| InventoryLot | companyId, itemId, lotId, totalMtrs, remainingMtrs, totalPcs, remainingPcs, source, status, warehouseId |
| StockMovement | companyId, lotId, type (PURCHASE/SALE/ISSUE/RECEIVE/ADJUSTMENT), qtyMtrs, qtyPcs, referenceId, idempotencyKey |
| AccountingEntry | companyId, entryNo, entryDate, voucherType, refType, refId, lines[], isReversed |
| LedgerMaster | companyId, name, group, subGroup, accountType, linkedPartyId, nature, openingBalance |
| PaymentVoucher | companyId, voucherNo, voucherType (Payment/Receipt), partyLedgerId, bankLedgerId, amount, paymentMode, idempotencyKey, accountingEntryId |

---

## 4. EXISTING TRANSACTION BOUNDARIES

### 4.1 Sales Invoice (salesService.createInvoice)

```
withTransaction(session) {
  1. Idempotent check: Sales.findOne({companyId, operationId}) - return existing if found
  2. assertRefs (Party, Item - same companyId)
  3. assertBusinessValid (credit limit, duplicate detection)
  4. recalcSalesTotals (server-side GST - client amounts ignored)
  5. assertAccountingPeriodOpen + gstConfigService.assertPeriodOpen
  6. Allocate invoiceNo: (a) hybrid lease, (b) voucherSeries, (c) Counter fallback
  7. Sales.save()
  8. For each item: applyLotMovement (SALE, FIFO or explicit lotId)
  9. accountingService.onSalesInvoicePost => AccountingEntry.create
  10. sales.accountingEntryId = entry._id; sales.save()
  11. outstandingEngine.syncBillFromSales (BillSettlement)
  12. eventBus.emitSafe('sales.created')
  13. [HYBRID DESKTOP ONLY] syncOutboxService.enqueue (PENDING)
}
```

### 4.2 Purchase Bill (purchaseService.createPurchase)

```
withTransaction(session) {
  1. Normalize supplierId/itemId (strip local- stubs)
  2. assertRefs (Party, Items - same companyId)
  3. assertBusinessValid
  4. recalcPurchaseTotals (server-side GST, TDS, RCM)
  5. assertAccountingPeriodOpen + gstConfigService.assertPeriodOpen
  6. Allocate invoiceNo: voucherSeries or Counter fallback
  7. Generate lotId per item (timestamp-random)
  8. Purchase.save()
  9. For each item: InventoryLot.create (source='purchase') + StockMovement.create (PURCHASE)
  10. accountingService.onPurchaseBillPost => AccountingEntry.create
  11. purchase.accountingEntryId = entry._id; purchase.save()
  12. outstandingEngine.syncBillFromPurchase
  13. eventBus.emitSafe('purchase.created')
  NOTE: NO outbox enqueue - Hybrid not yet wired for Purchase
}
```

### 4.3 Job Issue (jobService.issueToJob)

```
session.startTransaction() {
  1. Allocate jobCardNo: Counter JC-{companyId}
  2. Resolve chainTemplate if given (build steps[])
  3. Resolve outputItemId from ItemProcessMapping
  4. Normalize form fields (date to issueDate, jobRate to processCharges)
  5. Job.save()
  6. applyLotMovement (ISSUE, delta = -issueQty)
  7. accountingService.onJobIssuePost (Stock A/c => Job Work In Progress)
  8. session.commitTransaction()
  NOTE: NO outbox enqueue - Hybrid not yet wired for Job Issue
}
```

### 4.4 Job Receive (jobService.receiveFromJob)

```
session.startTransaction() {
  1. Job.findOne({_id:jobId, companyId}) - validates status (not Received/Cancelled)
  2. Validate billGpNo uniqueness across different workers
  3. Compute: cumulativeReceivedQty, wastage split (normal/abnormal), isFinal
  4. Resolve outputItemId (ItemProcessMapping fallback)
  5. Compute greyCostPerMtr from originalLot.rate or purchase taxableAmount
  6. Per-tranche charges + GST calculation
  7. Job update: receivedQty, receivedPcs, wastage, status (Partial/Received)
  8. Job.save()
  9. applyLotMovement on OUTPUT lot (RECEIVE, +trancheQty) - creates NEW InventoryLot
  10. [isFinal] accountingService.onJobReceiveStockPost (WIP => Stock valuation)
  11. Per-tranche: accountingService.onJobReceiveChargesPost (Charges + GST)
  12. session.commitTransaction()
  NOTE: NO outbox enqueue - Hybrid not yet wired for Job Receive
}
```

### 4.5 Bank Payment / Receipt (cashBankEngineService)

```
  1. voucherNo allocation (Counter)
  2. PaymentVoucher.create (idempotencyKey unique index)
  3. accountingService.onPaymentVoucherPost => AccountingEntry
  4. outstandingEngine.applyPayment / applyReceipt
  NOTE: NO outbox enqueue - Hybrid not yet wired for Banking
```

---

## 5. INVENTORY EFFECTS BY MODULE

| Module | Effect |
|---|---|
| Purchase | InventoryLot (new doc) + StockMovement (PURCHASE) = +stock |
| Job Issue | StockMovement (ISSUE) + InventoryLot.remainingMtrs reduced = -stock (source lot) |
| Job Receive | InventoryLot (new finished lot) + StockMovement (RECEIVE) = +stock (output lot) |
| Sales | StockMovement (SALE) + InventoryLot.remainingMtrs reduced = -stock |

---

## 6. ACCOUNTING EFFECTS BY MODULE

| Module | Dr | Cr | Method |
|---|---|---|---|
| Sales | Debtor (netAmount) | Sales A/c + CGST/SGST/IGST Output | onSalesInvoicePost |
| Purchase (normal) | Purchase A/c + CGST/SGST/IGST Input | Supplier (netAmount) | onPurchaseBillPost |
| Purchase (RCM) | Purchase A/c + ITC Input + RCM Liability | Supplier (taxable) | onPurchaseBillPost |
| Purchase (TDS) | Purchase A/c + ITC | Supplier (net-TDS) + TDS Payable | onPurchaseBillPost |
| Job Issue | Job Work In Progress | Stock A/c | onJobIssuePost |
| Job Receive (charges) | Job Work Charges + GST Input | Supplier (charges) | onJobReceiveChargesPost |
| Job Receive (stock) | Stock A/c (finished) | Job Work In Progress | onJobReceiveStockPost |
| Payment | Supplier Ledger | Bank/Cash A/c | onPaymentVoucherPost |
| Receipt | Bank/Cash A/c | Customer Ledger | onPaymentVoucherPost |

Critical invariant: Total Debits = Total Credits per entry (enforced by Round Off ledger balancer).

---

## 7. GST EFFECTS BY MODULE

| Module | Input GST | Output GST |
|---|---|---|
| Purchase | CGST Input / SGST Input / IGST Input | - |
| Purchase (RCM) | CGST/SGST/IGST Input | CGST/SGST/IGST RCM Liability |
| Sales | - | CGST Output / SGST Output / IGST Output |
| Job Receive | CGST/SGST Input (job work charges) | - |

GST period gating: gstConfigService.assertPeriodOpen called in both Sales and Purchase before writes.

---

## 8. SYNC ARCHITECTURE (SALES - REFERENCE IMPLEMENTATION)

### 8.1 Local Side (DESKTOP_LOCAL=true, DESKTOP_HYBRID=true)

POST /sales => salesController
  => salesService.createInvoice(data, { enqueueOutbox: true })
     => [same business logic as central]
     => syncOutboxService.enqueue({ entityType:'sales', operationId, payload })
  <= Returns local invoice (same format as central)

### 8.2 Sync Agent (syncAgentWorker.js)

tick() [every 20s or manual /sync/agent-tick]:
  1. getAgentContext() => { token, companyId, deviceId }
  2. renewLeaseIfNeeded() => POST /sync/leases/invoice if < 10 remaining
  3. pushPending() => listPending(limit=20) => POST /sync/push => markSynced/markFailed
  4. pullIncremental() => GET /sync/pull?cursor=... => applyPulledChanges()

### 8.3 Central Side - Push Handler (syncPushService.js)

POST /sync/push => syncController.push
  => syncPushService.pushOperations({ companyId, userId, deviceId, operations })
     for each op:
       if entityType='sales' AND operationType='create':
         => processSalesCreate(op)
           1. ProcessedOperation.findOne({companyId, operationId}) => return duplicate if found
           2. numberLeaseService.assertAndConsumeLeaseNumber(companyId, deviceId, invoiceNo)
           3. salesService.createInvoice(payload, { fromSync:true, skipLeaseAllocation:true })
           4. ProcessedOperation.create({operationId, entityId, invoiceNo})
       else:
         => failedOperations.push({ UNSUPPORTED }) <-- THIS IS WHAT MUST BE EXTENDED

### 8.4 Idempotency Guarantee

- Local: Sales.operationId unique index per company prevents local duplicates
- Central: ProcessedOperation(companyId, operationId) unique index prevents central duplicates
- On retry: processSalesCreate checks ProcessedOperation first - returns {duplicate:true}
- On local create: salesService.createInvoice checks Sales.findOne({companyId,operationId})

### 8.5 Number Lease Flow

[Central] POST /sync/leases/invoice
  => numberLeaseService.allocateInvoiceLease(companyId, deviceId, {size})
  => NumberRangeLease.create (startSeq..endSeq, status='active')

[Local] numberLeaseService.cacheLeaseLocally(companyId, lease)
  => SyncState key='lease:sales:{companyId}'

[Local invoice creation with AUTO number]
  => numberLeaseService.consumeLocalLease(companyId, 'sales')
  => SyncState lease.nextSeq += 1

[Central push validation]
  => numberLeaseService.assertAndConsumeLeaseNumber(companyId, deviceId, invoiceNo)
  => NumberRangeLease.consumedThrough = max(consumedThrough, seq)

---

## 9. SALES - GOLDEN REFERENCE: 39 CERTIFIED SCENARIOS

1. Security preconditions (isolated memory DBs)
2. MongoDB connectivity
3. Central API startup
4. Local API startup
5. Company provisioning
6. Device activation
7. Sales module entitlement
8. Initial sync / lease acquisition
9. Online Sales baseline
10. Offline mode (central stopped)
11. Local API available offline
12. Offline invoice creation
13. Local persistence (Sales document in local Mongo)
14. Outbox persistence (SyncOutbox PENDING)
15. Local stock movement (StockMovement created)
16. Local accounting effect (AccountingEntry created)
17. Application restart recovery
18. Data survives restart
19. Outbox survives restart
20. Connectivity restoration
21. Automatic synchronization (agent-tick)
22. Central persistence (Sales in central Mongo)
23. Outbox marked synced
24. Invoice reconciliation (local net = central net, GST, taxable)
25. Inventory reconciliation (local)
26. Inventory reconciliation (central)
27. Accounting reconciliation
28. Idempotency (same op pushed again => duplicate=true, count stays 1)
29. Idempotency no duplicate invoice
30. Retry handling (outbox reset to RETRY => tick => count stays 1)
31. Timeout handling (server already committed => returns existing)
32. Crash recovery (kill+restart+tick => count stays 1)
33. Number lease handling
34. Device binding
35. Module entitlement (sales disabled => rejected)
36. Company isolation (Company A cannot read Company B data)
37. Second device sync
38. Prolonged offline
39. Failed-operation recovery

---

## 10. MODULE DEPENDENCY GRAPH

```
Company / License / Plan / Subscription
         |
   Party (Supplier / Customer / Job Worker)
         |
   Item => HsnMaster
         |
   InventoryLot (opening stock)
         |
        PURCHASE  --------------------------------+
        (InventoryLot+, StockMovement PURCHASE)   |
              |                                   |
        JOB ISSUE                                 |
        (InventoryLot-, StockMovement ISSUE)      |
              |                                   |
        JOB RECEIVE                               |
        (InventoryLot+, StockMovement RECEIVE)    |
              |                                   v
            SALES                          AccountingEntry (all modules)
        (InventoryLot-, StockMovement SALE)       |
              |                            LedgerMaster
        Receivable                                |
              |                         LedgerEngine / Statement
        BANK RECEIPT                              |
              |                         GSTService / Period Reports
        Cash/Bank Balance
              |
        Reconciliation / Reports
```

Dependency order for hybrid implementation:
1. Purchase (creates inventory - prerequisite for Job/Sales)
2. Job Issue (requires InventoryLot from Purchase)
3. Job Receive (requires Job Issue record)
4. Bank Payment (requires Supplier Ledger from Purchase)
5. Bank Receipt (requires Customer Ledger from Sales)
6. Ledger reconciliation (after all above)
7. GST reconciliation (after Sales + Purchase)
8. Reports (after all transactional modules)

---

## 11. IDENTIFIED RISKS

RISK-1 (HIGH): Purchase model has no operationId field
  Impact: Cannot implement idempotent sync on central
  Mitigation: Add operationId: { type: String, index: true } to Purchase schema (additive)

RISK-2 (HIGH): Job model has no operationId field
  Impact: Same as RISK-1 for Job Issue and Job Receive
  Mitigation: Add operationId to Job schema (additive)

RISK-3 (HIGH): syncPushService.pushOperations only handles entityType='sales'
  Impact: Any non-sales op pushed to central returns UNSUPPORTED
  Mitigation: Extend pushOperations with processPurchaseCreate, processJobIssue,
              processJobReceive, processPayment, processReceipt

RISK-4 (HIGH): Purchase/Job services have no outbox enqueue
  Impact: Offline transactions for these modules will not queue for sync
  Mitigation: Add outbox enqueue to purchaseService.createPurchase and
              jobService.issueToJob/receiveFromJob following salesService pattern

RISK-5 (MEDIUM): Purchase uses Counter not number leases - offline number collision risk
  Impact: Multiple devices may assign same purchase invoice number
  Mitigation: Extend numberLeaseService to support module='purchase'; update purchaseService
              to consume lease when isHybridDesktop; extend assertAndConsumeLeaseNumber

RISK-6 (MEDIUM): Job uses Counter JC-{companyId} for jobCardNo - same collision risk
  Impact: Multiple devices may assign same job card number
  Mitigation: Extend lease for module='job' OR use UUID-based numbers in offline mode

RISK-7 (MEDIUM): PaymentVoucher has idempotencyKey but no operationId
  Impact: Sync needs stable operation ID; idempotencyKey can serve as operationId
  Mitigation: Use idempotencyKey as the operationId for Payment/Receipt sync ops

RISK-8 (LOW): sync.routes.js uses requirePermission('sales',...) for all sync routes
  Impact: Devices with purchase/job modules but no sales permission may fail /sync/push
  Mitigation: Use authenticated-only guard for push, or per-entity permission check

RISK-9 (LOW): Accounting period assertion in both Sales and Purchase
  Impact: Offline transactions pushed after period close will fail on central
  Mitigation: Failed period validation should mark outbox CONFLICT not RETRY

RISK-10 (LOW): assertAndConsumeLeaseNumber hardcoded to module='sales'
  Impact: Central push verification fails for purchase/job lease numbers
  Mitigation: Add module parameter to assertAndConsumeLeaseNumber

---

## 12. FILES TO CHANGE

### 12.1 New Files

| File | Purpose |
|---|---|
| backend/tests/hybrid-e2e/modules/purchase/run.js | Purchase E2E certification suite |
| backend/tests/hybrid-e2e/modules/job-work/run.js | Job Issue + Receive E2E suite |
| backend/tests/hybrid-e2e/modules/banking/run.js | Payment + Receipt E2E suite |
| backend/tests/hybrid-e2e/reconciliation/inventory.js | Reusable inventory reconciler |
| backend/tests/hybrid-e2e/reconciliation/accounting.js | Reusable accounting reconciler |
| backend/tests/hybrid-e2e/reconciliation/gst.js | Reusable GST reconciler |
| backend/tests/hybrid-e2e/reconciliation/reports.js | Reusable report reconciler |
| backend/tests/hybrid-e2e/run-all.js | Full cross-module harness (Sales regression first) |

### 12.2 Modified Files

| File | Change |
|---|---|
| backend/models/Purchase.js | Add operationId field |
| backend/models/Job.js | Add operationId field |
| backend/services/purchaseService.js | Add idempotent operationId check + outbox enqueue |
| backend/services/jobService.js | Add idempotent operationId check + outbox enqueue |
| backend/services/syncPushService.js | Add handlers for purchase/job/banking |
| backend/services/numberLeaseService.js | Make module param generic |
| backend/routes/sync.routes.js | Update permission for multi-module push |
| backend/package.json | Add test:hybrid-purchase, test:hybrid-job, test:hybrid-banking, test:hybrid-full |

### 12.3 Files Explicitly Protected - DO NOT MODIFY

| File | Reason |
|---|---|
| backend/services/accountingService.js | Business accounting engine |
| backend/services/salesService.js (business logic sections) | Certified golden reference |
| backend/services/inventoryEngineService.js | Inventory calculation |
| backend/services/gstService.js | GST calculation |
| backend/services/gstReturnService.js | GST returns |
| backend/services/entitlementService.js | Module gate |
| backend/services/deviceBindingService.js | Device binding |
| backend/utils/salesTotals.js | Sales GST math |
| backend/utils/purchaseTotals.js | Purchase GST math |
| backend/utils/inventoryStockHelper.js | Lot movement |
| backend/tests/hybrid-e2e/run.js | Sales certification - DO NOT WEAKEN ASSERTIONS |
| backend/tests/hybrid-e2e/lib/ | Test infrastructure |

---

## 13. PHASE GATES IMPLEMENTATION PLAN

### Gate 2: Purchase

Additive changes only:
1. Add operationId field to Purchase model
2. In purchaseService.createPurchase:
   - At start: idempotent check - if operationId exists, return existing
   - At end (isHybridDesktop, enqueueOutbox !== false, !fromSync): enqueue outbox
3. In numberLeaseService: add module='purchase' support
4. In syncPushService.pushOperations: add processPurchaseCreate handler
5. Central assertAndConsumeLeaseNumber accepts module param

Reconciliation fields: supplierId, invoiceNo, taxableAmount, cgst, sgst, igst,
gstAmount, netAmount, items[].qty, items[].rate, accountingEntryId, InventoryLot.remainingMtrs

### Gate 3: Job Issue + Receive

Additive changes only:
1. Add operationId to Job model
2. jobService.issueToJob: idempotent check + outbox enqueue
3. jobService.receiveFromJob: idempotent check + outbox enqueue
4. syncPushService: add processJobIssue + processJobReceive
5. Job number lease: extend for module='job' or UUID offline

Reconciliation fields: jobCardNo, lotId, workerId, issueQty, receivedQty, wastage,
processCharges, processGstAmount, status, stock movements

### Gate 4: Banking (Payment + Receipt)

Additive changes only:
1. Use PaymentVoucher.idempotencyKey as operationId for sync
2. cashBankEngineService: outbox enqueue on payment and receipt creation
3. syncPushService: add processPayment + processReceipt

Reconciliation fields: voucherNo, amount, partyLedgerId, bankLedgerId, paymentMode,
accountingEntryId

### Gate 5: Ledger Reconciliation

Reusable reconciler verifies for each upstream transaction:
- AccountingEntry exists on both local and central
- Sum of Dr lines = Sum of Cr lines
- Entry references correct refType/refId
- No duplicate entries for same operationId

### Gate 6: GST Reconciliation

Reusable reconciler:
- For each Purchase: CGST Input / SGST Input / IGST Input on AccountingEntry matches Purchase.cgst/sgst/igst
- For each Sales: CGST Output / SGST Output / IGST Output matches Sales.cgst/sgst/igst
- Period totals (local vs central) match

### Gate 7: Reports

Reusable reconciler:
- Inventory: Opening + Inward(Purchase+JobReceive) - Outward(Sale+JobIssue) = Closing
- Purchase report: count, taxable, GST, total from Purchase collection
- Sales report: same from Sales collection
- Job Work: issued qty, received qty, wastage from Job collection
- Banking: payment/receipt from PaymentVoucher + ledger balance

---

## 14. TEST COMMANDS

Existing (must continue to pass):
  npm run test:hybrid-sync
  npm run test:hybrid-e2e
  npm run test:hybrid-e2e:keep-data

New (to be added to package.json):
  npm run test:hybrid-purchase       # Phase 2 only
  npm run test:hybrid-job            # Phase 3+4 only
  npm run test:hybrid-banking        # Phase 5 only
  npm run test:hybrid-accounting     # Ledger reconciliation
  npm run test:hybrid-gst            # GST reconciliation
  npm run test:hybrid-reports        # Report reconciliation
  npm run test:hybrid-full           # All modules + Sales regression first

---

## 15. CERTIFICATION REPORT FORMAT

  RUN ID:               {uuid}
  DATE:                 {ISO}
  ENVIRONMENT:          isolated-memory-mongo / test
  MODULES TESTED:       [sales, purchase, job-work, banking, ...]

  SCENARIOS:            N
  PASSED:               N
  FAILED:               N

  TRANSACTIONS CREATED: N
  TRANSACTIONS SYNCED:  N
  DUPLICATES:           0
  DATA LOSS EVENTS:     0
  STOCK MISMATCHES:     0
  FINANCIAL MISMATCHES: 0
  GST MISMATCHES:       0
  REPORT MISMATCHES:    0
  CONFLICTS:            0
  RECOVERED FAILURES:   N

  RESULT:               PASS / FAIL

Artifacts directory: backend/tests/hybrid-e2e/artifacts/

---

## 16. REGRESSION REQUIREMENT

Every new module test run MUST first execute existing Sales certification.
If Sales fails: STOP. Do not certify next module.

Enforced in run-all.js by running run.js (Sales) first and exiting 1 if it fails.

---

## 17. SECURITY CONSTRAINTS

- JWT secrets, DB credentials, API keys MUST NOT appear in test artifacts or reports
- All tests use disposable memory DBs with isolated credentials
- The harness uses assertNotProduction(uri) guard - refuses to run against Atlas URIs
- Certification reports redact any token values
- NEVER connect test harness to production VPS/database

---

## 18. PRODUCTION DEPLOYMENT (SEPARATE PHASE - AFTER ALL LOCAL GATES PASS)

1. Deploy central backend to VPS
2. Configure central MongoDB with replica set (required for transactions)
3. Configure Nginx reverse proxy
4. Configure HTTPS / domain
5. Set production environment variables (JWT_SECRET, PROVISIONING_PACK_SECRET, etc.)
6. Enable HYBRID_SYNC_ENABLED=true
7. Provision pilot company + devices
8. Run production smoke tests
9. Monitor /api/sync/status and /api/health/live
10. Only then expand rollout

---

Audit complete. Ready to proceed to Phase 1 - Purchase implementation.
