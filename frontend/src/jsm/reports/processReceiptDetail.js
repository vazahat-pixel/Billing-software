import { detailConfig } from './detailConfig';

/** JSM Reports › Process Reports › Receipt Detail (Rpt_Process_Receipt_Detail). */
const base = detailConfig({
  form: 'Rpt_Process_Receipt_Detail',
  lists: { ListView0: 'mills', ListView1: 'greyItems', ListView2: 'finishItems', ListView3: 'rates', ListView4: 'desc1' },
  defaults: { Js1_Process_typ: 'All' },
});
export default { ...base, toParams: (s) => ({ ...base.toParams(s), processType: s.Js1_Process_typ }) };
