# Sprint 2.10 — Business Readiness Certification

**Version:** 1.0 · **Date:** 15 Jul 2026  
**Gate:** ≥ **85** + reconcile ≠ `failures`

## Verdict: certification engine ready — score is **data-dependent**

## Shipped
- `CertificationRun` model + weighted checklist (masters → engines → automation → docs → workflow → validation → audit → reconcile)
- `certificationService.run(companyId)`
- CLI: `node scripts/certification/runCertification.js <companyId>`
- API: `POST /api/stage2/certification/run`, `GET .../latest`
- FE: Stage2Ops → Certification tab
- Migration `008_stage2_ops_indexes.js`

## How to certify
1. Seed automation + Stage2 Ops templates/workflows  
2. Run sample transactions through Purchase / Inventory / Production / Sales engines  
3. **Utilities → Stage 2 Ops / Certification → Run**  
4. Score ≥ 85 and reconcile clean/warnings-only → proceed to **Business Simulation Week**

## Simulation Week (still required before Stage 3)
See STAGE-2 plan: 100+ purchases, multi-process job work, sales chain, returns, nightly reconcile clean, written sign-off.

## Stage 2 coding exit
Sprints **2.1–2.10** engineering delivered. Simulation Week remains the operational gate.
