# Sprint 2.9 — Business Validation Engine

**Version:** 1.0 · **Date:** 15 Jul 2026

## Verdict: **80 / 100**

## Shipped
- Central `validateBusiness` / `assertBusinessValid` in `validateBusinessService.js`
- Checks: FY lock · inactive party · GSTIN format · credit limit · duplicates · lot/stock · warehouse · unbalanced journal · closed voucher
- Wired into `salesService.createInvoice` + `purchaseService.createPurchase`
- Dry-run API `POST /api/stage2/validate`

## Exit coverage
| Check | Status |
|---|---|
| Duplicate invoice | ✅ hard on exact no / soft warn |
| Negative stock | ✅ |
| Invalid GSTIN | ✅ |
| Credit limit | ✅ |
| Inactive party | ✅ |
| Expired subscription | ✅ via middleware |
| Locked FY | ✅ |
| Closed voucher | ✅ |
| Deleted lot / hold | ✅ via stock helper |
| Wrong warehouse | ⚠️ warning |
| Unbalanced journal | ✅ |
| Central hub used by engines | ✅ sales + purchase kernels |
