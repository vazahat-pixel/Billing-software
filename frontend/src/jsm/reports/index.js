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
import { OUTSTANDING_ZOOMS, outstandingPurchaseAll } from './outstandingZoom';
import { LIST_PRINTS } from './listPrint';
import { GSTIN_ITEM_DETAILS } from './gstinItemDetail';
import { SUPPLY_REGISTERS } from './supplyRegister';
import gstr9Old from './gstr9Old';
import { MONTH_OUTSTANDINGS } from './monthOutstanding';
import smsOutstanding from './smsOutstanding';
import os90Days from './os90Days';
import dailyTransaction from './dailyTransaction';
import challanStatus from './challanStatus';
import jobProfitLoss from './jobProfitLoss';
import rgPending from './rgPending';
import salesChallan from './salesChallan';
import { PURCHASE_STOCKS } from './purchaseStock';
import millReturnToSend from './millReturnToSend';
import boxStock from './boxStock';
import finishStock from './finishStock';
import cashBankRegister from './cashBankRegister';
import cheqInHand from './cheqInHand';
import { BROKERAGE_STATEMENTS } from './brokerageStatement';
import { ORDER_STATUSES } from './orderStatus';
import { SLIP_REGISTERS } from './slipRegister';
import lotCosting from './lotCosting';
import { CUTTING_REPORTS } from './cuttingReport';
import gstr9cOld from './gstr9cOld';
import gstr9New from './gstr9New';
import gstr3bInwardOutward from './gstr3bInwardOutward';
import { GST_MATCHING_REPORTS } from './gstMatching';
import { JS_GSTR_REPORTS } from './gstExtraReports';
import { OUTSTANDING_AGE_EXTRAS } from './outstandingAgeExtra';
import { BILL_WISE_INTEREST_REPORTS } from './billWiseInterest';
import { BANK_EXTRA_REPORTS } from './bankExtraReports';
import { BROKERAGE_JOB_AND_ALL } from './brokerageJobAndAll';
import { PROFIT_AND_YARN_REPORTS } from './profitAndYarnReports';
import { OLD_GST_REPORTS } from './oldGstReports';
import { OLD_STOCK_REPORTS } from './oldStockReports';
import { OLD_MISC_REPORTS } from './oldMiscReports';
import { OLD_BANK_REPORTS } from './oldBankReports';
import processTakaDetail from './processTakaDetail';
import zoomSelectDate from './zoomSelectDate';
import brokregOsReport from './brokregOsReport';
import billAgainstPaidDetail from './billAgainstPaidDetail';
import match8aReport from './match8aReport';
import dbRepairDiagnostics from './dbRepairDiagnostics';
import gstFreezeData from './gstFreezeData';
import { UPDATE_STATUS_TOOLS } from './updateStatusTools';
import ewayUploadOffline from './ewayUploadOffline';
import importSalesJsm from './importSalesJsm';
import reminderTool from './reminderTool';
import { BROKERAGE_ENTRY_TOOLS } from './brokerageEntryTools';
import investmentReport from './investmentReport';
import { GSTIN_SUMMARY_REPORTS } from './gstinSummary';
import { TDS_TCS_REPORTS } from './tdsTcsBooks';
import tcsRecPay from './tcsRecPay';
import stockFinishNew from './stockFinishNew';
import stockGreyAtMill from './stockGreyAtMill';
import stockAccFinish from './stockAccFinish';
import cashBankFinance from './cashBankFinance';
import bankMonthWise from './bankMonthWise';
import checkDiffOpening from './checkDiffOpening';
import { GST_NATIVE_TOOLS } from './gstNativeTools';

/** JSM report screens rebuilt so far, keyed by JSM form name. */
export const JSM_REPORTS = Object.fromEntries([
  processSend, jobSend, processReceiptDetail, jobReceiptDetail, processReceiptSummary, jobReceiptSummary,
  processStock, jobStock, ...BILL_REGISTERS, ...OUTSTANDING_REPORTS, ...ITEM_WISE_REPORTS, salesHaste,
  ...LEDGER_REPORTS, trialBalance, cashBank, balanceSheet, profitAndLoss, ...REGISTER_SUMMARIES, groupBalance, aboveBelow, voucherBook, processItemSummary, ...MASTER_LISTS, ...OUTSTANDING_DETAILS, ...REC_PAY_REGISTERS, greyFinishSummary, ...ACC_STOCK_REPORTS, ...KGS_STOCK_REPORTS, itemStockRegister, ...OUTSTANDING_ZOOMS, ...MONTH_OUTSTANDINGS, smsOutstanding, os90Days, dailyTransaction, challanStatus, jobProfitLoss, rgPending, salesChallan, ...PURCHASE_STOCKS, millReturnToSend, boxStock, finishStock, cashBankRegister, cheqInHand, ...BROKERAGE_STATEMENTS, ...LIST_PRINTS, outstandingPurchaseAll, ...GSTIN_ITEM_DETAILS, ...SUPPLY_REGISTERS, gstr9Old, ...ORDER_STATUSES, ...SLIP_REGISTERS, lotCosting, ...CUTTING_REPORTS, gstr9cOld, gstr9New, gstr3bInwardOutward, ...GST_MATCHING_REPORTS, ...JS_GSTR_REPORTS,
  ...OUTSTANDING_AGE_EXTRAS, ...BILL_WISE_INTEREST_REPORTS, ...BANK_EXTRA_REPORTS, ...BROKERAGE_JOB_AND_ALL, ...PROFIT_AND_YARN_REPORTS,
  ...OLD_GST_REPORTS, ...OLD_STOCK_REPORTS, ...OLD_MISC_REPORTS, ...OLD_BANK_REPORTS,
  processTakaDetail, zoomSelectDate, brokregOsReport, billAgainstPaidDetail, match8aReport, dbRepairDiagnostics,
  gstFreezeData, ...UPDATE_STATUS_TOOLS, ewayUploadOffline, importSalesJsm, reminderTool, ...BROKERAGE_ENTRY_TOOLS, investmentReport,
  ...GSTIN_SUMMARY_REPORTS, ...GST_NATIVE_TOOLS, ...TDS_TCS_REPORTS, tcsRecPay, stockFinishNew, stockGreyAtMill, stockAccFinish, cashBankFinance, bankMonthWise, checkDiffOpening,
].map((r) => [r.form, r]));
