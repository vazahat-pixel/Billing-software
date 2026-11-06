import processSend from './processSend';
import jobSend from './jobSend';
import processReceiptDetail from './processReceiptDetail';
import jobReceiptDetail from './jobReceiptDetail';
import processReceiptSummary from './processReceiptSummary';
import jobReceiptSummary from './jobReceiptSummary';
import processStock from './processStock';
import jobStock from './jobStock';
import { BILL_REGISTERS } from './billRegisters';
import { OUTSTANDING_REPORTS } from './outstandingReports';
import { ITEM_WISE_REPORTS } from './itemWiseSummary';
import salesHaste from './salesHaste';
import { LEDGER_REPORTS } from './ledger';
import trialBalance from './trialBalance';
import cashBank from './cashBank';
import balanceSheet from './balanceSheet';
import profitAndLoss from './profitAndLoss';
import { REGISTER_SUMMARIES } from './registerSummaries';

/** JSM report screens rebuilt so far, keyed by JSM form name. */
export const JSM_REPORTS = Object.fromEntries([
  processSend, jobSend, processReceiptDetail, jobReceiptDetail, processReceiptSummary, jobReceiptSummary,
  processStock, jobStock, ...BILL_REGISTERS, ...OUTSTANDING_REPORTS, ...ITEM_WISE_REPORTS, salesHaste,
  ...LEDGER_REPORTS, trialBalance, cashBank, balanceSheet, profitAndLoss, ...REGISTER_SUMMARIES,
].map((r) => [r.form, r]));
