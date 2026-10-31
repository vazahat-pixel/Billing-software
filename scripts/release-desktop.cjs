#!/usr/bin/env node
/**
 * The desktop auto-updater (desktop/updater.js) has worked correctly since 1.0.1 — it reads
 * frontend/public/downloads/updates/latest.yml, which IS git-tracked (git log proves clean
 * "release: website + desktop X.X.X" commits for every version through 1.0.6, and again for
 * 1.0.7-1.0.9 — just on OTHER release branches that never got merged forward). The server
 * only ever shows whatever version is committed on the branch it actually deployed, so every
 * release where someone built the desktop installer locally but forgot the git add -f + commit
 * step (or the commit landed on a branch that was later abandoned) left already-installed
 * copies pointed at a stale feed forever — not because the mechanism is broken, but because
 * the binaries (correctly git-ignored by default, ~90MB each) never actually got force-added
 * and committed on the branch that reaches the server.
 *
 * This script is the one place that does the whole chain so that step can't be skipped again:
 * bump the desktop version, build the Windows installer (regenerates latest.yml), VERIFY the
 * regenerated feed actually names the new version (not a stale one some earlier step left
 * behind), build the web frontend, then git add -f the exact binary paths + commit. Vite's
 * build already copies public/downloads/** into dist/downloads/** on its own, so the existing
 * server routine (git fetch/reset, npm run build, copy dist to the webroot) is all that's left
 * — no scp, no separate upload step, same as it worked for 1.0.1 through 1.0.6.
 *
 * Usage:  node scripts/release-desktop.cjs 1.0.12 "short description of what changed"
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = __dirname.replace(/[\\/]scripts$/, '');
const version = process.argv[2];
const summary = process.argv[3] || '';

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Usage: node scripts/release-desktop.cjs <version> ["short description"]   e.g. node scripts/release-desktop.cjs 1.0.12 "fix GSTR-1"');
  process.exit(1);
}

const run = (cmd, args, cwd) => {
  console.log(`\n$ ${cmd} ${args.join(' ')}   (in ${path.relative(root, cwd)})`);
  execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
};

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

// 1. Bump desktop/package.json version (text replace — keeps exact formatting/field order).
const desktopPkgPath = path.join(root, 'desktop', 'package.json');
const desktopPkgRaw = fs.readFileSync(desktopPkgPath, 'utf8');
const before = desktopPkgRaw.match(/"version":\s*"([^"]+)"/)?.[1];
if (!before) throw new Error('Could not find "version" in desktop/package.json');
const desktopPkgNew = desktopPkgRaw.replace(/"version":\s*"[^"]+"/, `"version": "${version}"`);
fs.writeFileSync(desktopPkgPath, desktopPkgNew);
console.log(`desktop/package.json version: ${before} -> ${version}`);

// 2. Security gate — never release if something looks like the Oct-2026 injection pattern.
run('bash', ['scripts/ci/check-no-obfuscation.sh'], root);

// 3. Build the desktop installer. This step itself runs build:ui (bundles the React app into
//    desktop/renderer) then electron-builder (produces the NSIS installer + fresh latest.yml)
//    then sync:installer (copies installer+latest.yml+blockmap into frontend/public/downloads/).
run(npmCmd, ['run', 'dist:win'], path.join(root, 'desktop'));

// 4. Verify the regenerated update feed actually says the NEW version — this is exactly the
//    check that was missing before, and the reason a "successful" build silently changed nothing.
const latestYmlPath = path.join(root, 'frontend', 'public', 'downloads', 'updates', 'latest.yml');
const latestYml = fs.readFileSync(latestYmlPath, 'utf8');
const feedVersion = latestYml.match(/^version:\s*(\S+)/m)?.[1];
if (feedVersion !== version) {
  throw new Error(`latest.yml reports version ${feedVersion}, expected ${version} — the build did not produce what we think it did. STOP, do not deploy.`);
}
const exeName = `TextileERP-Setup-${version}.exe`;
const exePath = path.join(root, 'frontend', 'public', 'downloads', 'updates', exeName);
const exeStat = fs.statSync(exePath);
if (exeStat.size < 10 * 1024 * 1024) {
  throw new Error(`${exeName} is only ${exeStat.size} bytes — looks truncated/corrupt. STOP, do not deploy.`);
}
console.log(`\nVerified: latest.yml -> version ${feedVersion}, ${exeName} -> ${(exeStat.size / 1024 / 1024).toFixed(1)} MB`);

// 5. Build the web frontend (same as every other release in this project).
run(npmCmd, ['install'], path.join(root, 'frontend'));
run(npmCmd, ['run', 'build'], path.join(root, 'frontend'));

// 6. git add -f the exact binary paths (gitignored by default — force is required and
//    intentional here) plus the version bump and release notes. This is the step every prior
//    desktop release after 1.0.6 skipped or lost to a branch that never merged forward.
const blockmapName = `${exeName}.blockmap`;
const addPaths = [
  'desktop/package.json',
  'desktop/assets/release-notes.md',
  'frontend/public/downloads/BillingSoftware-Setup.exe',
  `frontend/public/downloads/updates/latest.yml`,
  `frontend/public/downloads/updates/${exeName}`,
  `frontend/public/downloads/updates/${blockmapName}`,
];
run('git', ['add', '-f', ...addPaths], root);
run('git', ['add', 'frontend/dist'], root);

const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root }).toString().trim();
const commitMsg = `release: website + desktop ${version}${summary ? ` — ${summary}` : ''}`;
run('git', ['commit', '-m', commitMsg], root);
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim();

console.log(`
========================================================================
Committed locally on branch "${branch}" as ${sha}:
  ${commitMsg}

This commit now carries the ${exeName} binary + the refreshed latest.yml (both force-added,
since they're gitignored by default) along with the web build. Nothing has been pushed.

When you say so:
  git push origin ${branch}

Then on the server, the exact same routine as every other release — no scp, no separate
upload step:
  cd /opt/Billing-software && git fetch origin && git reset --hard ${sha}
  cd frontend && npm install && npm run build && cp -r dist/* /var/www/billing-frontend/
  pm2 restart all

Vite's build copies public/downloads/** into dist/downloads/** on its own, so that cp carries
latest.yml + the installer straight to where nginx serves app.dealingindia.com from. Confirm with:
  curl -s https://app.dealingindia.com/downloads/updates/latest.yml | head -3

Already-installed desktop copies auto-check every 30 minutes (and on launch); once that curl
shows v${version}, they download it in the background and show "Update ready — Restart now" —
no manual reinstall. Help > Check for updates forces it immediately on a running copy.
========================================================================
`);
