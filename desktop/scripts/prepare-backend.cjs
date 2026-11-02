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

/**
 * Paths, relative to the bundled backend root, that must never ship. Checked as exact paths (a
 * directory also covers everything under it) — NOT as file names at any depth: the Oct-2026
 * injection was a loader at the backend root called api.js, while plenty of legitimate npm
 * packages contain their own api.js (razorpay/dist/api.js, for one). A name-based match flagged
 * those and blocked every build.
 *
 * Installed dependencies are not walked: they come from package-lock.json, and our own source is
 * what an attacker would plant a loader in. Obfuscated code in tracked files is caught separately
 * by scripts/ci/check-no-obfuscation.sh.
 */
const FORBIDDEN_PATHS = [
  'api.js',
  '.env',
  '.env.production',
  '.env.local',
  'backups',
  'data',
  'scratch',
  'developer',
  'qa',
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
function securityGate() {
  const bad = [];
  for (const rel of FORBIDDEN_PATHS) {
    const abs = path.join(dest, rel);
    if (fs.existsSync(abs)) bad.push(abs);
  }
  // Our own source must not contain a planted loader at any depth either; dependencies are skipped.
  const walk = (dir, relBase) => {
    for (const name of fs.readdirSync(dir)) {
      if (name === 'node_modules') continue;
      const abs = path.join(dir, name);
      const rel = relBase ? `${relBase}/${name}` : name;
      if (fs.statSync(abs).isDirectory()) walk(abs, rel);
      else if (name === 'api.js' || name.startsWith('.env')) bad.push(abs);
    }
  };
  walk(dest, '');

  if (bad.length) {
    console.error('\n❌  SECURITY GATE: these must not be shipped:');
    for (const b of bad) console.error(`      ${b}`);
    console.error('    Fix the allowlist (desktop/scripts/prepare-backend.cjs) and rebuild.\n');
    process.exit(2);
  }
}
securityGate();

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

// Gate again after npm install — a postinstall script must not plant anything in our source.
securityGate();

console.log('\nBackend ready at', dest, '(allowlist-only, prod deps installed, security gate passed)');
