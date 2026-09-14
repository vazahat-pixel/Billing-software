/**
 * Build the React UI into desktop/renderer for Electron packaging.
 * Usage: node scripts/build-ui.cjs
 * Optional: ERP_API_URL=https://api.example.com/api node scripts/build-ui.cjs
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const desktopRoot = path.join(__dirname, '..');
const frontendRoot = path.join(desktopRoot, '..', 'frontend');

const env = {
  ...process.env,
  VITE_DESKTOP: '1',
  VITE_API_URL: process.env.ERP_API_URL || process.env.VITE_API_URL || '',
};

console.log('[desktop] Building frontend for Electron…');
console.log('[desktop] VITE_DESKTOP=1 outDir=desktop/renderer');
if (env.VITE_API_URL) {
  console.log('[desktop] Bake-time API:', env.VITE_API_URL);
} else {
  console.log('[desktop] No bake-time API — runtime config.json will be used');
}

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npmCmd, ['run', 'build'], {
  cwd: frontendRoot,
  env,
  stdio: 'inherit',
  shell: true,
});

if (result.status !== 0) {
  console.error('[desktop] Frontend build failed');
  process.exit(result.status || 1);
}

const indexHtml = path.join(desktopRoot, 'renderer', 'index.html');
if (!fs.existsSync(indexHtml)) {
  console.error('[desktop] Missing renderer/index.html after build');
  process.exit(1);
}

console.log('[desktop] UI ready at desktop/renderer');
