/**
 * Fill missing purchase returns + debit/credit notes on the demo tenant (no full reseed).
 * Usage: node scripts/seedNotesAndReturns.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { QaContext } = require('../qa/context');
const { getOrCreateQaTenant } = require('../qa/utils/tenant');
const { simulateNotesAndReturns } = require('../qa/simulator/notesAndReturnsSimulator');

(async () => {
  const ctx = new QaContext({ profile: 'demo', args: {} });
  await ctx.connect();
  const tenant = await getOrCreateQaTenant('demo');
  ctx.companyId = tenant.companyId;
  ctx.userId = tenant.userId;

  const result = await simulateNotesAndReturns(ctx);

  const ReturnInvoice = require('../models/ReturnInvoice');
  const DebitCreditNote = require('../models/DebitCreditNote');
  const counts = {
    purchaseReturns: await ReturnInvoice.countDocuments({ companyId: ctx.companyId, returnType: 'Purchase' }),
    salesReturns: await ReturnInvoice.countDocuments({ companyId: ctx.companyId, returnType: 'Sales' }),
    notes: await DebitCreditNote.countDocuments({ companyId: ctx.companyId }),
    creditNotes: await DebitCreditNote.countDocuments({ companyId: ctx.companyId, noteType: 'Credit' }),
    debitNotes: await DebitCreditNote.countDocuments({ companyId: ctx.companyId, noteType: 'Debit' }),
  };

  console.log(JSON.stringify({ created: result, counts, errors: result.errors }, null, 2));
  await ctx.disconnect();
  process.exit(result.failed && !result.created ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
