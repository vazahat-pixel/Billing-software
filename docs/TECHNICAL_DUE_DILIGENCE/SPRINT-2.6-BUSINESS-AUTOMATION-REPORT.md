# Sprint 2.6 — Business Automation Engine

**Version:** 1.0 · **Date:** 15 Jul 2026 · **Stage:** Business Engine  
**Kernel preserved:** Inline `accountingService` posting (listeners orchestrate — do not double-post)

---

## Verdict

| Metric | Score |
|---|---|
| Sprint Completion | **76 / 100** |
| Event-driven orchestration | **80 / 100** |
| Voucher series allocation | **78 / 100** |
| Notifications / scans | **75 / 100** |
| Configurable rules | **72 / 100** |
| Cost allocation / profit | **65 / 100** (documented + stub) |

---

## What automation does now

```
Domain event (sales.created / purchase.created / job.received / …)
   → registerAutomation listeners
   → In-app Notification inbox
   → Outstanding refresh (party + company summary)
   → Optional low-stock scan (after job)
   → DomainEvent.processedAt marked
```

Accounting + inventory posting remain **inside** domain services (transactional). Automation **does not** re-post ledgers.

---

## What shipped

### Models
- `BusinessRule` — approval / duplicate / stock / general rules
- `Notification` — in-app inbox
- `ProfitSnapshot` — estimated GP KPI (see PROFIT-SNAPSHOTS.md)
- `Party` — `outstandingReceivable` / `outstandingPayable` cache fields
- `DomainEvent` — allow `processedAt` updates (outbox drain)

### Services
| Service | Role |
|---|---|
| `voucherSeriesService` | Seed defaults + `allocateNext` |
| `notificationDispatchService` | Config-aware in-app dispatch |
| `outstandingRefreshService` | Party/company outstanding + overdue list |
| `duplicateDetectionService` | Soft 24h duplicate scan |
| `businessAutomationService` | Pipeline, rules, scans, profit snapshots |
| `costAllocationService` | Documented deferred stub |

### Listeners (`events/registerAutomation.js`)
Registered on Mongo connect in `server.js`:
- `sales.created`, `purchase.created`, `job.received`
- `sales.order.created`, `purchase.order.created`, `purchase.grn.created`

### Numbering
- Sales / Purchase AUTO invoice Nos prefer **VoucherSeries** (+ FY), with Counter fallback

### APIs (`/api/business-automation/*`)
| Area | Paths |
|---|---|
| Health | `/pipeline`, `/seed` |
| Rules | `/rules`, `/evaluate-approval`, `/check-duplicates` |
| Series | `/series`, `/series/allocate` |
| Notify | `/notifications`, `/notifications/:id/read` |
| Ops | `/outstanding`, `/scans/low-stock`, `/scans/overdue` |
| Profit | `/profit-snapshots` |

### Frontend
- `businessAutomation.api.js`
- `AutomationEngineModal` — Pipeline · Rules · Series · Notifications · Scans · Profit
- Dashboard: **Utilities / Setup → Business Automation**

### Migration
- `007_business_automation_indexes.js`

### Docs
- `PROFIT-SNAPSHOTS.md`

---

## Scope vs plan

| Item | Status |
|---|---|
| Auto ledger/inventory/GST posting | ✅ already in services; automation notifies + refreshes |
| Voucher/invoice series | ✅ allocate wired to sales/purchase AUTO |
| Outstanding refresh | ✅ on invoice events + API |
| Cost allocation | ⚠️ documented stub |
| Profit snapshots | ✅ estimated KPI + docs |
| Notifications | ✅ in-app inbox (+ channel stubs) |
| Low stock / overdue | ✅ manual scans → notifications |
| Approval triggers | ✅ rule evaluate API (threshold) |
| Duplicate detection | ✅ soft warn (blocking → 2.9) |
| Configurable business rules | ✅ BusinessRule CRUD + defaults |

---

## Gaps / next

- Wire approval evaluate into SO/PO create UI before save  
- Email/SMS/WhatsApp delivery (Sprint 2.7 channels)  
- Full workflow graphs (Sprint 2.8)  
- Hard pre-save validation hub (Sprint 2.9)  
- Landed-cost freight allocation into lots  

---

## Verification

```bash
node -e "require('./events/registerAutomation'); require('./services/businessAutomationService'); console.log('ok')"
cd frontend && npm run build
cd backend && node scripts/migrate.js
```
