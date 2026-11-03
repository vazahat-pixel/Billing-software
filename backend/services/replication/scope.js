'use strict';

/**
 * What a desktop mirrors, and how each collection is scoped to one company group.
 *
 * Desktop and cloud hold the SAME documents with the SAME _id. The desktop is the writer: every
 * document it changes is copied up verbatim and the cloud stores it as-is, so the two can never
 * calculate anything differently. This file is the only place that decides which collections take
 * part — a collection not listed here is never read from or written to by replication.
 *
 *  BOTH  — copied down at activation, copied up whenever the desktop changes them, and copied
 *          down again from the web when "Desktop-only entries" is OFF.
 *  DOWN  — copied down only, never accepted from a desktop. Billing, plan and module gates live
 *          here: a desktop must not be able to grant itself modules or change its subscription
 *          (the desktop even rewrites commercialPolicy on its own Company copy — that must never
 *          reach the cloud), and users carry credentials.
 *
 * Logs, sessions, queues and sync bookkeeping are in neither list on purpose.
 */

const { BSON } = require('mongodb');

const BOTH = [
  'accountgroups', 'accountingentries', 'automationrules', 'bankinstruments', 'bankreconciliations',
  'beamentries', 'billconfigs', 'billsettlements', 'books', 'businessrules', 'columnconfigs',
  'companysettings', 'costcenters', 'cuttingentries', 'debitcreditnotes', 'deliverychallans',
  'documenttemplates', 'einvoices', 'ewaybills', 'financialclosingruns', 'financialyears',
  'formconfigs', 'grns', 'gstconfigs', 'gstperiods', 'gstr2bimports', 'gstreturnsnapshots',
  'hsnmasters', 'inventories', 'inventorylots', 'items', 'itemprocessmappings', 'jobs',
  'ledgerentries', 'ledgermasters', 'notificationconfigs', 'orders', 'parties', 'paymentvouchers',
  'permissionmatrixes', 'pricingruleconfigs', 'processchaintemplates', 'profitsnapshots',
  'purchases', 'purchaseindents', 'reconciliationruns', 'reportconfigs', 'returninvoices', 'sales',
  'salesquotations', 'stockadjustments', 'stockmovements', 'stockreservations', 'stocktransfers',
  'submasters', 'supplierquotations', 'taxdeductions', 'visits', 'voucherseries', 'warehouses',
  'workflowdefinitions', 'workflowinstances',
  // Bill / voucher number counters. No companyId field — the company id is part of _id.
  'counters',
];

const DOWN = [
  'companies', 'users', 'companymoduleconfigs', 'featureflags', 'enterpriseconfigs',
  'securityconfigs', 'subscriptions', 'licenses', 'plans',
];

const BOTH_SET = new Set(BOTH);
const DOWN_SET = new Set(DOWN);
const ALL = [...BOTH, ...DOWN];

const HEX24 = /^[0-9a-f]{24}$/i;

function oid(v) {
  return v instanceof BSON.ObjectId ? v : new BSON.ObjectId(String(v));
}

/** companyId stored as ObjectId normally, as a string in a few legacy rows — match both. */
function companyIdValues(companyIds) {
  const out = [];
  for (const id of companyIds) {
    const s = String(id);
    out.push(s);
    if (HEX24.test(s)) out.push(oid(s));
  }
  return out;
}

/** Mongo filter selecting this company group's documents in `coll`. */
function scopeFilter(coll, companyIds) {
  const ids = companyIds.map(String).filter((s) => HEX24.test(s));
  if (!ids.length) throw new Error('replication scope needs at least one company id');
  if (coll === 'counters') return { _id: { $regex: `(${ids.join('|')})` } };
  if (coll === 'companies') return { _id: { $in: ids.map(oid) } };
  if (coll === 'plans') return {}; // public price list, no tenant data
  return { companyId: { $in: companyIdValues(ids) } };
}

/** True when `doc` (as it will be stored) belongs to the company group. */
function docInScope(coll, doc, companyIds) {
  const ids = new Set(companyIds.map(String));
  if (!doc || doc._id === undefined || doc._id === null) return false;
  if (coll === 'counters') {
    const id = String(doc._id);
    return [...ids].some((c) => id.includes(c));
  }
  if (coll === 'companies') return ids.has(String(doc._id));
  if (coll === 'plans') return true;
  return doc.companyId !== undefined && doc.companyId !== null && ids.has(String(doc.companyId));
}

const isBoth = (coll) => BOTH_SET.has(coll);
const isDown = (coll) => DOWN_SET.has(coll);
const isMirrored = (coll) => BOTH_SET.has(coll) || DOWN_SET.has(coll);

module.exports = {
  BOTH, DOWN, ALL, isBoth, isDown, isMirrored, scopeFilter, docInScope, companyIdValues,
};
