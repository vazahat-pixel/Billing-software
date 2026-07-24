/**
 * 009 — Repair SalesAuto entries that posted CGST/SGST (or IGST) twice.
 *
 * Detection: for each non-reversed SalesAuto linked to a Sales invoice,
 * compare tax Cr totals on the entry vs invoice.cgst/sgst/igst.
 * Excess tax is reversed via a balancing Journal (Dr tax / Cr Round Off).
 *
 * Safe to re-run — skips entries already corrected (narration tag) or with no excess.
 */
const round2 = (n) => Number(Number(n || 0).toFixed(2));

const TAX_NAMES = {
  cgst: ['CGST Output'],
  sgst: ['SGST Output'],
  igst: ['IGST Output'],
};

function sumTaxCr(lines, names) {
  const set = new Set(names.map((n) => n.toLowerCase()));
  return round2(
    (lines || []).reduce((s, l) => {
      if (l.type !== 'Cr') return s;
      if (!set.has(String(l.ledgerName || '').toLowerCase())) return s;
      return s + Number(l.amount || 0);
    }, 0)
  );
}

function pickTaxLine(lines, names) {
  const set = new Set(names.map((n) => n.toLowerCase()));
  return (lines || []).find(
    (l) => l.type === 'Cr' && set.has(String(l.ledgerName || '').toLowerCase())
  );
}

module.exports = {
  name: 'Repair double GST on SalesAuto journals',

  async up(mongoose) {
    // Ensure models are registered for this runner
    require('../models/AccountingEntry');
    require('../models/Sales');
    require('../models/LedgerMaster');
    require('../models/Counter');

    const AccountingEntry = mongoose.model('AccountingEntry');
    const Sales = mongoose.model('Sales');
    const LedgerMaster = mongoose.model('LedgerMaster');
    const Counter = mongoose.model('Counter');

    const entries = await AccountingEntry.find({
      voucherType: 'SalesAuto',
      refType: 'SalesInvoice',
      isReversed: { $ne: true },
      status: { $ne: 'Draft' },
    }).lean();

    let fixed = 0;
    let skipped = 0;

    for (const entry of entries) {
      if (!entry.refId) {
        skipped += 1;
        continue;
      }

      const already = await AccountingEntry.findOne({
        companyId: entry.companyId,
        voucherType: 'Journal',
        narration: new RegExp(`Double-GST repair for ${entry.entryNo}`),
      }).lean();
      if (already) {
        skipped += 1;
        continue;
      }

      const sale = await Sales.findById(entry.refId).lean();
      if (!sale) {
        skipped += 1;
        continue;
      }

      const expected = {
        cgst: round2(sale.cgst || sale.totals?.cgst || 0),
        sgst: round2(sale.sgst || sale.totals?.sgst || 0),
        igst: round2(sale.igst || sale.totals?.igst || 0),
      };
      const actual = {
        cgst: sumTaxCr(entry.lines, TAX_NAMES.cgst),
        sgst: sumTaxCr(entry.lines, TAX_NAMES.sgst),
        igst: sumTaxCr(entry.lines, TAX_NAMES.igst),
      };

      const excess = {
        cgst: round2(Math.max(0, actual.cgst - expected.cgst)),
        sgst: round2(Math.max(0, actual.sgst - expected.sgst)),
        igst: round2(Math.max(0, actual.igst - expected.igst)),
      };

      // True double-post ≈ 2× invoice tax. Ignore tiny round-off noise (< ₹1 or < 50% of expected).
      const isDoubled = (ex, exp) => {
        if (ex < 1) return false;
        if (exp < 0.01) return ex >= 1;
        return ex >= round2(exp * 0.85);
      };
      if (!isDoubled(excess.cgst, expected.cgst)) excess.cgst = 0;
      if (!isDoubled(excess.sgst, expected.sgst)) excess.sgst = 0;
      if (!isDoubled(excess.igst, expected.igst)) excess.igst = 0;

      const totalExcess = round2(excess.cgst + excess.sgst + excess.igst);
      if (totalExcess < 0.01) {
        skipped += 1;
        continue;
      }

      let roundLedger = await LedgerMaster.findOne({
        companyId: entry.companyId,
        name: 'Round Off',
      });
      if (!roundLedger) {
        roundLedger = await LedgerMaster.create({
          companyId: entry.companyId,
          name: 'Round Off',
          group: 'Income',
          subGroup: 'Indirect Income',
          isSystem: true,
          openingBalance: 0,
          balanceType: 'Cr',
        });
      }

      const lines = [];
      for (const key of ['cgst', 'sgst', 'igst']) {
        if (excess[key] < 0.01) continue;
        const sample = pickTaxLine(entry.lines, TAX_NAMES[key]);
        if (!sample?.ledgerId) continue;
        lines.push({
          ledgerId: sample.ledgerId,
          ledgerName: sample.ledgerName,
          type: 'Dr',
          amount: excess[key],
          narration: `Reverse duplicate ${TAX_NAMES[key][0]} (${entry.entryNo})`,
        });
      }

      if (!lines.length) {
        skipped += 1;
        continue;
      }

      const drSum = round2(lines.reduce((s, l) => s + l.amount, 0));
      lines.push({
        ledgerId: roundLedger._id,
        ledgerName: roundLedger.name,
        type: 'Cr',
        amount: drSum,
        narration: `Double-GST repair offset (${entry.entryNo})`,
      });

      const y = new Date().getFullYear();
      const fy = `${String(y).slice(2)}-${String(y + 1).slice(2)}`;
      const counterId = `JV-${fy}-${entry.companyId}`;
      const seq = await Counter.nextSeq(counterId);
      const entryNo = `JV-${fy}-${String(seq).padStart(4, '0')}`;

      await AccountingEntry.create({
        companyId: entry.companyId,
        entryNo,
        entryDate: entry.entryDate || new Date(),
        voucherType: 'Journal',
        refType: 'Journal',
        refId: entry._id,
        lines,
        narration: `Double-GST repair for ${entry.entryNo} / Invoice #${sale.invoiceNo || ''}`,
        status: 'Posted',
      });

      fixed += 1;
      console.log(
        `    repaired ${entry.entryNo} invoice #${sale.invoiceNo} excess ₹${totalExcess.toFixed(2)}`
      );
    }

    console.log(`    double-GST repair done: fixed=${fixed}, skipped=${skipped}`);
  },

  async down() {
    console.log('    down: manual — reverse Journals tagged "Double-GST repair for …"');
  },
};
