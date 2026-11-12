'use strict';

/**
 * JSM: Others Reports › Outstanding › Sms Days Wise (Rpt_Sms_OsReports, titled "Outstanding Sms").
 *
 * The reminder JSM would send each party whose bills have been outstanding longer than the Days
 * box. Its own SELECT (SmsScriptWeb) is
 *
 *   SELECT A.*, DATEDIFF(day, A.BILL_DATE, '<date>') AS OS_DAYS FROM JSM_VW_OS_SALES_SUMMARY A
 *   WHERE … AND A.TOT_BALANCE<>0 AND (OS_DAYS>=<days>) AND (A.PEND='P' AND A.OPEN_CLOSE='P')
 *   ORDER BY PARTY, CO_PATH, Q_TYPE, BILL_DATE, BILL_NO, CBILL_NO, NCBILL_NO
 *
 * and it then walks those rows party by party, building one message per party:
 *
 *   Regarding payment of Our Outstanding
 *   BNo <no> BDt <date> OsAmt <balance> Dys <days>
 *
 * So one row per party here, carrying the message JSM would send, its length (JSM's "Show Message
 * Lenth" tick) and the mobile it would go to. The sending itself — JSM's Dongle and Send Thru Web
 * buttons — needs an SMS gateway, which this software has none of, so the screen shows the list
 * and the text and sends nothing.
 */
const { orderRows, inList, round } = require('../jcEngine');
const { loadOutstandingRows } = require('../sources/outstanding');

/** JSM writes the date as dd/MM/yyyy in the message, as its own Date_Format does. */
function ddmmyyyy(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

async function run(companyId, p = {}, deps = {}) {
  const days = Number(p.osDays ?? 90) || 0;

  let rows = deps.rows || await loadOutstandingRows(companyId, 'sales', {
    asOn: p.asOn,
    status: 'Pending',
  });
  rows = inList(rows, 'PARTY', p.parties)
    .filter((r) => round(r.TOT_BALANCE) !== 0 && Number(r.OS_DAYS || 0) >= days);

  const ordered = orderRows(rows, [
    'PARTY', 'BILL_DATE', { field: 'NCBILL_NO', dir: 'asc', numeric: true },
  ]);

  const byParty = new Map();
  for (const r of ordered) {
    const key = r.PARTY || '';
    if (!byParty.has(key)) byParty.set(key, []);
    byParty.get(key).push(r);
  }

  const out = [];
  for (const [party, bills] of byParty) {
    const lines = ['Regarding payment of Our Outstanding'];
    for (const b of bills) {
      // The "Full Comp.Name And Bill.Date" tick is what puts the bill's date in the line.
      lines.push([
        `BNo ${b.NCBILL_NO || ''}`,
        p.withNameAndDate ? `BDt ${ddmmyyyy(b.BILL_DATE)}` : null,
        `OsAmt ${round(b.TOT_BALANCE)}`,
        `Dys ${Number(b.OS_DAYS || 0)}`,
      ].filter(Boolean).join(' '));
    }
    const message = lines.join('\r\n');
    out.push({
      PARTY: party,
      PARTY_MOBILE: bills[0].PARTY_MOBILE || '',
      BILL_COUNT: bills.length,
      TOT_BALANCE: round(bills.reduce((t, b) => t + Number(b.TOT_BALANCE || 0), 0)),
      OS_DAYS: Math.max(...bills.map((b) => Number(b.OS_DAYS || 0))),
      MESSAGE: message,
      MSG_LENTH: message.length,
    });
  }

  return {
    rows: orderRows(out, ['PARTY']),
    grid: {
      layout: 'JSM_VW_SMS_OS',
      variant: 1,
      groupColumns: [],
      groupDisplays: [],
      captions: {},
      title: 'Outstanding Sms',
      period: `OS DAYS >= ${days}   AS ON : ${p.asOnText || p.asOn || ''}`,
      pageWise: false,
    },
  };
}

async function options(companyId) {
  const rows = await loadOutstandingRows(companyId, 'sales', {});
  return {
    parties: [...new Set(rows.map((r) => r.PARTY).filter((v) => String(v ?? '').trim()))]
      .sort((a, b) => String(a).localeCompare(String(b))),
  };
}

module.exports = { run, options };
