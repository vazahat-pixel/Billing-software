const TaxDeduction = require('../models/TaxDeduction');
const Party = require('../models/Party');
const LedgerMaster = require('../models/LedgerMaster');
const journalEngine = require('./journalEngineService');
const gstConfigService = require('./gstConfigService');
const auditService = require('./auditService');
const { periodBounds } = require('../utils/gstDetermination');

const round2 = (n) => Number(Number(n || 0).toFixed(2));

const TDS_SECTIONS = {
  '194C': { name: 'Contractors', defaultRate: 1, threshold: 30000 },
  '194H': { name: 'Commission/Brokerage', defaultRate: 5, threshold: 15000 },
  '194J': { name: 'Professional/Technical', defaultRate: 10, threshold: 30000 },
  '194Q': { name: 'Purchase of Goods', defaultRate: 0.1, threshold: 5000000 },
  '194A': { name: 'Interest', defaultRate: 10, threshold: 40000 },
  '194I': { name: 'Rent', defaultRate: 10, threshold: 240000 },
};

const TCS_SECTIONS = {
  '206C(1H)': { name: 'Sale of Goods', defaultRate: 0.1, threshold: 5000000 },
  '206C': { name: 'TCS General', defaultRate: 1, threshold: 0 },
};

/**
 * TDS & TCS Engine — Sprint 4.5
 */
class TdsTcsService {
  sections() {
    return { tds: TDS_SECTIONS, tcs: TCS_SECTIONS };
  }

  async computeTds({ section, taxableAmount, pan, customRate }) {
    const meta = TDS_SECTIONS[section];
    if (!meta) throw new Error(`Unknown TDS section ${section}`);
    const rate = customRate != null ? Number(customRate) : meta.defaultRate;
    // Higher rate without PAN (approx 20% rule simplified)
    const effectiveRate = pan && String(pan).length === 10 ? rate : Math.max(rate, 20);
    const amount = round2((Number(taxableAmount) * effectiveRate) / 100);
    return { section, rate: effectiveRate, amount, threshold: meta.threshold, name: meta.name };
  }

  async computeTcs({ section = '206C(1H)', taxableAmount, customRate }) {
    const meta = TCS_SECTIONS[section] || TCS_SECTIONS['206C(1H)'];
    const rate = customRate != null ? Number(customRate) : meta.defaultRate;
    const amount = round2((Number(taxableAmount) * rate) / 100);
    return { section, rate, amount, threshold: meta.threshold, name: meta.name };
  }

  async postTds(companyId, payload, userId) {
    const party = await Party.findOne({ _id: payload.partyId, companyId });
    if (!party) throw new Error('Party not found');

    const calc = await this.computeTds({
      section: payload.section,
      taxableAmount: payload.taxableAmount,
      pan: payload.pan || party.pan,
      customRate: payload.rate,
    });

    if (calc.amount < 0.01) throw new Error('TDS amount is zero');

    await gstConfigService.mapSystemLedgers(companyId);
    const cfg = await gstConfigService.getOrCreate(companyId);
    let tdsLedger = cfg.ledgerMap?.tdsPayable
      ? await LedgerMaster.findById(cfg.ledgerMap.tdsPayable)
      : await LedgerMaster.findOne({ companyId, name: 'TDS Payable' });

    if (!tdsLedger) {
      tdsLedger = await LedgerMaster.create({
        companyId,
        name: 'TDS Payable',
        group: 'Liabilities',
        subGroup: 'Current Liabilities',
        accountType: 'Tax',
        nature: 'Cr',
        isSystemLedger: true,
      });
    }

    const partyLedger = await require('./accountingService').getOrCreatePartyLedger(companyId, party._id);

    // Dr Party / Cr TDS Payable (deduction from payable)
    const entry = await journalEngine.postJournal(companyId, {
      entryDate: payload.transactionDate || new Date(),
      voucherType: 'Journal',
      refType: 'Journal',
      lines: [
        {
          ledgerId: partyLedger._id,
          type: 'Dr',
          amount: calc.amount,
          narration: `TDS ${calc.section}`,
          systemPost: true,
        },
        {
          ledgerId: tdsLedger._id,
          type: 'Cr',
          amount: calc.amount,
          narration: `TDS ${calc.section}`,
          systemPost: true,
        },
      ],
      narration: payload.narration || `TDS u/s ${calc.section} — ${party.name}`,
    }, { userId, systemPost: true });

    const doc = await TaxDeduction.create({
      companyId,
      deductionType: 'TDS',
      section: calc.section,
      partyId: party._id,
      partyName: party.name,
      pan: (payload.pan || party.pan || '').toUpperCase(),
      refType: payload.refType || 'Manual',
      refId: payload.refId,
      refNo: payload.refNo || '',
      transactionDate: payload.transactionDate || new Date(),
      taxableAmount: round2(payload.taxableAmount),
      rate: calc.rate,
      deductedAmount: calc.amount,
      accountingEntryId: entry._id,
      status: 'Posted',
      narration: payload.narration || '',
      createdBy: userId,
    });

    await auditService.logSystem({
      companyId, userId, action: 'TDS_POST', module: 'TaxDeduction',
      referenceId: doc._id, after: { section: calc.section, amount: calc.amount },
    });
    return doc;
  }

  async postTcs(companyId, payload, userId) {
    const party = await Party.findOne({ _id: payload.partyId, companyId });
    if (!party) throw new Error('Party not found');

    const calc = await this.computeTcs({
      section: payload.section,
      taxableAmount: payload.taxableAmount,
      customRate: payload.rate ?? party.tcsPer,
    });

    let tcsLedger = await LedgerMaster.findOne({ companyId, name: 'TCS Payable' });
    if (!tcsLedger) {
      tcsLedger = await LedgerMaster.create({
        companyId,
        name: 'TCS Payable',
        group: 'Liabilities',
        subGroup: 'Current Liabilities',
        accountType: 'Tax',
        nature: 'Cr',
        isSystemLedger: true,
      });
    }

    const partyLedger = await require('./accountingService').getOrCreatePartyLedger(companyId, party._id);

    // Dr Party / Cr TCS Payable (collected from customer)
    const entry = await journalEngine.postJournal(companyId, {
      entryDate: payload.transactionDate || new Date(),
      voucherType: 'Journal',
      refType: 'Journal',
      lines: [
        {
          ledgerId: partyLedger._id,
          type: 'Dr',
          amount: calc.amount,
          narration: `TCS ${calc.section}`,
          systemPost: true,
        },
        {
          ledgerId: tcsLedger._id,
          type: 'Cr',
          amount: calc.amount,
          narration: `TCS ${calc.section}`,
          systemPost: true,
        },
      ],
      narration: payload.narration || `TCS u/s ${calc.section} — ${party.name}`,
    }, { userId, systemPost: true });

    const doc = await TaxDeduction.create({
      companyId,
      deductionType: 'TCS',
      section: calc.section,
      partyId: party._id,
      partyName: party.name,
      pan: (party.pan || '').toUpperCase(),
      refType: payload.refType || 'SalesInvoice',
      refId: payload.refId,
      refNo: payload.refNo || '',
      transactionDate: payload.transactionDate || new Date(),
      taxableAmount: round2(payload.taxableAmount),
      rate: calc.rate,
      deductedAmount: calc.amount,
      accountingEntryId: entry._id,
      status: 'Posted',
      createdBy: userId,
    });

    return doc;
  }

  async list(companyId, query = {}) {
    const filter = { companyId };
    if (query.deductionType) filter.deductionType = query.deductionType;
    if (query.section) filter.section = query.section;
    if (query.period) {
      const { startDate, endDate } = periodBounds(query.period);
      filter.transactionDate = { $gte: startDate, $lte: endDate };
    }
    return TaxDeduction.find(filter).sort({ transactionDate: -1 }).lean();
  }

  async report(companyId, { deductionType = 'TDS', period } = {}) {
    const rows = await this.list(companyId, { deductionType, period });
    const bySection = {};
    for (const r of rows) {
      if (!bySection[r.section]) {
        bySection[r.section] = { section: r.section, count: 0, taxable: 0, deducted: 0 };
      }
      bySection[r.section].count += 1;
      bySection[r.section].taxable = round2(bySection[r.section].taxable + r.taxableAmount);
      bySection[r.section].deducted = round2(bySection[r.section].deducted + r.deductedAmount);
    }
    return {
      deductionType,
      period,
      rows,
      bySection: Object.values(bySection),
      totalDeducted: round2(rows.reduce((s, r) => s + r.deductedAmount, 0)),
    };
  }

  async issueCertificate(companyId, id, userId) {
    const doc = await TaxDeduction.findOne({ _id: id, companyId });
    if (!doc) throw new Error('Deduction not found');
    doc.certificateNo = `TDS/${doc.section}/${Date.now().toString().slice(-8)}`;
    doc.certificateIssued = true;
    doc.updatedBy = userId;
    await doc.save();
    return doc;
  }
}

module.exports = new TdsTcsService();
module.exports.TDS_SECTIONS = TDS_SECTIONS;
module.exports.TCS_SECTIONS = TCS_SECTIONS;
