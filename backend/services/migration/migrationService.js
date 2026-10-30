'use strict';

/**
 * Migration run lifecycle: upload -> preview -> apply -> reconcile -> undo.
 * Import goes only into a company that has no transactions yet; every document it creates is recorded so Undo
 * removes exactly those. Nothing here talks to the old software: it works on an uploaded package file.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const AppError = require('../../utils/AppError');
const { MigrationRun, MigrationRunDocs } = require('../../models/MigrationRun');
const { scanPackage, loadPackage } = require('./packageReader');
const { buildPlan } = require('./jsmMapper');

const MODELS = ['SubMaster', 'Warehouse', 'Party', 'LedgerMaster', 'Item', 'InventoryLot', 'StockMovement', 'Purchase', 'Sales', 'Job', 'ReturnInvoice', 'DebitCreditNote', 'PaymentVoucher', 'AccountingEntry', 'BillSettlement'];
const BATCH = 1000;
const UPLOAD_DIR = process.env.MIGRATION_UPLOAD_DIR || path.join(os.tmpdir(), 'billing-migration');
const model = (n) => require(`../../models/${n}`);
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Transactions that must not exist for an import (masters may). */
async function assertCompanyEmpty(companyId) {
  const found = [];
  for (const n of ['Sales', 'Purchase', 'Job', 'PaymentVoucher', 'AccountingEntry', 'InventoryLot', 'DebitCreditNote', 'ReturnInvoice']) {
    const c = await model(n).collection.countDocuments({ companyId: new mongoose.Types.ObjectId(String(companyId)) });
    if (c > 0) found.push(`${n}: ${c}`);
  }
  // system ledgers seeded at sign-up post nothing; an entry would be a real transaction
  if (found.length) throw AppError.badRequest(`Old data can only be imported into a company with no transactions yet (found ${found.join(', ')}). Create a new company for the import.`);
}

async function createRun({ companyId, userId, source = 'JSM' }) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const run = await MigrationRun.create({ companyId, userId, source, status: 'created' });
  run.filePath = path.join(UPLOAD_DIR, `${run._id}.ndjson.gz`);
  await run.save();
  return run;
}

async function getRun(companyId, id) {
  const run = await MigrationRun.findOne({ _id: id, companyId });
  if (!run) throw AppError.notFound('Import not found');
  return run;
}

/** Chunks arrive in order (index 0..n-1); a repeated chunk (retry) is ignored, a skipped one is refused. */
async function appendChunk(run, index, buffer) {
  if (!['created', 'uploading'].includes(run.status)) throw AppError.badRequest('This import is not accepting uploads');
  const expected = run.progress?.done || 0;
  if (index < expected) return run; // already received (a retry)
  if (index > expected) throw AppError.badRequest(`Chunk ${index} arrived before chunk ${expected}`);
  fs.appendFileSync(run.filePath, buffer);
  run.status = 'uploading';
  run.uploadedBytes += buffer.length;
  run.progress = { stage: 'upload', done: expected + 1, total: 0 };
  await run.save();
  return run;
}

function onlyZerosAfter(file, from, to) {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(Math.min(1024 * 1024, to - from));
    for (let pos = from; pos < to;) {
      const n = fs.readSync(fd, buf, 0, Math.min(buf.length, to - pos), pos);
      if (n <= 0) return false;
      for (let i = 0; i < n; i += 1) if (buf[i] !== 0) return false;
      pos += n;
    }
    return true;
  } finally { fs.closeSync(fd); }
}

async function completeUpload(run, { expectedBytes } = {}) {
  if (!fs.existsSync(run.filePath)) throw AppError.badRequest('Nothing was uploaded');
  let size = fs.statSync(run.filePath).size;
  // Desktop 1.0.8 sends its last piece padded with zero bytes up to the full piece size; cut that padding off.
  if (expectedBytes && size > Number(expectedBytes) && onlyZerosAfter(run.filePath, Number(expectedBytes), size)) {
    fs.truncateSync(run.filePath, Number(expectedBytes));
    size = Number(expectedBytes);
    run.uploadedBytes = size;
  }
  if (expectedBytes && size !== Number(expectedBytes)) {
    run.status = 'invalid'; run.problems = [`Uploaded ${size} bytes, expected ${expectedBytes}`]; await run.save();
    return run;
  }
  const scan = await scanPackage(run.filePath);
  run.header = scan.header ? { format: scan.header.format, source: scan.header.source, extractedAt: scan.header.extractedAt, companies: scan.header.companies } : null;
  run.problems = scan.problems;
  run.status = scan.problems.length ? 'invalid' : 'uploaded';
  await run.save();
  return run;
}

function summarise(plan) {
  return { counts: plan.counts, expected: { counts: plan.expected.counts, totals: plan.expected.totals }, warnings: plan.warnings.slice(0, 200), warningCount: plan.warnings.length, blockers: plan.blockers,
    years: plan.years.map((y) => ({ path: y.path, name: y.name, from: y.from, to: y.to })) };
}

/** Dry run: what would be created, without touching any collection. */
async function preview(run, { years } = {}) {
  if (!['uploaded', 'applied'].includes(run.status)) throw AppError.badRequest('Upload the data first');
  const pkg = await loadPackage(run.filePath);
  const plan = buildPlan(filterYears(pkg.tables, years), { companyId: run.companyId });
  return summarise(plan);
}

function filterYears(tables, years) {
  if (!years || !years.length) return tables;
  const keep = new Set(years);
  const out = {};
  for (const [name, rows] of Object.entries(tables)) out[name] = rows.some((r) => 'CO_PATH' in r) ? rows.filter((r) => keep.has(String(r.CO_PATH).trim())) : rows;
  return out;
}

const pathGet = (o, f) => f.split('.').reduce((v, k) => (v == null ? v : v[k]), o);
const pathSet = (o, f, val) => { const ks = f.split('.'); let t = o; for (const k of ks.slice(0, -1)) t = t[k] ||= {}; t[ks[ks.length - 1]] = val; };
/** Does a document fall under a partial index (the simple forms used in our models)? */
function underPartial(doc, filter) {
  if (!filter) return true;
  return Object.entries(filter).every(([f, cond]) => {
    const v = pathGet(doc, f);
    if (!cond || typeof cond !== 'object' || cond instanceof Date) return v === cond;
    if (cond.$exists !== undefined && (v !== undefined) !== Boolean(cond.$exists)) return false;
    if (cond.$type === 'string' && typeof v !== 'string') return false;
    if (cond.$type === 'number' && typeof v !== 'number') return false;
    if (cond.$gt !== undefined && !(v > cond.$gt)) return false;
    return v !== undefined && v !== null;
  });
}

/**
 * Before saving: every unique rule of the database (bill numbers, item codes, party codes, names ...) is checked
 * against the import itself and what the company already has. A clash gets /2, /3 ... (a number field is left
 * empty) and a warning, so the import never stops on "duplicate key".
 */
async function makeUnique(docsByModel, companyId, warnings) {
  for (const name of MODELS) {
    const list = docsByModel[name] || [];
    if (!list.length) continue;
    // the database's own rules, plus the model's (in case an index is not built yet)
    let dbIndexes = [];
    try { dbIndexes = await model(name).collection.indexes(); } catch { /* collection not created yet */ }
    const fromSchema = (model(name).schema?.indexes() || []).map(([key, o]) => ({ key, unique: !!o?.unique, partialFilterExpression: o?.partialFilterExpression, name: JSON.stringify(key) }));
    const seenIx = new Set();
    const indexes = [...dbIndexes, ...fromSchema].filter((i) => { const k = JSON.stringify(Object.keys(i.key || {}).sort()); if (seenIx.has(k)) return false; seenIx.add(k); return true; });
    for (const ix of indexes.filter((i) => i.unique && i.name !== '_id_' && i.key && 'companyId' in i.key)) {
      const fields = Object.keys(ix.key).filter((f) => f !== 'companyId');
      if (!fields.length) continue;
      const keyOf = (d) => JSON.stringify(fields.map((f) => { const v = pathGet(d, f); return v == null ? null : String(v); }));
      const existing = await model(name).collection.find({ companyId }, { projection: Object.fromEntries(fields.map((f) => [f, 1])) }).toArray();
      const taken = new Set(existing.filter((d) => underPartial(d, ix.partialFilterExpression)).map(keyOf));
      let fixed = 0;
      for (const d of list) {
        if (!underPartial(d, ix.partialFilterExpression)) continue;
        let k = keyOf(d);
        if (!taken.has(k)) { taken.add(k); continue; }
        fixed += 1;
        const f = [...fields].reverse().find((x) => typeof pathGet(d, x) === 'string');
        if (!f) { const nf = fields.find((x) => typeof pathGet(d, x) === 'number'); if (nf) pathSet(d, nf, undefined); continue; }
        const base = pathGet(d, f);
        for (let i = 2; taken.has(k); i += 1) { pathSet(d, f, `${base}/${i}`); k = keyOf(d); }
        taken.add(k);
      }
      if (fixed) warnings.push(`${fixed} ${name} record(s): ${fields.join(' + ')} was already used (twice in JSM, or already in this company); saved with /2, /3 ... so the import could finish`);
    }
  }
}

async function insertAll(run, docsByModel) {
  const total = Object.values(docsByModel).reduce((n, l) => n + l.length, 0);
  let done = 0;
  for (const name of MODELS) {
    const list = docsByModel[name] || [];
    const M = model(name);
    for (let i = 0; i < list.length; i += BATCH) {
      const batch = list.slice(i, i + BATCH);
      // listed BEFORE the insert: if the batch fails halfway, undo still removes the part that got in
      await MigrationRunDocs.create({ runId: run._id, model: name, ids: batch.map((d) => d._id) });
      // collection-level insert: documents keep their own dates and ids, no per-document save hooks
      await M.collection.insertMany(batch.map((d) => ({ ...d, isDeleted: false, version: 0 })), { ordered: true });
      done += batch.length;
      run.progress = { stage: `saving ${name}`, done, total };
      await run.save();
    }
  }
}

/** Bill counters continue after the highest imported number so the next new bill never clashes. */
async function bumpCounters(companyId, docs) {
  const Counter = model('Counter');
  const maxNum = (list, f) => list.reduce((m, d) => { const n = parseInt(String(d[f]).match(/^\d+$/) ? d[f] : 0, 10); return Number.isFinite(n) && n > m ? n : m; }, 0);
  const bump = (module, seq) => Counter.collection.updateOne({ _id: `BILLNO-${module}-${companyId}` }, { $max: { seq } }, { upsert: true });
  // every series continues after the highest imported number (JSM's numbers are kept as they are)
  const vouchers = docs.PaymentVoucher || []; const returns = docs.ReturnInvoice || [];
  await bump('sales', maxNum(docs.Sales || [], 'invoiceNo'));
  await bump('purchase', maxNum(docs.Purchase || [], 'invoiceNo'));
  await bump('receipt', maxNum(vouchers.filter((v) => v.voucherType === 'Receipt'), 'voucherNo'));
  await bump('payment', maxNum(vouchers.filter((v) => v.voucherType === 'Payment'), 'voucherNo'));
  await bump('note', maxNum(docs.DebitCreditNote || [], 'noteNo'));
  await bump('salesReturn', maxNum(returns.filter((r) => r.returnType === 'Sales'), 'invoiceNo'));
  await bump('purchaseReturn', maxNum(returns.filter((r) => r.returnType === 'Purchase'), 'invoiceNo'));
  await bump('job', Math.max(maxNum(docs.Job || [], 'jobCardNo'), maxNum(docs.Job || [], 'challanNo')));
}

async function apply(run, { years } = {}) {
  if (run.status !== 'uploaded') throw AppError.badRequest('This import is not ready to apply');
  await assertCompanyEmpty(run.companyId);
  run.status = 'applying'; run.error = ''; run.progress = { stage: 'reading', done: 0, total: 0 }; await run.save();
  try {
    const pkg = await loadPackage(run.filePath);
    const plan = buildPlan(filterYears(pkg.tables, years), { companyId: run.companyId });
    if (plan.blockers.length) throw AppError.badRequest(plan.blockers.join(' '));

    // masters that already exist under the same name are reused, not duplicated
    const reused = new Map();
    for (const [name, nameField, byId] of [['Party', 'name'], ['Item', 'name'], ['LedgerMaster', 'name']]) {
      const existing = await model(name).collection.find({ companyId: run.companyId }, { projection: { name: 1, gstin: 1, accd: 1 } }).toArray();
      if (!existing.length) continue;
      const have = new Map(existing.map((e) => [String(e.name).toLowerCase(), e]));
      // a party already here with the same JSM account code or GSTIN is the same account / firm (both are unique per company)
      const haveAccd = new Map(name === 'Party' ? existing.filter((e) => Number(e.accd) > 0).map((e) => [Number(e.accd), e._id]) : []);
      const haveGstin = new Map(name === 'Party' ? existing.filter((e) => e.gstin).map((e) => [String(e.gstin).toUpperCase(), e._id]) : []);
      const dropped = new Map();
      plan.docs[name] = plan.docs[name].filter((d) => {
        const byName = have.get(String(d[nameField]).toLowerCase());
        // a same-name party with a different JSM code is another account: keep this one under a distinct name
        const nameOk = byName && !(name === 'Party' && Number(byName.accd) > 0 && Number(d.accd) > 0 && Number(byName.accd) !== Number(d.accd));
        const hit = (Number(d.accd) > 0 && haveAccd.get(Number(d.accd))) || (d.gstin && haveGstin.get(String(d.gstin).toUpperCase())) || (nameOk && byName._id);
        if (hit) { dropped.set(String(d._id), hit); return false; }
        if (byName) d[nameField] = `${d[nameField]} (${d.accd || 2})`;
        return true;
      });
      if (dropped.size) remapIds(plan.docs, dropped);
      for (const [from, to] of dropped) reused.set(from, to);
    }
    // the expected outstanding follows a reused party to its existing record
    const outBy = {};
    for (const [pid, v] of Object.entries(plan.expected.outstandingByParty || {})) { const k = String(reused.get(pid) || pid); outBy[k] = Math.round(((outBy[k] || 0) + v) * 100) / 100; }
    plan.expected.outstandingByParty = outBy;
    // other masters (station, transport, tax slab ...) already there under the same name are kept as they are
    const subHave = new Set((await model('SubMaster').collection.find({ companyId: run.companyId }, { projection: { type: 1, name: 1 } }).toArray()).map((d) => `${d.type}|${String(d.name).toLowerCase()}`));
    plan.docs.SubMaster = (plan.docs.SubMaster || []).filter((d) => !subHave.has(`${d.type}|${String(d.name).toLowerCase()}`));
    const godHave = new Set((await model('Warehouse').collection.find({ companyId: run.companyId }, { projection: { name: 1, code: 1 } }).toArray()).flatMap((w) => [String(w.name).toLowerCase(), `#${w.code}`]));
    plan.docs.Warehouse = (plan.docs.Warehouse || []).filter((w) => !godHave.has(String(w.name).toLowerCase()) && !godHave.has(`#${w.code}`));

    await makeUnique(plan.docs, run.companyId, plan.warnings);
    await insertAll(run, plan.docs);
    await bumpCounters(run.companyId, plan.docs);
    run.status = 'applied'; run.appliedAt = new Date(); run.summary = summarise(plan); run.progress = { stage: 'done', done: 1, total: 1 };
    run.expectedInternal = undefined;
    await run.save();
    await MigrationRun.collection.updateOne({ _id: run._id }, { $set: { 'summary.expectedFull': { closing: plan.expected.closing, outstandingByParty: plan.expected.outstandingByParty, masters: plan.expected.masters || {} } } });
    return run;
  } catch (err) {
    run.status = 'failed'; run.error = String(err.message || err).slice(0, 500); await run.save();
    await undo(run, { keepStatus: true }); // leave the company as it was
    throw err;
  }
}

/** Points references to a dropped (reused) master at the existing one. */
function remapIds(docs, dropped) {
  const swap = (v) => dropped.get(String(v)) || v;
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (o instanceof mongoose.Types.ObjectId || o instanceof Date) return;
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (v instanceof mongoose.Types.ObjectId) { if (k !== '_id') o[k] = swap(v); } else walk(v);
    }
  };
  Object.values(docs).forEach((list) => list.forEach(walk));
}

/** Removes exactly the documents this run created (and the counters it moved). */
async function undo(run, { keepStatus = false } = {}) {
  if (!['applied', 'applying', 'failed'].includes(run.status)) throw AppError.badRequest('Nothing to undo');
  const parts = await MigrationRunDocs.find({ runId: run._id }).lean();
  const byModel = {};
  parts.forEach((p) => { (byModel[p.model] ||= []).push(...p.ids); });
  for (const name of [...MODELS].reverse()) {
    const ids = byModel[name] || [];
    for (let i = 0; i < ids.length; i += BATCH) await model(name).collection.deleteMany({ _id: { $in: ids.slice(i, i + BATCH) }, companyId: run.companyId });
  }
  await MigrationRunDocs.deleteMany({ runId: run._id });
  const Counter = model('Counter');
  const series = ['sales', 'purchase', 'receipt', 'payment', 'note', 'salesReturn', 'purchaseReturn', 'job'];
  await Counter.collection.deleteMany({ _id: { $in: series.map((m) => `BILLNO-${m}-${run.companyId}`) }, seq: { $lte: 1e9 } }).catch(() => {});
  if (!keepStatus) { run.status = 'undone'; run.undoneAt = new Date(); run.reconciliation = null; await run.save(); }
  return run;
}

/**
 * Compares what is now in MERN with what JSM's own data says: document counts and totals, every account's closing
 * balance (opening + all postings), and the outstanding of every party. Tolerance 0.01.
 */
async function reconcile(run) {
  if (run.status !== 'applied') throw AppError.badRequest('Reconcile an applied import');
  const raw = await MigrationRun.collection.findOne({ _id: run._id }, { projection: { summary: 1 } });
  const expected = raw.summary;
  const full = expected.expectedFull || {};
  const cid = new mongoose.Types.ObjectId(String(run.companyId));
  const checks = [];
  const add = (area, key, jsm, mern) => checks.push({ area, key, jsm, mern, diff: r2(Number(mern) - Number(jsm)), ok: Math.abs(Number(mern) - Number(jsm)) <= 0.01 });
  const cnt = (n, extra = {}) => model(n).collection.countDocuments({ companyId: cid, ...extra });
  const sumOf = async (n, field, extra = {}) => ((await model(n).collection.aggregate([{ $match: { companyId: cid, ...extra } }, { $group: { _id: null, t: { $sum: `$${field}` } } }]).toArray())[0]?.t) || 0;

  const ec = expected.expected.counts; const et = expected.expected.totals;
  add('Count', 'Sales bills', ec.sales, await cnt('Sales'));
  add('Count', 'Purchase bills', ec.purchases, await cnt('Purchase'));
  add('Count', 'Receipts + payments', ec.vouchers, await cnt('PaymentVoucher'));
  add('Count', 'GST notes', ec.notes, await cnt('DebitCreditNote'));
  add('Count', 'Sales returns', ec.returns, await cnt('ReturnInvoice'));
  add('Total', 'Sales net amount', et.salesNet, await sumOf('Sales', 'netAmount'));
  add('Total', 'Purchase net amount', et.purchaseNet, await sumOf('Purchase', 'netAmount'));
  add('Total', 'Receipts', et.receipts, await sumOf('PaymentVoucher', 'amount', { voucherType: 'Receipt' }));
  add('Total', 'Payments', et.payments, await sumOf('PaymentVoucher', 'amount', { voucherType: 'Payment' }));

  // account closing balances: opening + posted lines
  const ledgers = await model('LedgerMaster').collection.find({ companyId: cid }, { projection: { name: 1, code: 1, openingBalance: 1, openingBalanceType: 1 } }).toArray();
  const lines = await model('AccountingEntry').collection.aggregate([{ $match: { companyId: cid } }, { $unwind: '$lines' },
    { $group: { _id: '$lines.ledgerId', dr: { $sum: { $cond: [{ $eq: ['$lines.type', 'Dr'] }, '$lines.amount', 0] } }, cr: { $sum: { $cond: [{ $eq: ['$lines.type', 'Cr'] }, '$lines.amount', 0] } } } }]).toArray();
  const posted = new Map(lines.map((l) => [String(l._id), l.dr - l.cr]));
  // every JSM account is checked; one that went into an existing account of the same name (Round Off, TDS ...) is found by name
  const byCode = new Map(ledgers.filter((l) => l.code).map((l) => [String(l.code), l]));
  const byName = new Map(ledgers.map((l) => [String(l.name || '').trim().toLowerCase(), l]));
  for (const [code, want] of Object.entries(full.closing || {})) {
    const l = byCode.get(code) || byName.get(String(want.name || '').trim().toLowerCase());
    const op = l ? (l.openingBalanceType === 'Cr' ? -1 : 1) * (l.openingBalance || 0) : 0;
    add('Account balance', `${want.name} (Dr+ / Cr-)`, want.balance, l ? r2(op + (posted.get(String(l._id)) || 0)) : 0);
  }
  // outstanding per party
  const out = await model('BillSettlement').collection.aggregate([{ $match: { companyId: cid } }, { $group: { _id: '$partyId', o: { $sum: '$outstandingAmount' } } }]).toArray();
  const got = new Map(out.map((o) => [String(o._id), r2(o.o)]));
  const parties = await model('Party').collection.find({ companyId: cid }, { projection: { name: 1 } }).toArray();
  const names = new Map(parties.map((p) => [String(p._id), p.name]));
  // the expected outstanding was computed with the ids of the plan; compare by party name through the stored ids
  const idsByName = new Map(parties.map((p) => [String(p._id), p.name]));
  for (const [pid, want] of Object.entries(full.outstandingByParty || {})) add('Outstanding', `${idsByName.get(pid) || pid}`, want, got.get(pid) || 0);

  // other masters: every JSM name is here (station, transport, tax slab, unit, party bank ...)
  for (const [kind, names] of Object.entries(full.masters || {})) {
    const have = kind === 'Godown'
      ? await model('Warehouse').collection.find({ companyId: cid }, { projection: { name: 1 } }).toArray()
      : await model('SubMaster').collection.find({ companyId: cid, type: kind }, { projection: { name: 1 } }).toArray();
    const set = new Set(have.map((d) => String(d.name).trim().toLowerCase()));
    add('Masters', kind, names.length, names.filter((nm) => set.has(String(nm).trim().toLowerCase())).length);
  }

  // stock never negative
  const neg = await model('InventoryLot').collection.countDocuments({ companyId: cid, $or: [{ remainingMtrs: { $lt: 0 } }, { remainingPcs: { $lt: 0 } }] });
  add('Stock', 'Lots with negative balance', 0, neg);

  const mismatches = checks.filter((c) => !c.ok);
  const report = { at: new Date(), total: checks.length, matched: checks.length - mismatches.length, mismatched: mismatches.length, ok: mismatches.length === 0, checks, warnings: expected.warnings, warningCount: expected.warningCount };
  run.reconciliation = report; await run.save();
  return report;
}

function reportCsv(report) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return ['Area,Item,JSM,MERN,Difference,Result', ...report.checks.map((c) => [c.area, c.key, c.jsm, c.mern, c.diff, c.ok ? 'OK' : 'MISMATCH'].map(esc).join(','))].join('\r\n');
}

module.exports = { createRun, getRun, appendChunk, completeUpload, preview, apply, undo, reconcile, reportCsv, assertCompanyEmpty };
