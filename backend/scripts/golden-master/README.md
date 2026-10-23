# Golden-Master Reconciliation Suite

## Overview
This harness compares JSM's SQL view output (source of truth) against MERN's API output (implementation under test) to identify and fix report mismatches.

Two years of screenshot-matching work has achieved 87.7% structural parity. This suite measures **numerical parity**—do the reports print the same totals and line items?

## How It Works

### 1. Extract (`jsm-extract-demo.js`)
- Reads JSM's `JsmSql2_DEMO2026` database (SQL Server, read-only)
- Exports masters (items, parties, accounts) as CSV
- Exports one frozen period (Sep 2026) of transactions
- Extracts golden outputs from JSM's GST and ledger views
- Saves to: `backend/backups/golden-master/`

**Safety**: Read-only access. No data is modified.

### 2. Import (`mern-import-golden-data.js`)
- Creates or reuses a test company in MERN
- Populates it with the same masters and transactions from JSM
- Uses idempotent upsert pattern (rerunnable without duplicates)
- Takes atomic snapshot before write (restorable)

**Modes**:
```bash
npm run golden-master:import -- --dryRun    # Preview only, no writes
npm run golden-master:import -- --execute   # Write to MongoDB
```

### 3. Reconcile (`reconcile-reports.js` + `phase10_golden_master_test.js`)
- Runs critical reports through both systems on the same data
- Compares row counts and grand totals for each numeric field
- Produces `mismatch_register.csv` with exact deltas
- Identifies which reports need fixes and in what priority

**Reports covered** (Phase 1):
- GSTR-1 B2B/B2CL/B2CS/CDNR/HSN (5 variations)
- GSTR-2 (1)
- E-way bills (1)
- Outstanding (Purchase + Sales, 2)
- Ledger (1)
- Trial Balance, Profit & Loss (2)

**Tolerance**: 0.01 per field (handles rounding).

## Running the Suite

### Option A: Full automation
```bash
npm run golden-master
```
Runs all three stages in test mode (no writes). Produces:
- `backend/backups/golden-master/` — extracted data and manifest
- `backend/backups/golden-master/reconciliation/mismatch_register.csv` — findings

### Option B: Live execution
```bash
npm run golden-master -- --execute
```
- **Stage 1**: Extract (always read-only)
- **Stage 2**: Import data into test company (writes to MongoDB)
- **Stage 3**: Reconcile and generate report

### Option C: Individual stages
```bash
# Just extract from JSM
node backend/scripts/golden-master/jsm-extract-demo.js

# Import (with dryRun by default)
node backend/scripts/golden-master/mern-import-golden-data.js --dryRun

# Reconcile (requires MERN server running)
node backend/scripts/golden-master/reconcile-reports.js
```

## Interpreting Results

### `mismatch_register.csv`
Columns:
- `Report` — Report ID (RPT-001, RPT-014, etc.)
- `Type` — Kind of mismatch:
  - `ROW_COUNT` — Different number of lines
  - `TOTAL_MISMATCH` — Sum of a column differs
  - `KEY_MISSING` — Bill/Invoice not in one system
- `Field` — Which column has the delta (e.g., `GSTR`, `BALANCE`)
- `JSMValue` — JSM's value
- `MERNValue` — MERN's value
- `Delta` — Absolute difference

### Priority tiers (fix in this order)
1. **Tier 1 – GST Reports (5 reports)**  
   GSTR-1/2 totals must match exactly for legal compliance. Any mismatch requires immediate investigation.

2. **Tier 2 – Accounting (3 reports)**  
   Outstanding, Ledger, Trial Balance. Core to financial accuracy.

3. **Tier 3 – Stock/Registers (remaining)**  
   Inventory and transaction registers. Impact visibility, not compliance.

## Fixing Mismatches

For each mismatch:

1. **Identify root cause**  
   - Compare JSM's SQL view (`backend/backups/golden-master/reports/gstr1_summary.csv`) against MERN API response
   - Trace the calculation in `backend/services/` (e.g., `reportService.js`, `gstService.js`)
   - Check for missing fields, wrong formulas, or data not imported

2. **Example**:  
   ```
   Report,Field,JSMTotal,MERNTotal,Delta
   RPT-014,SGST,50000.00,49500.00,500.00
   ```
   Missing ₹500 in MERN's SGST calculation. Likely a line item not imported or a tax rate mismatch.

3. **Fix in MERN** (never in JSM)
   - Update the formula in the report service
   - Add missing import logic if data is absent
   - Rerun the suite to confirm the delta closes

4. **Commit separately** per report
   Each report fix should be its own PR with the mismatch evidence and root cause in the commit message.

## Integration with CI/CD

Add to `run_all_phases.js`:
```javascript
const { GoldenMasterValidator } = require('./phase10_golden_master_test');

// After all other phases...
console.log('\n[PHASE 10] Golden-Master Validation...');
const validator = new GoldenMasterValidator();
await validator.run(testCompanyId);
```

Runs after regular QA. Fails the build if any Tier-1 report has mismatches.

## Project Structure
```
backend/
├── scripts/golden-master/
│   ├── jsm-extract-demo.js          # Stage 1: JSM → CSV
│   ├── mern-import-golden-data.js   # Stage 2: CSV → MERN
│   ├── reconcile-reports.js         # Stage 3: Compare
│   ├── run-golden-master-suite.js   # Orchestrator
│   └── README.md                    # This file
├── qa/
│   └── phase10_golden_master_test.js # QA harness integration
└── backups/
    └── golden-master/
        ├── items.csv, parties.csv, accounts.csv
        ├── sales.csv, purchase.csv, vouchers.csv
        ├── manifest.json
        └── reconciliation/
            ├── mismatch_register.csv
            └── phase10_results.json
```

## FAQ

**Q: Why use JSM as source of truth?**  
A: JSM is the legacy system. Clients validated it over years. The MERN app was built to match it. Reports must be identical or clients see `Billing software reports wrong data`.

**Q: Can I skip the import stage?**  
A: No. Reconciliation requires the same data in both systems. Without a controlled import, you're comparing two different datasets.

**Q: What if JSM's view is buggy?**  
A: The golden-master is for MERN→JSM matching, not correctness. If JSM has a bug and you've matched it, document it in a separate Tier-4 ticket to fix both.

**Q: How often should I run this?**  
A: 
- Before launching any new report feature: run full suite
- After fixing a Tier-1 mismatch: run just that report's reconciliation
- In CI/CD: run nightly as a regression check

**Q: What if MERN server is offline?**  
A: Reconciliation stage skips with a warning. Extract and import stages don't depend on the server.

## Contact & Support
For issues or questions, refer to the plan at `C:\Users\admin\.claude\plans\suggest-me-one-thing-swift-bee.md`.
