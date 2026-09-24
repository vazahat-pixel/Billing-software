# Hybrid Cloud Sync — Pilot Certification

## Enablement

**Central server `.env`:**

```
HYBRID_SYNC_ENABLED=true
DEVICE_BINDING_ENFORCE=true
MODULE_GATE_ENFORCE=true
```

**Desktop `config.json`:**

```json
{
  "mode": "hybrid",
  "centralApiBaseUrl": "https://YOUR_CENTRAL/api"
}
```

## Pilot scope (Phase 9)

- One company only
- `maxDevices=1`
- Sales create sync only (classic `/api/sales`)
- Do not enable Purchase / Mill / Job Work offline sync until Sales certifies

## Certification checklist

- [ ] Offline Sales create survives app + PC restart (outbox PENDING)
- [ ] Reconnect creates exactly one central invoice (retry storms OK)
- [ ] Duplicate `operationId` push returns original (no second invoice/stock)
- [ ] Lease exhaustion blocks AUTO numbering with clear message
- [ ] Disabled sales module rejects online and offline writes
- [ ] Online SaaS Sales create unchanged (same GST/stock/ledger for fixtures)
- [ ] No cross-company data in pull/push
- [ ] Rotate secrets after `vite.config.js` malware cleanup on any machine that built before Phase 0

## Tests

```bash
cd backend
npm run test:hybrid-sync
```

## Architecture reminder

Offline execution uses the **same** `salesService.createInvoice` (GST via `recalcSalesTotals`, stock via `applyLotMovement`, ledger via `onSalesInvoicePost`). Sync never reimplements business math.
