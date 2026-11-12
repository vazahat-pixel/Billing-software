'use strict';

/**
 * JSM: Reports › Tds Reports › Address/Acknowledge (Rpt_Tds3_Add_Ackn).
 *
 * A small settings form: the CIT address and the four quarterly TDS acknowledgement numbers, kept
 * once per company (JSM's J_COMMON row 1). run with action 'save' writes them, anything else reads
 * them. Stored on the company settings record; no report or calculation reads them.
 */
const FIELDS = { TDS_ADDR: 'tdsCitAddress', TDS_Q1: 'tdsAckQ1', TDS_Q2: 'tdsAckQ2', TDS_Q3: 'tdsAckQ3', TDS_Q4: 'tdsAckQ4' };

async function run(companyId, p = {}, deps = {}) {
  const CompanySettings = deps.CompanySettings || require('../../../models/CompanySettings');
  if (p.action === 'save') {
    const set = {};
    for (const [out, field] of Object.entries(FIELDS)) set[field] = String(p[out] ?? '').slice(0, out === 'TDS_ADDR' ? 1000 : 200);
    const existed = Boolean(await CompanySettings.findOne({ companyId }).select('_id').lean());
    await CompanySettings.updateOne({ companyId }, { $set: set }, { upsert: true });
    return { rows: [{ ...Object.fromEntries(Object.entries(FIELDS).map(([out, f]) => [out, set[f]])) }], message: existed ? 'Record Updated' : 'Record saved...' };
  }
  const doc = (await CompanySettings.findOne({ companyId }).lean()) || {};
  return { rows: [Object.fromEntries(Object.entries(FIELDS).map(([out, f]) => [out, doc[f] || '']))] };
}

async function options() {
  return {};
}

module.exports = { run, options, FIELDS };
