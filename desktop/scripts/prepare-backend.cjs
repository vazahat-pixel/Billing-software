/**
 * Copy backend (minus heavy caches) into desktop/resources/backend for electron-builder.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const src = path.join(root, 'backend');
const dest = path.join(__dirname, '..', 'resources', 'backend');

function copyRecursive(from, to, skip = new Set()) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    if (skip.has(name)) continue;
    const s = path.join(from, name);
    const d = path.join(to, name);
    const st = fs.statSync(s);
    if (st.isDirectory()) copyRecursive(s, d, skip);
    else fs.copyFileSync(s, d);
  }
}

if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true, force: true });
}

copyRecursive(src, dest, new Set(['.env', 'test_output.txt', 'coverage', '.nyc_output']));
console.log('Copied backend →', dest);
