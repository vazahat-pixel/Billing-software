'use strict';

/**
 * JSM: Reports › Monthly Reports › Bank Rec. Payment (Rpt_BankBookRec_GstMonthWise, "BANK MONTH WISE").
 *
 * For the ticked bank accounts, the debits and credits posted to them in the period, totalled by
 * month: REGISTER 'SUMMARY', MONTH, DEBIT, CREDIT, in month order (JSM sorts on MONTH(ent_date)).
 * Read from the ledger statement of each account, as the Ledger screen reads it.
 */
const { MONTHS, round } = require('../jcEngine');

const BANK_GROUPS = ['Bank Accounts', 'Bank OD A/c'];
const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

async function banks(companyId) {
  const LedgerMaster = require('../../../models/LedgerMaster');
  return LedgerMaster.find({ companyId, group: { $in: BANK_GROUPS } }).select('name').lean();
}

async function run(companyId, p = {}, deps = {}) {
  const list = deps.banks || await banks(companyId);
  const want = Array.isArray(p.banks) && p.banks.length ? new Set(p.banks.map((b) => String(b).trim().toUpperCase())) : null;
  const chosen = list.filter((b) => !want || want.has(String(b.name).trim().toUpperCase()));
  const statement = deps.statement || ((l) => require('../../ledgerEngineService').getStatement(companyId, l._id, { from: p.from, to: p.to }));

  const byMonth = new Map();
  for (const bank of chosen) {
    const res = await statement(bank);
    for (const r of res.statement || []) {
      const d = dayKey(r.date);
      if ((p.from && d < p.from) || (p.to && d > p.to)) continue;
      const t = new Date(r.date);
      const key = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`;
      if (!byMonth.has(key)) byMonth.set(key, { REGISTER: 'SUMMARY', MONTH: MONTHS[t.getUTCMonth()], MONTH_NO: t.getUTCMonth() + 1, DEBIT: 0, CREDIT: 0 });
      const m = byMonth.get(key);
      m.DEBIT += Number(r.debit) || 0;
      m.CREDIT += Number(r.credit) || 0;
    }
  }
  const rows = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, m]) => ({ ...m, DEBIT: round(m.DEBIT), CREDIT: round(m.CREDIT) }));
  return {
    rows,
    grid: {
      layout: 'JSM_VW_T_CASHBANK_MONTH_WISE',
      variant: 1,
      groupColumns: ['REGISTER'],
      groupDisplays: ['REGISTER'],
      captions: {},
      title: 'Month Wise Bank List GSTIN:',
      period: `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`,
      pageWise: false,
    },
  };
}

async function options(companyId, deps = {}) {
  const list = deps.banks || await banks(companyId);
  return { banks: list.map((b) => b.name).filter(Boolean).sort((a, b) => a.localeCompare(b)) };
}

module.exports = { run, options };
