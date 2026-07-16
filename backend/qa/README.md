# ERP Developer QA Engine

Developer-only tooling. **Never expose to production users.**

## Safety

- Blocked when `NODE_ENV=production` unless `QA_ALLOW=true`
- Use a dedicated QA database: `MONGO_URI=mongodb://localhost:27017/billing_software_qa`

## Profiles

| Profile | Purchases | Sales | Jobs |
|---------|-----------|-------|------|
| smoke   | 5         | 3     | 2    |
| dev     | 50        | 40    | 15   |
| staging | 500       | 400   | 120  |
| full    | 5000      | 4000  | 1000 |

Override via `--profile=smoke|dev|staging|full` or `QA_PROFILE` / `QA_PURCHASES` env vars.

## Commands

```bash
npm run seed:all -- --profile=dev
npm run simulate -- --profile=smoke
npm run verify -- --companyId=<id>
npm run benchmark
npm run qa -- --profile=smoke --fresh
npm run clean -- --profile=dev
npm run reset
```

## Strategy

- **Masters**: direct Mongo upserts (companies, parties, items, warehouses, HSN, users)
- **Transactions**: always via domain services (`purchaseService`, `salesService`, `jobService`, etc.)

## HTTP (owner / super_admin)

- `POST /api/developer/qa/run-simulator`
- `GET /api/developer/qa/health`
- `GET /api/developer/qa/readiness/latest`

## Reports

Written to `backend/qa/reports/output/<timestamp>/report.json` and `report.html`.
