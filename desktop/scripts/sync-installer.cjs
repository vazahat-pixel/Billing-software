/**
 * Sync the built installer from desktop/dist to backend and frontend download paths.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const src = path.join(__dirname, '..', 'dist', 'TextileERP-Setup-1.0.0.exe');

if (!fs.existsSync(src)) {
  console.error('[sync-installer] Source installer not found:', src);
  process.exit(1);
}

const targets = [
  path.join(root, 'backend', 'public', 'downloads', 'BillingSoftware-Setup.exe'),
  path.join(root, 'backend', 'public', 'downloads', 'TextileERP-Setup-1.0.0.exe'),
  path.join(root, 'frontend', 'public', 'downloads', 'BillingSoftware-Setup.exe'),
  path.join(root, 'frontend', 'public', 'downloads', 'TextileERP-Setup-1.0.0.exe'),
  path.join(root, 'frontend', 'dist', 'downloads', 'BillingSoftware-Setup.exe'),
  path.join(root, 'frontend', 'dist', 'downloads', 'TextileERP-Setup-1.0.0.exe'),
];

const stat = fs.statSync(src);
console.log(`[sync-installer] Distributing installer (${(stat.size / (1024 * 1024)).toFixed(1)} MB) to download targets...`);

for (const target of targets) {
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(src, target);
    console.log(`  ✓ Synced -> ${path.relative(root, target)}`);
  } catch (err) {
    console.warn(`  ✗ Failed to sync -> ${path.relative(root, target)}:`, err.message);
  }
}

console.log('[sync-installer] All targets updated successfully.');
