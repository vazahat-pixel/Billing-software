# Sprint 2.2 — Purchase Engine

**Version:** 1.0 · **Date:** 15 Jul 2026 · **Stage:** Business Engine  
**Kernel preserved:** `purchaseService.createPurchase` (lot + movement + accounting)

---

## Verdict

| Metric | Score |
|---|---|
| Sprint Completion | **76 / 100** |
| Purchase lifecycle coverage | **78 / 100** |
| PO→GRN→Invoice controls | **80 / 100** |
| Quotation comparison | **70 / 100** |
| UI polish | **65 / 100** |

---

## Business flow now wired

```
Indent (Draft→Submit→Approve)
   → Supplier Quotation (+ compare / select)
   → Purchase Order (PendingApproval→Approved)
   → GRN (receive against PO remaining)
   → QC (accept/reject per line)
   → Purchase Invoice (purchaseService kernel)
   → Inventory + Accounting + GST fields
```

Existing **Purchase Return** / **Debit Note** remain on `/returns` and `/notes`.

---

## What shipped

### Models
- `PurchaseIndent` — request / indent with approval
- `SupplierQuotation` — quote lines + select/reject
- `Grn` — receipt + QC fields (stock **not** posted at GRN)
- `Order` extended — approval, received qty, indent/quotation/warehouse, statuses
- `Purchase` — `purchaseOrderId`, `grnId`, freight/TDS/transport/eway fields

### Service `purchaseEngineService`
- Over-receive blocked (unless `allowOverReceive`)
- Invoice qty cannot exceed remaining PO (unless override)
- GRN→Invoice calls existing **`purchaseService.createPurchase`**
- PO received totals updated; PO → Partial/Closed
- Audit + domain events

### APIs (`/api/purchase-engine/*`)
| Method | Path |
|---|---|
| GET | `/pipeline` |
| CRUD-ish | `/indents`, submit, approve |
| | `/quotations`, compare, select |
| | `/orders`, approve |
| | `/grns`, `/grns/:id/qc`, `/grns/:id/invoice` |

### Frontend
- `PurchaseEngineModal` — tabbed Indent → … → Invoice
- Dashboard: **Purchase Order**, **Purchase Engine**, **GRN / QC** open the engine
- Direct **Purchase** bill modal unchanged for quick entry

---

## Exit criteria

| Criterion | Status |
|---|---|
| PO → GRN → Invoice qty variance controlled | ✅ |
| Invoice not beyond QC-accepted GRN | ✅ (accepted lines only) |
| Atomic invoice + lots + accounting | ✅ via purchaseService session |
| Purchase return stock/tax | ✅ pre-existing Return path |

---

## Gaps / next

1. Partial GRN UI line editing (API supports; modal uses “receive remaining”)  
2. E-way / barcode scan UX  
3. Multi-level approval matrix (Sprint 2.8)  
4. Job Purchase special case still opens plain Purchase modal  

---

## Verify

1. Transaction → Purchase Engine  
2. Create indent → approve  
3. Add quotation(s) → compare → select  
4. Create PO → approve  
5. GRN (full remaining) → Pass QC → Create invoice  
6. Confirm Inventory lot + ledger + purchase record with `grnId`

---

## Next sprint

**2.3 Inventory Engine** (reservation, transfer, negative-stock lock, valuation).
