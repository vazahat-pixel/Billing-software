# Sprint 2.1 — Master Data Engine

**Version:** 1.0 · **Date:** 15 Jul 2026 · **Stage:** Business Engine  
**Constraint:** No ERP shell redesign · Extend existing masters · Soft-delete over hard-delete  

---

## Verdict

| Metric | Score |
|---|---|
| Sprint Completion | **74 / 100** |
| Master Data Production Readiness | **72 / 100** |
| Opening balance / stock integrity | **85 / 100** |
| Location masters | **80 / 100** |
| Merge / import | **78 / 100** |
| Full catalog (every textile attribute UI) | **60 / 100** |

Sprint 2.1 establishes the **reference-data engine** Purchase/Inventory/Job/Sales will depend on. Not every cross-cutting UX (approval/favorites everywhere) is complete — APIs and models are in place.

---

## What shipped

### Models extended
- **Party:** types `Transport`, `Employee`, `Salesman`, `Agent`; `paymentTermsId`, `isFavorite`, `lastUsedAt`
- **Item:** `brand`, `pattern`, `quality`, `shade`, reorder levels, `barcode`, warehouse default, favorites
- **SubMaster:** + Quality, Pattern, Brand, Shade, Process, Machine, Department, PaymentTerms, Currency + soft-delete plugin
- **Warehouse:** Warehouse / Godown / Rack / Bin hierarchy (`parentId`)
- **FinancialYear**, **VoucherSeries** setup masters
- **InventoryLot:** `warehouseId`, `rate`

### Integrity fixes (audit P0 gaps)
- Opening Balance → **syncs LedgerMaster** (`partyService.syncOpeningToLedger`)
- Opening Stock → **Mongo transaction**, updates `Item.openingStock`, optional warehouse + rate, OPENING movement with idempotency key
- Party/Item **soft-delete** (no hard delete)
- SubMaster soft-delete

### APIs
| Route | Purpose |
|---|---|
| `/api/warehouses` | CRUD locations |
| `/api/masters/merge/parties` | Atomic party merge |
| `/api/masters/merge/items` | Atomic item merge |
| `/api/masters/import` | Dry-run / apply JSON rows |
| `/api/masters/export` | Export party/item/submaster/warehouse |
| `/api/masters/financial-years` | FY list/create/activate |
| `/api/masters/voucher-series` | Series list/create |

### Frontend (no chrome redesign)
- Dashboard Master menu: Color, Design, Quality, Pattern, Brand, Shade, Process, Machine, Department, Payment Terms, Currency, **Warehouse**
- **Merge Event** → real Merge & Import modal (was fake toast)
- Opening Stock → warehouse + rate fields
- Opening Balance still uses `updateParty` — backend now syncs ledger

### Migration
- `003_master_data_indexes` applied via `npm run migrate`

---

## Exit criteria status

| Criterion | Status |
|---|---|
| Transactional FKs via validated masters | ⚠️ Partial — Party/Item/Warehouse validate; Process still SubMaster string on Job for now |
| Soft-delete + version on masters | ✅ Party/Item/SubMaster/Warehouse/Book |
| Merge tool for duplicates | ✅ |
| Opening balances on live LedgerMaster | ✅ |
| Bulk import with dry-run | ✅ JSON API + Merge modal |
| Integrity reconcile for orphans | Reuse `/api/integrity/reconcile` |

---

## Remaining gaps (carry to 2.2+)

1. Dedicated FY/Voucher Series UI modals (API ready; menu entry optional later)  
2. Item Master form fields for brand/pattern/quality/shade (schema ready; classic modal may not show all fields yet)  
3. Favorites / recently-used UI chips  
4. Approval workflow on master create (Sprint 2.8)  
5. Job.`processType` still free string — promote to Process SubMaster ObjectId in Sprint 2.4  

---

## How to verify

1. Master → Opening Balance → save → check `ledgermasters` opening fields for that party  
2. Master → Warehouse → create MAIN / GODOWN  
3. Master → Opening Stock → select item + warehouse + rate → lot in inventory with `source: opening`  
4. Master → Merge Event → dry-run import / merge two test parties  
5. Master → Process / Quality / etc. via GenericMaster  

---

## Next

**Sprint 2.2 — Purchase Engine** (Indent → PO → GRN → QC → Invoice) on this master foundation.
