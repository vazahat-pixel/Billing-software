# Stage 3 — Financial Engine (Enterprise Accounting & Finance Core)

**Version:** 1.0 · **Date:** 16 Jul 2026  
**Prerequisite:** Stage 2 Business Engine (Sprints 2.1–2.10) — engineering complete  
**Approach:** Extend live `LedgerMaster` + `AccountingEntry` stack — never fork a parallel ledger.

---

## Stage goal

Transform the ERP into a production-grade financial platform:

```
Business Transaction → Journal Voucher → Ledger Posting → Trial Balance → BS / P&L / Cash Flow
```

Rules:

- Users never manually update balances
- Every report is derived from journal entries
- Double-entry enforced at schema + service layer
- Posted journals are immutable (reversal only)
- MongoDB transactions on every financial mutation
- Company / FY / branch isolation enforced

---

## Sprint map (10)

| Sprint | Name | Outcome |
|---|---|---|
| **3.1** | Chart of Accounts Engine | Hierarchical CoA, groups, nature, GST/TDS, soft-delete |
| **3.2** | Journal Engine | Full voucher taxonomy, Dr=Cr, immutability, auto-post |
| **3.3** | Ledger Engine | GL / sub-ledgers, running balance, drill-down |
| **3.4** | Cash & Bank Engine | Cash/Bank books, BRS, cheque/NEFT/UPI register |
| **3.5** | Receivable & Payable Engine | Aging, credit limit, bill-wise settlement |
| **3.6** | Financial Reports Engine | TB, BS (with P&L plug), P&L, CF, Fund Flow, registers |
| **3.7** | Financial Closing Engine | Period/FY lock, OB carry-forward, retained earnings |
| **3.8** | Audit & Reconciliation Engine | Integrity checks, suspense, duplicate detection |
| **3.9** | Costing & Cost Centers | Cost centers, textile process costing, margins |
| **3.10** | Financial Readiness Certification | Integrity score + automated gates |

---

## Baseline (entering Stage 3)

| Capability | Status |
|---|---|
| LedgerMaster (flat groups) | Partial ✅ |
| AccountingEntry Dr=Cr | ✅ Schema-enforced |
| Sales/Purchase/Job auto-post | ✅ |
| Payment/Receipt vouchers | ✅ |
| Trial Balance / P&L / BS | Partial (BS missing P&L plug) |
| FY master + lock fields | Partial ✅ |
| Year close / opening journals | ❌ |
| Cash/Bank/Contra types | ❌ |
| Cost centers | ❌ |
| Hierarchical CoA | ❌ |

---

## Engineering conventions

- Routes under `/api/stage3/*` and deepen `/api/accounting/*`
- Services: `chartOfAccounts`, `journalEngine`, `ledgerEngine`, `cashBankEngine`, `outstandingEngine`, `financialReports`, `financialClosing`, `financialAudit`, `costCenter`, `financialCertification`
- Reuse: `Counter`, `VoucherSeries`, `auditService`, `enterpriseIntegrityPlugin`, `companyIsolation`
- Deprecate dead `LedgerEntry` path (already Sunset 2027)

---

## Exit gate (3.10)

Accounting Readiness Score ≥ **90** with:

- Trial Balance balances
- All journals balanced
- Ledger balances derive from journals
- Inventory ↔ GL reconcile
- GST control accounts reconcile
- Outstanding matches party ledgers
- No orphan journals / duplicate voucher numbers
- No manual balance edits possible
