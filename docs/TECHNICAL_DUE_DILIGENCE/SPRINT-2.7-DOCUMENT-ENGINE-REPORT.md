# Sprint 2.7 — Document Engine

**Version:** 1.0 · **Date:** 15 Jul 2026  
**Reuse:** `InvoicePDFViewer`, `SalesPrint`, `PurchasePrint`, `invoiceHelpers`

## Verdict: **74 / 100**

## Shipped
- `DocumentTemplate` model + seed defaults (invoice, bill, challan, PO, GRN, thermal label)
- `documentEngineService` — printable payloads, lot barcode/QR labels, email/WhatsApp/Excel channel stubs
- APIs under `/api/stage2/documents/*`
- FE: Stage2Ops → Documents tab

## Exit coverage
| Item | Status |
|---|---|
| Preview/Print/PDF | ✅ via existing InvoicePDFViewer |
| Templates / branding hooks | ✅ |
| Email / WhatsApp | ⚠️ stub queue via notifications |
| Barcode/QR | ✅ lot label payload |
| Thermal / Dot-matrix | ✅ format enum + thermal label |
| Digital signature | ✅ hook stub |
| Multi-language | ⚠️ locale field readiness |
