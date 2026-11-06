'use strict';

/**
 * JSM: Reports › Fas Reports › Voucher Book (Rpt_JvBook1, "Voucher Reports").
 *
 * The screen filters one voucher kind over a date range — its decompiled Genrate_Reports builds
 *   {…v_type} = '<JV|DN|CN>' and {…ent_date} in CDate(from) to CDate(to) and {…co_path} = '…'
 * — and prints X-Detail (a line at a time) or Y-Summary (a total per account).
 *
 * The printed columns are JSM's own VW_T_JV_BOOK: J_NAME, ENT_DATE, SRAL_NO, R_P and AMOUNT.
 * JV reads this software's journal vouchers; DN and CN read its debit and credit notes.
 */
const { orderRows, groupBy, round } = require('../jcEngine');

const KINDS = {
  JV: { label: 'Journal Voucher' },
  DN: { label: 'Debit Note' },
  CN: { label: 'Credit Note' },
};

function kindOf(raw) {
  const k = String(raw ?? 'JV').trim().toUpperCase();
  if (!KINDS[k]) {
    const err = new Error(`Unknown voucher type: ${raw}`);
    err.status = 400;
    throw err;
  }
  return k;
}

const between = (from, to) => {
  const q = {};
  if (from) q.$gte = new Date(from);
  if (to) q.$lte = new Date(`${to}T23:59:59.999Z`);
  return Object.keys(q).length ? q : null;
};

/** Journal vouchers, a row per posted line — JSM's R_P is the line's own Dr/Cr side. */
async function journalLines(companyId, from, to) {
  const AccountingEntry = require('../../../models/AccountingEntry');
  const ledgerEngine = require('../../ledgerEngineService');
  const match = { companyId, voucherType: 'Journal', ...ledgerEngine.LIVE_ENTRY_FILTER };
  const range = between(from, to);
  if (range) match.entryDate = range;

  const entries = await AccountingEntry.find(match).select('entryNo entryDate lines').lean();
  const out = [];
  for (const e of entries) {
    for (const l of e.lines || []) {
      out.push({
        ENT_DATE: e.entryDate,
        SRAL_NO: e.entryNo || '',
        J_NAME: l.ledgerName || '',
        R_P: l.type === 'Dr' ? 'D' : 'C',
        AMOUNT: round(Number(l.amount || 0)),
      });
    }
  }
  return out;
}

/** Debit / credit notes, a row per note. */
async function noteLines(companyId, kind, from, to) {
  const DebitCreditNote = require('../../../models/DebitCreditNote');
  const match = { companyId, noteType: kind === 'DN' ? 'Debit' : 'Credit' };
  const range = between(from, to);
  if (range) match.date = range;

  const notes = await DebitCreditNote.find(match).select('vNo noteNo date partyName amount totalAmount').lean();
  return notes.map((n) => ({
    ENT_DATE: n.date,
    SRAL_NO: n.vNo || n.noteNo || '',
    J_NAME: n.partyName || '',
    R_P: kind === 'DN' ? 'D' : 'C',
    AMOUNT: round(Number(n.totalAmount ?? n.amount ?? 0)),
  }));
}

async function run(companyId, p = {}, deps = {}) {
  const kind = kindOf(p.voucherType);
  const summary = p.summary === true || String(p.summary) === 'true';

  const rows = deps.rows
    || (kind === 'JV'
      ? await journalLines(companyId, p.from, p.to)
      : await noteLines(companyId, kind, p.from, p.to));

  const period = `DATE : FROM ${p.fromText || p.from || ''}  TO  ${p.toText || p.to || ''}`;
  const title = `${KINDS[kind].label} Book`;

  if (summary) {
    const grouped = groupBy(rows.map((r) => ({ ...r, J_NAME: r.J_NAME || '' })), ['J_NAME'], { sum: ['AMOUNT'] });
    for (const g of grouped) g.AMOUNT = round(g.AMOUNT);
    return {
      rows: orderRows(grouped, ['J_NAME']),
      grid: {
        layout: 'JSM_VW_JV_BOOK_SUMMARY',
        variant: 1,
        groupColumns: [],
        groupDisplays: [],
        captions: {},
        title: `${title} [Summary]`,
        period,
        pageWise: false,
      },
    };
  }

  return {
    rows: orderRows(rows, ['ENT_DATE', { field: 'SRAL_NO', dir: 'asc', numeric: true }, 'J_NAME']),
    grid: {
      layout: 'JSM_VW_JV_BOOK',
      variant: 1,
      groupColumns: [],
      groupDisplays: [],
      captions: {},
      title,
      period,
      pageWise: false,
    },
  };
}

async function options() { return {}; }

module.exports = { run, options, KINDS };
