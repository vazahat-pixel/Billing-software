/**
 * Sync the built installer from desktop/dist to backend and frontend download paths, and stage the
 * auto-update feed (latest.yml + installer + blockmap) in frontend/public/downloads/updates.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const { version } = require('../package.json');
const exeName = `TextileERP-Setup-${version}.exe`;
const dist = path.join(__dirname, '..', 'dist');
const src = path.join(dist, exeName);

if (!fs.existsSync(src)) {
  console.error('[sync-installer] Source installer not found:', src);
  process.exit(1);
}

const copies = [
  [src, path.join(root, 'backend', 'public', 'downloads', 'BillingSoftware-Setup.exe')],
  [src, path.join(root, 'frontend', 'public', 'downloads', 'BillingSoftware-Setup.exe')],
  [src, path.join(root, 'frontend', 'dist', 'downloads', 'BillingSoftware-Setup.exe')],
  // Auto-update feed: electron-updater reads latest.yml, then fetches the installer it names.
  [path.join(dist, 'latest.yml'), path.join(root, 'frontend', 'public', 'downloads', 'updates', 'latest.yml')],
  [src, path.join(root, 'frontend', 'public', 'downloads', 'updates', exeName)],
  [`${src}.blockmap`, path.join(root, 'frontend', 'public', 'downloads', 'updates', `${exeName}.blockmap`)],
];

const stat = fs.statSync(src);
console.log(`[sync-installer] Distributing ${exeName} (${(stat.size / (1024 * 1024)).toFixed(1)} MB)...`);

for (const [from, target] of copies) {
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(from, target);
    console.log(`  ✓ Synced -> ${path.relative(root, target)}`);
  } catch (err) {
    console.warn(`  ✗ Failed to sync -> ${path.relative(root, target)}:`, err.message);
  }
}

console.log('[sync-installer] Done.');
