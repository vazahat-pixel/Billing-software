/**
 * Copy backend (minus heavy caches) into desktop/resources/backend for electron-builder.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const src = path.join(root, 'backend');
const dest = path.join(__dirname, '..', 'resources', 'backend');

const { execSync } = require('child_process');

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

if (process.platform === 'win32') {
  fs.mkdirSync(dest, { recursive: true });
  try {
    execSync(
      `robocopy "${src}" "${dest}" /E /XD tests performance coverage .nyc_output downloads /XF .env* *.log test_output.txt *.exe *.zip /NFL /NDL /NJH /NJS`,
      { stdio: 'inherit' }
    );
  } catch (err) {
    // Robocopy returns non-zero for successful copies (1 = files copied, 2 = extra files, 3 = both)
    if (err.status && err.status > 7) {
      console.error('Robocopy failed with exit code', err.status);
      process.exit(1);
    }
  }
} else {
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  copyRecursive(src, dest, new Set(['.env', 'test_output.txt', 'coverage', '.nyc_output', 'tests', 'performance', 'downloads']));
}

// Clean any accidental downloads directory in bundled backend
const bundledDownloads = path.join(dest, 'public', 'downloads');
if (fs.existsSync(bundledDownloads)) {
  fs.rmSync(bundledDownloads, { recursive: true, force: true });
}

console.log('Copied backend →', dest);

