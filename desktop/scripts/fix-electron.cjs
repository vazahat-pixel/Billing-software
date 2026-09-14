const extract = require('extract-zip');
const fs = require('fs');
const path = require('path');
const { downloadArtifact } = require('@electron/get');

const root = path.join(__dirname, '..');
const electronDir = path.join(root, 'node_modules', 'electron');
const dist = path.join(electronDir, 'dist');
const version = require(path.join(electronDir, 'package.json')).version;

(async () => {
  console.log('Downloading electron', version, process.platform, process.arch);
  const zipPath = await downloadArtifact({
    version,
    artifactName: 'electron',
    force: true,
    platform: process.platform,
    arch: process.arch,
  });
  console.log('Zip:', zipPath);
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });
  await extract(zipPath, { dir: dist });
  fs.writeFileSync(path.join(electronDir, 'path.txt'), 'electron.exe');
  const exe = path.join(dist, 'electron.exe');
  console.log('electron.exe exists:', fs.existsSync(exe));
  if (!fs.existsSync(exe)) process.exit(1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
