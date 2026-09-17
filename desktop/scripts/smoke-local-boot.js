/**
 * Smoke: boot local stack → provisioning activate → login → basic ERP.
 * Usage (from desktop/): node scripts/smoke-local-boot.js
 */
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

async function main() {
  const live = process.env.SMOKE_LIVE_URL;
  if (live && process.env.SMOKE_LEGACY_REGISTER === 'true') {
    process.chdir(path.join(__dirname, '..', '..', 'backend'));
    require(path.join(__dirname, '..', '..', 'backend', 'scripts', 'goLiveSmoke.js'));
    return;
  }
  if (live) {
    process.chdir(path.join(__dirname, '..', '..', 'backend'));
    process.env.SMOKE_LIVE_URL = live;
    require(path.join(__dirname, '..', '..', 'backend', 'scripts', 'desktopActivationSmoke.js'));
    return;
  }

  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'textile-erp-smoke-'));
  const desktopRoot = path.join(__dirname, '..');
  console.log('Booting local stack in', userData);

  const { bootLocalStack, shutdownLocalStack } = require('../localRuntime');
  let stack;
  try {
    stack = await bootLocalStack({
      userData,
      desktopRoot,
      resourcesPath: path.join(desktopRoot, 'resources'),
      isPackaged: false,
    });
    console.log('API:', stack.apiBaseUrl);
    console.log('MONGO:', stack.mongoUri || '(from stack)');

    const jwtSecret =
      (fs.existsSync(path.join(userData, 'jwt.secret')) &&
        fs.readFileSync(path.join(userData, 'jwt.secret'), 'utf8').trim()) ||
      'desktop-local-jwt-secret-change-me-32chars!!';

    const { spawnSync } = require('child_process');
    const r = spawnSync(
      process.execPath,
      [path.join(__dirname, '..', '..', 'backend', 'scripts', 'desktopActivationSmoke.js')],
      {
        env: {
          ...process.env,
          SMOKE_LIVE_URL: stack.apiBaseUrl,
          DESKTOP_LOCAL: 'true',
          MONGO_URI: stack.mongoUri || process.env.MONGO_URI,
          JWT_SECRET: jwtSecret,
          PROVISIONING_PACK_SECRET: jwtSecret,
        },
        stdio: 'inherit',
        cwd: path.join(__dirname, '..', '..', 'backend'),
      }
    );
    await shutdownLocalStack();
    process.exit(r.status || 0);
  } catch (err) {
    console.error('smoke-local-boot failed:', err.message);
    try {
      await shutdownLocalStack();
    } catch {
      /* ignore */
    }
    process.exit(1);
  }
}

main();
