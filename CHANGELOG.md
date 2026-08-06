# CHANGELOG

## 1.1.1 — Recent Activity and Weaver Auto-population (2026-08-05)

### Added
- Auto-population of Weaver field from the associated Purchase's Supplier Name when a Lot is selected in Mill Issue.
- Chronological sorting of combined sales, purchases, and job work events in the Dashboard's Recent Activity timeline.

### Fixed
- Intercepted global Enter key capturing listener for LotNo input by applying `data-enter-nav="off"` attribute to allow local React key handling.

## 1.1.0 — Mill Issue Enhancements (2026-08-05)

### Added
- Conversions of Weaver and Pu.BillNo fields to inline searchable dropdowns (`ERPCombobox`) for improved ERP keyboard navigation.
- Dynamic relational filtering for Weaver and Pu.BillNo based on active inventory lots with remaining balance.

### Changed
- Refactored metrics layout in Mill Issue screen into a 3-column structure: Column 1 (Iss Pcs / Iss Qty), Column 2 (Pu.Rate / JobRate), and Column 3 (Lot No.).
- Fixed vertical alignment and empty space issues in Mill Receive screen by explicitly setting start alignment on flex containers.
- Restructured Mill Receive screen UI into a classic multi-column ERP grid layout with transaction grid and bottom adjustments block.
- Updated Proc Type options in Mill Receive transaction grid dropdown list to Finish, Refinish, and Return.
- Replaced horizontal lot selection panel with an Enter-key triggered inline Lot Number dropdown list overlay inside the table grid.

## 1.0.0 — Commercial Launch (2026-07-18)

### Added
- Stage 8 commercial certification, onboarding wizard, licensing activation
- Desktop Electron shell with NSIS installer & auto-update stub
- Customer documentation pack (`docs/guides`)
- Release management APIs & Version 1.0 RC workflow

### Included from prior stages
- Stages 1–4 business / finance / compliance engines
- Stage 6 enterprise productivity platform
- Stage 7 security, infrastructure, DevOps

### Fixed
- Admin license generation checksum placeholder replaced with real checksum
