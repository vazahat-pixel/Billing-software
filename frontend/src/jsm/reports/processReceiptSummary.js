import { detailConfig } from './detailConfig';

/** JSM Reports › Process Reports › Receipt Summary (Rpt_Process_Receipt_Summary), bill-wise mode. */
const base = detailConfig({
  form: 'Rpt_Process_Receipt_Summary',
  lists: { ListView0: 'mills', ListView1: 'msmeTypes' },
  defaults: { Js1_Process_typ: 'All' },
});
export default { ...base, toParams: (s) => ({ ...base.toParams(s), processType: s.Js1_Process_typ }) };
