const mongoose = require('mongoose');
const AccountingEntry = require('../models/AccountingEntry');
const LedgerMaster = require('../models/LedgerMaster');
const FinancialYear = require('../models/FinancialYear');
const Counter = require('../models/Counter');
const auditService = require('./auditService');

const round2 = (n) => Number(Number(n || 0).toFixed(2));

const VOUCHER_PREFIX = {
  Payment: 'PV',
  Receipt: 'RV',
  Journal: 'JV',
  Contra: 'CV',
  DebitNote: 'DN',
  CreditNote: 'CN',
  Sales: 'SV',
  Purchase: 'PUV',
  Opening: 'OB',
  Closing: 'CL',
  Reversal: 'REV',
  SalesAuto: 'JNL',
  PurchaseAuto: 'JNL',
  JobWorkAuto: 'JNL',
  WastageAuto: 'JNL',
  ReturnAuto: 'JNL',
  NoteAuto: 'JNL',
};

class JournalEngineService {
  async generateEntryNo(companyId, voucherType = 'Journal', session = null) {
    const prefix = VOUCHER_PREFIX[voucherType] || 'JNL';
    const fy = await this._activeFyCode(companyId);
    const counterId = `${prefix}-${fy}-${companyId}`;
    const seq = await Counter.nextSeq(counterId, session);
    return `${prefix}-${fy}-${seq.toString().padStart(4, '0')}`;
  }

  async _activeFyCode(companyId) {
    const fy = await FinancialYear.findOne({ companyId, isActive: true }).lean();
    if (fy?.code) return fy.code;
    const y = new Date().getFullYear();
    return `${String(y).slice(2)}-${String(y + 1).slice(2)}`;
  }

  async assertPeriodOpen(companyId, entryDate) {
    const d = new Date(entryDate);
    const fy = await FinancialYear.findOne({
      companyId,
      startDate: { $lte: d },
      endDate: { $gte: d },
    });
    if (fy) {
      if (fy.isClosed) throw new Error(`Financial year ${fy.code} is closed`);
      if (fy.isLocked) throw new Error(`Financial year ${fy.code} is locked`);
      if (fy.lockedUntilDate && d <= new Date(fy.lockedUntilDate)) {
        throw new Error(`Accounting period locked until ${new Date(fy.lockedUntilDate).toLocaleDateString()}`);
      }
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (Array.isArray(fy.lockedMonths) && fy.lockedMonths.includes(monthKey)) {
        throw new Error(`Month ${monthKey} is locked`);
      }
      return fy;
    }
    return null;
  }

  validateLines(lines) {
    if (!Array.isArray(lines) || lines.length < 2) {
      throw new Error('Journal must have at least two lines');
    }
    let dr = 0;
    let cr = 0;
    for (const line of lines) {
      if (!line.ledgerId) throw new Error('Each line requires ledgerId');
      if (!['Dr', 'Cr'].includes(line.type)) throw new Error('Line type must be Dr or Cr');
      const amt = round2(line.amount);
      if (amt < 0.01) throw new Error('Line amount must be at least 0.01');
      if (line.type === 'Dr') dr += amt;
      else cr += amt;
    }
    if (Math.abs(dr - cr) > 0.01) {
      throw new Error(`Unbalanced journal: Dr ₹${dr.toFixed(2)} ≠ Cr ₹${cr.toFixed(2)}`);
    }
    return { totalDebit: round2(dr), totalCredit: round2(cr) };
  }

  async resolveLines(companyId, lines) {
    const resolved = [];
    for (const line of lines) {
      const ledger = await LedgerMaster.findOne({ _id: line.ledgerId, companyId, isActive: true });
      if (!ledger) throw new Error(`Ledger not found or inactive: ${line.ledgerId}`);
      if (ledger.allowManualEntry === false && !line.systemPost) {
        throw new Error(`Manual entries not allowed on ledger ${ledger.name}`);
      }
      resolved.push({
        ledgerId: ledger._id,
        ledgerName: ledger.name,
        type: line.type,
        amount: round2(line.amount),
        narration: line.narration || '',
        costCenterId: line.costCenterId || null,
      });
    }
    return resolved;
  }

  /**
   * Post a journal within an optional Mongo session.
   * Always creates Posted status — drafts use createDraft.
   */
  async postJournal(companyId, payload, { session = null, userId = null, systemPost = false } = {}) {
    const entryDate = payload.entryDate || new Date();
    await this.assertPeriodOpen(companyId, entryDate);

    const voucherType = payload.voucherType || 'Journal';
    const rawLines = (payload.lines || []).map((l) => ({ ...l, systemPost }));
    this.validateLines(rawLines);
    const lines = await this.resolveLines(companyId, rawLines);
    this.validateLines(lines);

    const entryNo = payload.entryNo || await this.generateEntryNo(companyId, voucherType, session);
    const fy = await this.assertPeriodOpen(companyId, entryDate);

    const data = {
      companyId,
      entryNo,
      entryDate,
      voucherType,
      refType: payload.refType || voucherType,
      refId: payload.refId || undefined,
      lines,
      narration: payload.narration || '',
      status: 'Posted',
      createdBy: userId,
      financialYearId: fy?._id?.toString() || fy?.code || null,
      branchId: payload.branchId || null,
      reversedFromId: payload.reversedFromId || undefined,
    };

    let entry;
    if (session) {
      const created = await AccountingEntry.create([data], { session });
      entry = created[0];
    } else {
      entry = await AccountingEntry.create(data);
    }

    await auditService.logSystem({
      companyId,
      userId,
      action: 'JOURNAL_POST',
      module: 'AccountingEntry',
      referenceId: entry._id,
      after: { entryNo: entry.entryNo, voucherType, totalDebit: entry.totalDebit },
    });

    return entry;
  }

  /** Immutable reversal — flips Dr/Cr, marks original isReversed */
  async reverseJournal(companyId, entryId, { session: outerSession = null, userId = null, reason = '' } = {}) {
    const run = async (session) => {
      const original = await AccountingEntry.findOne({ _id: entryId, companyId }).session(session);
      if (!original) throw new Error('Journal entry not found');
      if (original.isReversed) throw new Error('Journal already reversed');
      if (original.status !== 'Posted') throw new Error('Only posted journals can be reversed');

      await this.assertPeriodOpen(companyId, new Date());

      const flipLines = original.lines.map((l) => ({
        ledgerId: l.ledgerId,
        type: l.type === 'Dr' ? 'Cr' : 'Dr',
        amount: l.amount,
        narration: `Reversal of ${original.entryNo}`,
        costCenterId: l.costCenterId || null,
        systemPost: true,
      }));

      const reversal = await this.postJournal(companyId, {
        entryDate: new Date(),
        voucherType: 'Reversal',
        refType: 'Reversal',
        refId: original._id,
        reversedFromId: original._id,
        lines: flipLines,
        narration: reason || `Reversal of ${original.entryNo}`,
      }, { session, userId, systemPost: true });

      original.isReversed = true;
      original.reversalEntryId = reversal._id;
      await original.save({ session });

      return reversal;
    };

    if (outerSession) return run(outerSession);

    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await run(session);
      });
      return result;
    } finally {
      session.endSession();
    }
  }

  async postContra(companyId, { fromLedgerId, toLedgerId, amount, entryDate, narration, userId }) {
    const amt = round2(amount);
    if (amt < 0.01) throw new Error('Contra amount must be > 0');
    return this.postJournal(companyId, {
      entryDate: entryDate || new Date(),
      voucherType: 'Contra',
      refType: 'Contra',
      lines: [
        { ledgerId: toLedgerId, type: 'Dr', amount: amt, narration: narration || 'Contra' },
        { ledgerId: fromLedgerId, type: 'Cr', amount: amt, narration: narration || 'Contra' },
      ],
      narration: narration || 'Contra voucher',
    }, { userId, systemPost: true });
  }

  async listJournals(companyId, query = {}) {
    const filter = { companyId, $or: [{ status: 'Posted' }, { status: { $exists: false } }] };
    if (query.voucherType) filter.voucherType = query.voucherType;
    if (query.isReversed !== undefined) {
      filter.isReversed = query.isReversed === 'true' || query.isReversed === true;
    }
    if (query.from || query.to) {
      filter.entryDate = {};
      if (query.from) filter.entryDate.$gte = new Date(query.from);
      if (query.to) filter.entryDate.$lte = new Date(query.to);
    }
    if (query.ledgerId) filter['lines.ledgerId'] = new mongoose.Types.ObjectId(query.ledgerId);
    if (query.search) filter.entryNo = { $regex: query.search, $options: 'i' };

    const limit = Math.min(parseInt(query.limit || '100', 10), 500);
    return AccountingEntry.find(filter)
      .sort({ entryDate: -1, createdAt: -1 })
      .limit(limit)
      .lean();
  }

  async getJournal(companyId, entryId) {
    const entry = await AccountingEntry.findOne({ _id: entryId, companyId }).lean();
    if (!entry) throw new Error('Journal not found');
    return entry;
  }
}

module.exports = new JournalEngineService();
