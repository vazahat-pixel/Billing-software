# Sprint 2.4 — Production & Job Work Engine

**Version:** 1.0 · **Date:** 15 Jul 2026 · **Stage:** Business Engine  
**Kernel preserved:** `jobService.issueToJob` / `receiveFromJob` (extended, not replaced)

---

## Verdict

| Metric | Score |
|---|---|
| Sprint Completion | **77 / 100** |
| Process chain coverage | **78 / 100** |
| Grey→finished mapping | **80 / 100** |
| Wastage/yield/cost in txn | **75 / 100** |
| Status board UI | **72 / 100** |

---

## Business flow now wired

```
Grey lot
   → Issue with process chain template (Dyeing→Printing→Finishing…)
   → Step advance / optional QC gate per step
   → Receive finished goods (output item from mapping)
   → New lot: parentLotId + processHistory + rate (grey cost + charges)
   → Accounting: job charges + abnormal wastage only (within tolerance = shrinkage)
```

Existing **Mill Issue / Embroidery modals** remain for quick entry; **Production Engine** is the full lifecycle workspace.

---

## What shipped

### Models
- `ProcessChainTemplate` — configurable multi-step chains (seeded defaults: Dyeing, Print, Embroidery)
- `ItemProcessMapping` — grey item + process → finished item
- `Job` extended — `steps[]`, `currentStepIndex`, `outputItemId`, `chainTemplateId`, `productionType`, `toleranceWastagePct`, `finishedLotId`
- `InventoryLot` extended — `parentLotId`, `sourceJobId`, `processHistory[]`

### Service `productionEngineService`
- Pipeline counts + kanban **status board**
- Chain template CRUD + auto-seed defaults
- Item mapping CRUD + resolve
- Delegates issue/receive/advance/QC to hardened `jobService`

### Hardened `jobService`
- Issue builds steps from chain template
- Receive resolves **outputItemId** from mapping
- Wastage split: tolerance vs **abnormal** (accounting only on abnormal)
- Finished lot **rate** = (grey material cost + process charges) / received qty
- `applyLotMovement` for RECEIVE (consistent with ISSUE)
- `advanceStep`, `performQc` for multi-stage jobs

### APIs (`/api/production-engine/*`)
| Method | Path |
|---|---|
| GET | `/pipeline`, `/board`, `/jobs`, `/processes` |
| GET/POST | `/chains` |
| GET/POST | `/mappings`, `/mappings/resolve` |
| POST | `/issue`, `/receive` |
| POST | `/jobs/:id/advance`, `/jobs/:id/qc` |

### Frontend
- `productionEngine.api.js`
- `ProductionEngineModal` — Board · Issue · Process · QC · Receive · Mapping
- Dashboard: **Production Engine** menu item

### Migration
- `005_production_engine_indexes.js`

---

## Exit criteria

| Criterion | Status |
|---|---|
| Configurable process chain per job | ✅ templates + embedded steps |
| Grey→finished itemId mapping on receive | ✅ mapping table + outputItemId |
| Wastage/yield/cost posts inside transaction | ✅ txn + tolerance split + rate |
| Finished lot inherits process history | ✅ processHistory + parentLotId |

---

## Gaps / next

- `IssueModal` (Mill Issue) still not API-aligned — use Production Engine Issue tab
- Roll/pcs tracking on Job (UI fields exist in IssueModal but not persisted)
- Vendor billing integration beyond charges journal
- Multi-stage receive without final receive (intermediate WIP lots) — future
- Route `/jobwork` page or deprecate orphaned `JobWorkPage`

---

## Verification

```bash
node -e "require('./services/productionEngineService'); console.log('ok')"
cd frontend && npm run build
cd backend && node scripts/migrate.js
```

---

## Score rationale

Core USP path is wired with transactional integrity and lineage. Board UI is functional kanban, not full MES. Mill Issue modal alignment deferred to avoid scope creep.
