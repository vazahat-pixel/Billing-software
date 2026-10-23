# Golden-Master Reconciliation — Quick Start

## TL;DR
Built a harness that compares JSM's reports (source of truth) against MERN's API (your implementation).  
Result: A list of exact report mismatches you can fix systematically.

## Run This (Right Now)

### 1. Extract from JSM (1 min, read-only)
```bash
cd backend
npm run golden-master:extract
```

**What happens:**
- Connects to your SQL Server (`.\JSMR2`)
- Exports Sep 2026 transactions and masters to CSV
- Creates `backend/backups/golden-master/manifest.json`

**Check output:**
```bash
cat backend/backups/golden-master/manifest.json
```
Should show counts like:
```json
{
  "transaction": {
    "salesInvoices": 25,
    "purchaseInvoices": 18
  },
  ...
}
```

### 2. Preview the Import (30 sec, no database writes)
```bash
npm run golden-master:import -- --dryRun
```

**What happens:**
- Shows what WOULD be imported to MERN
- Doesn't touch MongoDB
- Validates the data is importable

### 3. Start MERN Server (in another terminal)
```bash
npm run dev
```
Keep it running. The reconciliation needs it on port 5000.

### 4. Run the Full Reconciliation (5 min)
```bash
npm run golden-master
```

**What happens:**
- Extracts from JSM
- Previews import (dryRun mode)
- Tries to compare reports (may fail if MERN server not running)
- Outputs results to `backend/backups/golden-master/reconciliation/`

**Check the results:**
```bash
cat backend/backups/golden-master/reconciliation/mismatch_register.csv
```

You should see something like:
```
Report,Type,Field,JSMValue,MERNValue,Delta
RPT-014,TOTAL_MISMATCH,SGST,50000.00,49500.00,500.00
```

## What the Numbers Mean

| Column | Meaning |
|--------|---------|
| `Report` | Report code (RPT-001, RPT-014, etc.) |
| `Type` | Kind of mismatch (ROW_COUNT, TOTAL_MISMATCH) |
| `Field` | Which column/total (SGST, BALANCE, etc.) |
| `JSMValue` | What JSM calculates |
| `MERNValue` | What MERN calculates |
| `Delta` | The difference (gap to close) |

## Fix One Mismatch (Example)

Say the report shows:
```
RPT-014,TOTAL_MISMATCH,SGST,50000.00,49500.00,500.00
```

**Translation**: GSTR-1 Sales report (RPT-014) is missing ₹500 in SGST tax.

### Find & Fix
1. Open `backend/services/gstService.js` or wherever GSTR-1 is calculated
2. Find the SGST calculation line
3. Debug why ₹500 is missing (e.g., one invoice's tax not included?)
4. Fix the code
5. Re-run to confirm delta is now 0.00

### Commit
```bash
git add .
git commit -m "fix(gst): reconcile GSTR-1 SGST — delta closed from 500 to 0

JSM golden-master baseline showed ₹500 missing in SGST.
Root: One reverse-charge invoice excluded from tax total.
Verified: delta now 0.00"
```

## Repeat for All Mismatches

Priority order:
1. **GSTR (GST reports)** — Legal compliance, must match exactly
2. **Outstanding** — Customer/vendor aging
3. **Ledger** — Account statements
4. **Stock/Registers** — Inventory and transaction reports

## Important Notes

⚠️ **First Run Does NOT Write to MongoDB**  
The default `npm run golden-master` runs in test/preview mode. No data is written. To write to the database:

```bash
npm run golden-master -- --execute
```

(This is intentional — preview first, commit second.)

✓ **Safe to Rerun**  
The import uses idempotent upserts. Safe to rerun. Takes snapshots before writes.

✓ **SQL Server Read-Only**  
All access to JSM is read-only. Zero writes to JSM.

## File Structure
```
backend/
├── backups/golden-master/
│   ├── items.csv              ← Extracted from JSM
│   ├── sales.csv, purchase.csv
│   ├── manifest.json
│   └── reconciliation/
│       └── mismatch_register.csv    ← YOUR TO-DO LIST
├── scripts/golden-master/
│   ├── jsm-extract-demo.js    ← Stage 1
│   ├── mern-import-golden-data.js  ← Stage 2
│   ├── reconcile-reports.js   ← Stage 3
│   └── README.md              ← Full documentation
└── qa/
    └── phase10_golden_master_test.js  ← CI/CD integration
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Cannot connect to SQL Server" | Check `.\JSMR2` service running: `Get-Service *SQL*` |
| "MONGO_URI not set" | Source `.env`: `source .env` (bash) or `$env:MONGODB_URL` (PowerShell) |
| "MERN API returns 404" | Start server: `npm run dev` in another terminal |
| "mismatch_register.csv is empty" | All reports matched! Celebrate! 🎉 |

## Long-Term Use

Once you've fixed all mismatches:

1. **Add to CI/CD**: Run nightly to catch regressions
2. **Before releases**: Always run before shipping a new report
3. **For new features**: When adding a report, run to verify it matches JSM's output

## Full Documentation

See:
- `backend/scripts/golden-master/README.md` — Complete guide
- `GOLDEN-MASTER-RECONCILIATION.md` — Overview & context

## Questions?

Check the detailed docs. For technical questions, refer to:  
`C:\Users\admin\.claude\plans\suggest-me-one-thing-swift-bee.md`

---

**That's it. Run `npm run golden-master:extract` to start.**
