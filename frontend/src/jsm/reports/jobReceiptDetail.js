import { detailConfig } from './detailConfig';

/** JSM Reports › JobWork Reports › Receipt Detail (Rpt_JobWork_Receipt_Detail). */
const base = detailConfig({
  form: 'Rpt_JobWork_Receipt_Detail',
  lists: {
    ListView0: 'parties', ListView1: 'brokers', ListView2: 'books', ListView3: 'items', ListView4: 'recItems', ListView5: 'rates', ListView6: 'desc1',
  },
  defaults: { cbo_unit: 'Pcs' },
});
export default { ...base, toParams: (s) => ({ ...base.toParams(s), unit: s.cbo_unit }) };
