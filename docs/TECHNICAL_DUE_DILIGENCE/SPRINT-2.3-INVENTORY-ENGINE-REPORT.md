# Sprint 2.3 — Inventory Engine

**Version:** 1.0 · **Date:** 15 Jul 2026 · **Stage:** Business Engine  
**Kernel preserved:** `purchaseService` / `salesService` lot posting via centralized `inventoryStockHelper`

---

## Verdict

| Metric | Score |
|---|---|
| Sprint Completion | **78 / 100** |
| Stock ledger / movement integrity | **82 / 100** |
| Reservation & availability | **75 / 100** |
| Transfer / adjustment | **72 / 100** |
| UI polish | **68 / 100** |

---

## Business flow now wired

```
Opening / Purchase lot (existing kernels)
   → Availability query (physical − reserved)
   → Reservation (blocks oversell)
   → Transfer (warehouse / partial split lot)
   → Adjustment (cycle count → ADJUSTMENT movement)
   → Sale / Job Issue (helper enforces negative-stock guard)
   → Stock ledger (append-only StockMovement)
```

---

## What shipped

### Models extended / new
- `InventoryLot` — `holdStatus` (None/Blocked/Damaged/InTransit), `reservedMtrs`, `reservedPcs`, `barcode`
- `StockMovement` — types `TRANSFER_OUT`, `TRANSFER_IN`, `RESERVE`, `UNRESERVE`
- `StockReservation` — active/consumed/released reservations
- `StockTransfer` — inter-warehouse transfer audit
- `StockAdjustment` — draft/posted physical verification

### Core helper `inventoryStockHelper`
- `availableMtrs` / `availablePcs` — physical minus reservations
- `applyLotMovement` — single path for qty change + movement + optimistic `version` check
- `assertLotIssuable` — blocks issue on hold lots

### Service `inventoryEngineService`
- Pipeline counts, availability, stock/lot ledger, weighted valuation, low-stock alerts
- `reserveStock` / `releaseReservation`
- `transferStock` — full lot warehouse move or partial split
- `createAdjustment` / `postAdjustment`
- `setLotHold` — Blocked / Damaged / InTransit

### Sales / Job hardening
- `salesService.createInvoice` — uses `applyLotMovement` (reservation-aware, no negative remaining)
- `jobService.issueToJob` — same helper + idempotency key

### APIs (`/api/inventory-engine/*`)
| Method | Path |
|---|---|
| GET | `/pipeline`, `/availability`, `/ledger`, `/lot/:id/ledger`, `/valuation/:id`, `/low-stock` |
| GET/POST | `/reservations`, `/reservations/:id/release` |
| GET/POST | `/transfers` |
| GET/POST | `/adjustments`, `/adjustments/:id/post` |
| POST | `/lots/:id/hold` |

### Frontend
- `inventoryEngine.api.js`
- `InventoryEngineModal` — Availability · Reserve · Transfer · Adjust · Ledger
- Dashboard **Inventory Engine**, **Stock Transfer**, **Reservation** menu items

### Migration
- `004_inventory_engine_indexes.js` — reservation/transfer/adjustment/lot hold indexes

---

## Exit criteria

| Criterion | Status |
|---|---|
| All qty changes via StockMovement | ✅ (sales/job/adjust/transfer paths) |
| Reservation blocks oversell | ✅ availability = remaining − reserved |
| Lot remaining never negative (txn + version) | ✅ `applyLotMovement` + optimistic version |
| Reconciliation inventory section clean | ⚠️ run `/api/integrity/reconcile` on dataset |

---

## Gaps / next (Sprint 2.4+)

- Barcode scan UI (field ready on lot)
- FIFO layer consumption picker on sales (currently explicit lotId)
- Reservation auto-consume on sales order → invoice (Sprint 2.5)
- Cycle count multi-line draft UI
- LIFO valuation option
- Cancel sale/purchase stock restore (pre-existing debt)

---

## Verification

```bash
# Backend module load
node -e "require('./services/inventoryEngineService'); console.log('ok')"

# Frontend build
cd frontend && npm run build

# Migration
cd backend && node scripts/migrate.js
```

---

## Score rationale

Strong movement centralization and reservation model; transfer/adjustment UI is functional but minimal. Reconciliation and concurrent-load stress tests recommended before production cutover.
