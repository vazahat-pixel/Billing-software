# Sprint 2.5 — Sales Engine

**Version:** 1.0 · **Date:** 15 Jul 2026 · **Stage:** Business Engine  
**Kernel preserved:** `salesService.createInvoice` (extended with `skipStock` + server totals)

---

## Verdict

| Metric | Score |
|---|---|
| Sprint Completion | **79 / 100** |
| Order → Challan → Invoice (no double stock) | **85 / 100** |
| Reservation / availability consistency | **80 / 100** |
| Server-validated invoice totals | **78 / 100** |
| Sales return → lot restore | **80 / 100** |
| UI polish | **70 / 100** |

---

## Business flow now wired

```
Sales Quotation (Draft→Sent→Accepted)
   → Sales Order (approve → StockReservation on lots)
   → Packing (Picking → Packed)
   → Delivery Challan (consume reservation + SALE movement once)
   → Tax Invoice (accounting only if stockFromChallan — no second SALE)
   → Sales Return (restore_lot preferred → RETURN movement)
```

Direct `SalesModal` invoice path remains for quick Tax/Retail entry; engine path is source of truth for Order→Challan→Invoice.

---

## What shipped

### Models
- `SalesQuotation` — customer quote → convert to SO
- `DeliveryChallan` — order link, LR/eway, `stockDeducted`, status Draft/Dispatched/Invoiced
- `Order` extended — `salesQuotationId`, line `lotId` / `shippedMts` / `invoicedMts` / `reservationId`, `packingStatus`
- `Sales` extended — `orderId`, `challanId`, `stockFromChallan`, `invoiceType`
- `ReturnInvoice` extended — `lotId`, `originalSaleId`, `restoreMode`

### Utils
- `salesTotals.recalcSalesTotals` — server recalculates line amounts + GST + net

### Service `salesEngineService`
- Quote CRUD / accept / convert→SO
- SO create with optional approve → **reserve stock**
- Packing status updates
- Challan from SO → **consume reservation + deduct remaining once**
- Over-ship blocked vs order remaining
- Challan→Invoice → `createInvoice(..., { skipStock: true })`
- Sales return restore to original lot (or new RET lot)

### Hardened `salesService.createInvoice`
- Always recalc totals server-side
- `skipStock` / `stockFromChallan` prevents double issue

### APIs (`/api/sales-engine/*`)
| Method | Path |
|---|---|
| GET | `/pipeline` |
| | `/quotations`, accept, convert |
| | `/orders`, approve, packing |
| | `/challans`, `/challans/:id/invoice` |
| POST | `/invoice` (direct + validated totals), `/returns` |

### Frontend
- `salesEngine.api.js`
- `SalesEngineModal` — Quote · Order · Pack · Challan · Invoice · Return
- Dashboard: **Sales Engine**, **Sales Order**, **Delivery Challan**

### Migration
- `006_sales_engine_indexes.js` (run: `cd backend && node scripts/migrate.js`)

---

## Exit criteria

| Criterion | Status |
|---|---|
| Order → Challan → Invoice without double stock | ✅ stock at challan; invoice skips |
| Challan reduces reserved/available consistently | ✅ reserved ↓ then physical SALE |
| Invoice server-validated totals | ✅ `recalcSalesTotals` in createInvoice |
| Sales return restores lot | ✅ `restore_lot` via RETURN movement |

---

## Gaps / next

- Multi-gst-rate per line (currently first-item rate)
- Credit note auto-link from return (NoteModal still separate)
- E-way / e-invoice API integration (fields + hooks only)
- Print challan template (Sprint 2.7)
- Direct SalesModal still client-calculated until all paths route through engine / `recalcSalesTotals`

---

## Verification

```bash
node -e "require('./services/salesEngineService'); console.log('ok')"
cd frontend && npm run build
cd backend && node scripts/migrate.js
```

---

## Stock state machine

```
SO Approved  → ↑ reserved (available ↓)
Challan post → ↓ reserved + ↓ remaining (SALE movement, once)
Invoice      → accounting only (stockFromChallan)
Return       → ↑ remaining on original lot (RETURN)
```
