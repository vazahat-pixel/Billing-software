# Stage 2 — Business Engine (Core Business Operations)

**Version:** 1.0 · **Date:** 15 Jul 2026  
**Prerequisite:** Stage 1 Foundation Stabilization (Sprints 1.1–1.4) — complete  
**Expansion:** Original ~6-sprint sketch → **10 engineering sprints** (textile depth)

This stage turns the product from **generic multi-tenant billing** into a **Textile ERP operational engine**. Financial Engine (Stage 3) and Compliance (Stage 4) must **not** start until Stage 2 + **Business Simulation Week** pass.

---

## Stage goal

Complete textile business lifecycle with **zero operational mismatches**:

```
Customer Demand → Indent → PO → GRN → Purchase Invoice → Lot → Inventory
  → Job Work → Mill Receive → Finished Goods
  → Sales Order → Delivery Challan → Tax Invoice → Payment
  → Accounting → GST → Reports
```

UI shells already exist (modal ERP). Stage 2 depth-charges **business logic, documents, workflow, and validation** on the Stage 1 API/DB spine — without redesigning the Zero-Navigation shell unless a document requires it.

---

## Sprint map (10)

| Sprint | Name | Outcome |
|---|---|---|
| **2.1** | Master Data Engine | Textile masters as enterprise reference data (not CRUD-only) |
| **2.2** | Purchase Engine | Requisition → PO → GRN → QC → Invoice → Return |
| **2.3** | Inventory Engine | Lot/warehouse/valuation/reservation/negative-stock lock |
| **2.4** | Production & Job Work Engine | Grey→process→finished USP (yield, wastage, costing) |
| **2.5** | Sales Engine | Quote → Order → Challan → Invoice → Return → collections |
| **2.6** | Business Automation Engine | Auto posting, numbering, alerts, rules |
| **2.7** | Document Engine | Print/PDF/WhatsApp/templates/barcode |
| **2.8** | Workflow Engine | Approvals, credit limit, discount, escalation |
| **2.9** | Business Validation Engine | Pre-save guards (FY lock, GST, stock, duplicates) |
| **2.10** | Business Readiness Certification | Score + simulation gate |

**Then:** Business Simulation Week (not a coding sprint) → only then Stage 3 Financial Engine.

---

## Current platform baseline (from Stage 1)

| Capability | Status entering Stage 2 |
|---|---|
| FE API services / store | Sprint 1.1–1.3 ✅ |
| Security pipeline, company isolation | 1.2 ✅ |
| Dashboard KPIs server-side | 1.3 ✅ |
| Mongo transactions, indexes, recon API | 1.4 ✅ |
| Party / Item / Book masters | Partial CRUD ✅ |
| SubMaster types | Partial ✅ |
| Purchase / Sales create + lot + accounting | Thin lifecycle ✅ |
| Job issue / receive | Basic ✅ |
| Orders / Returns / Notes | Thin ✅ |
| GRN / Indent / Quotation / Warehouse bins | ❌ Missing or stub |
| Approval workflows | ❌ Missing |
| Server GST recompute | ❌ Still client-trusted |
| Cancel → stock restore | ❌ Gap (use returns) |
| Grey→finished SKU map | ❌ Audit gap |
| Document branding / multi-template | Partial (invoice PDF) |

---

## Sprint 2.1 — Master Data Engine

**Not CRUD — reference data foundation for every later engine.**

### Target master catalog

| Domain | Masters |
|---|---|
| Parties | Customer, Supplier, Broker, Transport, Employee, Salesman, Agent, Job Worker |
| Items | Item, Group, Category, Brand, Fabric, Design, Pattern, Quality, Color, Shade, Size, Unit, HSN, GST Rate |
| Locations | Warehouse, Godown, Rack, Bin |
| Production | Process, Machine, Department |
| Finance setup | Financial Year, Voucher Series, Books, Payment Terms, Credit Days, Currency |
| Opening | Opening Stock, Opening Ledger, Opening Outstanding, Opening GST |

### Cross-cutting behaviors (every master)

Create · Edit · Soft-delete · Merge · Import · Export · Approval (when required) · History · Audit · Versioning · Inline-create · Favorites · Recently used · Bulk update/import · Search · Filters · Hierarchy

### Build approach (recommended order)

1. Normalize **Party type + attributes** and **Item textile attributes** on existing models (extend, don’t fork).
2. Promote high-churn SubMasters (Color, Design, Quality, Process, Transport) to first-class APIs with company isolation + soft delete.
3. Introduce **Warehouse / location** models (lots gain `warehouseId` — additive).
4. Wire Opening Stock/Ledger/Outstanding/GST onto Stage 1 integrity (single source of truth).
5. Import/export + inline-create against centralized `api/*.api.js` (no page axios).

### Exit criteria (2.1)

- [ ] Every transactional FK (party/item/process/warehouse) resolves via validated master APIs  
- [ ] Soft-delete + version on masters; merge tool for duplicate parties/items  
- [ ] Opening balances appear on live LedgerMaster / lots (not Party-only orphan)  
- [ ] Bulk import with dry-run validation report  
- [ ] Integrity reconcile clean for masters/orphan refs  

---

## Sprint 2.2 — Purchase Engine

**Flow:** Request → Indent/PO → Approval → Supplier → GRN → QC → Purchase Invoice → Inventory → Accounting → GST → Outstanding

### Deliver

Purchase Requisition · Indent · PO · Quotation & comparison · Approval · GRN · QC · Purchase Invoice · Return · Debit Note · Freight/expenses · TDS/GST · Payment terms · Transport/Vehicle/LR/E-way hooks · Lot/batch · Barcode/QR readiness

### Baseline reuse

`purchaseService` create (lot + movement + accounting) remains the **invoice posting kernel**; wrap earlier docs that **convert** into that kernel.

### Exit criteria

- [ ] PO → GRN → Invoice quantity variance controlled  
- [ ] Invoice cannot post more than QC-accepted GRN (configurable override with audit)  
- [ ] Atomically: invoice + lots + movements + accounting (Stage 1 session pattern)  
- [ ] Purchase return reverses stock + tax correctly  

---

## Sprint 2.3 — Inventory Engine

Opening · Stock/Lot/Batch ledger · Warehouse/Rack/Bin · Transfer · Reservation · Availability · Damaged/Blocked/In-transit · Adjustment · Cycle count · Valuation (FIFO/WAVG first; LIFO optional) · Reorder min/max · **Negative stock prevention** · Barcode/QR/serial readiness

### Exit criteria

- [ ] All qty changes via StockMovement only  
- [ ] `POST /integrity/reconcile` inventory section clean on simulation dataset  
- [ ] Reservation blocks oversell  
- [ ] Lot remaining never goes negative under concurrent sales (txn + version)  

---

## Sprint 2.4 — Production & Job Work Engine (USP)

Grey → Mill Issue → Printing/Dyeing/Embroidery/Finishing/Packing/Stitching → QC → Shrinkage/Loss/Wastage/Yield → Mill Receive → Finished goods · Roll tracking · Lot conversion · Process/job costing · Vendor billing · Internal vs external production · Status board

### Exit criteria

- [ ] Configurable process chain per job  
- [ ] Grey→finished **itemId mapping** on receive  
- [ ] Wastage/yield/cost posts inside transaction (Stage 1.4 pattern)  
- [ ] Finished lot inherits process history  

---

## Sprint 2.5 — Sales Engine

Quotation → Order → Approval → Picking/Packing → Delivery Challan → Tax/Retail/BOS/Proforma → Return/Credit/Replacement → Dispatch/LR/Tracking · E-way/E-invoice hooks · Print/PDF/WA/Email · Outstanding/collections

### Exit criteria

- [ ] Order → Challan → Invoice allocation without double stock issue  
- [ ] Challan reduces reserved/available consistently  
- [ ] Invoice posting server-validated totals (start 2.5 / harden 2.9)  
- [ ] Sales return restores lot (enum already allows `return`)  

---

## Sprint 2.6 — Business Automation Engine

Auto ledger/inventory/GST posting · Voucher/invoice series · Outstanding refresh · Cost allocation · Profit snapshots (documented) · Notifications · Low stock/expiry · Approval triggers · Duplicate detection · Configurable business rules

---

## Sprint 2.7 — Document Engine

Preview · Print · PDF · Excel · Email · WhatsApp · Barcode/QR · Digital signature hooks · Branding · Templates · Thermal/A4/Dot-matrix · Multi-language readiness

Reuse `InvoicePDFViewer` / print pages — templatize, don’t redesign ERP chrome.

---

## Sprint 2.8 — Workflow Engine

Approval graphs for Purchase/Sales/Stock/Discount/Credit-limit · Roles · Escalation · Notifications · Activity timeline · Tasks · Comments · Attachments

---

## Sprint 2.9 — Business Validation Engine

Pre-save block: duplicate invoice · negative stock · invalid GSTIN · credit limit · inactive party · expired subscription · locked FY · closed voucher · deleted lot · wrong warehouse/process · unbalanced journal

Central `validateBusiness(context)` used by all engines.

---

## Sprint 2.10 — Business Readiness Certification

End-to-end scripts for Purchase · Inventory · Production · Sales · Accounting · GST · Reports · Automation · Approval · Audit.

**Output:** Business Readiness Score + gap list. Gate ≥ agreed threshold (recommend **≥ 85**) before Simulation Week.

---

## Business Simulation Week (mandatory before Stage 3)

Not optional. Mirrors enterprise ERP operational soak:

1. 100+ purchase transactions (PO/GRN/invoice mix)  
2. Inventory through multi-process job work  
3. Finished goods + sales (order/challan/invoice)  
4. Returns both ways  
5. Verify stock, lots, outstanding  
6. Nightly `POST /api/integrity/reconcile` → **status: clean** (or documented waived warnings only)  
7. Written sign-off: **zero blocking mismatches**

**Only then** open Stage 3 — Financial Engine.

---

## Stage 2 exit deliverables

- [ ] Complete textile purchase lifecycle  
- [ ] Complete inventory lifecycle  
- [ ] Complete job-work lifecycle (USP)  
- [ ] Complete sales lifecycle  
- [ ] Real-time stock + lot tracking  
- [ ] Barcode-ready movements  
- [ ] Workflow + document + validation engines  
- [ ] Zero-navigation UX preserved  
- [ ] Simulation Week passed  
- [ ] Business Readiness Score published  

---

## Sequencing rules

1. **Do not** start Sprint 2.2 until 2.1 masters can feed FKs safely.  
2. **Do not** deepen accounting (Stage 3) on unstable lots — Simulation Week is the lock.  
3. Prefer **convert existing docs → kernel services** over duplicate “savePurchaseNew” APIs (Stage 1 principle).  
4. Every new write path must use **Mongo sessions** + Stage 1 repo/company isolation.  
5. Frontend stays on `api/*.api.js` — no page-level Axios.

---

## Immediate next step

**Kick off Sprint 2.1 — Master Data Engine** when ready: extend Party/Item/SubMaster, add Warehouse, fix Opening sync, import/export + audit behaviors.

Await explicit “start Sprint 2.1” to begin implementation.
