import{c as a,a6 as r,al as l,d as h,n as t}from"./index-aRuuS9u0.js";import{L as d}from"./layout-dashboard-fDWf41Vx.js";import{S as p}from"./shield-B9Ad-t-d.js";/**
 * @license lucide-react v1.28.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m=[["path",{d:"M10.268 21a2 2 0 0 0 3.464 0",key:"vwvbt9"}],["path",{d:"M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326",key:"11g9vi"}]],x=a("bell",m);/**
 * @license lucide-react v1.28.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u=[["path",{d:"m9 18 6-6-6-6",key:"mthhwq"}]],g=a("chevron-right",u),j=({variant:n="dark"})=>{const e=r(),i=l();if(h(c=>c.role)!=="super_admin")return null;const s=i.pathname.startsWith("/admin"),o=n==="light"?"panel-switcher panel-switcher--light":"panel-switcher";return t.jsxs("div",{className:o,children:[t.jsxs("button",{type:"button",className:`panel-switcher__btn ${s?"":"panel-switcher__btn--active"}`,onClick:()=>e("/"),children:[t.jsx(d,{size:13}),"ERP Panel"]}),t.jsxs("button",{type:"button",className:`panel-switcher__btn ${s?"panel-switcher__btn--active":""}`,onClick:()=>e("/admin/dashboard"),children:[t.jsx(p,{size:13}),"Admin Panel"]})]})};export{x as B,g as C,j as P};
