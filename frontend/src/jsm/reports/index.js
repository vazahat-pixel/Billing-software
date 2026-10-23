import processSend from './processSend';
import jobSend from './jobSend';

/** JSM report screens rebuilt so far, keyed by JSM form name. */
export const JSM_REPORTS = Object.fromEntries([processSend, jobSend].map((r) => [r.form, r]));
