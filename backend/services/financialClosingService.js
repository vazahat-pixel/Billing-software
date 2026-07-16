const mongoose = require('mongoose');
const FinancialYear = require('../models/FinancialYear');
const FinancialClosingRun = require('../models/FinancialClosingRun');
const LedgerMaster = require('../models/LedgerMaster');
const journalEngine = require('./journalEngineService');
const ledgerEngine = require('./ledgerEngineService');
const financialReports = require('./financialReportsService');
const auditService = require('./auditService');

const round2 = (n) => Number(Number(n || 0).toFixed(2));

/**
 * Financial Closing Engine — Sprint 3.7
 */
class FinancialClosingService {
  async lockMonth(companyId, { year, month, userId }) {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const fy = await FinancialYear.findOne({
      companyId,
      startDate: { $lte: new Date(year, month - 1, 1) },
      endDate: { $gte: new Date(year, month - 1, 28) },
    });
    if (!fy) throw new Error('Financial year not found for month');
    if (!fy.lockedMonths) fy.lockedMonths = [];
    if (!fy.lockedMonths.includes(monthKey)) fy.lockedMonths.push(monthKey);
    fy.updatedBy = userId;
    await fy.save();
    await auditService.logSystem({
      companyId, userId, action: 'MONTH_LOCK', module: 'FinancialYear',
      referenceId: fy._id, after: { monthKey },
    });
    return fy;
  }

  async unlockMonth(companyId, { year, month, userId }) {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const fy = await FinancialYear.findOne({ companyId, lockedMonths: monthKey });
    if (!fy) throw new Error('No FY with this locked month');
    fy.lockedMonths = (fy.lockedMonths || []).filter((m) => m !== monthKey);
    fy.updatedBy = userId;
    await fy.save();
    return fy;
  }

  async lockPeriod(companyId, { lockedUntilDate, financialYearId, userId }) {
    const fy = financialYearId
      ? await FinancialYear.findOne({ _id: financialYearId, companyId })
      : await FinancialYear.findOne({ companyId, isActive: true });
    if (!fy) throw new Error('Financial year not found');
    fy.lockedUntilDate = new Date(lockedUntilDate);
    fy.updatedBy = userId;
    await fy.save();
    return fy;
  }

  async validateBeforeClose(companyId, financialYearId) {
    const fy = await FinancialYear.findOne({ _id: financialYearId, companyId });
    if (!fy) throw new Error('Financial year not found');
    const exceptions = [];

    const tb = await financialReports.trialBalance(companyId, { asOn: fy.endDate });
    if (!tb.isBalanced) {
      exceptions.push(`Trial Balance imbalance: ₹${tb.difference}`);
    }

    const AccountingEntry = require('../models/AccountingEntry');
    const unbalanced = await AccountingEntry.find({
      companyId,
      $expr: { $gt: [{ $abs: { $subtract: ['$totalDebit', '$totalCredit'] } }, 0.01] },
    }).limit(5);
    if (unbalanced.length) {
      exceptions.push(`${unbalanced.length} journal(s) with Dr≠Cr`);
    }

    return {
      trialBalanceOk: tb.isBalanced,
      journalsBalanced: unbalanced.length === 0,
      exceptions,
      fy,
      tb,
    };
  }

  /**
   * Close FY: P&L → Retained Earnings closing journal, lock FY,
   * create next FY opening balances for BS accounts.
   */
  async closeYear(companyId, { financialYearId, nextFyCode, userId }) {
    const session = await mongoose.startSession();
    let run;
    try {
      await session.withTransaction(async () => {
        const validation = await this.validateBeforeClose(companyId, financialYearId);
        if (validation.exceptions.length) {
          throw new Error(`Cannot close FY: ${validation.exceptions.join('; ')}`);
        }
        const fy = validation.fy;
        if (fy.isClosed) throw new Error('Financial year already closed');

        const pl = await financialReports.profitAndLoss(companyId, {
          from: fy.startDate,
          to: fy.endDate,
        });
        const balances = await ledgerEngine.computeBalances(companyId, {
          asOn: fy.endDate,
          includeOpening: true,
        });

        const retained = await LedgerMaster.findOne({ companyId, name: 'Retained Earnings' });
        if (!retained) throw new Error('Retained Earnings ledger missing');

        // Closing journal: zero Income/Expense into Retained Earnings
        const closeLines = [];
        for (const b of balances) {
          if (b.ledger.group === 'Income' && b.balance > 0.01) {
            closeLines.push({
              ledgerId: b.ledgerId,
              type: b.type === 'Cr' ? 'Dr' : 'Cr',
              amount: b.balance,
              narration: 'FY closing',
              systemPost: true,
            });
          }
          if (b.ledger.group === 'Expenses' && b.balance > 0.01) {
            closeLines.push({
              ledgerId: b.ledgerId,
              type: b.type === 'Dr' ? 'Cr' : 'Dr',
              amount: b.balance,
              narration: 'FY closing',
              systemPost: true,
            });
          }
        }

        let closeDr = 0;
        let closeCr = 0;
        closeLines.forEach((l) => {
          if (l.type === 'Dr') closeDr += l.amount;
          else closeCr += l.amount;
        });
        const plug = round2(closeDr - closeCr);
        if (Math.abs(plug) >= 0.01) {
          closeLines.push({
            ledgerId: retained._id,
            type: plug > 0 ? 'Cr' : 'Dr',
            amount: Math.abs(plug),
            narration: 'Transfer to Retained Earnings',
            systemPost: true,
          });
        }

        let closingEntry = null;
        if (closeLines.length >= 2) {
          closingEntry = await journalEngine.postJournal(companyId, {
            entryDate: fy.endDate,
            voucherType: 'Closing',
            refType: 'Closing',
            lines: closeLines,
            narration: `Closing entries ${fy.code}`,
          }, { session, userId, systemPost: true });
        }

        // Opening balances for next FY — derive from pre-close BS + RE plug
        // (avoids reading uncommitted journals without session-aware aggregates)
        const snapshots = [];
        const openingLines = [];

        for (const b of balances) {
          const g = b.ledger.group;
          const isBS = g === 'Assets' || g === 'Liabilities' || g === 'Capital' || g === 'Equity';
          if (!isBS) {
            snapshots.push({
              ledgerId: b.ledgerId,
              ledgerName: b.ledger.name,
              group: g,
              closingBalance: 0,
              closingType: 'Dr',
              carriedForward: false,
            });
            continue;
          }

          let signed = b.type === 'Dr' ? b.balance : -b.balance;
          if (b.ledgerId.toString() === retained._id.toString() || b.ledger.name === 'Retained Earnings') {
            // Net profit credits RE (Dr-positive signed balance decreases)
            signed = round2(signed - pl.netProfit);
          }

          const closingBalance = round2(Math.abs(signed));
          const closingType = signed >= 0 ? 'Dr' : 'Cr';

          snapshots.push({
            ledgerId: b.ledgerId,
            ledgerName: b.ledger.name,
            group: g,
            closingBalance,
            closingType,
            carriedForward: closingBalance > 0.01,
          });

          if (closingBalance > 0.01) {
            openingLines.push({
              ledgerId: b.ledgerId,
              type: closingType,
              amount: closingBalance,
              narration: `Opening ${nextFyCode || 'next FY'}`,
              systemPost: true,
            });
          }
        }

        // Balance opening journal via Suspense if needed, else Suspense absorbs difference
        let openDr = 0;
        let openCr = 0;
        openingLines.forEach((l) => {
          if (l.type === 'Dr') openDr += l.amount;
          else openCr += l.amount;
        });
        const openGap = round2(openDr - openCr);
        if (Math.abs(openGap) >= 0.01) {
          let suspense = await LedgerMaster.findOne({ companyId, name: 'Suspense A/c' });
          if (!suspense) {
            suspense = await LedgerMaster.create([{
              companyId, name: 'Suspense A/c', group: 'Assets', subGroup: 'Current Assets',
              accountType: 'System', nature: 'Dr', isSystemLedger: true,
            }], { session }).then((r) => r[0]);
          }
          openingLines.push({
            ledgerId: suspense._id,
            type: openGap > 0 ? 'Cr' : 'Dr',
            amount: Math.abs(openGap),
            narration: 'Opening balance difference',
            systemPost: true,
          });
        }

        let openingEntry = null;
        const nextStart = new Date(fy.endDate);
        nextStart.setDate(nextStart.getDate() + 1);

        if (openingLines.length >= 2) {
          openingEntry = await journalEngine.postJournal(companyId, {
            entryDate: nextStart,
            voucherType: 'Opening',
            refType: 'Opening',
            lines: openingLines,
            narration: `Opening balances from ${fy.code}`,
          }, { session, userId, systemPost: true });

          // Mark ledgers with openingEntryId and refresh OB fields for display
          for (const line of openingLines) {
            if (line.narration?.startsWith('Opening balance difference')) continue;
            await LedgerMaster.updateOne(
              { _id: line.ledgerId, companyId },
              {
                $set: {
                  openingBalance: line.amount,
                  openingBalanceType: line.type,
                  openingEntryId: openingEntry._id,
                },
              },
              { session }
            );
          }
        }

        // Create / activate next FY
        let nextFy = null;
        if (nextFyCode) {
          const nextEnd = new Date(nextStart);
          nextEnd.setFullYear(nextEnd.getFullYear() + 1);
          nextEnd.setDate(nextEnd.getDate() - 1);
          nextFy = await FinancialYear.findOneAndUpdate(
            { companyId, code: nextFyCode },
            {
              companyId,
              code: nextFyCode,
              label: nextFyCode,
              startDate: nextStart,
              endDate: nextEnd,
              isActive: true,
              isLocked: false,
              isClosed: false,
            },
            { upsert: true, new: true, session }
          );
          await FinancialYear.updateMany(
            { companyId, _id: { $ne: nextFy._id } },
            { $set: { isActive: false } },
            { session }
          );
        }

        fy.isClosed = true;
        fy.isLocked = true;
        fy.isActive = false;
        fy.closedAt = new Date();
        fy.closedBy = userId;
        fy.openingBalancesCarried = true;
        await fy.save({ session });

        run = await FinancialClosingRun.findOneAndUpdate(
          { companyId, financialYearId: fy._id },
          {
            companyId,
            financialYearId: fy._id,
            fromFyCode: fy.code,
            toFyCode: nextFyCode || '',
            status: 'Closed',
            closingEntryId: closingEntry?._id,
            openingEntryId: openingEntry?._id,
            netProfit: pl.netProfit,
            retainedEarningsTransfer: pl.netProfit,
            ledgerSnapshots: snapshots,
            validationReport: {
              trialBalanceOk: validation.trialBalanceOk,
              journalsBalanced: validation.journalsBalanced,
              exceptions: [],
            },
            closedBy: userId,
            closedAt: new Date(),
          },
          { upsert: true, new: true, session }
        );

        fy.closingRunId = run._id;
        await fy.save({ session });
      });
    } finally {
      session.endSession();
    }

    await auditService.logSystem({
      companyId, userId, action: 'FY_CLOSE', module: 'FinancialClosing',
      referenceId: run._id, after: { fromFyCode: run.fromFyCode, netProfit: run.netProfit },
    });
    return run;
  }

  async reopenYear(companyId, { financialYearId, reason, userId }) {
    const fy = await FinancialYear.findOne({ _id: financialYearId, companyId });
    if (!fy) throw new Error('Financial year not found');
    if (!fy.isClosed) throw new Error('FY is not closed');

    fy.isClosed = false;
    fy.isLocked = false;
    fy.isActive = true;
    await fy.save();

    await FinancialYear.updateMany(
      { companyId, _id: { $ne: fy._id } },
      { $set: { isActive: false } }
    );

    const run = await FinancialClosingRun.findOneAndUpdate(
      { companyId, financialYearId },
      {
        status: 'Reopened',
        reopenedBy: userId,
        reopenedAt: new Date(),
        reopenReason: reason || 'Admin reopen',
      },
      { new: true }
    );

    await auditService.logSystem({
      companyId, userId, action: 'FY_REOPEN', module: 'FinancialClosing',
      referenceId: fy._id, after: { reason },
    });
    return { fy, run };
  }

  async postDepreciation(companyId, { assetLedgerId, amount, entryDate, narration, userId }) {
    const dep = await LedgerMaster.findOne({ companyId, name: 'Depreciation A/c' });
    if (!dep) throw new Error('Depreciation A/c missing — seed CoA');
    return journalEngine.postJournal(companyId, {
      entryDate: entryDate || new Date(),
      voucherType: 'Journal',
      refType: 'Depreciation',
      lines: [
        { ledgerId: dep._id, type: 'Dr', amount: round2(amount), narration: narration || 'Depreciation' },
        { ledgerId: assetLedgerId, type: 'Cr', amount: round2(amount), narration: narration || 'Depreciation' },
      ],
      narration: narration || 'Depreciation entry',
    }, { userId, systemPost: true });
  }
}

module.exports = new FinancialClosingService();
