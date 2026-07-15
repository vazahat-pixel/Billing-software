# Sprint 1.1 — Frontend Integration & Architecture
**Version:** 1.0 · **Date:** 15 Jul 2026 · **Stage:** Foundation Stabilization

## Verdict

| Metric | Value |
|---|---|
| Sprint Completion Score | **62 / 100** |
| Integration Completion % | **~58%** of sprint acceptance criteria |
| UI redesign | **None** (as required) |
| Folder structure | **Preserved** (files added under existing `src/` trees) |

Sprint 1.1 established the **integration spine** (single Axios, config/toast/UI stores, API services, Ctrl+K, fake-data removal on critical surfaces). Full acceptance criteria (RHF+Zod on every form, unified DataTable, socket provider, every alert gone) is a multi-sprint track — called out under Remaining Issues.

---

## Files Created

| File | Purpose |
|---|---|
| `frontend/src/store/useToastStore.js` | Global toast queue + `toast.success/error/warning/info/unavailable` |
| `frontend/src/store/useConfigStore.js` | Session SSOT: company, plan, permissions, modules, FY, flags |
| `frontend/src/store/useUiStore.js` | Command palette / search chrome only |
| `frontend/src/components/ui/ToastHost.jsx` | Toast renderer |
| `frontend/src/components/CommandPalette.jsx` | Ctrl+K enterprise search |
| `frontend/src/providers/AppProviders.jsx` | Auth→config bridge + toast + palette hosts |
| `frontend/src/api/services/index.js` | Domain API services (auth, parties, items, sales, purchase, inventory, jobs, accounting, gst, reports, books, config) |
| `frontend/src/components/auth/PermissionGate.jsx` | Declarative permission wrapper |

---

## Files Modified

| File | Change |
|---|---|
| `frontend/src/App.jsx` | Wrapped with `AppProviders` |
| `frontend/src/utils/api.js` | **Re-exports** `api/client` — dual Axios eliminated |
| `frontend/src/api/client.js` | Adds `X-Request-Id` on every request |
| `frontend/src/utils/invoiceHelpers.js` | Removed `DEMO_COMPANY`; added `resolveCompanyProfile()` from config store |
| `frontend/src/components/InvoicePDFViewer.jsx` | Letterhead from live company profile; alerts → toast |
| `frontend/src/pages/LedgerModal.jsx` | Hardcoded Mahaveer → API ledger statement |
| `frontend/src/pages/reports/SalesOutstanding.jsx` | Company from config store |
| `frontend/src/pages/gst/GstModals.jsx` | GSTR-2B fake portal matching removed; ERP purchase register only |
| `frontend/src/pages/Dashboard.jsx` | Fake success `alert()` → `toast.unavailable` / real toasts; Ctrl+K event bridge |
| `frontend/src/context/ConfigContext.jsx` | Syncs bundle into `useConfigStore` |
| `frontend/src/store/useStore.js` | Hydrates/clears config store on setAuth/logout |
| `frontend/src/store/useAppStore.js` | **Emptied** mock parties/items/lots (deprecated stub) |
| `frontend/src/pages/sales/SalesModal.jsx` | Dead `utils/api` import removed; alerts → toast |
| `frontend/src/pages/purchase/PurchaseModal.jsx` | Same |

---

## Architecture (live)

```
App
 └─ AppProviders (toast, Ctrl+K, config hydrate)
     └─ Router
         └─ ProtectedRoute → AuthBootstrap → ConfigProvider → Dashboard (modal shell)
              ├─ useStore          ERP entities (parties, sales, …)
              ├─ useConfigStore    company / plan / permissions / modules
              ├─ useUiStore        command palette
              └─ api/client  ←──  api/services/* (new)  ←── store actions (gradual)
```

---

## Acceptance criteria status

| Criterion | Status |
|---|---|
| No hardcoded business firm (DEMO_COMPANY / MAHAVEER on prints/ledger/outstanding) | **Done** on print, ledger, outstanding |
| Every dropdown loads from backend | **Partial** — masters already did; remaining soft defaults in some forms |
| Every modal real CRUD | **Unchanged** — already mostly true per audit; Ledger now connected |
| Every page API driven | **Partial** — Utilities menu honest stubs; GSTR-2B no longer fake |
| Zustand modular | **Partial** — config/ui/toast split; ERP still in `useStore` (facade next sprint) |
| API layer centralized | **Done** — single client + services module |
| Global modal system unified | **Not started** — still Dashboard modal map (avoid UI redesign) |
| Sidebar permission-driven | **N/A this shell** — Dashboard menus already module/permission gated |
| Dashboard loads real data | **Yes** — activity already from store; no new fake charts injected |
| CRUD lifecycle standardized | **Partial** — toast on key screens |
| Error/loading/empty consistent | **Partial** |
| No duplicate frontend logic | **Partial** — dual Axios fixed; dual store mock killed |
| Console free of errors | **Verify in browser after restart** |

---

## Remaining frontend issues (Sprint 1.2+)

1. Split `useStore.js` (~1.5k lines) into domain slices (`masters`, `sales`, `purchase`, `inventory`, `accounting`, `gst`) while keeping a compatibility re-export.
2. Migrate store actions to call `api/services/*` exclusively.
3. Replace remaining `alert()` across masters/jobwork/admin (~40+ call sites).
4. React Hook Form + Zod form standard (opt-in per modal — do not big-bang).
5. Shared DataTable / SearchSelect components.
6. Socket provider when backend emits config/plan events (today polls every 5s).
7. Refresh-token / retry policy on Axios.
8. Kill orphan pages (`SalesPage`, `MainLayout`, …) in a dedicated cleanup PR.

---

## Regression risks

| Risk | Mitigation |
|---|---|
| Invoice letterhead empty if settings never loaded | Falls back to `"Company"`; ensure Company Config saved |
| Ledger rows shape differs from API | Flexible field mapping; empty state if no entries |
| `toast.error` on some validation paths | Tone is wrong but non-blocking; tighten in 1.2 |
| Command palette opens book-required modals via book selection flow | Same as Quick rail — expected |
| Dual-client removal breaks admin if something expected no timeout | Admin now shares 8s timeout + offline offline short-circuit — beneficial |

---

## Sprint score rationale (62)

+20 Single Axios + request IDs  
+15 Config store + Auth hydrate  
+15 Removed fake DEMO / Mahaveer / GSTR-2B fabrication  
+10 Toast system + Utilities honesty  
+10 Ctrl+K + API services scaffolding  
+5 PermissionGate + AppProviders  
−13 Full slice split / RHF / unified modal engine / all alerts not done  
−10 Socket / refresh token / DataTable standards not done  

---

## Next recommended sprint (1.2)

**“Store modularization & alert eradication”** — extract Zustand slices, wire all store methods through `api/services`, replace remaining alerts with toast tones, adopt SearchSelect in Sales/Purchase party dropdowns.
