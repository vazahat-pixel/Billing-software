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
import groupBalance from './groupBalance';
import aboveBelow from './aboveBelow';
import voucherBook from './voucherBook';
import processItemSummary from './processItemSummary';
import { MASTER_LISTS } from './masterList';
import { OUTSTANDING_DETAILS } from './outstandingDetail';
import { REC_PAY_REGISTERS } from './recPayRegister';
import greyFinishSummary from './greyFinishSummary';
import { ACC_STOCK_REPORTS } from './accStock';
import { KGS_STOCK_REPORTS } from './kgsStock';
import itemStockRegister from './itemStockRegister';
import { OUTSTANDING_ZOOMS } from './outstandingZoom';
import { MONTH_OUTSTANDINGS } from './monthOutstanding';
import smsOutstanding from './smsOutstanding';
import os90Days from './os90Days';
import dailyTransaction from './dailyTransaction';
import challanStatus from './challanStatus';
import jobProfitLoss from './jobProfitLoss';

/** JSM report screens rebuilt so far, keyed by JSM form name. */
export const JSM_REPORTS = Object.fromEntries([
  processSend, jobSend, processReceiptDetail, jobReceiptDetail, processReceiptSummary, jobReceiptSummary,
  processStock, jobStock, ...BILL_REGISTERS, ...OUTSTANDING_REPORTS, ...ITEM_WISE_REPORTS, salesHaste,
  ...LEDGER_REPORTS, trialBalance, cashBank, balanceSheet, profitAndLoss, ...REGISTER_SUMMARIES, groupBalance, aboveBelow, voucherBook, processItemSummary, ...MASTER_LISTS, ...OUTSTANDING_DETAILS, ...REC_PAY_REGISTERS, greyFinishSummary, ...ACC_STOCK_REPORTS, ...KGS_STOCK_REPORTS, itemStockRegister, ...OUTSTANDING_ZOOMS, ...MONTH_OUTSTANDINGS, smsOutstanding, os90Days, dailyTransaction, challanStatus, jobProfitLoss,
].map((r) => [r.form, r]));
