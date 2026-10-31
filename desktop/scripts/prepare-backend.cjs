/**
 * Copy backend into desktop/resources/backend for electron-builder.
 * ALLOWLIST ONLY — only explicitly named directories and files are copied.
 * Any file that must never be packaged (api.js, .env, backups/, data/, etc.)
 * is excluded by construction rather than by a blocklist.
 * A post-copy security gate aborts the build if api.js or .env appear anyway.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const src = path.join(root, 'backend');
const dest = path.join(__dirname, '..', 'resources', 'backend');

// Only these directories are safe to ship. Any new directory added to the backend
// must be explicitly reviewed and added here before it will be included in a build.
const ALLOWED_DIRS = new Set([
  'config',
  'constants',
  'controllers',
  'events',
  'middlewares',
  'models',
  'public',          // downloads/ sub-dir stripped below
  'repositories',
  'routes',
  'services',
  'socket',
  'utils',
  'validators',
]);

// Only these root-level files are shipped. Nothing else at the backend root is included.
const ALLOWED_ROOT_FILES = new Set([
  'server.js',
  'package.json',
  'package-lock.json',
]);

// These sub-paths (relative to dest) must NEVER appear — build fails immediately if they do.
const FORBIDDEN_PATTERNS = [
  'api.js',
  '.env',
  '.env.production',
  '.env.local',
  'backups',
  'data',
  'node_modules' + path.sep + '.cache',  // cache dirs only; node_modules itself is installed fresh
];

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    const s = path.join(from, name);
    const d = path.join(to, name);
    if (fs.statSync(s).isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

// ── Fresh destination ──────────────────────────────────────────────────────────
if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true, force: true });
}
fs.mkdirSync(dest, { recursive: true });

// ── Copy allowlisted directories ───────────────────────────────────────────────
for (const dirName of ALLOWED_DIRS) {
  const s = path.join(src, dirName);
  if (!fs.existsSync(s)) {
    console.log(`  skip (missing): backend/${dirName}`);
    continue;
  }
  copyDir(s, path.join(dest, dirName));
  console.log(`  copied: backend/${dirName}/`);
}

// ── Copy allowlisted root files ────────────────────────────────────────────────
for (const fileName of ALLOWED_ROOT_FILES) {
  const s = path.join(src, fileName);
  if (!fs.existsSync(s)) {
    console.log(`  skip (missing): backend/${fileName}`);
    continue;
  }
  fs.copyFileSync(s, path.join(dest, fileName));
  console.log(`  copied: backend/${fileName}`);
}

// ── Strip public/downloads (large binaries, not needed at runtime) ─────────────
const bundledDownloads = path.join(dest, 'public', 'downloads');
if (fs.existsSync(bundledDownloads)) {
  fs.rmSync(bundledDownloads, { recursive: true, force: true });
  console.log('  stripped: backend/public/downloads/');
}

// ── Security gate — abort if any forbidden path crept in ──────────────────────
function walkAndCheck(dir, relBase) {
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const rel = relBase ? `${relBase}/${name}` : name;
    for (const pat of FORBIDDEN_PATTERNS) {
      if (name === pat || rel === pat || rel.startsWith(pat + '/')) {
        console.error(`\n❌  SECURITY GATE: forbidden path found in bundled backend: ${abs}`);
        console.error('    This must not be shipped. Fix the allowlist and rebuild.\n');
        process.exit(2);
      }
    }
    if (fs.statSync(abs).isDirectory()) walkAndCheck(abs, rel);
  }
}
walkAndCheck(dest, '');

// ── Install production dependencies into the bundled backend ──────────────────
// node_modules must be present so the spawned Express process can run offline.
// We use --omit=dev so only runtime packages are installed (~half the size).
const { execFileSync } = require('child_process');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
console.log('\nInstalling production backend dependencies (npm install --omit=dev)...');
execFileSync(npmCmd, ['install', '--omit=dev'], {
  cwd: dest,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

// Gate again after npm install — malicious postinstall scripts are rare but not impossible.
walkAndCheck(dest, '');

console.log('\nBackend ready at', dest, '(allowlist-only, prod deps installed, security gate passed)');
