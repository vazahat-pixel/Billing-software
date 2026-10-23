/**
 * Builds the JSM report blueprint from the read-only extracts:
 *   - forms dump  (dumpforms.ps1 → JsmFormDump.cs, reflection-only over Jsm_Winsoft.exe)
 *   - layouts     (extractLayouts.js → JsmSet_*.STP_REPORT)
 * Outputs:
 *   frontend/src/jsm/blueprint/menu.json      report menu tree (caption → JSM form)
 *   frontend/src/jsm/blueprint/forms.json     parameter screens (controls, captions, positions, defaults, options)
 *   frontend/src/jsm/blueprint/layouts.json   grid layouts (columns, captions, widths, decimals, totals, 16 variants)
 *   backend/scripts/golden-master/jsm-blueprint/.spec-local/<Form>.json  per-report logic strings (git-ignored: JSM's code embeds vendor credentials)
 *
 *   node buildBlueprint.js --forms <jsm_all_forms.json> --layouts <jsm_layouts.json>
 */
const fs = require('fs');
const path = require('path');

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const forms = JSON.parse(fs.readFileSync(arg('forms'), 'utf8'));
const layouts = JSON.parse(fs.readFileSync(arg('layouts'), 'utf8'));
const ROOT = path.join(__dirname, '../../../..');
const OUT_FE = path.join(ROOT, 'frontend/src/jsm/blueprint');
const OUT_SPEC = path.join(__dirname, '.spec-local');

// Report menus whose modules exist in MERN. VAT (pre-GST), Agency, Pump, Looms and Embroidery are left out.
const INCLUDE_TOP = new Set(['Reports', 'Others Reports']);
const EXCLUDE = /^(Vat Reports|Agency|Agency Sales|Agency \(Sales\+Receipt\)|CommiPaid Voucher|Commission Report|Emb - Stock Report|Outstanding \(Agcy\)|Letter Pad|&Profit \/ Loss Account \(Pump\)|Cash &Pump|Old Ledger|Ledger\(Old\)|OldReport)$/;

const byName = Object.fromEntries(forms.map((f) => [f.form, f]));
const mdi = byName.JS_MdiParent;
const menuItems = mdi.controls.filter((c) => /ToolStripMenuItem/.test(c.type));
const children = {};
for (const m of menuItems) (children[m.parent || 'ROOT'] = children[m.parent || 'ROOT'] || []).push(m);

function opens(itemName) {
  const out = new Set();
  for (const [method, strs] of Object.entries(mdi.methods || {})) {
    if (!method.toLowerCase().startsWith(`${itemName.toLowerCase()}_`)) continue;
    strs.filter((s) => s.startsWith('new:')).map((s) => s.slice(4)).filter((f) => byName[f]).forEach((f) => out.add(f));
  }
  return [...out];
}

const usedForms = new Set();
function walk(parent) {
  return (children[parent] || [])
    .sort((a, b) => a.tab - b.tab)
    .filter((m) => !EXCLUDE.test(String(m.text || '').trim()))
    .map((m) => {
      const node = { caption: String(m.text || m.name).replace(/&(?!&)/g, '').replace(/&&/g, '&').trim(), id: m.name };
      const kids = walk(m.name);
      const opened = opens(m.name);
      if (kids.length) node.items = kids;
      else if (opened.length) {
        // One click can open different screens depending on JSM settings; keep every candidate.
        node.form = opened[0];
        if (opened.length > 1) node.alternatives = opened.slice(1);
        opened.forEach((f) => usedForms.add(f));
      }
      return node;
    })
    .filter((n) => n.items || n.form);
}

const roots = mdi.controls.filter((c) => /MenuStrip/.test(c.type)).map((c) => c.name);
const top = roots.flatMap((r) => (children[r] || []));
const menu = top
  .filter((m) => INCLUDE_TOP.has(String(m.text || '').replace(/&/g, '').trim()))
  .map((m) => ({ caption: String(m.text).replace(/&/g, '').trim(), id: m.name, items: walk(m.name) }));

// Grid/dialog forms the report screens open in turn (e.g. AA_Rpt_GridReport, list pickers).
for (const f of [...usedForms]) {
  for (const strs of Object.values(byName[f].methods || {})) {
    strs.filter((s) => s.startsWith('new:')).map((s) => s.slice(4)).filter((n) => byName[n]).forEach((n) => usedForms.add(n));
  }
}

const layoutNames = new Set(Object.keys(layouts));

/** Drops null / empty / -1 values so the shipped JSON stays small. */
function compact(obj) {
  if (Array.isArray(obj)) return obj.map(compact);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const c = compact(v);
      if (c === null || c === undefined || c === -1 || c === '') continue;
      if (Array.isArray(c) && !c.length) continue;
      if (c && typeof c === 'object' && !Array.isArray(c) && !Object.keys(c).length) continue;
      out[k] = c;
    }
    return out;
  }
  return obj;
}

/** Layout fields keep only the variants where the column is shown: { "1": { order, len, dec, space, groups } }. */
function compactLayouts(all) {
  const out = {};
  for (const [rpt, modes] of Object.entries(all)) {
    out[rpt] = {};
    for (const [mode, fields] of Object.entries(modes)) {
      out[rpt][mode] = fields.map((f) => {
        const variants = {};
        f.variants.forEach((v, i) => {
          if (v.show) {
            variants[i + 1] = compact({
              order: v.order, len: v.len, dec: v.dec, space: v.space, groups: v.groups.filter(Boolean),
            });
          }
        });
        return compact({
          field: f.field, caption: f.caption, kind: f.kind, total: f.total || undefined, len: f.len, dec: f.dec, variants,
        });
      });
    }
  }
  return out;
}
const formsOut = {};
fs.mkdirSync(OUT_SPEC, { recursive: true });
for (const name of [...usedForms].sort()) {
  const f = byName[name];
  formsOut[name] = {
    title: f.title,
    runtimeTitle: f.rtTitle,
    width: f.w,
    height: f.h,
    back: f.back,
    fore: f.fore,
    font: f.font,
    controls: f.controls
      .filter((c) => !/ToolTip|ErrorProvider|Timer|ContextMenu|ImageList|BindingSource|DataSet|PrintDocument|Dialog/.test(c.type))
      .map((c) => ({
        name: c.name, type: c.type, text: c.text, parent: c.parent, x: c.x, y: c.y, w: c.w, h: c.h, tab: c.tab,
        visible: c.visible, checked: c.checked, enabled: c.enabled, items: c.items, runtime: c.rt,
        back: c.back, fore: c.fore, font: c.font, dock: c.dock, checkBoxes: c.checkBoxes,
      }))
      .map(compact),
    layouts: [...new Set(Object.values(f.methods || {}).flat().map((s) => s.replace(/^RPT_NAME='(.*)'$/, '$1')).filter((s) => layoutNames.has(s)))],
  };
  fs.writeFileSync(path.join(OUT_SPEC, `${name}.json`), `${JSON.stringify({ form: name, title: f.title, methods: f.methods }, null, 1)}\n`);
}

fs.mkdirSync(OUT_FE, { recursive: true });
fs.writeFileSync(path.join(OUT_FE, 'menu.json'), `${JSON.stringify(menu, null, 1)}\n`);
fs.writeFileSync(path.join(OUT_FE, 'forms.json'), `${JSON.stringify(formsOut)}\n`);
fs.writeFileSync(path.join(OUT_FE, 'layouts.json'), `${JSON.stringify(compactLayouts(layouts))}\n`);

const count = (nodes) => nodes.reduce((t, n) => t + (n.form ? 1 : 0) + (n.items ? count(n.items) : 0), 0);
console.log(`menu: ${count(menu)} report entries; forms: ${Object.keys(formsOut).length}; layouts: ${Object.keys(layouts).length}`);
