const mongoose = require('mongoose');
const AccountingEntry = require('../models/AccountingEntry');
const LedgerMaster = require('../models/LedgerMaster');

const round2 = (n) => Number(Number(n || 0).toFixed(2));

/**
 * The set of journal entries that count as live money.
 *
 * A reversal leaves TWO entries behind: the original (flagged isReversed) and the
 * flipped Reversal entry (which carries reversedFromId). Filtering on `isReversed:false`
 * alone drops the original but keeps the reversal, so a reversed voucher left a phantom
 * one-sided movement in every ledger it touched. Both halves must go, together.
 *
 * Drafts are excluded here too, so opening balance and the statement rows agree.
 */
const LIVE_ENTRY_FILTER = {
  isReversed: false,
  reversedFromId: { $in: [null, undefined] },
  status: { $ne: 'Draft' },
};

/**
 * Ledger Engine — Sprint 3.3
 * All balances derived from journals + master OB (when no Opening journal).
 */
class LedgerEngineService {
  /**
   * Signed balance: positive = Dr, negative = Cr
   */
  signedOpening(ledger) {
    const ob = ledger.openingBalance || 0;
    if (ledger.openingEntryId) return 0; // OB already in journals
    return ledger.openingBalanceType === 'Cr' ? -ob : ob;
  }

  async aggregateByLedger(companyId, { from, to, ledgerIds } = {}) {
    const match = {
      companyId: new mongoose.Types.ObjectId(companyId),
      ...LIVE_ENTRY_FILTER,
    };
    if (from || to) {
      match.entryDate = {};
      if (from) match.entryDate.$gte = new Date(from);
      if (to) match.entryDate.$lte = new Date(to);
    }

    const pipeline = [
      { $match: match },
      { $unwind: '$lines' },
    ];
    if (ledgerIds?.length) {
      pipeline.push({
        $match: { 'lines.ledgerId': { $in: ledgerIds.map((id) => new mongoose.Types.ObjectId(id)) } },
      });
    }
    pipeline.push({
      $group: {
        _id: '$lines.ledgerId',
        totalDr: { $sum: { $cond: [{ $eq: ['$lines.type', 'Dr'] }, '$lines.amount', 0] } },
        totalCr: { $sum: { $cond: [{ $eq: ['$lines.type', 'Cr'] }, '$lines.amount', 0] } },
      },
    });

    const rows = await AccountingEntry.aggregate(pipeline);
    const map = {};
    rows.forEach((r) => { map[r._id.toString()] = r; });
    return map;
  }

  /**
   * Period movement only (no OB) — for P&L.
   * Closing = OB + all movements up to `to`.
   */
  async computeBalances(companyId, { asOn, from, includeOpening = true } = {}) {
    const aggMap = await this.aggregateByLedger(companyId, { from, to: asOn });
    const ledgers = await LedgerMaster.find({ companyId, isActive: true });

    return ledgers.map((ledger) => {
      const row = aggMap[ledger._id.toString()] || { totalDr: 0, totalCr: 0 };
      let signed = includeOpening ? this.signedOpening(ledger) : 0;
      signed += (row.totalDr - row.totalCr);
      return {
        ledgerId: ledger._id,
        ledger,
        totalDr: round2(row.totalDr),
        totalCr: round2(row.totalCr),
        balance: round2(Math.abs(signed)),
        type: signed >= 0 ? 'Dr' : 'Cr',
        signedBalance: round2(signed),
      };
    });
  }

  /**
   * Batch-load the documents behind a set of journal entries so each statement row can
   * show the Bill/VNo, ChqNo and Remark the operator actually recognises, instead of only
   * the internal journal number. One query per document type — never per row.
   */
  async loadSourceDocs(companyId, entries) {
    const idsByType = {};
    for (const e of entries) {
      if (!e.refId || !e.refType) continue;
      (idsByType[e.refType] = idsByType[e.refType] || []).push(e.refId);
    }
    const map = {};
    const collect = (docs, pick) => {
      for (const d of docs) map[String(d._id)] = pick(d);
    };

    const load = async (refTypes, modelName, pick, fields) => {
      const ids = refTypes.flatMap((t) => idsByType[t] || []);
      if (!ids.length) return;
      const Model = require(`../models/${modelName}`);
      const docs = await Model.find({ _id: { $in: ids }, companyId }).select(fields).lean();
      collect(docs, pick);
    };

    await Promise.all([
      load(['Payment', 'Receipt'], 'PaymentVoucher',
        (d) => {
          const billNos = (d.againstInvoices || []).map((x) => x.invoiceNo).filter(Boolean).join(', ');
          const billRemark = billNos ? `Bill No.: ${billNos}` : '';
          return {
            docNo: d.voucherNo,
            chequeNo: d.chequeNo || '',
            remarks: billRemark || d.narration || d.remark2 || '',
          };
        },
        'voucherNo chequeNo narration remark2 againstInvoices'),
      load(['SalesInvoice'], 'Sales',
        (d) => ({ docNo: d.invoiceNo, remarks: d.narration || d.remarks || `Sales Invoice #${d.invoiceNo || ''}` }),
        'invoiceNo narration remarks'),
      load(['PurchaseBill'], 'Purchase',
        (d) => ({ docNo: d.invoiceNo, remarks: d.narration || d.remarks || `Purchase Bill #${d.invoiceNo || ''}` }),
        'invoiceNo narration remarks'),
      load(['DebitNote', 'CreditNote'], 'DebitCreditNote',
        (d) => ({ docNo: d.vNo || d.noteNo, remarks: d.reason || d.narration || `${d.noteType} Note #${d.vNo || d.noteNo || ''}` }),
        'vNo noteNo noteType reason narration'),
    ]);

    return map;
  }

  /**
   * Correct statement: opening = master OB + movements before `from`.
   */
  async getStatement(companyId, ledgerId, { from, to } = {}) {
    let ledger = null;
    const cleanId = String(ledgerId || '').replace(/^party:/, '');

    if (mongoose.Types.ObjectId.isValid(cleanId)) {
      ledger = await LedgerMaster.findOne({ _id: cleanId, companyId });
    }
    if (!ledger) {
      ledger = await LedgerMaster.findOne({ companyId, linkedPartyId: cleanId });
    }
    if (!ledger) {
      const Party = require('../models/Party');
      const party = await Party.findOne({
        companyId,
        $or: [
          ...(mongoose.Types.ObjectId.isValid(cleanId) ? [{ _id: cleanId }] : []),
          { name: { $regex: new RegExp('^' + cleanId + '$', 'i') } }
        ]
      });
      if (party) {
        const accountingService = require('./accountingService');
        ledger = await accountingService.getOrCreatePartyLedger(companyId, party._id);
      }
    }
    if (!ledger && cleanId) {
      ledger = await LedgerMaster.findOne({
        companyId,
        name: { $regex: new RegExp('^' + cleanId + '$', 'i') }
      });
    }
    if (!ledger) throw new Error('Ledger not found');

    let openingSigned = this.signedOpening(ledger);

    if (from) {
      const priorTo = new Date(new Date(from).getTime() - 1);
      const prior = await this.aggregateByLedger(companyId, {
        to: priorTo,
        ledgerIds: [ledger._id],
      });
      const row = prior[ledger._id.toString()] || { totalDr: 0, totalCr: 0 };
      openingSigned += (row.totalDr - row.totalCr);
    }

    const entryFilter = {
      companyId,
      ...LIVE_ENTRY_FILTER,
      'lines.ledgerId': ledger._id,
    };
    if (from || to) {
      entryFilter.entryDate = {};
      if (from) entryFilter.entryDate.$gte = new Date(from);
      if (to) entryFilter.entryDate.$lte = new Date(to);
    }

    const entries = await AccountingEntry.find(entryFilter).sort({ entryDate: 1, createdAt: 1 });
    const sourceMap = await this.loadSourceDocs(companyId, entries);
    let current = openingSigned;
    const statement = [];

    for (const entry of entries) {
      const src = sourceMap[String(entry.refId)] || {};

      for (const line of entry.lines) {
        if (line.ledgerId.toString() !== ledger._id.toString()) continue;

        // Find all opposite (contra) lines in this journal entry
        const oppositeLines = entry.lines.filter(
          (l) => l.ledgerId && l.ledgerId.toString() !== ledger._id.toString()
        );

        // If it's a Payment/Receipt/Journal with multiple contra legs (e.g. Bank + Discount),
        // split into separate rows for each contra leg so user sees Bank and Discount lines separately!
        if (oppositeLines.length > 1 && ['Payment', 'Receipt', 'Journal'].includes(entry.voucherType)) {
          const totalOppositeAmt = oppositeLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

          for (const opp of oppositeLines) {
            const oppAmt = Number(opp.amount) || 0;
            const portion = totalOppositeAmt > 0
              ? round2((line.amount * oppAmt) / totalOppositeAmt)
              : oppAmt;

            if (line.type === 'Dr') current += portion;
            else current -= portion;

            statement.push({
              _id: `${entry._id}_${opp.ledgerId}`,
              date: entry.entryDate,
              voucherNo: entry.entryNo,
              billVoucherNo: src.docNo || entry.entryNo,
              chequeNo: src.chequeNo || '',
              remarks: src.remarks || opp.narration || '',
              voucherType: entry.voucherType,
              narration: opp.narration || line.narration || entry.narration || '',
              particulars: opp.ledgerName || 'CONTRA A/C',
              contraAccount: opp.ledgerName || '',
              debit: line.type === 'Dr' ? portion : 0,
              credit: line.type === 'Cr' ? portion : 0,
              runningBalance: round2(Math.abs(current)),
              balanceType: current >= 0 ? 'Dr' : 'Cr',
              refType: entry.refType,
              refId: entry.refId,
              journalLines: entry.lines.map((l) => ({
                ledgerId: l.ledgerId,
                ledgerName: l.ledgerName,
                type: l.type,
                amount: round2(l.amount),
                narration: l.narration || '',
              })),
              entryNarration: entry.narration || '',
            });
          }
        } else {
          // Single contra line or Sales/Purchase bill — single row
          const contraNames = oppositeLines.map((l) => l.ledgerName).filter(Boolean);
          const contra = [...new Set(contraNames)].join(', ');

          if (line.type === 'Dr') current += line.amount;
          else current -= line.amount;

          statement.push({
            _id: entry._id,
            date: entry.entryDate,
            voucherNo: entry.entryNo,
            billVoucherNo: src.docNo || entry.entryNo,
            chequeNo: src.chequeNo || '',
            remarks: src.remarks || '',
            voucherType: entry.voucherType,
            narration: line.narration || entry.narration || '',
            particulars: contra || (entry.voucherType === 'Sales' ? 'SALES BOOK' : entry.voucherType === 'Purchase' ? 'PURCHASE BOOK' : entry.refType || ''),
            contraAccount: contra,
            debit: line.type === 'Dr' ? line.amount : 0,
            credit: line.type === 'Cr' ? line.amount : 0,
            runningBalance: round2(Math.abs(current)),
            balanceType: current >= 0 ? 'Dr' : 'Cr',
            refType: entry.refType,
            refId: entry.refId,
            journalLines: entry.lines.map((l) => ({
              ledgerId: l.ledgerId,
              ledgerName: l.ledgerName,
              type: l.type,
              amount: round2(l.amount),
              narration: l.narration || '',
            })),
            entryNarration: entry.narration || '',
          });
        }
      }
    }

    return {
      ledger,
      ledgerName: ledger.name,
      openingBalance: round2(Math.abs(openingSigned)),
      openingBalanceType: openingSigned >= 0 ? 'Dr' : 'Cr',
      closingBalance: round2(Math.abs(current)),
      closingBalanceType: current >= 0 ? 'Dr' : 'Cr',
      statement,
    };
  }

  async partyLedger(companyId, partyId, opts) {
    const ledger = await LedgerMaster.findOne({ companyId, linkedPartyId: partyId });
    if (!ledger) throw new Error('Party ledger not found');
    return this.getStatement(companyId, ledger._id, opts);
  }

  async listByType(companyId, accountType) {
    return LedgerMaster.find({ companyId, accountType, isActive: true }).sort({ name: 1 }).lean();
  }
}

module.exports = new LedgerEngineService();
/** Reused by every report so "what counts as live money" is defined in exactly one place. */
module.exports.LIVE_ENTRY_FILTER = LIVE_ENTRY_FILTER;
