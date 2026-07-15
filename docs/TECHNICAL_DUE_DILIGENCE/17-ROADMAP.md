# 17 — Roadmap to Commercial Launch

Seven phases, sequenced by dependency (you cannot harden accounting you haven't fixed; you cannot claim GST compliance on a tax engine that doesn't exist yet). Each phase lists **scope**, **week estimate**, **suggested owner(s)**, and **exit criteria** — the exit criteria are the actual gate; do not advance a phase until they are met and verified by QA (`14-QA-AUDIT.md`).

Two tracks are offered at the end: **Track A — Beta/Early-Access launch** (Phases 1–2 + partial 6, ~6–8 weeks) and **Track B — Full commercial ERP claim** (all 7 phases, ~26–34 weeks). Both are laid out below; pick the track based on the sellability verdict in `18-CTO-FINAL-REPORT.md`.

---

## Phase 1 — Critical Bug Fixes (Weeks 1–2)

**Goal**: Stop the bleeding. Fix everything that actively crashes, silently corrupts data, or is a one-line security hole. No new features in this phase.

**Owner**: 1 senior backend engineer (full-time), 1 QA (part-time from day 3)

**Scope** (maps to `16-PRODUCTION-READINESS.md`):
- P0-1: Fix `InventoryLot.source` enum to include `'return'`; add regression test
- P0-7: Remove `NODE_ENV === 'development'` subscription bypass; replace with explicit, safely-defaulted flag
- P0-6: Remove/guard `DEMO_COMPANY` default in `InvoicePDFViewer.jsx`/`invoiceHelpers.js`; audit every print/PDF/WhatsApp call site
- P0-8: Restore or explicitly block stock-inconsistent cancellation for Sales/Purchase (`deleteSale`/`deletePurchase`)
- C-1: Fix the 4 confirmed N+1 loops (Outstanding Report, Sales Register, Purchase Register) with a single aggregation pattern
- C-2: Add `isActive` check to `authMiddleware` so deactivated users' live JWTs are rejected
- C-4: Add `checkPeriodLocked` to `salesService.createInvoice` and `purchaseService.createPurchase`
- C-5: Add `rate` field to `InventoryLot`, populate at creation, fix stock valuation
- PERF-2 (partial): Add pagination to the 5 highest-traffic unbounded list endpoints (Parties, Items, Jobs, Accounting Ledgers, Accounting Payments)
- DB-1: Add all missing compound indexes from `13-PERFORMANCE-AUDIT.md` §13.2

**Exit criteria**:
- [ ] Sales Return completes successfully end-to-end in a scripted test, 0 crashes over 50 repeated runs
- [ ] `NODE_ENV=development` no longer bypasses subscription/license checks under any circumstance
- [ ] Zero invoices/PDFs print `DEMO_COMPANY` in a 20-invoice smoke test across different companies
- [ ] Cancelling a Sales/Purchase either correctly reverses stock or is blocked with a clear message once stock has moved downstream — behavior is deterministic and tested, not undefined
- [ ] Outstanding Report on a 500-party/2,000-invoice seeded dataset returns in <2s (baseline before fix should be measured and published alongside this result)
- [ ] Deactivated user's existing token is rejected on the next API call within the same test session
- [ ] Trial Balance still balances (Dr=Cr) after every fix above — run the full accounting invariant suite from `14-QA-AUDIT.md` §14.4 as a regression gate
- [ ] All new/changed compound indexes deployed and confirmed via `explain()` that the target queries now use them

---

## Phase 2 — Business Logic Completion (Weeks 3–6)

**Goal**: Make the core trading loop (Purchase→Sales→Job→Return→Payment) behave correctly and consistently end-to-end, including the gaps that are "missing features" rather than "crashes."

**Owner**: 2 backend engineers, 1 frontend engineer, 1 QA (full-time)

**Scope**:
- P0-2: Build and roll out server-side RBAC middleware reading `PermissionMatrix`, applied to all tenant-mutating routes (Sales, Purchase, Accounting, Inventory, Jobs, Returns, Notes, Orders, Parties, Items)
- M-3: Design and implement grey→finished item/SKU conversion on job receive (item-mapping concept in `Job.js`/`jobService.js`, minimally a configurable "output item" field per job type)
- M-4: Verify and fix Opening Balance sync between `Party` and `LedgerMaster`
- M-5: Persist job-work accounting-posting failures to a reviewable location (`AuditLog` or dedicated `FailedPosting` collection) instead of console-only
- M-10: Build or explicitly deprecate Order→Invoice conversion (auto-fill Sales/Purchase modal from an approved Order)
- M-6/M-7: Delete dead ledger stack (`ledgerRoutes.js`, `ledgerController.js`, `ledgerService.js`, `LedgerEntry` model) and dead purchase stack (`purchase.controller.js`, `purchase.service.js`, `Inventory.js`) — or formally deprecate with a 410 response if any external consumer might exist
- M-8: Delete orphaned multipage UI scaffolding (`pages/dashboard/Dashboard.jsx`, `Sidebar.jsx`, `MainLayout.jsx`) — confirm with product owner that the modal-shell architecture is the permanent direction first
- PERF-2 (remainder): Paginate all remaining unbounded list endpoints
- PERF-6/7: Lazy-load Dashboard modals, split `GstModals.jsx`
- PERF-9: Delete `utils/api.js`, consolidate on `api/client.js`

**Exit criteria**:
- [ ] A user with a `PermissionMatrix` role set to `canCreate: false` for Sales is provably blocked by a direct API call (not just hidden in UI) — automated test from `14-QA-AUDIT.md` §14.2.19
- [ ] A job configured to output a different finished item than its grey input correctly creates the finished lot under the correct target `itemId`
- [ ] Opening balance entered via the UI appears correctly on that party's real ledger statement, verified by test
- [ ] Zero references to `LedgerEntry`, `ledgerService.js`, `purchase.controller.js`, `purchase.service.js`, `Inventory.js` remain in the codebase (grep-verified) — or, if kept for a transition period, all are marked `@deprecated` and return 410 from their routes
- [ ] All 12+ previously-unpaginated list endpoints from `13-PERFORMANCE-AUDIT.md` §13.4 now paginate with tested `page`/`limit` bounds
- [ ] Dashboard initial bundle size reduced (measured via bundle analyzer before/after) after lazy-loading modals
- [ ] Full regression pass of `14-QA-AUDIT.md` §14.2 (all screen checklists) with zero new P0/P1 regressions

---

## Phase 3 — Accounting Hardening (Weeks 7–11)

**Goal**: Make the books defensible for a real business — the single biggest gap standing between "billing software" and "ERP with real accounting."

**Owner**: 1 backend engineer with accounting-domain fluency, 1 accounting/CA subject-matter reviewer (part-time consulting), 1 QA

**Scope**:
- P0-4: Design and build financial year close: snapshot closing balances per `LedgerMaster`, generate opening balances for the new year, lock the closed period via existing `lockedUntilDate` mechanism, tag/archive `AccountingEntry` records by financial year
- P0-3 (accounting half): Build server-side recomputation/validation of invoice totals against `Item` master rate/GST data (shared scope with Phase 4's tax engine — sequence the shared pieces once)
- Build real Cash/Bank/Contra voucher types distinct from generic Payment/Receipt (currently only `Payment`/`Receipt`/`Journal` confirmed) — needed for a Tally-class chart-of-accounts experience
- Replace the 17 Utilities `alert()` stubs relating to accounting (`Backup`, `Restore`, `Closing/UnClosing Year`, `New A/c Year`, `Transfer To Next Year`, `Voucher Relndex`, `Missing Series`, `Auto Expense Entry`) with either real implementations or clearly labeled "not yet available" states — do not ship silent fake success alerts
- Add automated nightly double-entry integrity check (sum(Dr) === sum(Cr) across all `AccountingEntry`) as a monitoring job, not just a QA test

**Exit criteria**:
- [ ] A full year-close dry run on seeded 12-month data produces a correct opening trial balance for year N+1 that matches year N's closing trial balance
- [ ] Locked periods cannot be violated by **any** voucher-creating or invoice-creating endpoint (extends C-4 fix to full coverage)
- [ ] Balance Sheet `isBalanced: true` holds across a simulated year boundary
- [ ] CA/accounting SME reviewer signs off in writing that Trial Balance, P&L, and Balance Sheet outputs are structurally correct per standard Indian accounting practice (this is a domain sign-off, not just a code-correctness check)
- [ ] Real Cash/Bank/Contra vouchers available and correctly posting
- [ ] Zero remaining `alert()`-only stubs under the "Company"/"Utilities" accounting-adjacent menu items

---

## Phase 4 — GST Compliance (Weeks 12–17)

**Goal**: Either make the GST claims true, or make the product's actual GST capability honestly scoped. This phase's *output* (real integration vs. relabeling) is itself a business decision that should be made with input from `18-CTO-FINAL-REPORT.md` before work starts.

**Owner**: 1 backend engineer, GST/compliance subject-matter reviewer (part-time consulting), 1 frontend engineer, 1 QA

**Scope (if pursuing real compliance — Track B)**:
- Validate and align GSTR-1 JSON export against the actual current GSTN portal schema; remove the placeholder `hash`/`version` fields and replace with a schema-conformant structure
- Integrate with a GSP (GST Suvidha Provider) API or build a documented manual-upload-ready export, replacing the fabricated `Gst2bMatchingModal` with a real GSTR-2B ingestion (upload the JSON GSTN provides, diff against ERP purchase data)
- Fix hardcoded Gujarat state-code (`'24'`) interstate detection to use the company's actual registered state generically
- Build the server-side tax engine referenced in Phase 3 fully (item-rate + GST-rate driven recompute, validated against client submission, with a documented tolerance and override-audit-trail for manual corrections)
- Remove or replace the fake "File Return" 2-second simulation with either a real GSP filing call or an explicit "Download for filing via portal/CA" flow with correct expectations set in the UI copy

**Scope (if relabeling for beta — Track A, much shorter)**:
- Add a persistent "Beta / For internal reconciliation only — file via your CA or the GST portal" banner to GSTR-1, GSTR-2, GSTR-3B, CA Dashboard, and explicitly hide or bold-red-label `Gst2bMatchingModal` as simulated data
- Remove the fake "File Return" button or relabel it "Mark as Filed (manual)" with no simulated portal call

**Exit criteria (Track B / real compliance)**:
- [ ] GSTR-1 JSON export validated by an independent GST filing tool or CA against a live GSTN schema sample, zero structural errors
- [ ] GSTR-2B reconciliation ingests a real downloaded GSTN JSON and produces genuine match/mismatch results, not fabricated ones
- [ ] Interstate/intrastate split correct for a non-Gujarat test company
- [ ] GST/compliance SME reviewer signs off in writing

**Exit criteria (Track A / relabeling)**:
- [ ] No screen in the product implies real-time GSTN portal connectivity where none exists
- [ ] Sales/marketing collateral matches actual capability (cross-check with `18-CTO-FINAL-REPORT.md` sellability verdict)

---

## Phase 5 — Inventory & Production Fidelity (Weeks 18–21)

**Goal**: Match the textile-specific job-work/grey-to-finished workflow that is the product's actual market differentiator (Surat-style traders), and close remaining inventory-integrity gaps.

**Owner**: 1 backend engineer, 1 frontend engineer, domain reviewer (textile trader or ops person from target customer segment), 1 QA

**Scope**:
- Complete grey→finished item/SKU conversion begun in Phase 2 with full BOM-like configurability (multiple grey inputs → one finished output, wastage-adjusted yield tracking)
- Add FEFO/lot-priority picking logic and the `{companyId, itemId, status}` index from `13-PERFORMANCE-AUDIT.md` §13.2 to support it at scale
- Concurrency-harden lot stock deduction (Sales/Job Issue racing against the same lot) — verify Mongo transaction isolation actually prevents overdraft under real concurrent load (load-test, not just code review)
- Fix `LOT-`/`RET-` ID generation to use the existing `Counter` atomic-sequence pattern instead of `Date.now()` + random suffix, eliminating even the small residual collision risk
- Wire Order→Invoice conversion (if chosen to build rather than deprecate in Phase 2) fully into the textile order-to-delivery flow
- Add stock-value costing method decision (FIFO/weighted-average) formally, now that `InventoryLot.rate` exists from Phase 1 — decide and document the costing method, don't leave it implicit

**Exit criteria**:
- [ ] A job processing 2 grey lots into 1 finished SKU (with a defined wastage %) produces correct finished-lot quantities and correct grey-lot depletion, verified by a domain reviewer against how their business actually works
- [ ] Load test: 20 concurrent Sales/Job-Issue requests against the same lot never produce negative `remainingMtrs`
- [ ] Zero lot-ID collisions across a 500-purchase concurrent-submission stress test
- [ ] Stock valuation reports show correct, non-zero, costing-method-consistent values across Purchase, Job-Receive, and Opening-Stock sourced lots

---

## Phase 6 — Production Hardening (Weeks 22–25, overlaps with Phase 5 where possible)

**Goal**: Everything needed to run this safely and observably for real paying customers at moderate scale — the non-domain-specific "make it production-grade" work.

**Owner**: 1 backend/DevOps-leaning engineer, 1 QA, security reviewer (part-time)

**Scope**:
- Full security pass per `12-SECURITY-AUDIT.md` (rate limiting on auth endpoints, JWT TTL review, input sanitization audit for `$regex`/injection patterns flagged in `13-PERFORMANCE-AUDIT.md` §13.2 item search)
- Wire up CI: add `jest`/`supertest`/`mongodb-memory-server` to `backend/package.json`, add a `test` script, build out the automated test suites specified in `14-QA-AUDIT.md` §14.9, gate merges on green CI
- Cross-tenant isolation sweep test suite (§14.6 of QA audit) run and passing across every `companyId`-scoped model/route
- Remaining performance items from `13-PERFORMANCE-AUDIT.md`: config-poll interval increase + ETag, table virtualization on large masters/ledgers, Zustand store selector migration for hottest components
- Replace remaining Utilities `alert()` stubs not already handled in Phase 3 (`Email Option`, `Missing Views Code`, `Application Sync`, `Bulk Whatsapp`, `Backup Script Wise`, `Single Firm Backup/Restore`, `Complain Form`, `Update DataBase`, `Information`) with real functionality or clean removal
- Formal backup/restore and disaster-recovery runbook for the actual MongoDB deployment (distinct from the fake in-app "Backup" button)
- Load/perf testing pass against the fixed N+1/pagination work — establish and document real capacity numbers (concurrent users, dataset sizes) the system can handle

**Exit criteria**:
- [ ] CI pipeline green-gates every PR with unit + integration + E2E tests; test coverage on `services/*.js` ≥70%
- [ ] Cross-tenant isolation sweep: 0 leaks across all ~20 tenant-scoped resource types
- [ ] Rate limiting confirmed active on `/auth/login`, `/auth/register`, `/auth/forgot-password`
- [ ] Documented, tested backup/restore runbook exists and has been dry-run at least once
- [ ] Published capacity/performance baseline (e.g., "supports N concurrent users and M documents per collection with P95 <Xs on report endpoints") replaces the current absence of any such number
- [ ] Zero remaining non-functional `alert()` stubs anywhere in the product

---

## Phase 7 — Commercial Launch Readiness (Weeks 26–28+)

**Goal**: Final polish, documentation, and go-to-market alignment specifically because this is being sold, not just used internally.

**Owner**: Full team + product/founder involvement for positioning decisions

**Scope**:
- Finalize and legally review sellability positioning against `18-CTO-FINAL-REPORT.md` verdict (beta/early-access textile billing vs. full enterprise ERP claim) — marketing copy, pricing page, and sales collateral must match actual capability from Phase 4's outcome
- Customer onboarding flow polish (Signup → Company setup → first Purchase/Sales walkthrough)
- Support/runbook documentation for common failure modes surfaced throughout this audit (e.g., "what to do if a Sales Return fails," pre-Phase-1-fix)
- Final full regression pass of the entire `14-QA-AUDIT.md` checklist (all 380+ manual cases, all API cases) with sign-off recorded
- Pricing/plan/subscription gating final verification pass (re-run P0-7 test on the actual production deployment configuration, not staging)
- Pilot cohort selection and staged rollout plan (start with a small number of textile trading customers matching the Surat/grey-goods profile the product is actually built for, before broader claims)

**Exit criteria**:
- [ ] Full QA sign-off gate from `14-QA-AUDIT.md` §14.10 satisfied
- [ ] Marketing/sales materials reviewed against actual shipped capability, no overclaiming
- [ ] Pilot cohort identified and onboarding-ready
- [ ] Production `NODE_ENV`/config verified live, not just in staging
- [ ] Go/no-go decision made and recorded by the business owner, informed by this entire audit pack

---

## 17.1 Two-Track Summary

### Track A — Beta / Early-Access Launch (textile billing for Surat-style grey/finished traders)

| Phase | Weeks | Cumulative |
|---|---|---|
| 1 — Critical Bugs | 1–2 | 2 |
| 2 — Business Logic | 3–6 | 6 |
| 6 (partial — security/RBAC/CI essentials only) | 7–8 | 8 |
| 4 (relabeling only, not real GSP integration) | +0.5 week inside Phase 6 | 8 |
| 7 (lightweight) | 9 | **~9 weeks total** |

This matches the "beta/early access" sellability verdict in `18-CTO-FINAL-REPORT.md`: **legal GST claims must be removed and year-close deferred/disclosed** for this track to be honest.

### Track B — Full Commercial "Textile ERP with GST Compliance" Claim

| Phase | Weeks | Cumulative |
|---|---|---|
| 1 | 1–2 | 2 |
| 2 | 3–6 | 6 |
| 3 | 7–11 | 11 |
| 4 (real GSP integration) | 12–17 | 17 |
| 5 | 18–21 | 21 |
| 6 | 22–25 | 25 |
| 7 | 26–28 | **~28 weeks total** |

Matches the **28–40 engineer-week** range already cited in `00-INDEX.md` for the full commercial claim, allowing for schedule risk/buffer at the high end (GSP integration and CA sign-off timelines are the least controllable dependencies).

---

## 17.2 Cross-Cutting Owners Needed Throughout

| Role | Why needed | Phases involved |
|---|---|---|
| Backend engineer(s) (1–2) | Core implementation | All |
| Frontend engineer | Dashboard refactor, lazy-loading, GST/ledger UI rebuilds | 2, 4, 5, 6 |
| QA (dedicated from Phase 1 onward) | Execute `14-QA-AUDIT.md`, build automated suites | All |
| Accounting/CA subject-matter reviewer (part-time/consulting) | Sign off on year-close, Trial Balance/BS/P&L correctness | 3 |
| GST/compliance subject-matter reviewer (part-time/consulting) | Sign off on GSTR-1/2B/3B correctness and schema validity | 4 |
| Textile-trade domain reviewer | Validate grey→finished conversion matches real trader workflows | 5 |
| Security reviewer (part-time/consulting) | RBAC middleware design review, pen-test-style pass | 2, 6 |
| Product/founder | Track A vs Track B decision, marketing-claim alignment | 4, 7 |

---

## 17.3 Do-Not-Touch Reminder

While executing every phase above, do **not** regress the architectural strengths listed in `18-CTO-FINAL-REPORT.md` "never change" list (InventoryLot+StockMovement model approach, AccountingEntry double-entry validation, `companyId` tenant pattern, `Counter.nextSeq` voucher numbering, offline IndexedDB sync architecture, the classic-ERP-shell UX, and the Admin SaaS console structure). Every phase's exit criteria explicitly includes "no regression to existing correct behavior" — treat that as a standing constraint, not a one-time checklist item.
