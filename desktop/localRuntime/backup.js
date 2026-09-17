'use strict';

/**
 * Zip / restore userData for standalone desktop backups.
 * Prefer system tar/PowerShell Compress-Archive when available; otherwise naive file copy listing.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { windowsHide: true, ...opts });
    let err = '';
    p.stderr?.on('data', (d) => {
      err += String(d);
    });
    p.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(err || `${cmd} exited ${code}`));
    });
  });
}

async function zipUserData(userData, outZip) {
  fs.mkdirSync(path.dirname(outZip), { recursive: true });
  if (process.platform === 'win32') {
    const ps = `
      $src = ${JSON.stringify(userData)};
      $dst = ${JSON.stringify(outZip)};
      if (Test-Path $dst) { Remove-Item $dst -Force }
      Compress-Archive -Path (Join-Path $src '*') -DestinationPath $dst -Force
    `;
    await run('powershell.exe', ['-NoProfile', '-Command', ps]);
    return outZip;
  }
  await run('tar', ['-a', '-cf', outZip, '-C', userData, '.']);
  return outZip;
}

async function restoreUserDataZip(zipPath, userData) {
  if (!fs.existsSync(zipPath)) throw new Error('Backup zip not found');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const bak = `${userData}.pre-restore-${stamp}`;
  if (fs.existsSync(userData)) {
    fs.renameSync(userData, bak);
  }
  fs.mkdirSync(userData, { recursive: true });
  if (process.platform === 'win32') {
    const ps = `
      Expand-Archive -Path ${JSON.stringify(zipPath)} -DestinationPath ${JSON.stringify(userData)} -Force
    `;
    await run('powershell.exe', ['-NoProfile', '-Command', ps]);
    return { restoredTo: userData, previous: bak };
  }
  await run('tar', ['-xf', zipPath, '-C', userData]);
  return { restoredTo: userData, previous: bak };
}

module.exports = { zipUserData, restoreUserDataZip };
