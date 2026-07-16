const AccountingEntry = require('../../models/AccountingEntry');
const LedgerMaster = require('../../models/LedgerMaster');
const Purchase = require('../../models/Purchase');
const Sales = require('../../models/Sales');
const outstandingEngineService = require('../../services/outstandingEngineService');
const financialCertificationService = require('../../services/financialCertificationService');

async function verifyAccounting(companyId) {
  const issues = [];
  const warnings = [];
  const entries = await AccountingEntry.find({ companyId }).lean();
  const ledgerIds = new Set(
    (await LedgerMaster.find({ companyId }).select('_id').lean()).map((l) => String(l._id))
  );

  const entryNos = new Map();
  for (const entry of entries) {
    const dr = (entry.lines || []).filter((l) => l.type === 'Dr').reduce((s, l) => s + (l.amount || 0), 0);
    const cr = (entry.lines || []).filter((l) => l.type === 'Cr').reduce((s, l) => s + (l.amount || 0), 0);
    if (Math.abs(dr - cr) > 0.01) {
      issues.push(`Unbalanced journal ${entry.entryNo}: Dr ${dr} != Cr ${cr}`);
    }
    for (const line of entry.lines || []) {
      if (line.ledgerId && !ledgerIds.has(String(line.ledgerId))) {
        issues.push(`Orphan ledger line in ${entry.entryNo}: ${line.ledgerId}`);
      }
    }
    const key = entry.entryNo;
    entryNos.set(key, (entryNos.get(key) || 0) + 1);
  }

  for (const [no, count] of entryNos.entries()) {
    if (count > 1) issues.push(`Duplicate entryNo: ${no} (${count}x)`);
  }

  const [missingPurchaseAcct, missingSalesAcct] = await Promise.all([
    Purchase.countDocuments({
      companyId,
      status: { $in: ['active', 'partial', 'paid'] },
      accountingEntryId: { $in: [null, undefined] },
    }),
    Sales.countDocuments({
      companyId,
      status: { $in: ['active', 'partial', 'paid'] },
      accountingEntryId: { $in: [null, undefined] },
    }),
  ]);
  if (missingPurchaseAcct) issues.push(`${missingPurchaseAcct} purchases missing accountingEntryId`);
  if (missingSalesAcct) issues.push(`${missingSalesAcct} sales missing accountingEntryId`);

  let receivableRecon = { ok: true };
  let payableRecon = { ok: true };
  try {
    receivableRecon = await outstandingEngineService.reconcileWithLedger(companyId, { type: 'receivable' });
    payableRecon = await outstandingEngineService.reconcileWithLedger(companyId, { type: 'payable' });
    if (!receivableRecon.ok) warnings.push('Receivable outstanding does not match ledger');
    if (!payableRecon.ok) warnings.push('Payable outstanding does not match ledger');
  } catch (err) {
    warnings.push(`Outstanding reconcile error: ${err.message}`);
  }

  let finCert = null;
  try {
    finCert = await financialCertificationService.run(companyId);
    if (!finCert.passed) warnings.push(...(finCert.gaps || []).slice(0, 5));
  } catch (err) {
    warnings.push(`Financial certification: ${err.message}`);
  }

  const passed = issues.length === 0;
  const score = passed
    ? Math.max(70, 100 - warnings.length * 3)
    : Math.max(0, 100 - issues.length * 10 - warnings.length * 2);

  return {
    label: 'Accounting Integrity',
    passed,
    score,
    entryCount: entries.length,
    issues: [...issues, ...warnings],
    warnings,
    financialCertification: finCert,
    outstanding: { receivable: receivableRecon, payable: payableRecon },
  };
}

module.exports = { verifyAccounting };
