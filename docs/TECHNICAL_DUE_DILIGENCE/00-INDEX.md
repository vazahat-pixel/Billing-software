# Textile ERP SaaS — Complete Technical Due Diligence & Architecture Audit

| Field | Value |
|---|---|
| **Product** | Billing-software / Textile ERP SaaS |
| **Audit date** | 15 July 2026 |
| **Codebase root** | `c:\Users\admin\Desktop\Billing-software` |
| **Inspected layers** | Frontend (React/Vite), Backend (Express/Mongoose), MongoDB models, Offline/PWA, Admin SaaS console |
| **Audit method** | Full static code inspection of every route, controller, service, model, page, modal, store, middleware — no assumptions unmarked |
| **Primary stack** | React 19 + Zustand + Vite 8 \| Express 4 + Mongoose 8 + JWT + bcryptjs \| MongoDB \| IndexedDB offline \| Service Worker PWA |

---

## Document map (read in order)

| # | File | Section |
|---|---|---|
| 00 | This index | Navigation & scoring |
| 01 | `01-EXECUTIVE-SUMMARY.md` | Scores, launch readiness, risks, timeline |
| 02 | `02-PROJECT-STRUCTURE.md` | Folders, architecture, dead code, diagrams |
| 03 | `03-MODULE-INVENTORY.md` | Every business module status matrix |
| 04 | `04-FRONTEND-AUDIT.md` | Routes, modals, stores, mocks, route map |
| 05 | `05-BACKEND-AUDIT.md` | Controllers, services, middleware, deps |
| 06 | `06-DATABASE-AUDIT.md` | Every collection fields/indexes/risks |
| 07 | `07-API-AUDIT.md` | Complete endpoint catalog |
| 08 | `08-BUSINESS-FLOWS.md` | Purchase→Sales→Job→Accounting sequences |
| 09 | `09-TEXTILE-DOMAIN.md` | Industry workflow validation |
| 10 | `10-ACCOUNTING-AUDIT.md` | Double-entry, books, TB/BS/P&L |
| 11 | `11-GST-AUDIT.md` | CGST/SGST/IGST, GSTR1/2/3B compliance |
| 12 | `12-SECURITY-AUDIT.md` | JWT, tenancy, injection, RBAC |
| 13 | `13-PERFORMANCE-AUDIT.md` | Queries, indexes, React, N+1 |
| 14 | `14-QA-AUDIT.md` | Manual + automated test plans |
| 15 | `15-INTEGRATION-MATRIX.md` | Screen→API→DB→Reports |
| 16 | `16-PRODUCTION-READINESS.md` | Blockers, bug triage, priority |
| 17 | `17-ROADMAP.md` | Phases 1–7 to commercial launch |
| 18 | `18-CTO-FINAL-REPORT.md` | Sellability, rewrite vs keep, recommendations |

Companion interactive overview: Cursor Canvas `textile-erp-due-diligence.canvas.tsx` (open beside chat).

---

## Scoreboard (0–100, evidence-backed)

| Dimension | Score | Rationale (one line) |
|---|---:|---|
| Overall Health | **58** | Core billing/job/lot paths work; books, GST portal, utilities fake/incomplete |
| Production Readiness | **42** | Security gaps, accounting close broken, sales-return schema risk, utilities stubs |
| Architecture | **62** | Clear service layer + companyId tenancy; dual ledger/purchase stacks + orphan UI |
| Business Logic | **55** | Sales/purchase/job postings real; grey→finished, cash/contra, year-close missing |
| Code Quality | **57** | Transactional critical paths; dead code, client-trusted amounts, mixed styles |
| Security | **38** | No rate limit; RBAC not server-enforced; subscription bypass in development |
| Performance | **52** | Some indexes; outstanding N+1; no pagination on many lists; Dashboard monolith |
| Maintainability | **48** | Modal mega-shell; orphan pages; two API clients; duplicate purchase/ledger paths |
| Scalability | **45** | Single Mongo, no queue/workers; Usage limits unused; 30d JWT |
| Testing | **22** | Empty `__tests__`; Playwright script declared but no e2e suite found; ad-hoc scripts only |
| Technical Debt | **68** *(higher = more debt)* | Orphan UI, dead Inventory/LedgerEntry, fake utilities, incomplete GST |

**Launch Ready?** **NO**

**Estimated Completion:** **~55–60%** of a commercial textile ERP (core trading + lot stock + basic books + SaaS admin ~ done; accounting close, GST portal, production shop-floor, utilities ~ not)

**Estimated remaining work:** **14–22 engineer-weeks** to soft launch (SME traders); **28–40 engineer-weeks** to serious commercial claim (GST + year close + textile process fidelity).

---

## Evidence baselines (do not argue without re-reading)

- Live ERP UI = single route `/` → `frontend/src/pages/Dashboard.jsx` (modal shell). Comment in `App.jsx`: *"Only the Legacy Dashboard is kept"*.
- Live financial truth = `AccountingEntry` + `LedgerMaster` via `accountingService.js`.
- Dead parallel books = `LedgerEntry` + `ledgerService.js` / `ledgerController.js`.
- Dead purchase stack = `purchase.controller.js` + `purchase.service.js` + `Inventory.js`.
- Live purchase = `purchaseController.js` + `purchaseService.js` + `InventoryLot.js`.
- SaaS gate: `auth.middleware.js` + `subscription.middleware.js` + `featureGuard.js`.
- `PermissionMatrix` stored but **not** enforced as Express middleware.

---

## How to use this pack

1. Engineering leadership: start `01`, `16`, `18`.
2. Accounting/GST specialists: `10`, `11`, `08`.
3. Implementers rebuilding: `03`, `07`, `15`, `17`.
4. Security/DevOps: `12`, `13`.
5. QA: `14` as master checklist.

Every status claim in modules/APIs cites file paths discovered during inspection. Where something was **not found in code**, it is marked **MISSING** (not "assumed absent from docs").
