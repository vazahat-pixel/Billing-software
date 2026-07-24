/**
 * Standalone repair — same logic as migrations/009_repair_double_gst_sales.js
 *
 * Usage (from backend/):
 *   node scripts/repairDoubleGstSales.js
 *   node scripts/repairDoubleGstSales.js --dry-run
 */
require('dotenv').config();
const mongoose = require('mongoose');
const migration = require('../migrations/009_repair_double_gst_sales');

async function main() {
  const dry = process.argv.includes('--dry-run');
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/billing-software';
  await mongoose.connect(uri);
  console.log('[repair-double-gst] connected', dry ? '(dry-run — no writes)' : '');

  if (dry) {
    require('../models/AccountingEntry');
    require('../models/Sales');
    const AccountingEntry = mongoose.model('AccountingEntry');
    const Sales = mongoose.model('Sales');
    const round2 = (n) => Number(Number(n || 0).toFixed(2));
    const entries = await AccountingEntry.find({
      voucherType: 'SalesAuto',
      refType: 'SalesInvoice',
      isReversed: { $ne: true },
    }).lean();
    let wouldFix = 0;
    for (const entry of entries) {
      const sale = entry.refId ? await Sales.findById(entry.refId).lean() : null;
      if (!sale) continue;
      const expectedC = round2(sale.cgst || sale.totals?.cgst || 0);
      const expectedS = round2(sale.sgst || sale.totals?.sgst || 0);
      const expectedI = round2(sale.igst || sale.totals?.igst || 0);
      const sumCr = (name) =>
        round2(
          (entry.lines || [])
            .filter((l) => l.type === 'Cr' && String(l.ledgerName || '').toLowerCase() === name.toLowerCase())
            .reduce((s, l) => s + Number(l.amount || 0), 0)
        );
      const excessC = Math.max(0, sumCr('CGST Output') - expectedC);
      const excessS = Math.max(0, sumCr('SGST Output') - expectedS);
      const excessI = Math.max(0, sumCr('IGST Output') - expectedI);
      const isDoubled = (ex, exp) => {
        if (ex < 1) return false;
        if (exp < 0.01) return ex >= 1;
        return ex >= Number((exp * 0.85).toFixed(2));
      };
      const excess = round2(
        (isDoubled(excessC, expectedC) ? excessC : 0) +
          (isDoubled(excessS, expectedS) ? excessS : 0) +
          (isDoubled(excessI, expectedI) ? excessI : 0)
      );
      if (excess >= 0.01) {
        wouldFix += 1;
        console.log(`  would repair ${entry.entryNo} invoice #${sale.invoiceNo} excess ₹${excess.toFixed(2)}`);
      }
    }
    console.log(`[repair-double-gst] dry-run: ${wouldFix} entr(y/ies) need repair`);
  } else {
    await migration.up(mongoose);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[repair-double-gst] failed:', err);
  process.exit(1);
});
