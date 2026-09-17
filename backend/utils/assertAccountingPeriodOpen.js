/**
 * Refuse postings into a closed/locked accounting period.
 * Checks FinancialYear locks (Stage-3 closing) and legacy Company.settings.lockedUntilDate.
 * Does not touch tax/amount math.
 */
'use strict';

async function assertAccountingPeriodOpen(companyId, entryDate) {
  const d = new Date(entryDate || Date.now());
  if (Number.isNaN(d.getTime())) {
    throw new Error('Invalid document date for period lock check');
  }

  const journalEngineService = require('../services/journalEngineService');
  await journalEngineService.assertPeriodOpen(companyId, d);

  const Company = require('../models/Company');
  const company = await Company.findById(companyId).select('settings.lockedUntilDate').lean();
  const lockedUntil = company?.settings?.lockedUntilDate;
  if (lockedUntil) {
    const lockDate = new Date(lockedUntil);
    if (d <= lockDate) {
      throw new Error(
        `Accounting period locked until ${lockDate.toLocaleDateString()}`
      );
    }
  }

  return true;
}

module.exports = { assertAccountingPeriodOpen };
