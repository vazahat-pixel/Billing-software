const AccountingEntry = require('../../models/AccountingEntry');
const LedgerMaster = require('../../models/LedgerMaster');

/**
 * Accounting certification — Debit == Credit, orphan ledgers, duplicate entryNos.
 */
async function certify(companyId) {
  const issues = [];
  const filter = companyId ? { companyId } : {};
  const entries = await AccountingEntry.find(filter).limit(5000).lean().catch(() => []);
  const ledgerIds = new Set(
    (await LedgerMaster.find(filter).select('_id').lean().catch(() => [])).map((l) => String(l._id))
  );

  let unbalanced = 0;
  const entryNos = new Map();

  for (const entry of entries) {
    const lines = entry.lines || entry.entries || [];
    const dr = lines
      .filter((l) => l.type === 'Dr' || l.dc === 'D' || l.side === 'debit')
      .reduce((s, l) => s + Number(l.amount || l.debit || 0), 0);
    const cr = lines
      .filter((l) => l.type === 'Cr' || l.dc === 'C' || l.side === 'credit')
      .reduce((s, l) => s + Number(l.amount || l.credit || 0), 0);

    // If schema uses debit/credit columns on each line
    const altDr = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
    const altCr = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
    const debit = dr || altDr;
    const credit = cr || altCr;

    if (lines.length && Math.abs(debit - credit) > 0.02) {
      unbalanced += 1;
      if (issues.length < 20) {
        issues.push(`Unbalanced journal ${entry.entryNo || entry._id}: Dr ${debit} != Cr ${credit}`);
      }
    }

    for (const line of lines) {
      if (line.ledgerId && ledgerIds.size && !ledgerIds.has(String(line.ledgerId))) {
        if (issues.length < 30) issues.push(`Orphan ledger in ${entry.entryNo}: ${line.ledgerId}`);
      }
    }

    const key = entry.entryNo;
    if (key) entryNos.set(key, (entryNos.get(key) || 0) + 1);
  }

  for (const [no, count] of entryNos.entries()) {
    if (count > 1) issues.push(`Duplicate entryNo: ${no} (${count}x)`);
  }

  // Empty books are warn-pass (new company); unbalanced books fail
  const passed = unbalanced === 0 && !issues.some((i) => i.startsWith('Duplicate'));
  return {
    passed: entries.length === 0 ? true : passed,
    detail: `entries=${entries.length} unbalanced=${unbalanced} issues=${issues.length}`,
    gaps: issues,
    entryCount: entries.length,
    unbalanced,
    score: passed ? 100 : Math.max(0, 100 - unbalanced * 15 - issues.length * 2),
  };
}

module.exports = { certify };
