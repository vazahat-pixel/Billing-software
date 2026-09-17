/**
 * Download MongoDB Community Windows x64 binaries into desktop/vendor/mongodb.
 * Run once before packaging: node desktop/scripts/fetch-mongodb.cjs
 *
 * Licence: MongoDB Community is SSPL — see https://www.mongodb.com/licensing/server-side-public-license
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const VERSION = process.env.MONGODB_VERSION || '7.0.14';
const OUT = path.join(__dirname, '..', 'vendor', 'mongodb');
const ZIP_NAME = `mongodb-windows-x86_64-${VERSION}.zip`;
const URL = `https://fastdl.mongodb.org/windows/${ZIP_NAME}`;

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(dest);
          return download(res.headers.location, dest).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve(dest)));
      })
      .on('error', reject);
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const zipPath = path.join(OUT, ZIP_NAME);
  const binDir = path.join(OUT, 'bin');
  if (fs.existsSync(path.join(binDir, 'mongod.exe'))) {
    console.log('mongod.exe already present at', binDir);
    return;
  }

  console.log('Downloading', URL);
  await download(URL, zipPath);
  console.log('Extracting…');
  const expand = `
    Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${OUT.replace(/'/g, "''")}' -Force
  `;
  execSync(`powershell.exe -NoProfile -Command "${expand.replace(/\n/g, ' ')}"`, { stdio: 'inherit' });

  // Flatten: find mongod.exe and copy bin/*
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        const hit = walk(p);
        if (hit) return hit;
      } else if (e.name === 'mongod.exe') {
        return path.dirname(p);
      }
    }
    return null;
  };
  const foundBin = walk(OUT);
  if (!foundBin) throw new Error('mongod.exe not found after extract');
  fs.mkdirSync(binDir, { recursive: true });
  for (const f of fs.readdirSync(foundBin)) {
    const src = path.join(foundBin, f);
    if (fs.statSync(src).isFile()) {
      fs.copyFileSync(src, path.join(binDir, f));
    }
  }
  fs.writeFileSync(
    path.join(OUT, 'LICENSE-NOTICE.txt'),
    `MongoDB Community ${VERSION} — Server Side Public License (SSPL).\nDownloaded from ${URL}\n`
  );
  console.log('Ready:', path.join(binDir, 'mongod.exe'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
