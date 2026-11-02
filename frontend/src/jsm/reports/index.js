import processSend from './processSend';
import jobSend from './jobSend';
import processReceiptDetail from './processReceiptDetail';
import jobReceiptDetail from './jobReceiptDetail';
import processReceiptSummary from './processReceiptSummary';
import jobReceiptSummary from './jobReceiptSummary';
import processStock from './processStock';
import jobStock from './jobStock';
import { purchaseRegisterSummary, purchaseRegisterDetail } from './purchaseRegister';

/** JSM report screens rebuilt so far, keyed by JSM form name. */
export const JSM_REPORTS = Object.fromEntries([
  processSend, jobSend, processReceiptDetail, jobReceiptDetail, processReceiptSummary, jobReceiptSummary,
  processStock, jobStock, purchaseRegisterSummary, purchaseRegisterDetail,
].map((r) => [r.form, r]));
