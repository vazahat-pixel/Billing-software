import { detailConfig } from './detailConfig';

/** JSM Reports › JobWork Reports › Receipt Summary (Rpt_JobWork_Receipt_Summary), bill-wise mode. */
export default detailConfig({
  form: 'Rpt_JobWork_Receipt_Summary',
  lists: { ListView0: 'parties', ListView1: 'brokers', ListView2: 'books', ListView3: 'msmeTypes' },
});
