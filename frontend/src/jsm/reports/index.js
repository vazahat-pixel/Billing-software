import processSend from './processSend';
import jobSend from './jobSend';
import processReceiptDetail from './processReceiptDetail';

/** JSM report screens rebuilt so far, keyed by JSM form name. */
export const JSM_REPORTS = Object.fromEntries([processSend, jobSend, processReceiptDetail].map((r) => [r.form, r]));
