# Stage 4 — Compliance Engine (GST • TDS • TCS • E-Invoice • E-Way)

**Version:** 1.0 · **Date:** 16 Jul 2026  
**Prerequisite:** Stage 3 Financial Engine  
**Approach:** Extend `gstService` + Stage 3 tax ledgers — never fork parallel tax books. All GST is backend-driven.

---

## Stage goal

```
Business Txn → Tax Determination → GST Journals → Returns → Reconciliation → Filing Export
```

Rules:

- Never trust frontend GST calculations
- Never hardcode rates/state codes in UI
- Returns from finalized/locked periods only
- JSON exports government-schema oriented
- Every compliance action audit-logged
- Multi-company isolation enforced

---

## Sprint map (10)

| Sprint | Name | Outcome |
|---|---|---|
| **4.1** | GST Configuration Engine | Registration, scheme, RCM, ledger map, period lock |
| **4.2** | GST Transaction Engine | Shared determination + purchase/sales/note tax posting |
| **4.3** | GST Return Engine | GSTR-1 / 2B / 3B / 9-ready + JSON export |
| **4.4** | HSN/SAC Engine | Masters + summary reports |
| **4.5** | TDS & TCS Engine | Sections, auto-deduct, certificates, reports |
| **4.6** | E-Invoice & E-Way Engine | Payload + IRN/EWB lifecycle (NIC-ready) |
| **4.7** | CA Workspace | Read-only CA portal APIs |
| **4.8** | GST Reconciliation | 2B match, GL vs returns, exceptions |
| **4.9** | Compliance Dashboard | Payable/receivable, dues, score |
| **4.10** | Compliance Certification | Integrity gate ≥ 90 |

---

## Baseline

| Capability | Status entering Stage 4 |
|---|---|
| GSTR-1 partial JSON | Partial ✅ |
| Sales server totals | ✅ |
| Purchase server totals | ❌ Client-trusted |
| Note GST fields | ❌ |
| Interstate auto (sales/purchase) | ❌ (Job Work only) |
| GSTR-2B match | ❌ |
| E-Invoice / E-Way | Flags only |
| TDS/TCS posting | ❌ |

---

## API root

`/api/stage4/*` (+ deepen `/api/gst/*`)

## Exit gate

Compliance Readiness Score ≥ **90** with zero unexplained tax differences on sample FY.
