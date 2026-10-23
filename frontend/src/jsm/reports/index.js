import processSend from './processSend';
import jobSend from './jobSend';
import processReceiptDetail from './processReceiptDetail';
import jobReceiptDetail from './jobReceiptDetail';
import processReceiptSummary from './processReceiptSummary';
import jobReceiptSummary from './jobReceiptSummary';

/** JSM report screens rebuilt so far, keyed by JSM form name. */
export const JSM_REPORTS = Object.fromEntries([processSend, jobSend, processReceiptDetail, jobReceiptDetail, processReceiptSummary, jobReceiptSummary].map((r) => [r.form, r]));
