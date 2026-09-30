const Party = require('../models/Party');
const PaymentVoucher = require('../models/PaymentVoucher');
const reportService = require('./reportService');
const ledgerEngine = require('./ledgerEngineService');

const round2 = (n) => Number(Number(n || 0).toFixed(2));

function fyStartISO(asOn) {
  const d = asOn ? new Date(asOn) : new Date();
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-04-01`;
}

function dayBefore(iso) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function parseDay(value) {
  const s = String(value || '').trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`);
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) return new Date(`${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}T00:00:00`);
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function daysBetween(a, b) {
  return Math.abs(Math.round((a.getTime() - b.getTime()) / 86400000));
}

async function pendingOutstanding(companyId, type, extra = {}) {
  return reportService.getOutstanding(companyId, type, {
    status: 'Pending',
    includeLastYear: true,
    ...extra,
  });
}

function flattenBills(parties) {
  const rows = [];
  for (const party of parties || []) {
    for (const inv of party.invoices || party.bills || []) {
      rows.push({ party, inv });
    }
  }
  return rows;
}

async function ledgerInterest(companyId, query = {}) {
  const asOn = query.asOn || new Date().toISOString().slice(0, 10);
  const rate = Number(query.rate || 18);
  const minDays = Number(query.minDays || 0);
  const type = query.type === 'payable' ? 'payable' : 'receivable';
  const parties = await pendingOutstanding(companyId, type, { asOn });
  const rows = [];
  for (const { party, inv } of flattenBills(parties)) {
    const outstanding = Number(inv.outstanding || 0);
    const days = Number(inv.ageDays || 0);
    if (outstanding < 0.01 || days < minDays) continue;
    const interest = round2(outstanding * (rate / 100) * (days / 365));
    rows.push({
      partyName: party.partyName,
      billNo: inv.docNo || inv.billNo || '',
      billDate: inv.date,
      outstanding: round2(outstanding),
      days,
      rate,
      interest,
    });
  }
  rows.sort((a, b) => String(a.partyName).localeCompare(String(b.partyName)) || b.days - a.days);
  const totalOutstanding = round2(rows.reduce((s, r) => s + r.outstanding, 0));
  const totalInterest = round2(rows.reduce((s, r) => s + r.interest, 0));
  return { asOn, rate, minDays, type, rows, totalOutstanding, totalInterest };
}

async function confirmation(companyId, query = {}) {
  const asOn = query.asOn || new Date().toISOString().slice(0, 10);
  const balances = await ledgerEngine.computeBalances(companyId, { asOn, includeOpening: true });
  const partyIds = balances.map((b) => b.ledger?.linkedPartyId).filter(Boolean);
  const parties = await Party.find({ companyId, _id: { $in: partyIds } })
    .select('name address city state gstin mobile')
    .lean();
  const byId = new Map(parties.map((p) => [String(p._id), p]));
  const rows = balances
    .filter((b) => b.ledger?.linkedPartyId && b.balance > 0.01)
    .map((b) => {
      const party = byId.get(String(b.ledger.linkedPartyId)) || {};
      return {
        partyName: party.name || b.ledger.name,
        address: [party.address, party.city, party.state].filter(Boolean).join(', '),
        gstin: party.gstin || '',
        phone: party.mobile || '',
        debit: b.type === 'Dr' ? b.balance : 0,
        credit: b.type === 'Cr' ? b.balance : 0,
        balanceType: b.type,
      };
    })
    .sort((a, b) => a.partyName.localeCompare(b.partyName));
  return {
    asOn,
    rows,
    totalDebit: round2(rows.reduce((s, r) => s + r.debit, 0)),
    totalCredit: round2(rows.reduce((s, r) => s + r.credit, 0)),
  };
}

async function aboveBelow(companyId, query = {}) {
  const asOn = query.asOn || new Date().toISOString().slice(0, 10);
  const amount = Number(query.amount || 0);
  const mode = query.mode === 'below' ? 'below' : 'above';
  const side = ['Dr', 'Cr'].includes(query.side) ? query.side : 'all';
  const balances = await ledgerEngine.computeBalances(companyId, { asOn, includeOpening: true });
  const rows = balances
    .filter((b) => b.balance > 0.01)
    .filter((b) => (side === 'all' ? true : b.type === side))
    .filter((b) => (mode === 'above' ? b.balance >= amount - 0.001 : b.balance <= amount + 0.001))
    .map((b) => ({
      name: b.ledger.name,
      group: b.ledger.group || '',
      subGroup: b.ledger.subGroup || '',
      debit: b.type === 'Dr' ? b.balance : 0,
      credit: b.type === 'Cr' ? b.balance : 0,
      balanceType: b.type,
    }))
    .sort((a, b) => b.debit + b.credit - (a.debit + a.credit));
  return { asOn, amount, mode, side, rows, count: rows.length };
}

async function importBank(companyId, body = {}) {
  const windowDays = Number(body.windowDays ?? 3);
  const rowsIn = Array.isArray(body.rows) ? body.rows : [];
  const vouchers = await PaymentVoucher.find({
    companyId,
    status: 'Posted',
    isReversed: { $ne: true },
  }).select('voucherNo date voucherType amount partyName narration chequeNo utrNo slipNo').lean();
  const used = new Set();
  const rows = rowsIn.map((raw, index) => {
    const debit = round2(raw.debit);
    const credit = round2(raw.credit);
    const date = parseDay(raw.date);
    const reference = String(raw.reference || '').trim();
    const narration = String(raw.narration || '').trim();
    const wantType = credit > 0.01 ? 'Receipt' : debit > 0.01 ? 'Payment' : '';
    const amount = credit > 0.01 ? credit : debit;
    let match = null;
    if (wantType && date && amount > 0.01) {
      const refHit = reference
        ? vouchers.find((v) => !used.has(String(v._id))
          && v.voucherType === wantType
          && [v.chequeNo, v.utrNo, v.slipNo].some((value) => String(value || '') === reference))
        : null;
      const hit = refHit || vouchers.find((v) => {
        if (used.has(String(v._id)) || v.voucherType !== wantType) return false;
        if (Math.abs(Number(v.amount) - amount) > 0.05) return false;
        const vd = v.date ? new Date(v.date) : null;
        return vd && daysBetween(vd, date) <= windowDays;
      });
      if (hit) {
        used.add(String(hit._id));
        match = {
          voucherNo: hit.voucherNo,
          voucherType: hit.voucherType,
          partyName: hit.partyName,
          amount: hit.amount,
          date: hit.date,
        };
      }
    }
    return {
      index: index + 1,
      date: date ? date.toISOString().slice(0, 10) : raw.date || '',
      narration,
      reference,
      debit,
      credit,
      status: match ? 'Matched' : (wantType ? 'Unmatched' : 'Skipped'),
      match,
    };
  });
  return {
    windowDays,
    rows,
    matched: rows.filter((r) => r.status === 'Matched').length,
    unmatched: rows.filter((r) => r.status === 'Unmatched').length,
  };
}

async function diffOpening(companyId, query = {}) {
  const asOn = query.asOn || new Date().toISOString().slice(0, 10);
  const onlyDiff = query.onlyDiff !== '0' && query.onlyDiff !== 'false';
  const fyStart = fyStartISO(asOn);
  const before = dayBefore(fyStart);
  const [recv, pay, parties] = await Promise.all([
    pendingOutstanding(companyId, 'receivable', { asOn, billDateTo: before }),
    pendingOutstanding(companyId, 'payable', { asOn, billDateTo: before }),
    Party.find({ companyId }).select('name type openingBalance openingBalanceType').lean(),
  ]);
  const map = new Map();
  const ensure = (id, name, type) => {
    const key = String(id);
    if (!map.has(key)) {
      map.set(key, { partyName: name || '—', partyType: type || '', opening: 0, openingType: 'Dr', receivable: 0, payable: 0 });
    }
    return map.get(key);
  };
  parties.forEach((p) => {
    const row = ensure(p._id, p.name, p.type);
    row.opening = round2(p.openingBalance || 0);
    row.openingType = p.openingBalanceType === 'Cr' ? 'Cr' : 'Dr';
  });
  recv.forEach((p) => { ensure(p.partyId, p.partyName, 'Customer').receivable = round2(p.totalOutstanding || 0); });
  pay.forEach((p) => { ensure(p.partyId, p.partyName, 'Supplier').payable = round2(p.totalOutstanding || 0); });

  const rows = [...map.values()].map((row) => {
    const openingSigned = row.openingType === 'Cr' ? -row.opening : row.opening;
    const billSigned = round2(row.receivable - row.payable);
    const difference = round2(openingSigned - billSigned);
    return { ...row, difference };
  }).filter((row) => row.opening > 0.01 || row.receivable > 0.01 || row.payable > 0.01)
    .filter((row) => !onlyDiff || Math.abs(row.difference) >= 1)
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

  return { asOn, fyStart, onlyDiff, rows, mismatchCount: rows.filter((r) => Math.abs(r.difference) >= 1).length };
}

async function diffYear(companyId, query = {}) {
  const asOn = query.asOn || new Date().toISOString().slice(0, 10);
  const onlyDiff = query.onlyDiff !== '0' && query.onlyDiff !== 'false';
  const [balances, recv, pay] = await Promise.all([
    ledgerEngine.computeBalances(companyId, { asOn, includeOpening: true }),
    pendingOutstanding(companyId, 'receivable', { asOn }),
    pendingOutstanding(companyId, 'payable', { asOn }),
  ]);
  const byParty = new Map();
  const ensure = (id, name) => {
    const key = String(id || name);
    if (!byParty.has(key)) {
      byParty.set(key, {
        partyName: name || '—',
        receivable: 0,
        payable: 0,
        ledgerDebit: 0,
        ledgerCredit: 0,
        hasLedger: false,
      });
    }
    return byParty.get(key);
  };
  balances.forEach((b) => {
    if (!b.ledger?.linkedPartyId) return;
    const row = ensure(b.ledger.linkedPartyId, b.ledger.name);
    row.hasLedger = true;
    row.ledgerDebit = b.type === 'Dr' ? b.balance : 0;
    row.ledgerCredit = b.type === 'Cr' ? b.balance : 0;
  });
  recv.forEach((p) => { ensure(p.partyId, p.partyName).receivable = round2(p.totalOutstanding || 0); });
  pay.forEach((p) => { ensure(p.partyId, p.partyName).payable = round2(p.totalOutstanding || 0); });

  const rows = [...byParty.values()].map((row) => {
    const ledgerSigned = round2(row.ledgerDebit - row.ledgerCredit);
    const billSigned = round2(row.receivable - row.payable);
    const difference = round2(ledgerSigned - billSigned);
    let note = Math.abs(difference) < 1 ? 'Match' : 'Bill outstanding and ledger differ';
    if (!row.hasLedger && (row.receivable > 0.01 || row.payable > 0.01)) note = 'No party ledger';
    return { ...row, difference, note };
  }).filter((row) => row.receivable > 0.01 || row.payable > 0.01 || row.ledgerDebit > 0.01 || row.ledgerCredit > 0.01)
    .filter((row) => !onlyDiff || Math.abs(row.difference) >= 1 || row.note === 'No party ledger')
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

  return { asOn, onlyDiff, rows, mismatchCount: rows.filter((r) => Math.abs(r.difference) >= 1).length };
}

module.exports = {
  ledgerInterest,
  confirmation,
  aboveBelow,
  importBank,
  diffOpening,
  diffYear,
};
