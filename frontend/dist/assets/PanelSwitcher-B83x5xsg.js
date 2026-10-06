import{c,a7 as r,ad as l,d as h,n as t}from"./index-CaCYcfAw.js";import{L as d}from"./layout-dashboard-C22EbPOL.js";import{S as p}from"./shield-DFrmEfp1.js";/**
 * @license lucide-react v1.28.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m=[["path",{d:"M10.268 21a2 2 0 0 0 3.464 0",key:"vwvbt9"}],["path",{d:"M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326",key:"11g9vi"}]],v=c("bell",m),x=({variant:s="dark"})=>{const e=r(),n=l();if(h(o=>o.role)!=="super_admin")return null;const a=n.pathname.startsWith("/admin"),i=s==="light"?"panel-switcher panel-switcher--light":"panel-switcher";return t.jsxs("div",{className:i,children:[t.jsxs("button",{type:"button",className:`panel-switcher__btn ${a?"":"panel-switcher__btn--active"}`,onClick:()=>e("/"),children:[t.jsx(d,{size:13}),"ERP Panel"]}),t.jsxs("button",{type:"button",className:`panel-switcher__btn ${a?"panel-switcher__btn--active":""}`,onClick:()=>e("/admin/dashboard"),children:[t.jsx(p,{size:13}),"Admin Panel"]})]})};export{v as B,x as P};
