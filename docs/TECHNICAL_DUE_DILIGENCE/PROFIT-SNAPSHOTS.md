# Profit Snapshots — Sprint 2.6 Documentation

**Status:** Estimated / operational KPI — **not statutory P&L**

## What is stored (`ProfitSnapshot`)

| Field | Meaning |
|---|---|
| `salesTaxable` | Sum of sales `taxableAmount` in period |
| `purchaseTaxable` | Sum of purchase `taxableAmount` in period |
| `estimatedCogs` | Currently = purchase taxable (proxy) |
| `estimatedGrossProfit` | salesTaxable − estimatedCogs |

## What is intentionally out of scope

- Full absorption costing / WIP valuation
- Freight landed-cost split (see `costAllocationService.js` stub)
- GST-adjusted statutory statements (use Report / GST modules)
- Multi-warehouse inventory valuation roll-forward

## API

- `POST /api/business-automation/profit-snapshots`
- `GET /api/business-automation/profit-snapshots`

Capture from **Utilities → Business Automation → Profit** tab.
