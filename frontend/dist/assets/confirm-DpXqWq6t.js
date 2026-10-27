import{c as n,ar as t}from"./index-CDPcVOcP.js";/**
 * @license lucide-react v1.28.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const r=[["path",{d:"M10 11v6",key:"nco0om"}],["path",{d:"M14 11v6",key:"outv1u"}],["path",{d:"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",key:"miytrc"}],["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",key:"e791ji"}]],i=n("trash-2",r);function a(e){return typeof e=="string"?t.getState().open({message:e}):t.getState().open(e)}function c(e="this record"){return a({title:"Confirm Delete",message:`Are you sure you want to delete ${e}? This action may affect linked transactions.`,confirmLabel:"Delete",cancelLabel:"Cancel",danger:!0})}function s(e="Do you want to delete this line?"){return a({title:"Delete Line",message:e,confirmLabel:"Yes",cancelLabel:"No",danger:!0,defaultFocus:"confirm"})}export{i as T,s as a,c as b,a as e};
